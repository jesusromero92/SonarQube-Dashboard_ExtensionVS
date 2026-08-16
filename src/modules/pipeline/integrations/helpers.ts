import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';
import * as path from 'node:path';
import type {
  DetectedProjectIntegration,
  IntegrationDetectionContext,
  NodeProjectContext,
  ProjectIntegrationConfigurationStatus,
  ProjectIntegrationDescriptor,
  ProjectIntegrationEvidence,
  ProjectIntegrationHealth,
  ProjectIntegrationVersion
} from './contracts';

const execFileAsync = promisify(execFile);

export async function findExecutable(
  platform: NodeJS.Platform,
  command: string,
  rootPath?: string
): Promise<string | undefined> {
  try {
    const executable = platform === 'win32' ? 'where.exe' : 'which';
    const env = rootPath ? projectScopedEnvironment(rootPath) : process.env;
    const { stdout } = await execFileAsync(executable, [command], {
      cwd: rootPath,
      env,
      timeout: 1200,
      windowsHide: true
    });
    return String(stdout).split(/\r?\n/).map(item => item.trim()).find(Boolean);
  } catch {
    return undefined;
  }
}

function projectScopedEnvironment(rootPath: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') ?? 'PATH';
  const projectBin = path.resolve(rootPath, 'node_modules', '.bin');
  const normalizedProjectBin = normalizedPath(projectBin);
  const inheritedEntries = (env[pathKey] ?? '').split(path.delimiter).filter(Boolean);
  const scopedEntries = inheritedEntries.filter(entry => {
    const resolved = path.resolve(entry);
    const isNodeModulesBin = path.basename(resolved).toLowerCase() === '.bin' &&
      path.basename(path.dirname(resolved)).toLowerCase() === 'node_modules';
    return !isNodeModulesBin || normalizedPath(resolved) === normalizedProjectBin;
  });
  env[pathKey] = [projectBin, ...scopedEntries].join(path.delimiter);
  return env;
}

function normalizedPath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function firstExisting(
  rootPath: string,
  candidates: readonly string[]
): Promise<string | undefined> {
  for (const candidate of candidates) {
    if (await exists(path.join(rootPath, candidate))) return candidate;
  }
  return undefined;
}

export async function executableForWrapper(
  rootPath: string,
  wrapperName: string,
  fallback: string
): Promise<string> {
  if (!(await exists(path.join(rootPath, wrapperName)))) return fallback;
  return process.platform === 'win32' ? wrapperName : `./${wrapperName}`;
}

export async function fileContains(file: string, pattern: RegExp): Promise<boolean> {
  try {
    return pattern.test(await fs.readFile(file, 'utf8'));
  } catch {
    return false;
  }
}

export function firstScript(
  scripts: Record<string, string>,
  candidates: readonly string[]
): string | undefined {
  return candidates.find(candidate => Boolean(scripts[candidate]?.trim()));
}

export function firstScriptContaining(
  scripts: Record<string, string>,
  pattern: RegExp
): string | undefined {
  return Object.entries(scripts).find(([, command]) => pattern.test(command))?.[0];
}

export function nodeDependency(
  node: NodeProjectContext | undefined,
  packageName: string
): ProjectIntegrationEvidence | undefined {
  if (!node) return undefined;
  if (node.packageJson.dependencies?.[packageName]) {
    return { source: 'dependency', value: `package.json#dependencies.${packageName}` };
  }
  if (node.packageJson.devDependencies?.[packageName]) {
    return { source: 'devDependency', value: `package.json#devDependencies.${packageName}` };
  }
  return undefined;
}

export function nodeDependencyVersionSpec(
  node: NodeProjectContext | undefined,
  packageName: string
): string | undefined {
  return node?.packageJson.dependencies?.[packageName] ?? node?.packageJson.devDependencies?.[packageName];
}

export async function resolveNodePackageVersion(
  context: IntegrationDetectionContext,
  packageName: string
): Promise<ProjectIntegrationVersion | undefined> {
  const packageFile = path.join(
    context.rootPath,
    'node_modules',
    ...packageName.split('/'),
    'package.json'
  );
  try {
    const value = JSON.parse(await fs.readFile(packageFile, 'utf8')) as { version?: string };
    if (value.version?.trim()) return { value: value.version.trim(), source: 'installed' };
  } catch {
    // package may be declared but node_modules may not exist yet.
  }

  const declared = nodeDependencyVersionSpec(context.node, packageName)?.trim();
  return declared ? { value: declared, source: 'declared' } : undefined;
}

export async function versionFromRequirements(
  rootPath: string,
  requirementsFile: string | undefined,
  packageName: string
): Promise<ProjectIntegrationVersion | undefined> {
  if (!requirementsFile) return undefined;
  try {
    const content = await fs.readFile(path.join(rootPath, requirementsFile), 'utf8');
    const line = content.split(/\r?\n/).map(item => item.trim()).find(item =>
      new RegExp(`^${escapeRegExp(packageName)}(?:\\[.*?\\])?(?:[<>=~!]|\\s|$)`, 'i').test(item)
    );
    if (!line) return undefined;
    const version = line.slice(packageName.length).trim();
    return version ? { value: version, source: 'declared' } : undefined;
  } catch {
    return undefined;
  }
}

export function buildDetectedIntegration(
  descriptor: ProjectIntegrationDescriptor,
  command: string,
  evidences: ProjectIntegrationEvidence[],
  configurationStatus: ProjectIntegrationConfigurationStatus,
  version?: ProjectIntegrationVersion,
  displayName?: string,
  healthOverride?: ProjectIntegrationHealth
): DetectedProjectIntegration {
  const health = healthOverride ?? healthForConfiguration(configurationStatus);
  return {
    id: descriptor.id,
    name: displayName ?? descriptor.displayName,
    description: descriptor.description,
    command,
    evidence: evidences[0]?.value ?? '',
    evidences,
    category: descriptor.category,
    failurePolicy: descriptor.failurePolicy,
    configurationStatus,
    health,
    version: version?.value,
    versionSource: version?.source,
    probeSupported: false
  };
}

export function healthForConfiguration(
  status: ProjectIntegrationConfigurationStatus
): ProjectIntegrationHealth {
  if (status === 'configured') return 'healthy';
  if (status === 'partial') return 'warning';
  return 'unknown';
}

export function evidence(
  source: ProjectIntegrationEvidence['source'],
  value: string | undefined
): ProjectIntegrationEvidence | undefined {
  return value ? { source, value } : undefined;
}

export function compactEvidence(
  ...values: Array<ProjectIntegrationEvidence | undefined>
): ProjectIntegrationEvidence[] {
  const unique = new Map<string, ProjectIntegrationEvidence>();
  for (const item of values) {
    if (!item) continue;
    unique.set(`${item.source}:${item.value}`, item);
  }
  return [...unique.values()];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
