import * as vscode from 'vscode';
import { localizeRuntimeText } from './i18n/runtime';
import type { IssueDiagnosticPresentation, IssueDiagnosticSnapshot } from '../../issueDiagnostics';
import type { FolderSonarFormConfig } from '../../types';
import type {
  DashboardModule,
  DashboardModuleBridge,
  DashboardModuleCapability,
  IssueOverlaySnapshot,
  ModuleActivationContext,
  ModuleConfigurationSaveContext,
  ModuleWebviewMessage
} from '../contracts';
import {
  CLEAR_LAST_SOLVED_REMEDIATION_RESULTS_COMMAND,
  CLEAR_LAST_STILL_DETECTED_REMEDIATION_RESULTS_COMMAND,
  CLEAR_LIVE_REMEDIATION_SESSION_COMMAND,
  LOCALLY_MODIFIED_ISSUES_TREE_VIEW_ID,
  OPEN_LOCALLY_MODIFIED_ISSUE_COMMAND,
  REVERT_LIVE_REMEDIATION_CHANGE_COMMAND,
  REFRESH_LIVE_REMEDIATION_COMMAND,
  SHOW_LIVE_REMEDIATION_DIFF_COMMAND,
  SONARQUBE_FOR_IDE_EXTENSION_ID
} from './constants';
import { LiveRemediationManager } from './manager';
import { clearPersistedRemediationState } from './persistence';
import { LocallyModifiedIssuesTreeProvider } from './treeView';
import { LIVE_REMEDIATION_WEBVIEW_CONTRIBUTION } from './webview';

function issueKey(argument: unknown): string | undefined {
  if (typeof argument === 'string' && argument.trim()) return argument;
  if (!argument || typeof argument !== 'object') return undefined;
  const candidate = argument as { issue?: { key?: unknown }; key?: unknown };
  if (typeof candidate.issue?.key === 'string' && candidate.issue.key.trim()) {
    return candidate.issue.key;
  }
  return typeof candidate.key === 'string' && candidate.key.trim()
    ? candidate.key
    : undefined;
}

export class LiveRemediationModule implements DashboardModule {
  readonly id = 'liveRemediation' as const;
  readonly displayName = 'Live Remediation';
  readonly webview = LIVE_REMEDIATION_WEBVIEW_CONTRIBUTION;

  private bridge: DashboardModuleBridge | undefined;
  private manager: LiveRemediationManager | undefined;
  private tree: LocallyModifiedIssuesTreeProvider | undefined;
  private readonly activeDisposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly diagnostics: IssueDiagnosticPresentation,
    private readonly analyzeCapabilityCommand: string,
    private readonly onOverlayChanged: () => void
  ) {}

  attachDashboard(bridge: DashboardModuleBridge): void {
    this.bridge = bridge;
  }

  activate(context: ModuleActivationContext): void {
    if (this.manager) return;
    const manager = new LiveRemediationManager(
      this.context,
      this.diagnostics,
      REFRESH_LIVE_REMEDIATION_COMMAND
    );
    const tree = new LocallyModifiedIssuesTreeProvider(
      manager,
      this.analyzeCapabilityCommand
    );
    this.manager = manager;
    this.tree = tree;
    this.activeDisposables.push(
      manager,
      tree,
      manager.onDidChange(() => this.onOverlayChanged()),
      vscode.window.registerTreeDataProvider(LOCALLY_MODIFIED_ISSUES_TREE_VIEW_ID, tree),
      vscode.commands.registerCommand(
        REFRESH_LIVE_REMEDIATION_COMMAND,
        () => this.bridge?.refreshFromModule('sync')
      ),
      vscode.commands.registerCommand(OPEN_LOCALLY_MODIFIED_ISSUE_COMMAND, (argument: unknown) => {
        const key = issueKey(argument);
        return key ? manager.revealLocallyModifiedIssue(key) : undefined;
      }),
      vscode.commands.registerCommand(SHOW_LIVE_REMEDIATION_DIFF_COMMAND, (argument: unknown) => {
        const key = issueKey(argument);
        return key ? manager.showIssueDiff(key) : undefined;
      }),
      vscode.commands.registerCommand(REVERT_LIVE_REMEDIATION_CHANGE_COMMAND, (argument: unknown) => {
        const key = issueKey(argument);
        return key ? manager.revertLocallyModifiedIssue(key) : undefined;
      }),
      vscode.commands.registerCommand(
        CLEAR_LIVE_REMEDIATION_SESSION_COMMAND,
        () => manager.clearRemediationSession()
      ),
      vscode.commands.registerCommand(
        CLEAR_LAST_SOLVED_REMEDIATION_RESULTS_COMMAND,
        () => manager.clearLastSolvedResults()
      ),
      vscode.commands.registerCommand(
        CLEAR_LAST_STILL_DETECTED_REMEDIATION_RESULTS_COMMAND,
        () => manager.clearLastStillDetectedResults()
      )
    );
    manager.applyServerSnapshot(context.issues, context.diagnostics, false);
    this.onOverlayChanged();
  }

  deactivate(): void {
    while (this.activeDisposables.length > 0) {
      this.activeDisposables.pop()?.dispose();
    }
    this.manager = undefined;
    this.tree = undefined;
    this.diagnostics.restoreServerSnapshot();
    this.onOverlayChanged();
  }

  async confirmDisable(): Promise<boolean> {
    const language = this.bridge?.getLanguage() ?? 'en';
    const confirmLabel = localizeRuntimeText('Desactivar', language);
    const selected = await vscode.window.showWarningMessage(
      localizeRuntimeText(
        '¿Seguro que quieres desactivar el módulo Live Remediation? Se detendrá el seguimiento local y se ocultará su vista. La sesión persistida se conservará para cuando vuelvas a activarlo y los diagnósticos normales de SonarQube seguirán funcionando.',
        language
      ),
      { modal: true },
      confirmLabel
    );
    return selected === confirmLabel;
  }

  affectsConfiguration(_event: vscode.ConfigurationChangeEvent): boolean {
    return false;
  }

  ownsMessage(_type: string | undefined): boolean {
    return false;
  }

  async handleWebviewMessage(_message: ModuleWebviewMessage): Promise<boolean> {
    return false;
  }

  async getConfigurationState(
    _folder: vscode.WorkspaceFolder | undefined,
    _form: FolderSonarFormConfig | undefined,
    _connectionDraftDirty: boolean,
    enabled: boolean
  ): Promise<Record<string, unknown>> {
    if (!enabled) return this.emptyConfigurationState(false);
    return this.configurationState();
  }

  async saveConfiguration(
    _folder: vscode.WorkspaceFolder,
    _message: ModuleWebviewMessage,
    _context: ModuleConfigurationSaveContext
  ): Promise<Record<string, unknown>> {
    return this.configurationState();
  }

  async resetConnectionScopedConfiguration(_folder: vscode.WorkspaceFolder): Promise<void> {
    // No connection-scoped configuration is owned by Live Remediation.
  }

  applyServerSnapshot(
    issues: readonly import('../../types').DashboardIssue[],
    diagnostics: IssueDiagnosticSnapshot,
    confirmLocalRemediation: boolean
  ): number {
    return this.manager?.applyServerSnapshot(
      issues,
      diagnostics,
      confirmLocalRemediation
    ) ?? 0;
  }

  getIssueOverlay(): IssueOverlaySnapshot {
    return {
      states: this.manager?.getStates() ?? new Map(),
      ranges: this.manager?.getRanges() ?? new Map()
    };
  }

  clearWorkspaceState(): void {
    if (this.manager) {
      this.manager.clear();
      return;
    }
    clearPersistedRemediationState(this.context);
  }

  refreshLanguage(): void {
    this.manager?.refreshLanguage();
    this.tree?.refresh();
  }

  onDashboardReady(): void {}

  onDashboardVisible(): void {}

  async collectDiagnosticsContribution(
    _folder: vscode.WorkspaceFolder | undefined
  ): Promise<Record<string, unknown>> {
    const extension = vscode.extensions.getExtension(SONARQUBE_FOR_IDE_EXTENSION_ID);
    return {
      moduleDiagnostics: [{
        moduleId: 'liveRemediation',
        title: 'Live Remediation',
        items: [
          {
            label: 'Estado del runtime',
            value: this.manager ? 'Activo' : 'Inactivo',
            status: this.manager ? 'healthy' : 'warning'
          },
          {
            label: 'SonarQube for IDE',
            value: extension ? (extension.isActive ? 'Activo' : 'Instalado') : 'No instalado',
            status: extension?.isActive ? 'healthy' : extension ? 'warning' : 'unknown'
          }
        ]
      }]
    };
  }

  hasCapability(_capability: DashboardModuleCapability): boolean {
    return false;
  }

  async executeCapability(_capability: DashboardModuleCapability): Promise<boolean> {
    return false;
  }

  configurationState(): Record<string, unknown> {
    const extension = vscode.extensions.getExtension(SONARQUBE_FOR_IDE_EXTENSION_ID);
    return {
      liveRemediationModuleEnabled: true,
      sonarIdeIntegration: {
        installed: Boolean(extension),
        active: extension?.isActive === true
      }
    };
  }

  emptyConfigurationState(enabled: boolean): Record<string, unknown> {
    return {
      liveRemediationModuleEnabled: enabled,
      sonarIdeIntegration: { installed: false, active: false }
    };
  }

  dispose(): void {
    this.deactivate();
  }
}
