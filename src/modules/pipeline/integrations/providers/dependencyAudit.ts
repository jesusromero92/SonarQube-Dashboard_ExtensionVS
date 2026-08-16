import type { PipelineIntegrationProvider } from '../contracts';
import {
  dependencyAuditCommand,
  nodeInstallCommand,
  packageManagerLockFiles
} from '../context';
import {
  buildDetectedIntegration,
  evidence,
  firstExisting
} from '../helpers';
import { versionProbe } from '../probe';
import { parseDependencyAuditResult } from '../../results/parsers';

const descriptor = {
  id: 'dependency-audit',
  displayName: 'Auditoría de dependencias Node',
  description: 'Audita las dependencias conocidas del proyecto.',
  category: 'dependencies-sca' as const,
  failurePolicy: 'continue' as const,
  recommendation: { anyOf: ['node'], reason: 'Recomendada para proyectos Node.js, JavaScript o TypeScript detectados.', priority: 90 }
};

export const dependencyAuditIntegrationProvider: PipelineIntegrationProvider = {
  descriptor,
  parseResult: parseDependencyAuditResult,
  watchFiles: ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'],
  async detect(context) {
    if (!context.node) return undefined;
    const lockFile = await firstExisting(
      context.rootPath,
      packageManagerLockFiles(context.node.packageManager)
    );
    if (!lockFile) return undefined;

    const declaredVersion = declaredPackageManagerVersion(context.node.declaredPackageManager);
    return buildDetectedIntegration(
      descriptor,
      dependencyAuditCommand(context.node.packageManager),
      [evidence('lockfile', lockFile)!],
      'configured',
      declaredVersion ? { value: declaredVersion, source: 'declared' } : undefined,
      `${context.node.packageManager} audit`
    );
  },
  getProbe(context) {
    if (!context.node) return versionProbe(context.rootPath, context.platform, 'npm');
    return versionProbe(
      context.rootPath,
      context.platform,
      context.node.packageManager,
      ['--version'],
      `${context.node.packageManager} --version`
    );
  },
  getDisplayName(context) {
    return context.node ? `${context.node.packageManager} audit` : descriptor.displayName;
  },
  getSetup(context) {
    return {
      hint: 'Instala las dependencias con el gestor detectado para generar o actualizar su lockfile.',
      command: context.node ? nodeInstallCommand(context.node.packageManager) : undefined
    };
  }
};

function declaredPackageManagerVersion(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  const separator = normalized.lastIndexOf('@');
  if (separator <= 0 || separator === normalized.length - 1) return undefined;
  return normalized.slice(separator + 1);
}
