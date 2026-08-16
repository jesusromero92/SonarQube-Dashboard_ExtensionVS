import * as vscode from 'vscode';
import { getFolderConfig, getFolderFormConfig } from '../configuration';
import {
  fetchSonarCompatibilityInfo,
  getLastSonarRequestFailure,
  probeSonarServer,
  SonarRequestFailure
} from '../sonarClient';

export interface ExtensionDiagnosticsModuleState {
  readonly id: string;
  readonly displayName: string;
  readonly enabled: boolean;
  readonly loaded: boolean;
}

export interface ExtensionDiagnosticsModuleItem {
  readonly label: string;
  readonly value: string;
  readonly status?: 'healthy' | 'warning' | 'unknown';
}

export interface ExtensionDiagnosticsModuleSection {
  readonly moduleId?: string;
  readonly title: string;
  readonly items: readonly ExtensionDiagnosticsModuleItem[];
}

export interface ExtensionDiagnosticsCommand {
  readonly name: string;
  readonly command: string;
  readonly source?: string;
  readonly evidence?: string;
}

export interface ExtensionDiagnosticsTool {
  readonly name: string;
  readonly command: string;
  readonly category?: string;
  readonly evidence?: string;
  readonly health?: string;
  readonly configurationStatus?: string;
  readonly version?: string;
  readonly versionSource?: string;
  readonly probeSupported?: string;
}

export interface ExtensionDiagnosticsSnapshot {
  readonly generatedAt: string;
  readonly extensionVersion: string;
  readonly vscodeVersion: string;
  readonly nodeVersion: string;
  readonly platform: string;
  readonly architecture: string;
  readonly workspaceTrusted: boolean;
  readonly workspaceFolder: string;
  readonly modules: readonly ExtensionDiagnosticsModuleState[];
  readonly moduleDiagnostics: readonly ExtensionDiagnosticsModuleSection[];
  readonly sonarServer: string;
  readonly projectKey: string;
  readonly branch: string;
  readonly sonarVersion: string;
  readonly sonarStatus: string;
  readonly compatibilityProfile: string;
  readonly compatibilityProfiles: readonly string[];
  readonly responseTimeMs?: number;
  readonly scanner: string;
  readonly scannerKind: string;
  readonly scannerEvidence: string;
  readonly commands: readonly ExtensionDiagnosticsCommand[];
  readonly tools: readonly ExtensionDiagnosticsTool[];
  readonly lastFailedRequest?: SonarRequestFailure;
  readonly errors: readonly string[];
}

interface DiagnosticsContribution {
  readonly modules?: unknown;
  readonly moduleDiagnostics?: unknown;
  readonly moduleDiagnosticErrors?: unknown;
  readonly scanner?: unknown;
  readonly scannerKind?: unknown;
  readonly scannerEvidence?: unknown;
  readonly commands?: unknown;
  readonly tools?: unknown;
}

export async function collectExtensionDiagnostics(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder | undefined,
  rawContribution: Record<string, unknown> = {}
): Promise<ExtensionDiagnosticsSnapshot> {
  const contribution = rawContribution as DiagnosticsContribution;
  const errors = normalizeStringArray(contribution.moduleDiagnosticErrors);
  const form = folder
    ? await tryCollect(
        () => getFolderFormConfig(context, folder),
        errors,
        'No se pudo leer la configuración de SonarQube.'
      )
    : undefined;
  const config = folder
    ? await tryCollect(
        () => getFolderConfig(context, folder),
        errors,
        'No se pudo leer el token/configuración completa de SonarQube.'
      )
    : undefined;

  let sonarVersion = '';
  let sonarStatus = '';
  let compatibilityProfile = '';
  let compatibilityProfiles: readonly string[] = [];
  let responseTimeMs: number | undefined;

  if (config) {
    const compatibility = await tryCollect(
      () => fetchSonarCompatibilityInfo(config.serverUrl, config.token),
      errors,
      'No se pudo obtener la compatibilidad del servidor SonarQube.'
    );
    if (compatibility) {
      sonarVersion = compatibility.version;
      compatibilityProfile = compatibility.profile;
      compatibilityProfiles = [...compatibility.appliedProfiles];
      if (compatibility.warning) {
        errors.push(compatibility.warning);
      }
    }

    const probe = await tryCollect(
      () => probeSonarServer(config.serverUrl, config.token),
      errors,
      'No se pudo comprobar el estado del servidor SonarQube.'
    );
    if (probe) {
      sonarStatus = probe.status;
      responseTimeMs = probe.durationMs;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    extensionVersion: getExtensionVersion(context),
    vscodeVersion: vscode.version,
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    workspaceTrusted: vscode.workspace.isTrusted,
    workspaceFolder: folder?.uri.fsPath ?? '',
    modules: normalizeModules(contribution.modules),
    moduleDiagnostics: normalizeModuleDiagnostics(contribution.moduleDiagnostics),
    sonarServer: form?.serverUrl ?? '',
    projectKey: form?.projectKey ?? '',
    branch: form?.branch ?? '',
    sonarVersion,
    sonarStatus,
    compatibilityProfile,
    compatibilityProfiles,
    responseTimeMs,
    scanner: asString(contribution.scanner),
    scannerKind: asString(contribution.scannerKind),
    scannerEvidence: asString(contribution.scannerEvidence),
    commands: normalizeCommands(contribution.commands),
    tools: normalizeTools(contribution.tools),
    lastFailedRequest: getLastSonarRequestFailure(),
    errors
  };
}

export function formatDiagnosticsReport(snapshot: ExtensionDiagnosticsSnapshot): string {
  const lines: string[] = [
    'SonarQube Dashboard - Extension Diagnostics',
    `Generated: ${snapshot.generatedAt}`,
    '',
    '[Environment]',
    `Extension: ${snapshot.extensionVersion || '—'}`,
    `VS Code: ${snapshot.vscodeVersion || '—'}`,
    `Node.js: ${snapshot.nodeVersion || '—'}`,
    `Platform: ${[snapshot.platform, snapshot.architecture].filter(Boolean).join(' ') || '—'}`,
    `Workspace trusted: ${snapshot.workspaceTrusted ? 'yes' : 'no'}`,
    `Workspace folder: ${snapshot.workspaceFolder || '—'}`,
    '',
    '[Modules]'
  ];

  appendRows(
    lines,
    snapshot.modules.map(module => [
      module.displayName || module.id,
      module.enabled
        ? module.loaded
          ? 'enabled / runtime loaded'
          : 'enabled / runtime not loaded'
        : 'disabled'
    ])
  );

  lines.push('', '[Module health]');
  for (const section of snapshot.moduleDiagnostics) {
    lines.push(`${section.title}:`);
    for (const item of section.items) {
      lines.push(`  - ${item.label}: ${item.value}${item.status ? ` [${item.status}]` : ''}`);
    }
  }
  if (snapshot.moduleDiagnostics.length === 0) {
    lines.push('—');
  }

  lines.push(
    '',
    '[SonarQube]',
    `Server: ${snapshot.sonarServer || '—'}`,
    `Project: ${snapshot.projectKey || '—'}`,
    `Branch: ${snapshot.branch || 'main/default'}`,
    `Version: ${snapshot.sonarVersion || '—'}`,
    `Status: ${snapshot.sonarStatus || '—'}`,
    `Compatibility profile: ${snapshot.compatibilityProfile || '—'}`,
    `Applied profiles: ${snapshot.compatibilityProfiles.join(', ') || '—'}`,
    `Response time: ${snapshot.responseTimeMs === undefined ? '—' : `${snapshot.responseTimeMs} ms`}`,
    '',
    '[Scanner]',
    `Scanner: ${snapshot.scanner || '—'}`,
    `Kind: ${snapshot.scannerKind || '—'}`,
    `Evidence: ${snapshot.scannerEvidence || '—'}`,
    '',
    '[Detected commands]'
  );

  appendRows(
    lines,
    snapshot.commands.map(command => [
      command.name,
      redactSensitiveText(command.command),
      command.source,
      command.evidence
    ])
  );

  lines.push('', '[Available tools]');
  appendRows(
    lines,
    snapshot.tools.map(tool => [
      tool.name,
      redactSensitiveText(tool.command),
      tool.category,
      tool.version ? `version=${tool.version}` : '',
      tool.health ? `health=${tool.health}` : '',
      tool.configurationStatus ? `configuration=${tool.configurationStatus}` : '',
      tool.evidence
    ])
  );

  lines.push('', '[Last failed SonarQube request]');
  if (snapshot.lastFailedRequest) {
    const failure = snapshot.lastFailedRequest;
    lines.push(
      `${failure.occurredAt} ${failure.method} ${failure.endpoint}` +
        `${failure.status === undefined ? '' : ` [${failure.status}]`}`,
      redactSensitiveText(failure.message)
    );
  } else {
    lines.push('—');
  }

  lines.push('', '[Collection errors]');
  if (snapshot.errors.length === 0) {
    lines.push('—');
  } else {
    lines.push(...snapshot.errors.map(error => `- ${redactSensitiveText(error)}`));
  }

  lines.push('', 'Secrets and SonarQube tokens are not included in this report.');
  return `${lines.join('\n')}\n`;
}

function getExtensionVersion(context: vscode.ExtensionContext): string {
  const packageJson = context.extension?.packageJSON as { version?: unknown } | undefined;
  if (typeof packageJson?.version === 'string') {
    return packageJson.version;
  }

  const fallbackPackageJson = (context as unknown as { extension?: { packageJSON?: unknown } })
    .extension?.packageJSON as { version?: unknown } | undefined;
  return typeof fallbackPackageJson?.version === 'string' ? fallbackPackageJson.version : '';
}

async function tryCollect<T>(
  action: () => Promise<T>,
  errors: string[],
  prefix: string
): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    errors.push(`${prefix} ${errorMessage(error)}`);
    return undefined;
  }
}

function normalizeModules(value: unknown): ExtensionDiagnosticsModuleState[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map(item => ({
      id: asString(item.id),
      displayName: asString(item.displayName),
      enabled: item.enabled === true,
      loaded: item.loaded === true
    }));
}

function normalizeModuleDiagnostics(value: unknown): ExtensionDiagnosticsModuleSection[] {
  if (!Array.isArray(value)) return [];
  const result: ExtensionDiagnosticsModuleSection[] = [];
  for (const rawSection of value) {
    if (!isRecord(rawSection)) continue;
    const rawItems = Array.isArray(rawSection.items) ? rawSection.items : [];
    const items: ExtensionDiagnosticsModuleItem[] = [];
    for (const rawItem of rawItems) {
      if (!isRecord(rawItem)) continue;
      const status = normalizeStatus(rawItem.status);
      items.push({
        label: asString(rawItem.label),
        value: asString(rawItem.value),
        ...(status ? { status } : {})
      });
    }
    result.push({
      moduleId: asString(rawSection.moduleId) || undefined,
      title: asString(rawSection.title),
      items
    });
  }
  return result;
}

function normalizeCommands(value: unknown): ExtensionDiagnosticsCommand[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map(item => ({
      name: asString(item.name),
      command: asString(item.command),
      source: asString(item.source) || undefined,
      evidence: asString(item.evidence) || undefined
    }));
}

function normalizeTools(value: unknown): ExtensionDiagnosticsTool[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map(item => ({
      name: asString(item.name),
      command: asString(item.command),
      category: asString(item.category) || undefined,
      evidence: asString(item.evidence) || undefined,
      health: asString(item.health) || undefined,
      configurationStatus: asString(item.configurationStatus) || undefined,
      version: asString(item.version) || undefined,
      versionSource: asString(item.versionSource) || undefined,
      probeSupported: asString(item.probeSupported) || undefined
    }));
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function normalizeStatus(
  value: unknown
): ExtensionDiagnosticsModuleItem['status'] | undefined {
  return value === 'healthy' || value === 'warning' || value === 'unknown'
    ? value
    : undefined;
}

function appendRows(lines: string[], rows: readonly (readonly (string | undefined)[])[]): void {
  if (rows.length === 0) {
    lines.push('—');
    return;
  }

  for (const row of rows) {
    const values = row.filter((value): value is string => Boolean(value));
    lines.push(values.join(' | '));
  }
}

function redactSensitiveText(value: string): string {
  return value
    .replace(
      /((?:token|password|passwd|secret|api[_-]?key|authorization)\s*[=:]\s*)(["']?)[^\s"'&;]+\2/gi,
      '$1********'
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ********');
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
