import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type {
  IntegrationDetectionContext,
  NodePackageManager,
  NodeProjectContext,
  PackageJsonShape
} from './contracts';
import { exists } from './helpers';

export async function createIntegrationDetectionContext(
  rootPath: string
): Promise<IntegrationDetectionContext> {
  return {
    rootPath,
    platform: process.platform,
    node: await readNodeProject(rootPath)
  };
}

export async function readNodeProject(rootPath: string): Promise<NodeProjectContext | undefined> {
  const packageJsonPath = path.join(rootPath, 'package.json');
  if (!(await exists(packageJsonPath))) return undefined;

  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as PackageJsonShape;
    return {
      packageJson,
      packageManager: await detectNodePackageManager(rootPath, packageJson.packageManager),
      declaredPackageManager: packageJson.packageManager
    };
  } catch {
    return undefined;
  }
}

export async function detectNodePackageManager(
  rootPath: string,
  declaredPackageManager?: string
): Promise<NodePackageManager> {
  const declared = normalizeNodePackageManager(declaredPackageManager);
  if (declared) return declared;

  const lockfiles: Array<[string, NodePackageManager]> = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm'],
    ['npm-shrinkwrap.json', 'npm']
  ];
  for (const [lockfile, packageManager] of lockfiles) {
    if (await exists(path.join(rootPath, lockfile))) return packageManager;
  }
  return 'npm';
}

export function normalizeNodePackageManager(
  value: string | undefined
): NodePackageManager | undefined {
  const name = value?.trim().toLowerCase().split('@', 1)[0];
  if (name === 'npm' || name === 'pnpm' || name === 'yarn' || name === 'bun') return name;
  return undefined;
}

export function packageManagerLockFiles(packageManager: NodePackageManager): string[] {
  if (packageManager === 'npm') return ['package-lock.json', 'npm-shrinkwrap.json'];
  if (packageManager === 'pnpm') return ['pnpm-lock.yaml'];
  if (packageManager === 'yarn') return ['yarn.lock'];
  return ['bun.lock', 'bun.lockb'];
}

export function dependencyAuditCommand(packageManager: NodePackageManager): string {
  if (packageManager === 'npm') return 'npm audit --audit-level=high --json';
  if (packageManager === 'pnpm') return 'pnpm audit --audit-level=high --json';
  if (packageManager === 'bun') return 'bun audit --audit-level=high';
  return 'yarn audit --level high --json';
}

export function packageScriptCommand(packageManager: NodePackageManager, script: string): string {
  if (packageManager === 'npm') return script === 'test' ? 'npm test' : `npm run ${script}`;
  if (packageManager === 'pnpm') return script === 'test' ? 'pnpm test' : `pnpm run ${script}`;
  if (packageManager === 'bun') return `bun run ${script}`;
  return `yarn ${script}`;
}

export function packageExecutableCommand(
  packageManager: NodePackageManager,
  command: string
): string {
  if (packageManager === 'npm') return `npm exec -- ${command}`;
  if (packageManager === 'pnpm') return `pnpm exec ${command}`;
  if (packageManager === 'bun') return `bunx ${command}`;
  return `yarn ${command}`;
}

export function nodeDevInstallCommand(
  packageManager: NodePackageManager,
  packageName: string
): string {
  if (packageManager === 'npm') return `npm install -D ${packageName}`;
  if (packageManager === 'pnpm') return `pnpm add -D ${packageName}`;
  if (packageManager === 'yarn') return `yarn add -D ${packageName}`;
  return `bun add -d ${packageName}`;
}

export function nodeInstallCommand(packageManager: NodePackageManager): string {
  if (packageManager === 'npm') return 'npm install';
  if (packageManager === 'pnpm') return 'pnpm install';
  if (packageManager === 'yarn') return 'yarn install';
  return 'bun install';
}
