export const MODULE_CONFIGURATION_KEYS = {
  pipeline: 'modules.pipeline.enabled',
  liveRemediation: 'modules.liveRemediation.enabled'
} as const;

export const MODULE_CONTEXT_KEYS = {
  pipeline: 'sonarQubeDashboard.module.pipeline.enabled',
  liveRemediation: 'sonarQubeDashboard.module.liveRemediation.enabled'
} as const;

export type DashboardModuleId = keyof typeof MODULE_CONFIGURATION_KEYS;

export const ANALYZE_REPOSITORY_CAPABILITY_COMMAND =
  'sonarQubeDashboard.moduleCapability.analyzeRepository';
