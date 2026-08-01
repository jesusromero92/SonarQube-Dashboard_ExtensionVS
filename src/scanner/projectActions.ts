import { Dirent, promises as fs } from 'node:fs';
import * as path from 'node:path';

export type ProjectIntegrationCategory = 'quality' | 'security';

export interface DetectedProjectIntegration {
  id: string;
  name: string;
  description: string;
  command: string;
  evidence: string;
  category: ProjectIntegrationCategory;
  failurePolicy: 'stop' | 'continue';
}

export interface DetectedProjectActions {
  buildCommand?: string;
  testCommand?: string;
  evidence?: string;
  integrations: DetectedProjectIntegration[];
}

interface PackageJsonShape {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

type PackageManager = 'npm' | 'pnpm' | 'yarn';

interface NodeProjectContext {
  packageJson: PackageJsonShape;
  packageManager: PackageManager;
}

export async function detectProjectActions(
  rootPath: string
): Promise<DetectedProjectActions> {
  const packageJsonPath = path.join(rootPath, 'package.json');
  const nodeContext = await readNodeProject(rootPath, packageJsonPath);
  let detected: Omit<DetectedProjectActions, 'integrations'> = {};

  if (nodeContext) {
    detected = detectNodeActions(nodeContext);
  }

  if (!detected.buildCommand && !detected.testCommand) {
    detected = await detectNonNodeActions(rootPath);
  }

  return {
    ...detected,
    integrations: await detectPredefinedIntegrations(rootPath, nodeContext)
  };
}

export async function detectPredefinedIntegrations(
  rootPath: string,
  providedNodeContext?: NodeProjectContext
): Promise<DetectedProjectIntegration[]> {
  const packageJsonPath = path.join(rootPath, 'package.json');
  const nodeContext = providedNodeContext ?? await readNodeProject(rootPath, packageJsonPath);
  const integrations: DetectedProjectIntegration[] = [];

  if (nodeContext) {
    const { packageJson, packageManager } = nodeContext;
    const scripts = packageJson.scripts ?? {};
    const dependencies = {
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {})
    };
    const lockFile = await firstExisting(rootPath, [
      'package-lock.json',
      'npm-shrinkwrap.json',
      'pnpm-lock.yaml',
      'yarn.lock'
    ]);

    if (lockFile) {
      integrations.push({
        id: 'dependency-audit',
        name: packageManager === 'npm' ? 'npm audit' : `${packageManager} audit`,
        description: 'Audita las dependencias conocidas del proyecto.',
        command: packageManager === 'npm'
          ? 'npm audit --audit-level=high'
          : packageManager === 'pnpm'
            ? 'pnpm audit --audit-level=high'
            : 'yarn audit --level high',
        evidence: lockFile,
        category: 'security',
        failurePolicy: 'continue'
      });
    }

    const lintScript = firstScript(scripts, ['lint', 'lint:ci', 'eslint']);
    const eslintConfig = await firstExisting(rootPath, [
      'eslint.config.js',
      'eslint.config.mjs',
      'eslint.config.cjs',
      '.eslintrc',
      '.eslintrc.js',
      '.eslintrc.cjs',
      '.eslintrc.json',
      '.eslintrc.yml',
      '.eslintrc.yaml'
    ]);
    if (lintScript || dependencies.eslint || eslintConfig) {
      integrations.push({
        id: 'eslint',
        name: 'ESLint',
        description: 'Ejecuta el análisis estático de JavaScript y TypeScript.',
        command: lintScript
          ? packageScriptCommand(packageManager, lintScript)
          : packageExecutableCommand(packageManager, 'eslint .'),
        evidence: lintScript ? `package.json#${lintScript}` : eslintConfig ?? 'package.json#eslint',
        category: 'quality',
        failurePolicy: 'stop'
      });
    }

    const semgrepScript = firstScript(scripts, ['semgrep', 'security:semgrep', 'scan:semgrep']);
    const semgrepConfig = await firstExisting(rootPath, [
      '.semgrep.yml',
      '.semgrep.yaml',
      'semgrep.yml',
      'semgrep.yaml'
    ]);
    if (semgrepScript || dependencies.semgrep || semgrepConfig) {
      integrations.push({
        id: 'semgrep',
        name: 'Semgrep',
        description: 'Busca patrones de seguridad y calidad mediante reglas Semgrep.',
        command: semgrepScript
          ? packageScriptCommand(packageManager, semgrepScript)
          : 'semgrep scan --config auto .',
        evidence: semgrepScript ? `package.json#${semgrepScript}` : semgrepConfig ?? 'package.json#semgrep',
        category: 'security',
        failurePolicy: 'continue'
      });
    }

    const snykScript = firstScript(scripts, ['snyk', 'security:snyk', 'scan:snyk']);
    const snykConfig = await firstExisting(rootPath, ['.snyk']);
    if (snykScript || dependencies.snyk || snykConfig) {
      integrations.push({
        id: 'snyk',
        name: 'Snyk',
        description: 'Comprueba vulnerabilidades de dependencias con Snyk.',
        command: snykScript
          ? packageScriptCommand(packageManager, snykScript)
          : packageExecutableCommand(packageManager, 'snyk test'),
        evidence: snykScript ? `package.json#${snykScript}` : snykConfig ?? 'package.json#snyk',
        category: 'security',
        failurePolicy: 'continue'
      });
    }

    const trivyScript = firstScript(scripts, ['trivy', 'security:trivy', 'scan:trivy']);
    const trivyEvidence = await firstExisting(rootPath, [
      'trivy.yaml',
      'trivy.yml',
      '.trivyignore',
      'Dockerfile',
      'docker-compose.yml',
      'docker-compose.yaml'
    ]);
    if (trivyScript || trivyEvidence) {
      integrations.push({
        id: 'trivy',
        name: 'Trivy',
        description: 'Escanea vulnerabilidades, secretos y configuraciones inseguras.',
        command: trivyScript
          ? packageScriptCommand(packageManager, trivyScript)
          : 'trivy fs --scanners vuln,secret,misconfig .',
        evidence: trivyScript ? `package.json#${trivyScript}` : trivyEvidence!,
        category: 'security',
        failurePolicy: 'continue'
      });
    }
  } else {
    const trivyEvidence = await firstExisting(rootPath, [
      'trivy.yaml',
      'trivy.yml',
      '.trivyignore',
      'Dockerfile',
      'docker-compose.yml',
      'docker-compose.yaml'
    ]);
    if (trivyEvidence) {
      integrations.push({
        id: 'trivy',
        name: 'Trivy',
        description: 'Escanea vulnerabilidades, secretos y configuraciones inseguras.',
        command: 'trivy fs --scanners vuln,secret,misconfig .',
        evidence: trivyEvidence,
        category: 'security',
        failurePolicy: 'continue'
      });
    }
  }

  const semgrepConfig = await firstExisting(rootPath, [
    '.semgrep.yml',
    '.semgrep.yaml',
    'semgrep.yml',
    'semgrep.yaml'
  ]);
  if (semgrepConfig && !integrations.some(item => item.id === 'semgrep')) {
    integrations.push({
      id: 'semgrep',
      name: 'Semgrep',
      description: 'Busca patrones de seguridad y calidad mediante reglas Semgrep.',
      command: 'semgrep scan --config auto .',
      evidence: semgrepConfig,
      category: 'security',
      failurePolicy: 'continue'
    });
  }

  const pomPath = path.join(rootPath, 'pom.xml');
  if (await fileContains(pomPath, /dependency-check-maven|org\.owasp/i)) {
    const executable = await executableForWrapper(
      rootPath,
      process.platform === 'win32' ? 'mvnw.cmd' : 'mvnw',
      process.platform === 'win32' ? 'mvn.cmd' : 'mvn'
    );
    integrations.push({
      id: 'owasp-dependency-check',
      name: 'OWASP Dependency-Check',
      description: 'Analiza dependencias conocidas mediante OWASP Dependency-Check.',
      command: `${executable} org.owasp:dependency-check-maven:check`,
      evidence: 'pom.xml',
      category: 'security',
      failurePolicy: 'continue'
    });
  }

  const gradleFile = await firstExisting(rootPath, ['build.gradle', 'build.gradle.kts']);
  if (
    gradleFile &&
    await fileContains(path.join(rootPath, gradleFile), /org\.owasp\.dependencycheck|dependencyCheck/i)
  ) {
    const executable = await executableForWrapper(
      rootPath,
      process.platform === 'win32' ? 'gradlew.bat' : 'gradlew',
      process.platform === 'win32' ? 'gradle.bat' : 'gradle'
    );
    integrations.push({
      id: 'owasp-dependency-check',
      name: 'OWASP Dependency-Check',
      description: 'Analiza dependencias conocidas mediante OWASP Dependency-Check.',
      command: `${executable} dependencyCheckAnalyze`,
      evidence: gradleFile,
      category: 'security',
      failurePolicy: 'continue'
    });
  }

  return uniqueIntegrations(integrations);
}

async function detectNonNodeActions(
  rootPath: string
): Promise<Omit<DetectedProjectActions, 'integrations'>> {
  const dotnetTarget = await firstMatchingFile(rootPath, [
    '.sln',
    '.slnx',
    '.csproj',
    '.vbproj',
    '.fsproj'
  ]);
  if (dotnetTarget) {
    const target = quoteShellArgument(path.relative(rootPath, dotnetTarget));
    return {
      buildCommand: `dotnet build ${target} --no-incremental`,
      testCommand: `dotnet test ${target} --no-build`,
      evidence: path.basename(dotnetTarget)
    };
  }

  if (await exists(path.join(rootPath, 'pom.xml'))) {
    const executable = await executableForWrapper(
      rootPath,
      process.platform === 'win32' ? 'mvnw.cmd' : 'mvnw',
      process.platform === 'win32' ? 'mvn.cmd' : 'mvn'
    );
    return {
      buildCommand: `${executable} clean package -DskipTests`,
      testCommand: `${executable} test`,
      evidence: 'pom.xml'
    };
  }

  const gradleFile = await firstExisting(rootPath, [
    'build.gradle',
    'build.gradle.kts',
    'settings.gradle',
    'settings.gradle.kts'
  ]);
  if (gradleFile) {
    const executable = await executableForWrapper(
      rootPath,
      process.platform === 'win32' ? 'gradlew.bat' : 'gradlew',
      process.platform === 'win32' ? 'gradle.bat' : 'gradle'
    );
    return {
      buildCommand: `${executable} clean build -x test`,
      testCommand: `${executable} test`,
      evidence: gradleFile
    };
  }

  if (await exists(path.join(rootPath, 'Cargo.toml'))) {
    return {
      buildCommand: 'cargo build',
      testCommand: 'cargo test',
      evidence: 'Cargo.toml'
    };
  }

  if (await exists(path.join(rootPath, 'go.mod'))) {
    return {
      buildCommand: 'go build ./...',
      testCommand: 'go test ./...',
      evidence: 'go.mod'
    };
  }

  const pythonEvidence = await firstExisting(rootPath, [
    'pyproject.toml',
    'pytest.ini',
    'setup.cfg',
    'requirements.txt'
  ]);
  if (pythonEvidence) {
    return {
      testCommand: process.platform === 'win32'
        ? 'py -m pytest'
        : 'python3 -m pytest',
      evidence: pythonEvidence
    };
  }

  return {};
}

async function readNodeProject(
  rootPath: string,
  packageJsonPath: string
): Promise<NodeProjectContext | undefined> {
  if (!(await exists(packageJsonPath))) {
    return undefined;
  }
  try {
    const packageJson = JSON.parse(
      await fs.readFile(packageJsonPath, 'utf8')
    ) as PackageJsonShape;
    return {
      packageJson,
      packageManager: await detectPackageManager(rootPath)
    };
  } catch {
    return undefined;
  }
}

function detectNodeActions(
  context: NodeProjectContext
): Omit<DetectedProjectActions, 'integrations'> {
  const scripts = context.packageJson.scripts ?? {};
  const buildScript = firstScript(scripts, ['build', 'compile', 'typecheck']);
  const testScript = firstUsableTestScript(scripts);

  return {
    buildCommand: buildScript
      ? packageScriptCommand(context.packageManager, buildScript)
      : undefined,
    testCommand: testScript
      ? packageScriptCommand(context.packageManager, testScript)
      : undefined,
    evidence: 'package.json'
  };
}

async function detectPackageManager(rootPath: string): Promise<PackageManager> {
  if (await exists(path.join(rootPath, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (await exists(path.join(rootPath, 'yarn.lock'))) {
    return 'yarn';
  }
  return 'npm';
}

function packageScriptCommand(
  packageManager: PackageManager,
  script: string
): string {
  if (packageManager === 'npm') {
    return script === 'test' ? 'npm test' : `npm run ${script}`;
  }
  if (packageManager === 'pnpm') {
    return script === 'test' ? 'pnpm test' : `pnpm run ${script}`;
  }
  return `yarn ${script}`;
}

function packageExecutableCommand(
  packageManager: PackageManager,
  command: string
): string {
  if (packageManager === 'npm') {
    return `npx ${command}`;
  }
  if (packageManager === 'pnpm') {
    return `pnpm exec ${command}`;
  }
  return `yarn ${command}`;
}

function firstScript(
  scripts: Record<string, string>,
  candidates: string[]
): string | undefined {
  return candidates.find(candidate => Boolean(scripts[candidate]?.trim()));
}

function firstUsableTestScript(
  scripts: Record<string, string>
): string | undefined {
  for (const candidate of ['test', 'test:unit', 'test:ci']) {
    const command = scripts[candidate]?.trim();
    if (!command) {
      continue;
    }
    if (/no test specified/i.test(command)) {
      continue;
    }
    return candidate;
  }
  return undefined;
}

async function executableForWrapper(
  rootPath: string,
  wrapperName: string,
  fallback: string
): Promise<string> {
  if (!(await exists(path.join(rootPath, wrapperName)))) {
    return fallback;
  }
  if (process.platform === 'win32') {
    return wrapperName;
  }
  return `./${wrapperName}`;
}

async function firstExisting(
  rootPath: string,
  candidates: string[]
): Promise<string | undefined> {
  for (const candidate of candidates) {
    if (await exists(path.join(rootPath, candidate))) {
      return candidate;
    }
  }
  return undefined;
}

async function firstMatchingFile(
  rootPath: string,
  extensions: string[]
): Promise<string | undefined> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true });
  } catch {
    return undefined;
  }

  return entries
    .filter(entry => entry.isFile())
    .map(entry => path.join(rootPath, entry.name))
    .find(file => extensions.includes(path.extname(file).toLowerCase()));
}

async function fileContains(file: string, pattern: RegExp): Promise<boolean> {
  try {
    return pattern.test(await fs.readFile(file, 'utf8'));
  } catch {
    return false;
  }
}

function uniqueIntegrations(
  integrations: DetectedProjectIntegration[]
): DetectedProjectIntegration[] {
  const byId = new Map<string, DetectedProjectIntegration>();
  for (const integration of integrations) {
    if (!byId.has(integration.id)) {
      byId.set(integration.id, integration);
    }
  }
  return [...byId.values()].sort((left, right) =>
    left.category.localeCompare(right.category) || left.name.localeCompare(right.name)
  );
}

function quoteShellArgument(value: string): string {
  if (!/\s/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
