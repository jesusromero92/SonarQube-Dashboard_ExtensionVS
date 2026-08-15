import * as vscode from 'vscode';
import type { DashboardPage } from '../dashboard/contracts';
import type { DashboardLanguage } from '../i18n';
import type { IssueDiagnosticSnapshot } from '../issueDiagnostics';
import type { IssueLocalRemediationState } from '../issueLocalState';
import type { DashboardIssue, FolderSonarFormConfig, RefreshSummary } from '../types';
import type { DashboardModuleId } from './constants';
import type { DashboardModuleState } from './manager';

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

export type DashboardModuleCapability =
  | 'analyzeRepository';

export interface DashboardModule extends vscode.Disposable {
  readonly id: DashboardModuleId;
  readonly displayName: string;
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
  syncEnabledModules(): Promise<void>;
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
  dispose(): void;
}
