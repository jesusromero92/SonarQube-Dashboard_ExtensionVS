import * as path from 'node:path';
import * as vscode from 'vscode';
import { getFolderFormConfig, tokenKey } from '../configuration';
import { detectScanner } from '../scanner/detector';
import {
  detectProjectActions,
  type DetectedProjectIntegration
} from '../pipeline';
import {
  fetchSonarCompatibilityInfo,
  probeSonarServer
} from '../sonarClient';

export interface ExtensionDiagnosticCommand {
  name: string;
  command: string;
  source: string;
  evidence?: string;
}

export interface ExtensionDiagnosticTool {
  name: string;
  command: string;
  category: string;
  evidence?: string;
}

export interface ExtensionFailedRequest {
  method?: string;
  endpoint?: string;
  status?: number | string;
  message?: string;
  occurredAt?: string;
}

export interface ExtensionDiagnosticsSnapshot {
  generatedAt: string;
  extensionVersion: string;
  vscodeVersion: string;
  nodeVersion: string;
  platform: string;
  architecture: string;
  workspaceTrusted: boolean;
  workspaceFolder: string;
  sonarServer?: string;
  projectKey?: string;
  branch?: string;
  sonarVersion?: string;
  sonarStatus?: string;
  compatibilityProfile?: string;
  compatibilityProfiles?: string[];
  responseTimeMs?: number;
  scanner?: string;
  scannerKind?: string;
  scannerEvidence?: string;
  commands: ExtensionDiagnosticCommand[];
  tools: ExtensionDiagnosticTool[];
  lastFailedRequest?: ExtensionFailedRequest;
  errors: string[];
}

const LAST_FAILED_REQUEST_KEY_PREFIX =
  'sonarQubeDashboard.diagnostics.lastFailedRequest:';

export async function collectExtensionDiagnostics(
  context: vscode.ExtensionContext,
  folder?: vscode.WorkspaceFolder
): Promise<ExtensionDiagnosticsSnapshot> {
  const errors: string[] = [];
  const snapshot: ExtensionDiagnosticsSnapshot = {
    generatedAt: new Date().toISOString(),
    extensionVersion: extensionVersion(context),
    vscodeVersion: vscode.version,
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    workspaceTrusted: vscode.workspace.isTrusted,
    workspaceFolder: folder?.uri.fsPath ?? '',
    commands: [],
    tools: [],
    errors
  };

  if (!folder) {
    errors.push('No hay ninguna carpeta del workspace seleccionada.');
    return snapshot;
  }

  const form = await getFolderFormConfig(context, folder);
  const rootPath = analysisRoot(folder, form.baseDir);

  snapshot.sonarServer = form.serverUrl;
  snapshot.projectKey = form.projectKey;
  snapshot.branch = form.branch;
  snapshot.lastFailedRequest = context.workspaceState.get<ExtensionFailedRequest>(
    `${LAST_FAILED_REQUEST_KEY_PREFIX}${folder.uri.toString()}`
  );

  try {
    const actions = await detectProjectActions(rootPath);
    if (actions.buildCommand) {
      snapshot.commands.push({
        name: 'Compilar el proyecto',
        command: actions.buildCommand,
        source: 'Detectado automáticamente',
        evidence: actions.evidence
      });
    }
    if (actions.testCommand) {
      snapshot.commands.push({
        name: 'Ejecutar tests',
        command: actions.testCommand,
        source: 'Detectado automáticamente',
        evidence: actions.evidence
      });
    }
    snapshot.tools = actions.integrations.map(toDiagnosticTool);
  } catch (error) {
    errors.push(`No se pudieron detectar comandos y herramientas: ${errorMessage(error)}`);
  }

  try {
    const scanner = await detectScanner(rootPath, form.scannerMode);
    snapshot.scanner = scanner.label;
    snapshot.scannerKind = scanner.kind;
    snapshot.scannerEvidence = scanner.evidence;
  } catch (error) {
    errors.push(`No se pudo detectar el scanner: ${errorMessage(error)}`);
  }

  const token = await context.secrets.get(tokenKey(folder));
  if (!form.serverUrl || !token) {
    if (form.serverUrl && !token) {
      errors.push('No hay un token guardado para comprobar SonarQube.');
    }
    return snapshot;
  }

  const [compatibilityResult, probeResult] = await Promise.allSettled([
    fetchSonarCompatibilityInfo(form.serverUrl, token),
    probeSonarServer(form.serverUrl, token)
  ]);

  if (compatibilityResult.status === 'fulfilled') {
    const compatibility = compatibilityResult.value;
    snapshot.sonarVersion = compatibility.version;
    snapshot.compatibilityProfile = compatibility.profile;
    snapshot.compatibilityProfiles = [...compatibility.appliedProfiles];
  } else {
    errors.push(
      `No se pudo detectar la compatibilidad de SonarQube: ${errorMessage(compatibilityResult.reason)}`
    );
  }

  if (probeResult.status === 'fulfilled') {
    snapshot.sonarStatus = probeResult.value.status;
    snapshot.responseTimeMs = probeResult.value.durationMs;
  } else {
    snapshot.sonarStatus = 'UNAVAILABLE';
    errors.push(
      `No se pudo comprobar el estado de SonarQube: ${errorMessage(probeResult.reason)}`
    );
  }

  return snapshot;
}

export function formatDiagnosticsReport(
  snapshot: ExtensionDiagnosticsSnapshot
): string {
  const branch = firstNonEmpty(snapshot.branch, 'Rama principal');
  const compatibilityProfile = firstNonEmpty(
    snapshot.compatibilityProfiles?.join(' / '),
    snapshot.compatibilityProfile
  );
  const responseTime = snapshot.responseTimeMs === undefined
    ? '—'
    : `${snapshot.responseTimeMs} ms`;
  const lines = [
    '# SonarQube Dashboard · Diagnóstico',
    '',
    `Generado: ${snapshot.generatedAt}`,
    '',
    '## Entorno',
    `- Extensión: ${value(snapshot.extensionVersion)}`,
    `- VS Code: ${value(snapshot.vscodeVersion)}`,
    `- Node.js: ${value(snapshot.nodeVersion)}`,
    `- Plataforma: ${value([snapshot.platform, snapshot.architecture].filter(Boolean).join(' '))}`,
    `- Workspace confiable: ${snapshot.workspaceTrusted ? 'Sí' : 'No'}`,
    `- Carpeta: ${value(snapshot.workspaceFolder)}`,
    '',
    '## SonarQube y compatibilidad',
    `- Servidor: ${value(snapshot.sonarServer)}`,
    `- Proyecto: ${value(snapshot.projectKey)}`,
    `- Rama: ${value(branch)}`,
    `- Versión: ${value(snapshot.sonarVersion)}`,
    `- Estado: ${value(snapshot.sonarStatus)}`,
    `- Perfil: ${value(compatibilityProfile)}`,
    `- Tiempo de respuesta: ${responseTime}`,
    '',
    '## Scanner',
    `- Scanner: ${value(snapshot.scanner)}`,
    `- Tipo: ${value(snapshot.scannerKind)}`,
    `- Evidencia: ${value(snapshot.scannerEvidence)}`,
    '',
    '## Comandos detectados automáticamente',
    ...formatCommands(snapshot.commands),
    '',
    '## Herramientas disponibles',
    ...formatTools(snapshot.tools),
    '',
    '## Última petición fallida',
    ...formatFailure(snapshot.lastFailedRequest),
    '',
    '## Incidencias al recopilar el diagnóstico',
    ...(snapshot.errors.length > 0
      ? snapshot.errors.map(item => `- ${item}`)
      : ['- Ninguna']),
    '',
    '> El informe no incluye tokens ni secretos.'
  ];

  return lines.join('\n');
}

function analysisRoot(
  folder: vscode.WorkspaceFolder,
  baseDir: string
): string {
  return baseDir
    ? path.resolve(folder.uri.fsPath, baseDir)
    : folder.uri.fsPath;
}

function extensionVersion(context: vscode.ExtensionContext): string {
  const packageJson = context.extension.packageJSON as { version?: unknown };
  return typeof packageJson.version === 'string' ? packageJson.version : '';
}

function toDiagnosticTool(
  integration: DetectedProjectIntegration
): ExtensionDiagnosticTool {
  return {
    name: integration.name,
    command: integration.command,
    category: integration.category,
    evidence: integration.evidence
  };
}

function formatCommands(commands: readonly ExtensionDiagnosticCommand[]): string[] {
  if (commands.length === 0) return ['- Ninguno'];
  return commands.map(command => {
    const evidence = formatEvidence(command.evidence);
    return `- ${command.name}: \`${command.command}\`${evidence}`;
  });
}

function formatTools(tools: readonly ExtensionDiagnosticTool[]): string[] {
  if (tools.length === 0) return ['- Ninguna'];
  return tools.map(tool => {
    const evidence = formatEvidence(tool.evidence);
    return `- ${tool.name} [${tool.category}]: \`${tool.command}\`${evidence}`;
  });
}

function formatEvidence(evidence?: string): string {
  return evidence ? ` (${evidence})` : '';
}

function formatFailure(failure?: ExtensionFailedRequest): string[] {
  if (!failure) return ['- No hay peticiones fallidas registradas.'];
  const title = [failure.method, failure.endpoint, failure.status]
    .filter(item => item !== undefined && item !== '')
    .join(' ');
  return [
    `- ${title || 'Petición fallida'}`,
    failure.message ? `  - Mensaje: ${failure.message}` : '',
    failure.occurredAt ? `  - Fecha: ${failure.occurredAt}` : ''
  ].filter(Boolean);
}

function value(input: unknown): string {
  if (input === undefined || input === null || input === '') return '—';
  if (
    typeof input === 'string' ||
    typeof input === 'number' ||
    typeof input === 'bigint' ||
    typeof input === 'boolean'
  ) {
    return String(input);
  }
  if (typeof input === 'symbol') {
    return input.description ?? 'Symbol';
  }
  if (typeof input === 'function') {
    return input.name ? `[Function ${input.name}]` : '[Function]';
  }
  try {
    return JSON.stringify(input) ?? '—';
  } catch {
    return '—';
  }
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const current of values) {
    if (current) {
      return current;
    }
  }
  return '';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
