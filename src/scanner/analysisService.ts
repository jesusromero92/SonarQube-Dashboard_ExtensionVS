import { Dirent, promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { detectScanner } from './detector';
import { ProcessRunner } from './processRunner';
import {
  AnalysisRequest,
  AnalysisState,
  DetectedScanner,
  ProcessSpec,
  SonarCeTaskResponse
} from './types';

const MAX_LOG_LINES = 1200;
const CE_POLL_INTERVAL_MS = 2000;
const CE_POLL_TIMEOUT_MS = 5 * 60 * 1000;
const DOCKER_SCAN_TIMEOUT_MS = 30 * 60 * 1000;
const DOCKER_HEARTBEAT_MS = 15 * 1000;
const DOCKER_CACHE_VOLUME = 'sonarqube-dashboard-scanner-cache';
const DEFAULT_EXCLUSIONS = [
  '**/.git/**',
  '**/.scannerwork/**',
  '**/.sonarqube/**',
  '**/bin/**',
  '**/build/**',
  '**/coverage/**',
  '**/dist/**',
  '**/node_modules/**',
  '**/obj/**',
  '**/target/**'
].join(',');

export class AnalysisService implements vscode.Disposable {
  private readonly runner = new ProcessRunner();
  private controller: AbortController | undefined;
  private state: AnalysisState = emptyAnalysisState();
  private detectedScanner: DetectedScanner | undefined;
  private token = '';

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onStateChanged: (state: AnalysisState) => void
  ) {}

  getState(): AnalysisState {
    return cloneState(this.state);
  }

  isRunning(): boolean {
    return this.state.running;
  }

  async analyze(request: AnalysisRequest): Promise<void> {
    if (this.isRunning()) {
      throw new Error('Ya hay un análisis de SonarQube en ejecución.');
    }

    this.controller = new AbortController();
    this.token = request.config.token;
    this.state = {
      running: true,
      phase: 'detecting',
      message: 'Detectando el tipo de proyecto…',
      scanner: '',
      startedAt: new Date().toISOString(),
      canCancel: true,
      log: []
    };
    this.emit();

    try {
      this.detectedScanner = await detectScanner(
        request.rootPath,
        request.config.scannerMode ?? 'auto'
      );
      this.update('detecting', `Scanner seleccionado: ${this.detectedScanner.label}`, this.detectedScanner.label);
      this.appendLog(`Proyecto detectado mediante ${this.detectedScanner.evidence}.`);

      await this.runScanner(this.detectedScanner, request);
      this.ensureNotCancelled();

      this.update('processing', 'Esperando a que SonarQube procese el informe…');
      const ceTaskUrl = await this.findCeTaskUrl(this.detectedScanner.rootPath);
      if (ceTaskUrl) {
        await this.waitForCeTask(ceTaskUrl, request.config.token, this.controller.signal);
      } else {
        this.appendLog(
          'No se encontró report-task.txt; se comprobará la aparición del nuevo análisis en SonarQube.'
        );
        await this.waitForProjectAnalysis(request, this.controller.signal);
      }

      this.ensureNotCancelled();
      this.state = {
        ...this.state,
        running: false,
        phase: 'success',
        message: 'Análisis completado y procesado por SonarQube.',
        completedAt: new Date().toISOString(),
        canCancel: false
      };
      this.appendLog('Análisis finalizado correctamente.');
      this.emit();
    } catch (error) {
      const cancelled = this.controller?.signal.aborted;
      this.state = {
        ...this.state,
        running: false,
        phase: cancelled ? 'cancelled' : 'error',
        message: cancelled ? 'Análisis cancelado.' : errorMessage(error),
        completedAt: new Date().toISOString(),
        canCancel: false
      };
      this.appendLog(cancelled ? 'El análisis fue cancelado por el usuario.' : `ERROR: ${errorMessage(error)}`);
      this.emit();
      throw error;
    } finally {
      this.controller = undefined;
      this.token = '';
    }
  }

  setRefreshing(): void {
    this.state = {
      ...this.state,
      running: true,
      phase: 'refreshing',
      message: 'Actualizando Problems y los datos del dashboard…',
      canCancel: false
    };
    this.emit();
  }

  setRefreshCompleted(message: string): void {
    this.state = {
      ...this.state,
      running: false,
      phase: 'success',
      message,
      completedAt: new Date().toISOString(),
      canCancel: false
    };
    this.appendLog(message);
    this.emit();
  }

  setRefreshError(message: string): void {
    this.state = {
      ...this.state,
      running: false,
      phase: 'error',
      message,
      completedAt: new Date().toISOString(),
      canCancel: false
    };
    this.appendLog(`ERROR: ${message}`);
    this.emit();
  }

  cancel(): void {
    this.controller?.abort();
    this.runner.cancel();
  }

  dispose(): void {
    this.cancel();
  }

  private async runScanner(scanner: DetectedScanner, request: AnalysisRequest): Promise<void> {
    switch (scanner.kind) {
      case 'dotnet':
        await this.runDotnet(scanner, request);
        break;
      case 'maven':
        await this.runMaven(scanner, request);
        break;
      case 'gradle':
        await this.runGradle(scanner, request);
        break;
      case 'docker':
        await this.runDocker(scanner, request);
        break;
      case 'custom':
        await this.runCustom(scanner, request);
        break;
      default:
        await this.runGenericNpm(scanner, request);
        break;
    }
  }

  private async runMaven(scanner: DetectedScanner, request: AnalysisRequest): Promise<void> {
    const wrapper = process.platform === 'win32'
      ? path.join(scanner.rootPath, 'mvnw.cmd')
      : path.join(scanner.rootPath, 'mvnw');
    const command = await exists(wrapper)
      ? wrapper
      : process.platform === 'win32' ? 'mvn.cmd' : 'mvn';
    const args = [
      'clean',
      'verify',
      'org.sonarsource.scanner.maven:sonar-maven-plugin:sonar',
      '-DskipTests',
      ...this.sonarProperties(request, '-D')
    ];

    this.update('building', 'Compilando y analizando el proyecto Maven…');
    await this.execute({
      command: process.platform !== 'win32' && command === wrapper ? '/bin/sh' : command,
      args: process.platform !== 'win32' && command === wrapper ? [wrapper, ...args] : args,
      cwd: scanner.rootPath,
      env: this.sonarEnvironment(request),
      displayCommand: `${path.basename(command)} clean verify … sonar`
    });
  }

  private async runGradle(scanner: DetectedScanner, request: AnalysisRequest): Promise<void> {
    const wrapper = process.platform === 'win32'
      ? path.join(scanner.rootPath, 'gradlew.bat')
      : path.join(scanner.rootPath, 'gradlew');
    const command = await exists(wrapper)
      ? wrapper
      : process.platform === 'win32' ? 'gradle.bat' : 'gradle';
    const launchCommand = process.platform !== 'win32' && command === wrapper ? '/bin/sh' : command;
    const prefixArgs = process.platform !== 'win32' && command === wrapper ? [wrapper] : [];

    if (scanner.gradleSonarConfigured) {
      this.update('building', 'Compilando y analizando el proyecto Gradle…');
      await this.execute({
        command: launchCommand,
        args: [...prefixArgs, 'clean', 'build', 'sonar', '-x', 'test', ...this.sonarProperties(request, '-D')],
        cwd: scanner.rootPath,
        env: this.sonarEnvironment(request),
        displayCommand: `${path.basename(command)} clean build sonar -x test`
      });
      return;
    }

    this.appendLog('El plugin de SonarQube no está configurado en Gradle. Se compilará y se usará el scanner genérico.');
    this.update('building', 'Compilando el proyecto Gradle…');
    await this.execute({
      command: launchCommand,
      args: [...prefixArgs, 'clean', 'build', '-x', 'test'],
      cwd: scanner.rootPath,
      env: process.env,
      displayCommand: `${path.basename(command)} clean build -x test`
    });
    await this.runGenericNpm(scanner, request, await findJavaBinaryDirectories(scanner.rootPath));
  }

  private async runDotnet(scanner: DetectedScanner, request: AnalysisRequest): Promise<void> {
    if (!scanner.buildTarget) {
      throw new Error('No se encontró ningún archivo .sln, .csproj, .vbproj o .fsproj para compilar.');
    }

    await this.assertCommand('dotnet', ['--info'], scanner.rootPath, 'No se encontró el SDK de .NET en PATH.');
    const scannerExecutable = await this.ensureDotnetScanner(scanner.rootPath);
    const tokenProperty = `/d:sonar.token=${request.config.token}`;
    const beginArgs = [
      'begin',
      `/k:${request.config.projectKey}`,
      `/n:${request.config.projectName || request.config.projectKey}`,
      `/d:sonar.host.url=${request.config.serverUrl}`,
      tokenProperty
    ];
    if (request.config.branch?.trim()) {
      beginArgs.push(`/d:sonar.branch.name=${request.config.branch.trim()}`);
    }

    this.update('scanning', 'Preparando SonarScanner for .NET…');
    await this.execute({
      command: scannerExecutable,
      args: beginArgs,
      cwd: scanner.rootPath,
      env: this.sonarEnvironment(request),
      displayCommand: `dotnet-sonarscanner begin /k:${request.config.projectKey} /d:sonar.token=********`
    });

    this.update('building', 'Compilando la solución .NET…');
    if (request.config.buildCommand?.trim()) {
      await this.execute({
        command: '',
        args: [],
        cwd: scanner.rootPath,
        env: this.sonarEnvironment(request),
        shellCommand: request.config.buildCommand.trim(),
        displayCommand: request.config.buildCommand.trim()
      });
    } else {
      await this.execute({
        command: 'dotnet',
        args: ['build', scanner.buildTarget, '--no-incremental'],
        cwd: scanner.rootPath,
        env: this.sonarEnvironment(request),
        displayCommand: `dotnet build ${path.basename(scanner.buildTarget)} --no-incremental`
      });
    }

    this.update('scanning', 'Publicando el análisis .NET en SonarQube…');
    await this.execute({
      command: scannerExecutable,
      args: ['end', tokenProperty],
      cwd: scanner.rootPath,
      env: this.sonarEnvironment(request),
      displayCommand: 'dotnet-sonarscanner end /d:sonar.token=********'
    });
  }

  private async runGenericNpm(
    scanner: DetectedScanner,
    request: AnalysisRequest,
    javaBinaryDirectories: string[] = []
  ): Promise<void> {
    if (request.config.buildCommand?.trim()) {
      this.update('building', 'Ejecutando el comando de compilación configurado…');
      await this.execute({
        command: '',
        args: [],
        cwd: scanner.rootPath,
        env: this.sonarEnvironment(request),
        shellCommand: request.config.buildCommand.trim(),
        displayCommand: request.config.buildCommand.trim()
      });
    }

    const hasProperties = await exists(path.join(scanner.rootPath, 'sonar-project.properties'));
    const args = ['--yes', '@sonar/scan', ...this.sonarProperties(request, '-D')];
    if (!hasProperties) {
      args.push('-Dsonar.sources=.');
      args.push(`-Dsonar.exclusions=${DEFAULT_EXCLUSIONS}`);
    }
    if (javaBinaryDirectories.length > 0) {
      args.push(`-Dsonar.java.binaries=${javaBinaryDirectories.join(',')}`);
    }

    this.update('scanning', 'Analizando el repositorio con SonarScanner genérico…');
    try {
      await this.execute({
        command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
        args,
        cwd: scanner.rootPath,
        env: this.sonarEnvironment(request),
        displayCommand: `npx @sonar/scan -Dsonar.projectKey=${request.config.projectKey}`
      });
    } catch (error) {
      const message = errorMessage(error);
      const missingNpm = /No se encontró la herramienta|ENOENT|not found|no se reconoce/i.test(message);
      if (request.config.scannerMode === 'npm' || !missingNpm) {
        throw error;
      }
      this.appendLog('No se encontró NPM/NPX. Se intentará el scanner Docker como alternativa.');
      await this.runDocker(
        { ...scanner, kind: 'docker', label: 'SonarScanner CLI en Docker' },
        request
      );
    }
  }

  private async runDocker(scanner: DetectedScanner, request: AnalysisRequest): Promise<void> {
    const volume = `${scanner.rootPath}:/usr/src`;
    const hasProperties = await exists(path.join(scanner.rootPath, 'sonar-project.properties'));
    const scannerArgs = [...this.sonarProperties(request, '-D')];
    if (!hasProperties) {
      scannerArgs.push('-Dsonar.sources=.');
      scannerArgs.push(`-Dsonar.exclusions=${DEFAULT_EXCLUSIONS}`);
    }
    scannerArgs.push('-Dsonar.scanner.skipJreProvisioning=true');
    scannerArgs.push('-Dsonar.working.directory=/usr/src/.scannerwork');
    const args = [
      'run', '--rm',
      '-e', 'SONAR_HOST_URL',
      '-e', 'SONAR_TOKEN',
      '-v', volume,
      '-v', `${DOCKER_CACHE_VOLUME}:/opt/sonar-scanner/.sonar/cache`,
      '-w', '/usr/src',
      'sonarsource/sonar-scanner-cli',
      ...scannerArgs
    ];

    this.update('scanning', 'Analizando el repositorio con SonarScanner en Docker…', 'SonarScanner CLI en Docker');
    this.appendLog(
      'La primera ejecución puede tardar mientras Docker descarga la imagen y SonarScanner almacena los analizadores.'
    );
    this.appendLog('Se utilizará el Java incluido en la imagen Docker, sin descargar otro JRE.');
    this.appendLog('La caché del scanner se conservará para acelerar los siguientes análisis.');
    const heartbeat = setInterval(() => {
      this.appendLog('SonarScanner continúa en ejecución; esperando nuevos datos del proceso…');
    }, DOCKER_HEARTBEAT_MS);
    try {
      await this.execute({
        command: 'docker',
        args,
        cwd: scanner.rootPath,
        env: this.sonarEnvironment(request),
        displayCommand: `docker run --rm … sonarsource/sonar-scanner-cli -Dsonar.projectKey=${request.config.projectKey}`,
        timeoutMs: DOCKER_SCAN_TIMEOUT_MS
      });
    } finally {
      clearInterval(heartbeat);
    }
  }

  private async runCustom(scanner: DetectedScanner, request: AnalysisRequest): Promise<void> {
    const template = request.config.customScannerCommand?.trim();
    if (!template) {
      throw new Error('Selecciona otro scanner o configura un comando personalizado.');
    }
    const command = template
      .replace(/\$\{workspaceFolder\}/g, scanner.rootPath)
      .replace(/\$\{projectKey\}/g, request.config.projectKey)
      .replace(/\$\{projectName\}/g, request.config.projectName || request.config.projectKey)
      .replace(/\$\{serverUrl\}/g, request.config.serverUrl)
      .replace(/\$\{branch\}/g, request.config.branch ?? '');

    this.update('scanning', 'Ejecutando el comando de análisis personalizado…');
    await this.execute({
      command: '',
      args: [],
      cwd: scanner.rootPath,
      env: this.sonarEnvironment(request),
      shellCommand: command,
      displayCommand: command
    });
  }

  private async ensureDotnetScanner(cwd: string): Promise<string> {
    const toolsDirectory = path.join(this.context.globalStorageUri.fsPath, 'scanner-tools', 'dotnet');
    await fs.mkdir(toolsDirectory, { recursive: true });
    const executable = path.join(
      toolsDirectory,
      process.platform === 'win32' ? 'dotnet-sonarscanner.exe' : 'dotnet-sonarscanner'
    );
    if (await exists(executable)) {
      return executable;
    }

    this.update('installing', 'Instalando SonarScanner for .NET en el almacenamiento de la extensión…');
    await this.execute({
      command: 'dotnet',
      args: ['tool', 'install', 'dotnet-sonarscanner', '--tool-path', toolsDirectory],
      cwd,
      env: process.env,
      displayCommand: 'dotnet tool install dotnet-sonarscanner --tool-path <almacenamiento-extension>'
    });
    if (!await exists(executable)) {
      throw new Error('SonarScanner for .NET se instaló, pero no se encontró el ejecutable.');
    }
    return executable;
  }

  private async assertCommand(
    command: string,
    args: string[],
    cwd: string,
    message: string
  ): Promise<void> {
    try {
      const result = await this.runner.run(
        { command, args, cwd, env: process.env },
        this.controller?.signal ?? AbortSignal.abort(),
        () => undefined
      );
      if (result.exitCode !== 0) {
        throw new Error(message);
      }
    } catch {
      throw new Error(message);
    }
  }

  private async execute(spec: ProcessSpec): Promise<void> {
    this.ensureNotCancelled();
    this.appendLog(`> ${this.redact(spec.displayCommand ?? [spec.command, ...spec.args].join(' '))}`);
    let result;
    try {
      result = await this.runner.run(
        spec,
        this.controller?.signal ?? AbortSignal.abort(),
        line => this.appendLog(line)
      );
    } catch (error) {
      if (this.controller?.signal.aborted) {
        throw new Error('Análisis cancelado.');
      }
      const message = errorMessage(error);
      if (/ENOENT|not found|no se reconoce/i.test(message)) {
        throw new Error(`No se encontró la herramienta necesaria para ejecutar “${spec.command || spec.shellCommand}”.`);
      }
      throw error;
    }
    if (result.exitCode !== 0) {
      const tail = result.output.slice(-8).join(' ');
      if (/not recognized|no se reconoce|not found|command not found/i.test(tail)) {
        throw new Error(`No se encontró la herramienta necesaria para ejecutar “${spec.command || spec.shellCommand}”.`);
      }
      throw new Error(`El proceso terminó con el código ${result.exitCode}. Revisa el registro del análisis.`);
    }
  }

  private sonarProperties(request: AnalysisRequest, prefix: '-D' | '/d:'): string[] {
    const values = [
      `${prefix}sonar.projectKey=${request.config.projectKey}`,
      `${prefix}sonar.projectName=${request.config.projectName || request.config.projectKey}`,
      `${prefix}sonar.host.url=${request.config.serverUrl}`
    ];
    if (request.config.branch?.trim()) {
      values.push(`${prefix}sonar.branch.name=${request.config.branch.trim()}`);
    }
    return values;
  }

  private sonarEnvironment(request: AnalysisRequest): NodeJS.ProcessEnv {
    return {
      ...process.env,
      SONAR_HOST_URL: request.config.serverUrl,
      SONAR_TOKEN: request.config.token
    };
  }

  private async findCeTaskUrl(rootPath: string): Promise<string | undefined> {
    const candidates = [
      path.join(rootPath, '.scannerwork', 'report-task.txt'),
      path.join(rootPath, '.sonarqube', 'out', '.sonar', 'report-task.txt'),
      path.join(rootPath, 'target', 'sonar', 'report-task.txt'),
      path.join(rootPath, 'build', 'sonar', 'report-task.txt')
    ];

    for (const candidate of candidates) {
      const url = await readCeTaskUrl(candidate);
      if (url) {
        this.appendLog(`Tarea de procesamiento detectada en ${path.relative(rootPath, candidate)}.`);
        return url;
      }
    }

    const discovered = await findFilesNamed(rootPath, 'report-task.txt', 5);
    for (const candidate of discovered) {
      const url = await readCeTaskUrl(candidate);
      if (url) {
        return url;
      }
    }
    return undefined;
  }

  private async waitForCeTask(url: string, token: string, signal: AbortSignal): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < CE_POLL_TIMEOUT_MS) {
      this.ensureNotCancelled();
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        },
        signal
      });
      if (!response.ok) {
        throw new Error(`SonarQube respondió ${response.status} al consultar el procesamiento del análisis.`);
      }
      const payload = await response.json() as SonarCeTaskResponse;
      const status = payload.task?.status?.toUpperCase() ?? 'UNKNOWN';
      this.appendLog(`Estado de procesamiento: ${status}.`);
      if (status === 'SUCCESS') {
        return;
      }
      if (status === 'FAILED' || status === 'CANCELED') {
        throw new Error(payload.task?.errorMessage || `La tarea de SonarQube terminó en estado ${status}.`);
      }
      await delay(CE_POLL_INTERVAL_MS, signal);
    }
    throw new Error('SonarQube no terminó de procesar el análisis dentro de 5 minutos.');
  }

  private async waitForProjectAnalysis(
    request: AnalysisRequest,
    signal: AbortSignal
  ): Promise<void> {
    const pollingStartedAt = Date.now();
    const analysisStartedAt = Date.parse(this.state.startedAt ?? '') - 5000;
    const serverUrl = request.config.serverUrl.replace(/\/+$/, '');
    while (Date.now() - pollingStartedAt < CE_POLL_TIMEOUT_MS) {
      this.ensureNotCancelled();
      const url = new URL(`${serverUrl}/api/project_analyses/search`);
      url.searchParams.set('project', request.config.projectKey);
      url.searchParams.set('ps', '1');
      if (request.config.branch?.trim()) {
        url.searchParams.set('branch', request.config.branch.trim());
      }
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${request.config.token}`
        },
        signal
      });
      if (!response.ok) {
        throw new Error(
          `SonarQube respondió ${response.status} al comprobar el nuevo análisis.`
        );
      }
      const payload = await response.json() as {
        analyses?: Array<{ date?: string }>;
      };
      const latestDate = Date.parse(payload.analyses?.[0]?.date ?? '');
      if (Number.isFinite(latestDate) && latestDate >= analysisStartedAt) {
        this.appendLog('El nuevo análisis ya está disponible en SonarQube.');
        return;
      }
      this.appendLog('SonarQube sigue procesando el informe…');
      await delay(CE_POLL_INTERVAL_MS, signal);
    }
    throw new Error('SonarQube no publicó el nuevo análisis dentro de 5 minutos.');
  }

  private update(phase: AnalysisState['phase'], message: string, scanner = this.state.scanner): void {
    this.state = { ...this.state, phase, message, scanner };
    this.emit();
  }

  private appendLog(line: string): void {
    const redacted = this.redact(line);
    this.state.log.push(redacted);
    if (this.state.log.length > MAX_LOG_LINES) {
      this.state.log.splice(0, this.state.log.length - MAX_LOG_LINES);
    }
    this.emit();
  }

  private redact(value: string): string {
    if (!this.token) {
      return value;
    }
    return value.split(this.token).join('********');
  }

  private emit(): void {
    this.onStateChanged(cloneState(this.state));
  }

  private ensureNotCancelled(): void {
    if (this.controller?.signal.aborted) {
      throw new Error('Análisis cancelado.');
    }
  }
}

export function emptyAnalysisState(): AnalysisState {
  return {
    running: false,
    phase: 'idle',
    message: 'Listo para analizar el repositorio.',
    scanner: '',
    canCancel: false,
    log: []
  };
}

function cloneState(state: AnalysisState): AnalysisState {
  return { ...state, log: [...state.log] };
}

async function exists(value: string): Promise<boolean> {
  try {
    await fs.access(value);
    return true;
  } catch {
    return false;
  }
}

async function readCeTaskUrl(file: string): Promise<string | undefined> {
  try {
    const content = await fs.readFile(file, 'utf8');
    const properties = new Map<string, string>(
      content
        .split(/\r?\n/)
        .map((line: string) => line.trim())
        .filter(Boolean)
        .map((line: string): [string, string] => {
          const separator = line.indexOf('=');
          return separator < 0 ? [line, ''] : [line.slice(0, separator), line.slice(separator + 1)];
        })
    );
    return properties.get('ceTaskUrl');
  } catch {
    return undefined;
  }
}

async function findFilesNamed(rootPath: string, fileName: string, maxDepth: number): Promise<string[]> {
  const result: string[] = [];
  const ignored = new Set(['.git', 'node_modules']);
  const visit = async (directory: string, depth: number): Promise<void> => {
    if (depth > maxDepth) {
      return;
    }
    let entries: Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory() && !ignored.has(entry.name)) {
        await visit(fullPath, depth + 1);
      } else if (entry.isFile() && entry.name === fileName) {
        result.push(fullPath);
      }
    }
  };
  await visit(rootPath, 0);
  return result;
}

async function findJavaBinaryDirectories(rootPath: string): Promise<string[]> {
  const directories: string[] = [];
  const candidates = await findDirectoriesNamed(rootPath, new Set(['classes', 'bin']), 6);
  for (const directory of candidates) {
    if (await containsFileWithExtension(directory, '.class', 3)) {
      directories.push(path.relative(rootPath, directory).replace(/\\/g, '/'));
    }
  }
  return directories;
}

async function findDirectoriesNamed(rootPath: string, names: Set<string>, maxDepth: number): Promise<string[]> {
  const result: string[] = [];
  const ignored = new Set(['.git', 'node_modules']);
  const visit = async (directory: string, depth: number): Promise<void> => {
    if (depth > maxDepth) return;
    let entries: Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || ignored.has(entry.name)) continue;
      const fullPath = path.join(directory, entry.name);
      if (names.has(entry.name)) result.push(fullPath);
      await visit(fullPath, depth + 1);
    }
  };
  await visit(rootPath, 0);
  return result;
}

async function containsFileWithExtension(directory: string, extension: string, maxDepth: number): Promise<boolean> {
  const visit = async (current: string, depth: number): Promise<boolean> => {
    if (depth > maxDepth) return false;
    let entries: Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const entry of entries) {
      if (entry.isFile() && path.extname(entry.name).toLowerCase() === extension) return true;
      if (entry.isDirectory() && await visit(path.join(current, entry.name), depth + 1)) return true;
    }
    return false;
  };
  return visit(directory, 0);
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('Análisis cancelado.'));
    }, { once: true });
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
