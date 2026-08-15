import * as vscode from 'vscode';
import { DASHBOARD_CONFIGURATION_SECTION } from '../constants';
import type { IssueDiagnosticManager } from '../issueDiagnostics';
import type { DashboardIssue, FolderSonarFormConfig } from '../types';
import {
  ANALYZE_REPOSITORY_CAPABILITY_COMMAND,
  MODULE_CONFIGURATION_KEYS
} from './constants';
import type {
  DashboardModule,
  DashboardModuleBridge,
  DashboardModuleCapability,
  DashboardModulesRuntime,
  IssueOverlaySnapshot,
  ModuleConfigurationSaveContext,
  ModuleWebviewMessage
} from './contracts';
import {
  getDashboardModuleState,
  isDashboardModuleEnabled,
  setDashboardModuleEnabled,
  updateDashboardModuleContexts,
  type DashboardModuleState
} from './manager';

export class DashboardModuleRuntime implements DashboardModulesRuntime {
  private bridge: DashboardModuleBridge | undefined;
  private readonly moduleList: readonly DashboardModule[];
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    modules: readonly DashboardModule[],
    private readonly issueDiagnostics: IssueDiagnosticManager,
    private readonly onIssueOverlayChanged: () => void
  ) {
    this.moduleList = [...modules];

    this.disposables.push(
      vscode.commands.registerCommand(
        ANALYZE_REPOSITORY_CAPABILITY_COMMAND,
        () => this.executeCapability('analyzeRepository')
      )
    );
  }

  attachDashboard(bridge: DashboardModuleBridge): void {
    this.bridge = bridge;
    for (const module of this.moduleList) module.attachDashboard(bridge);
  }

  getState(): DashboardModuleState {
    return getDashboardModuleState();
  }

  affectsConfiguration(event: vscode.ConfigurationChangeEvent): boolean {
    return this.affectsLifecycleConfiguration(event)
      || this.moduleList.some(module => module.affectsConfiguration(event));
  }

  affectsLifecycleConfiguration(event: vscode.ConfigurationChangeEvent): boolean {
    return Object.values(MODULE_CONFIGURATION_KEYS).some(key =>
      event.affectsConfiguration(`${DASHBOARD_CONFIGURATION_SECTION}.${key}`)
    );
  }

  async syncEnabledModules(): Promise<void> {
    const state = getDashboardModuleState();
    await updateDashboardModuleContexts(state);
    const summary = this.bridge?.getRefreshSummary();
    const activationContext = {
      issues: summary?.issues ?? [],
      diagnostics: this.issueDiagnostics.getServerSnapshot()
    };

    for (const module of this.moduleList) {
      if (state[module.id]) module.activate(activationContext);
      else module.deactivate();
    }
    this.onIssueOverlayChanged();
  }

  async setEnabled(moduleId: string, enabled: boolean): Promise<boolean> {
    const module = this.resolveModule(moduleId);
    if (!module) return false;
    const currentlyEnabled = isDashboardModuleEnabled(module.id);
    if (currentlyEnabled === enabled) return true;

    if (!enabled && !(await module.confirmDisable())) return false;

    await setDashboardModuleEnabled(module.id, enabled);
    await this.syncEnabledModules();
    await this.bridge?.requestStateRefresh();
    return true;
  }

  async handleWebviewMessage(message: ModuleWebviewMessage): Promise<boolean> {
    const owner = this.moduleList.find(module => module.ownsMessage(message.type));
    if (!owner) return false;
    if (!isDashboardModuleEnabled(owner.id)) {
      this.bridge?.postStatus(
        'error',
        this.bridge?.getLanguage() === 'es'
          ? `El módulo ${owner.displayName} está desactivado. Actívalo en Configuración > Módulos para usar esta función.`
          : `The ${owner.displayName} module is disabled. Enable it in Configuration > Modules to use this feature.`
      );
      return true;
    }
    return owner.handleWebviewMessage(message);
  }

  async getConfigurationState(
    folder: vscode.WorkspaceFolder | undefined,
    form: FolderSonarFormConfig | undefined,
    connectionDraftDirty: boolean
  ): Promise<Record<string, unknown>> {
    const state = getDashboardModuleState();
    const contributions = await Promise.all(
      this.moduleList.map(module => module.getConfigurationState(
        folder,
        form,
        connectionDraftDirty,
        state[module.id]
      ))
    );
    return Object.assign({}, ...contributions);
  }

  async resetConnectionScopedConfiguration(folder: vscode.WorkspaceFolder): Promise<void> {
    await Promise.all(
      this.moduleList.map(module => module.resetConnectionScopedConfiguration(folder))
    );
  }

  async saveConfiguration(
    folder: vscode.WorkspaceFolder,
    message: ModuleWebviewMessage,
    saveContext: ModuleConfigurationSaveContext
  ): Promise<Record<string, unknown>> {
    const state = getDashboardModuleState();
    const result: Record<string, unknown> = {};
    for (const module of this.moduleList) {
      Object.assign(
        result,
        state[module.id]
          ? await module.saveConfiguration(folder, message, saveContext)
          : await module.getConfigurationState(folder, undefined, false, false)
      );
    }
    return result;
  }

  applyServerSnapshot(
    issues: readonly DashboardIssue[],
    diagnostics: import('../issueDiagnostics').IssueDiagnosticSnapshot,
    confirmLocalRemediation: boolean
  ): number {
    const state = getDashboardModuleState();
    let confirmations = 0;
    for (const module of this.moduleList) {
      if (!state[module.id] || !module.applyServerSnapshot) continue;
      confirmations += module.applyServerSnapshot(
        issues,
        diagnostics,
        confirmLocalRemediation
      );
    }
    return confirmations;
  }

  getIssueOverlay(): IssueOverlaySnapshot {
    const state = getDashboardModuleState();
    const states = new Map<string, import('../issueLocalState').IssueLocalRemediationState>();
    const ranges = new Map<string, vscode.Range>();
    for (const module of this.moduleList) {
      if (!state[module.id] || !module.getIssueOverlay) continue;
      const overlay = module.getIssueOverlay();
      for (const [key, value] of overlay.states) states.set(key, value);
      for (const [key, value] of overlay.ranges) ranges.set(key, value);
    }
    return { states, ranges };
  }

  clearWorkspaceState(): void {
    for (const module of this.moduleList) module.clearWorkspaceState();
  }

  refreshLanguage(): void {
    for (const module of this.moduleList) module.refreshLanguage();
  }

  onDashboardReady(): void {
    for (const module of this.moduleList) {
      if (isDashboardModuleEnabled(module.id)) module.onDashboardReady();
    }
  }

  onDashboardVisible(): void {
    for (const module of this.moduleList) {
      if (isDashboardModuleEnabled(module.id)) module.onDashboardVisible();
    }
  }

  async collectDiagnosticsContribution(
    folder: vscode.WorkspaceFolder | undefined
  ): Promise<Record<string, unknown>> {
    const state = getDashboardModuleState();
    const result: Record<string, unknown> = {};
    for (const module of this.moduleList) {
      if (!state[module.id]) continue;
      Object.assign(result, await module.collectDiagnosticsContribution(folder));
    }
    return result;
  }

  dispose(): void {
    for (const module of this.moduleList) module.dispose();
    while (this.disposables.length > 0) this.disposables.pop()?.dispose();
  }

  private resolveModule(moduleId: string): DashboardModule | undefined {
    return this.moduleList.find(module => module.id === moduleId);
  }

  private async executeCapability(capability: DashboardModuleCapability): Promise<void> {
    for (const module of this.moduleList) {
      if (!isDashboardModuleEnabled(module.id) || !module.hasCapability(capability)) continue;
      if (await module.executeCapability(capability)) return;
    }

    await vscode.window.showInformationMessage(
      this.bridge?.getLanguage() === 'es'
        ? 'No hay ningún módulo activo que proporcione esta capacidad. Activa el módulo correspondiente en Configuración > Módulos.'
        : 'No enabled module provides this capability. Enable the corresponding module in Configuration > Modules.'
    );
    await this.bridge?.showPage('configuration');
  }
}
