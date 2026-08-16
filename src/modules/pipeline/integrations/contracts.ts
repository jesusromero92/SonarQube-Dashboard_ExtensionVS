import type { PipelineStructuredResultParser } from '../results';
export type ProjectIntegrationCategory =
  | 'quality'
  | 'security-sast'
  | 'dependencies-sca'
  | 'formatting-lint'
  | 'tests'
  | 'iac'
  | 'containers'
  | 'sonarqube';

export type ProjectIntegrationDetectionSource =
  | 'dependency'
  | 'devDependency'
  | 'script'
  | 'config'
  | 'lockfile'
  | 'project-file'
  | 'plugin'
  | 'binary'
  | 'server';

export type ProjectIntegrationConfigurationStatus =
  | 'configured'
  | 'partial'
  | 'unknown';

export type ProjectIntegrationHealth = 'healthy' | 'warning' | 'unknown';
export type ProjectIntegrationVersionSource = 'installed' | 'declared' | 'server' | 'unknown';
export type ProjectIntegrationFailurePolicy = 'stop' | 'continue';

export interface ProjectIntegrationEvidence {
  source: ProjectIntegrationDetectionSource;
  value: string;
}

export interface ProjectIntegrationVersion {
  value: string;
  source: ProjectIntegrationVersionSource;
}

export interface ProjectIntegrationRecommendation {
  readonly anyOf: readonly string[];
  readonly reason: string;
  readonly priority?: number;
}

export interface ProjectIntegrationDescriptor {
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly category: ProjectIntegrationCategory;
  readonly failurePolicy: ProjectIntegrationFailurePolicy;
  readonly recommendation?: ProjectIntegrationRecommendation;
}

export interface ProjectIntegrationSetup {
  readonly hint: string;
  readonly command?: string;
}

export interface ProjectIntegrationProbe {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly displayCommand: string;
  readonly timeoutMs?: number;
}

export interface ProjectIntegrationProbeResult {
  readonly success: boolean;
  readonly command: string;
  readonly output: string;
  readonly exitCode: number;
  readonly timedOut: boolean;
  readonly durationMs: number;
}

export interface DetectedProjectIntegration {
  id: string;
  name: string;
  description: string;
  command: string;
  /** Primary evidence kept for backwards-compatible consumers. */
  evidence: string;
  evidences: ProjectIntegrationEvidence[];
  category: ProjectIntegrationCategory;
  failurePolicy: ProjectIntegrationFailurePolicy;
  configurationStatus: ProjectIntegrationConfigurationStatus;
  health: ProjectIntegrationHealth;
  version?: string;
  versionSource?: ProjectIntegrationVersionSource;
  probeSupported: boolean;
}

export interface ProjectIntegrationCatalogItem {
  id: string;
  name: string;
  description: string;
  category: ProjectIntegrationCategory;
  failurePolicy: ProjectIntegrationFailurePolicy;
  setupHint: string;
  setupCommand?: string;
  probeSupported: boolean;
  recommendationReason?: string;
  recommendationPriority?: number;
}

export interface PipelineIntegrationProvider {
  readonly descriptor: ProjectIntegrationDescriptor;
  readonly watchFiles?: readonly string[];
  detect(context: IntegrationDetectionContext): Promise<DetectedProjectIntegration | undefined>;
  getSetup(context: IntegrationDetectionContext): ProjectIntegrationSetup;
  getDisplayName?(context: IntegrationDetectionContext): string;
  getProbe?(
    context: IntegrationDetectionContext,
    integration: DetectedProjectIntegration
  ): ProjectIntegrationProbe;
  readonly parseResult?: PipelineStructuredResultParser;
}

export type NodePackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface PackageJsonShape {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packageManager?: string;
}

export interface NodeProjectContext {
  packageJson: PackageJsonShape;
  packageManager: NodePackageManager;
  declaredPackageManager?: string;
}

export interface IntegrationDetectionContext {
  readonly rootPath: string;
  readonly platform: NodeJS.Platform;
  readonly node?: NodeProjectContext;
}
