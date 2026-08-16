export {
  createIntegrationDetectionContext,
  dependencyAuditCommand,
  detectNodePackageManager,
  nodeDevInstallCommand,
  nodeInstallCommand,
  packageExecutableCommand,
  packageManagerLockFiles,
  packageScriptCommand
} from './context';
export {
  detectIntegrationsFromProviders,
  detectRegisteredIntegrations,
  getRegisteredIntegrationCatalog,
  getRecommendedIntegrationCatalog,
  getRegisteredIntegrationProvider,
  getRegisteredIntegrationWatchFiles,
  PIPELINE_INTEGRATION_PROVIDERS
} from './registry';
export type {
  DetectedProjectIntegration,
  IntegrationDetectionContext,
  NodePackageManager,
  NodeProjectContext,
  PackageJsonShape,
  PipelineIntegrationProvider,
  ProjectIntegrationCatalogItem,
  ProjectIntegrationCategory,
  ProjectIntegrationConfigurationStatus,
  ProjectIntegrationDetectionSource,
  ProjectIntegrationDescriptor,
  ProjectIntegrationEvidence,
  ProjectIntegrationFailurePolicy,
  ProjectIntegrationHealth,
  ProjectIntegrationRecommendation,
  ProjectIntegrationProbe,
  ProjectIntegrationSetup,
  ProjectIntegrationVersion,
  ProjectIntegrationVersionSource
} from './contracts';

export { versionProbe } from './probe';
