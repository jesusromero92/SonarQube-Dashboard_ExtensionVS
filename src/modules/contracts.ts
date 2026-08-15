import * as vscode from 'vscode';
import type { DashboardPage } from '../dashboard/contracts';
import type { DashboardLanguage } from '../i18n';
import type { IssueDiagnosticSnapshot } from '../issueDiagnostics';
import type { IssueLocalRemediationState } from '../issueLocalState';
import type { DashboardIssue, FolderSonarFormConfig, RefreshSummary } from '../types';
import type { DashboardModuleState } from './manager';
import type { LocalizationBundle } from '../i18n/types';

export type DashboardModuleId = string;

export interface ModuleWebviewContribution {
  configurationTab?: string;
  configurationPanel?: string;
  styles?: string;
  scripts?: string;
  modals?: string;
  pages?: string;
  dataControls?: string;
  emptyActions?: string;
  moduleSettings?: string;
  localization?: LocalizationBundle;
}

export interface DashboardModuleDefinition {
  readonly id: DashboardModuleId;
  readonly displayName: string;
  readonly configurationKey: string;
  readonly contextKey: string;
  readonly defaultEnabled: boolean;
  readonly description: string;
  readonly localization?: LocalizationBundle;
  create(): Promise<DashboardModule>;
}

export type ModuleWebviewMessage = Record<string, unknown> & {
  type?: string;
  folderUri?: string;
};

export interface DashboardModuleBridge {
  readonly context: vscode.ExtensionContext;
  getLanguage(): DashboardLanguage;
  getSelectedFolderUri(): string | undefined;
  getWorkspaceFolder(folderUri?: string): vscode.WorkspaceFolder | undefined;
  isConnectionDraftDirty(folderUri: string): boolean;
  postMessage(message: Record<string, unknown>): void;
  postStatus(kind: 'loading' | 'success' | 'error', message: string): void;
  navigate(page: DashboardPage): void;
  showPage(page: DashboardPage): Promise<void>;
  refreshFromModule(source: 'sync' | 'analysis'): Promise<RefreshSummary>;
  setRefreshSummary(summary: RefreshSummary, revealResults?: boolean): void;
  getRefreshSummary(): RefreshSummary;
  requestStateRefresh(): Promise<void>;
  rebuildWebview(): void;
}

export interface ModuleConfigurationSaveContext {
  connectionChanged: boolean;
}

export interface IssueOverlaySnapshot {
  states: ReadonlyMap<string, IssueLocalRemediationState>;
  ranges: ReadonlyMap<string, vscode.Range>;
}

export interface ModuleActivationContext {
  issues: readonly DashboardIssue[];
  diagnostics: IssueDiagnosticSnapshot;
}

/** Open capability token: modules can add providers without extending a core union. */
export type DashboardModuleCapability = string;

export interface DashboardModule extends vscode.Disposable {
  readonly id: DashboardModuleId;
  readonly displayName: string;
  readonly webview: ModuleWebviewContribution;
  attachDashboard(bridge: DashboardModuleBridge): void;
  activate(context: ModuleActivationContext): void;
  deactivate(): void;
  confirmDisable(): Promise<boolean>;
  affectsConfiguration(event: vscode.ConfigurationChangeEvent): boolean;
  ownsMessage(type: string | undefined): boolean;
  handleWebviewMessage(message: ModuleWebviewMessage): Promise<boolean>;
  getConfigurationState(
    folder: vscode.WorkspaceFolder | undefined,
    form: FolderSonarFormConfig | undefined,
    connectionDraftDirty: boolean,
    enabled: boolean
  ): Promise<Record<string, unknown>>;
  saveConfiguration(
    folder: vscode.WorkspaceFolder,
    message: ModuleWebviewMessage,
    context: ModuleConfigurationSaveContext
  ): Promise<Record<string, unknown>>;
  resetConnectionScopedConfiguration(folder: vscode.WorkspaceFolder): Promise<void>;
  applyServerSnapshot?(
    issues: readonly DashboardIssue[],
    diagnostics: IssueDiagnosticSnapshot,
    confirmLocalRemediation: boolean
  ): number;
  getIssueOverlay?(): IssueOverlaySnapshot;
  clearWorkspaceState(): void;
  refreshLanguage(): void;
  onDashboardReady(): void;
  onDashboardVisible(): void;
  collectDiagnosticsContribution(
    folder: vscode.WorkspaceFolder | undefined
  ): Promise<Record<string, unknown>>;
  hasCapability(capability: DashboardModuleCapability): boolean;
  executeCapability(capability: DashboardModuleCapability): Promise<boolean>;
  dispose(): void;
}

export interface DashboardModulesRuntime extends vscode.Disposable {
  attachDashboard(bridge: DashboardModuleBridge): void;
  syncEnabledModules(): Promise<boolean>;
  affectsConfiguration(event: vscode.ConfigurationChangeEvent): boolean;
  affectsLifecycleConfiguration(event: vscode.ConfigurationChangeEvent): boolean;
  getState(): DashboardModuleState;
  setEnabled(moduleId: string, enabled: boolean): Promise<boolean>;
  handleWebviewMessage(message: ModuleWebviewMessage): Promise<boolean>;
  getConfigurationState(
    folder: vscode.WorkspaceFolder | undefined,
    form: FolderSonarFormConfig | undefined,
    connectionDraftDirty: boolean
  ): Promise<Record<string, unknown>>;
  resetConnectionScopedConfiguration(folder: vscode.WorkspaceFolder): Promise<void>;
  saveConfiguration(
    folder: vscode.WorkspaceFolder,
    message: ModuleWebviewMessage,
    context: ModuleConfigurationSaveContext
  ): Promise<Record<string, unknown>>;
  applyServerSnapshot(
    issues: readonly DashboardIssue[],
    diagnostics: IssueDiagnosticSnapshot,
    confirmLocalRemediation: boolean
  ): number;
  getIssueOverlay(): IssueOverlaySnapshot;
  clearWorkspaceState(): void;
  refreshLanguage(): void;
  onDashboardReady(): void;
  onDashboardVisible(): void;
  collectDiagnosticsContribution(
    folder: vscode.WorkspaceFolder | undefined
  ): Promise<Record<string, unknown>>;
  getWebviewContribution(): ModuleWebviewContribution;
  dispose(): void;
}
