import type {
  IntegrationDetectionContext,
  PipelineIntegrationProvider,
  ProjectIntegrationConfigurationStatus,
  ProjectIntegrationDescriptor,
  ProjectIntegrationEvidence
} from './contracts';
import type { PipelineStructuredResultParser } from '../results';
import {
  nodeDevInstallCommand,
  packageExecutableCommand,
  packageScriptCommand
} from './context';
import {
  buildDetectedIntegration,
  compactEvidence,
  evidence,
  findExecutable,
  firstExisting,
  firstScript,
  firstScriptContaining,
  nodeDependency,
  resolveNodePackageVersion
} from './helpers';
import { commandExecutable, versionProbe } from './probe';

export interface NodeToolProviderOptions {
  descriptor: ProjectIntegrationDescriptor;
  packageName: string;
  installPackage?: string;
  scriptNames?: readonly string[];
  scriptPattern?: RegExp;
  configFiles?: readonly string[];
  executable: string;
  binaryName?: string;
  setupHint: string;
  parseResult?: PipelineStructuredResultParser;
  configurationStatus?: (signals: {
    script?: string;
    config?: string;
    dependency: boolean;
    binary?: string;
  }) => ProjectIntegrationConfigurationStatus;
}

export function createNodeToolProvider(options: NodeToolProviderOptions): PipelineIntegrationProvider {
  return {
    descriptor: options.descriptor,
    watchFiles: options.configFiles,
    parseResult: options.parseResult,
    async detect(context: IntegrationDetectionContext) {
      const node = context.node;
      if (!node) return undefined;
      const scripts = node.packageJson.scripts ?? {};
      const script = detectScript(scripts, options);
      const config = options.configFiles
        ? await firstExisting(context.rootPath, options.configFiles)
        : undefined;
      const dependencyEvidence = nodeDependency(node, options.packageName);
      const binary = options.binaryName
        ? await findExecutable(context.platform, options.binaryName, context.rootPath)
        : undefined;
      if (!script && !config && !dependencyEvidence && !binary) return undefined;

      const status = integrationConfigurationStatus(options, {
        script,
        config,
        dependency: Boolean(dependencyEvidence),
        binary
      });
      const version = dependencyEvidence
        ? await resolveNodePackageVersion(context, options.packageName)
        : undefined;
      const evidences = compactEvidence(
        evidence('script', script ? `package.json#scripts.${script}` : undefined),
        evidence('config', config),
        dependencyEvidence,
        evidence('binary', binary)
      );
      const command = nodeToolCommand(context, options, script, dependencyEvidence, binary);
      const runnable = Boolean(binary || version?.source === 'installed' || script);
      return buildDetectedIntegration(
        options.descriptor,
        command,
        evidences,
        status,
        version,
        undefined,
        status === 'configured' && runnable ? 'healthy' : 'warning'
      );
    },
    getSetup(context: IntegrationDetectionContext) {
      return {
        hint: options.setupHint,
        command: context.node
          ? nodeDevInstallCommand(context.node.packageManager, options.installPackage ?? options.packageName)
          : undefined
      };
    },
    getProbe(context: IntegrationDetectionContext) {
      const binary = options.binaryName ?? options.executable.trim().split(/\s+/, 1)[0];
      if (!context.node) return versionProbe(context.rootPath, context.platform, binary);
      const manager = context.node.packageManager;
      if (manager === 'npm') {
        return {
          executable: commandExecutable(context.platform, 'npm'),
          args: ['exec', '--', binary, '--version'],
          cwd: context.rootPath,
          displayCommand: `npm exec -- ${binary} --version`,
          timeoutMs: 5000
        };
      }
      if (manager === 'pnpm') {
        return {
          executable: commandExecutable(context.platform, 'pnpm'),
          args: ['exec', binary, '--version'],
          cwd: context.rootPath,
          displayCommand: `pnpm exec ${binary} --version`,
          timeoutMs: 5000
        };
      }
      if (manager === 'bun') {
        return {
          executable: commandExecutable(context.platform, 'bun'),
          args: ['x', binary, '--version'],
          cwd: context.rootPath,
          displayCommand: `bunx ${binary} --version`,
          timeoutMs: 5000
        };
      }
      return {
        executable: commandExecutable(context.platform, 'yarn'),
        args: [binary, '--version'],
        cwd: context.rootPath,
        displayCommand: `yarn ${binary} --version`,
        timeoutMs: 5000
      };
    }
  };
}

function detectScript(
  scripts: Record<string, string>,
  options: NodeToolProviderOptions
): string | undefined {
  if (options.scriptNames) return firstScript(scripts, options.scriptNames);
  if (options.scriptPattern) return firstScriptContaining(scripts, options.scriptPattern);
  return undefined;
}

function integrationConfigurationStatus(
  options: NodeToolProviderOptions,
  signals: { script?: string; config?: string; dependency: boolean; binary?: string }
): ProjectIntegrationConfigurationStatus {
  if (options.configurationStatus) return options.configurationStatus(signals);
  return signals.script || signals.dependency || signals.binary ? 'configured' : 'partial';
}

function nodeToolCommand(
  context: IntegrationDetectionContext,
  options: NodeToolProviderOptions,
  script: string | undefined,
  dependencyEvidence: ProjectIntegrationEvidence | undefined,
  binary: string | undefined
): string {
  if (script && context.node) return packageScriptCommand(context.node.packageManager, script);
  if (dependencyEvidence && context.node) {
    return packageExecutableCommand(context.node.packageManager, options.executable);
  }
  if (binary) return options.executable;
  return context.node
    ? packageExecutableCommand(context.node.packageManager, options.executable)
    : options.executable;
}
