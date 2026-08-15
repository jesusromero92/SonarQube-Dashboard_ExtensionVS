export {
  getDashboardModuleState,
  isDashboardModuleEnabled,
  setDashboardModuleEnabled,
  updateDashboardModuleContexts
} from './manager';
export type { DashboardModuleState } from './manager';
export {
  ANALYZE_REPOSITORY_CAPABILITY_COMMAND
} from './constants';
export { DashboardModuleRuntime } from './runtime';
export { createDashboardModuleRuntime } from './registry';
export type {
  DashboardModule,
  DashboardModuleBridge,
  DashboardModuleCapability,
  DashboardModuleDefinition,
  DashboardModuleId,
  DashboardModulesRuntime,
  IssueOverlaySnapshot,
  ModuleActivationContext,
  ModuleConfigurationSaveContext,
  ModuleWebviewContribution,
  ModuleWebviewMessage
} from './contracts';
