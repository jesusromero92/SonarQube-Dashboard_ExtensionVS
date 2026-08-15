import * as vscode from 'vscode';
import { DASHBOARD_CONFIGURATION_SECTION } from '../constants';
import type { IssueDiagnosticManager } from '../issueDiagnostics';
import type { DashboardIssue, FolderSonarFormConfig } from '../types';
import { ANALYZE_REPOSITORY_CAPABILITY_COMMAND } from './constants';
import type {
  DashboardModule,
  DashboardModuleBridge,
  DashboardModuleCapability,
  DashboardModuleDefinition,
  DashboardModulesRuntime,
  IssueOverlaySnapshot,
  ModuleConfigurationSaveContext,
  ModuleWebviewContribution,
  ModuleWebviewMessage
} from './contracts';
import {
  getDashboardModuleState,
  isDashboardModuleEnabled,
  registerDashboardModuleDefinitions,
  setDashboardModuleEnabled,
  updateDashboardModuleContexts,
  type DashboardModuleState
} from './manager';
import { composeModuleWebviewContributions } from './webview';

export class DashboardModuleRuntime implements DashboardModulesRuntime {
  private bridge: DashboardModuleBridge | undefined;
  private readonly loadedModules = new Map<string, DashboardModule>();
  private readonly disposables: vscode.Disposable[] = [];
  private syncQueue: Promise<void> = Promise.resolve();
  private lastSyncedSignature = '';

  constructor(
    private readonly definitions: readonly DashboardModuleDefinition[],
    private readonly issueDiagnostics: IssueDiagnosticManager,
    private readonly onIssueOverlayChanged: () => void
  ) {
    registerDashboardModuleDefinitions(definitions);
    this.disposables.push(vscode.commands.registerCommand(
      ANALYZE_REPOSITORY_CAPABILITY_COMMAND,
      () => this.executeCapability('analyzeRepository')
    ));
  }

  attachDashboard(bridge: DashboardModuleBridge): void {
    this.bridge = bridge;
    for (const module of this.loadedModules.values()) module.attachDashboard(bridge);
  }

  getState(): DashboardModuleState {
    return getDashboardModuleState();
  }

  getWebviewContribution(): ModuleWebviewContribution {
    const state = getDashboardModuleState();
    return composeModuleWebviewContributions(
      this.definitions,
      [...this.loadedModules.values()]
        .filter(module => state[module.id])
        .map(module => module.webview)
    );
  }

  affectsConfiguration(event: vscode.ConfigurationChangeEvent): boolean {
    return this.affectsLifecycleConfiguration(event)
      || [...this.loadedModules.values()].some(module => module.affectsConfiguration(event));
  }

  affectsLifecycleConfiguration(event: vscode.ConfigurationChangeEvent): boolean {
    return this.definitions.some(definition => event.affectsConfiguration(
      `${DASHBOARD_CONFIGURATION_SECTION}.${definition.configurationKey}`
    ));
  }

  async syncEnabledModules(): Promise<boolean> {
    return this.enqueueLifecycle(() => this.performModuleSync());
  }

  private enqueueLifecycle<T>(operation: () => Promise<T>): Promise<T> {
    const scheduled = this.syncQueue
      .catch(() => undefined)
      .then(operation);
    this.syncQueue = scheduled.then(() => undefined, () => undefined);
    return scheduled;
  }

  private async performModuleSync(): Promise<boolean> {
    const state = getDashboardModuleState();
    const signature = this.definitions
      .map(definition => `${definition.id}:${state[definition.id] ? '1' : '0'}`)
      .join('|');
    const runtimeMatchesState = this.definitions.every(
      definition => Boolean(state[definition.id]) === this.loadedModules.has(definition.id)
    );
    if (signature === this.lastSyncedSignature && runtimeMatchesState) return false;

    let changed = signature !== this.lastSyncedSignature || !runtimeMatchesState;

    for (const definition of this.definitions) {
      const module = this.loadedModules.get(definition.id);
      if (state[definition.id]) {
        try {
          if (await this.loadAndActivate(definition)) changed = true;
        } catch (error) {
          // Never leave the persisted state claiming that a module is enabled
          // when its lazy implementation could not be started.
          state[definition.id] = false;
          await setDashboardModuleEnabled(definition.id, false);
          this.reportModuleError(definition, error);
          changed = true;
        }
      } else if (module) {
        try {
          this.unloadModule(definition.id);
        } catch (error) {
          this.reportModuleError(definition, error);
        }
        changed = true;
      }
    }

    await updateDashboardModuleContexts(state);
    this.onIssueOverlayChanged();
    this.lastSyncedSignature = this.getStateSignature(state);
    return changed;
  }

  async setEnabled(moduleId: string, enabled: boolean): Promise<boolean> {
    const definition = this.definitions.find(item => item.id === moduleId);
    if (!definition) return false;

    const currentlyEnabled = isDashboardModuleEnabled(moduleId);
    if (currentlyEnabled !== enabled && !(await this.confirmModuleChange(definition, enabled))) {
      return false;
    }

    return this.enqueueLifecycle(() => this.applyModuleEnabledState(definition, enabled));
  }

  private async applyModuleEnabledState(
    definition: DashboardModuleDefinition,
    enabled: boolean
  ): Promise<boolean> {
    const latestEnabled = isDashboardModuleEnabled(definition.id);
    if (latestEnabled === enabled) {
      return this.repairModuleRuntimeState(definition.id, enabled);
    }

    const transitionApplied = enabled
      ? await this.enableModule(definition)
      : await this.disableModule(definition);
    if (!transitionApplied) return false;

    await this.performModuleSync();
    this.bridge?.rebuildWebview();
    return true;
  }

  private async repairModuleRuntimeState(moduleId: string, enabled: boolean): Promise<boolean> {
    const repaired = await this.performModuleSync();
    if (repaired) this.bridge?.rebuildWebview();
    return isDashboardModuleEnabled(moduleId) === enabled;
  }

  private async enableModule(definition: DashboardModuleDefinition): Promise<boolean> {
    const moduleId = definition.id;
    let loadedForTransition = false;
    try {
      loadedForTransition = await this.loadAndActivate(definition);
      await setDashboardModuleEnabled(moduleId, true);
      return true;
    } catch (error) {
      if (loadedForTransition) this.tryUnloadAfterFailedEnable(moduleId);
      this.reportModuleError(definition, error);
      return false;
    }
  }

  private tryUnloadAfterFailedEnable(moduleId: string): void {
    try {
      this.unloadModule(moduleId);
    } catch {
      // Keep reporting the original activation/configuration failure.
    }
  }

  private async disableModule(definition: DashboardModuleDefinition): Promise<boolean> {
    try {
      await setDashboardModuleEnabled(definition.id, false);
      return true;
    } catch (error) {
      this.reportModuleError(definition, error);
      return false;
    }
  }

  private getStateSignature(state: DashboardModuleState): string {
    return this.definitions
      .map(definition => `${definition.id}:${state[definition.id] ? '1' : '0'}`)
      .join('|');
  }

  private async loadAndActivate(definition: DashboardModuleDefinition): Promise<boolean> {
    const existing = this.loadedModules.get(definition.id);
    if (existing) {
      existing.activate(this.getActivationContext());
      return false;
    }

    const module = await definition.create();
    try {
      if (this.bridge) module.attachDashboard(this.bridge);
      module.activate(this.getActivationContext());
      this.loadedModules.set(definition.id, module);
      return true;
    } catch (error) {
      module.dispose();
      throw error;
    }
  }

  private getActivationContext(): { issues: readonly DashboardIssue[]; diagnostics: import('../issueDiagnostics').IssueDiagnosticSnapshot } {
    const summary = this.bridge?.getRefreshSummary();
    return {
      issues: summary?.issues ?? [],
      diagnostics: this.issueDiagnostics.getServerSnapshot()
    };
  }

  private unloadModule(moduleId: string): void {
    const module = this.loadedModules.get(moduleId);
    this.loadedModules.delete(moduleId);
    module?.dispose();
  }

  private async confirmModuleChange(
    definition: DashboardModuleDefinition,
    enabled: boolean
  ): Promise<boolean> {
    const module = this.loadedModules.get(definition.id);
    if (!enabled && module) return module.confirmDisable();

    const { action, message } = this.getModuleChangeConfirmation(definition, enabled);
    const selected = await vscode.window.showWarningMessage(message, { modal: true }, action);
    return selected === action;
  }

  private getModuleChangeConfirmation(
    definition: DashboardModuleDefinition,
    enabled: boolean
  ): { action: string; message: string } {
    const spanish = this.bridge?.getLanguage() === 'es';
    if (enabled && spanish) {
      return {
        action: 'Activar',
        message: `¿Quieres activar el módulo ${definition.displayName}? Sus vistas y funciones se cargarán al confirmar.`
      };
    }
    if (enabled) {
      return {
        action: 'Enable',
        message: `Do you want to enable the ${definition.displayName} module? Its views and features will be loaded after confirmation.`
      };
    }
    if (spanish) {
      return {
        action: 'Desactivar',
        message: `¿Quieres desactivar el módulo ${definition.displayName}? Sus vistas y funciones dejarán de estar disponibles.`
      };
    }
    return {
      action: 'Disable',
      message: `Do you want to disable the ${definition.displayName} module? Its views and features will no longer be available.`
    };
  }

  private reportModuleError(definition: DashboardModuleDefinition, error: unknown): void {
    const detail = error instanceof Error ? error.message : String(error);
    const message = this.bridge?.getLanguage() === 'es'
      ? `No se pudo cambiar el estado del módulo ${definition.displayName}: ${detail}`
      : `The state of the ${definition.displayName} module could not be changed: ${detail}`;
    this.bridge?.postStatus('error', message);
    void vscode.window.showErrorMessage(message);
  }

  async handleWebviewMessage(message: ModuleWebviewMessage): Promise<boolean> {
    const owner = [...this.loadedModules.values()].find(module => module.ownsMessage(message.type));
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
    const result: Record<string, unknown> = Object.fromEntries(
      this.definitions.map(definition => [`${definition.id}ModuleEnabled`, state[definition.id]])
    );
    const contributions = await Promise.all(
      [...this.loadedModules.values()].map(module => module.getConfigurationState(
        folder, form, connectionDraftDirty, Boolean(state[module.id])
      ))
    );
    return Object.assign(result, ...contributions);
  }

  async resetConnectionScopedConfiguration(folder: vscode.WorkspaceFolder): Promise<void> {
    await Promise.all([...this.loadedModules.values()].map(
      module => module.resetConnectionScopedConfiguration(folder)
    ));
  }

  async saveConfiguration(
    folder: vscode.WorkspaceFolder,
    message: ModuleWebviewMessage,
    saveContext: ModuleConfigurationSaveContext
  ): Promise<Record<string, unknown>> {
    const state = getDashboardModuleState();
    const result: Record<string, unknown> = {};
    for (const module of this.loadedModules.values()) {
      Object.assign(result, state[module.id]
        ? await module.saveConfiguration(folder, message, saveContext)
        : await module.getConfigurationState(folder, undefined, false, false));
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
    for (const module of this.loadedModules.values()) {
      if (!state[module.id] || !module.applyServerSnapshot) continue;
      confirmations += module.applyServerSnapshot(issues, diagnostics, confirmLocalRemediation);
    }
    return confirmations;
  }

  getIssueOverlay(): IssueOverlaySnapshot {
    const state = getDashboardModuleState();
    const states = new Map<string, import('../issueLocalState').IssueLocalRemediationState>();
    const ranges = new Map<string, vscode.Range>();
    for (const module of this.loadedModules.values()) {
      if (!state[module.id] || !module.getIssueOverlay) continue;
      const overlay = module.getIssueOverlay();
      for (const [key, value] of overlay.states) states.set(key, value);
      for (const [key, value] of overlay.ranges) ranges.set(key, value);
    }
    return { states, ranges };
  }

  clearWorkspaceState(): void {
    for (const module of this.loadedModules.values()) module.clearWorkspaceState();
  }

  refreshLanguage(): void {
    for (const module of this.loadedModules.values()) module.refreshLanguage();
  }

  onDashboardReady(): void {
    for (const module of this.loadedModules.values()) {
      if (isDashboardModuleEnabled(module.id)) module.onDashboardReady();
    }
  }

  onDashboardVisible(): void {
    for (const module of this.loadedModules.values()) {
      if (isDashboardModuleEnabled(module.id)) module.onDashboardVisible();
    }
  }

  async collectDiagnosticsContribution(
    folder: vscode.WorkspaceFolder | undefined
  ): Promise<Record<string, unknown>> {
    const state = getDashboardModuleState();
    const result: Record<string, unknown> = {};
    for (const module of this.loadedModules.values()) {
      if (state[module.id]) Object.assign(result, await module.collectDiagnosticsContribution(folder));
    }
    return result;
  }

  dispose(): void {
    for (const module of this.loadedModules.values()) module.dispose();
    this.loadedModules.clear();
    while (this.disposables.length > 0) this.disposables.pop()?.dispose();
  }

  private async executeCapability(capability: DashboardModuleCapability): Promise<void> {
    for (const module of this.loadedModules.values()) {
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
