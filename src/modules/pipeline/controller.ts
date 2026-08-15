import * as path from 'node:path';
import * as vscode from 'vscode';
import { getFolderConfig } from '../../configuration';
import type { DashboardLanguage } from '../../i18n';
import {
  getDashboardLanguage,
  localizeAnalysisState,
  localizeRuntimeText
} from '../../i18n';
import {
  checkAnalysisPermission,
  fetchAnalysisBaselineData
} from '../../sonarClient';
import type {
  AnalysisPermissionStatus,
  FolderSonarFormConfig,
  RefreshSummary
} from '../../types';
import type {
  DashboardModuleBridge,
  ModuleConfigurationSaveContext,
  ModuleWebviewMessage
} from '../contracts';
import { isDashboardModuleEnabled } from '../manager';
import {
  createAnalysisBaselineSnapshot,
  compareAnalysisBaselines
} from './baseline';
import {
  getPipelineAnalysisConfig,
  getPipelineFolderConfig,
  normalizeScannerMode,
  savePipelineFolderConfig,
  type PipelineAnalysisConfig
} from './configuration';
import { AnalysisService, emptyAnalysisState } from './executionService';
import { createRunningPipelineHistoryEntry } from './history';
import type {
  AnalysisBaselineSnapshot,
  AnalysisExecutionOptions,
  AnalysisExecutionStep,
  AnalysisRequest,
  AnalysisState,
  PipelineRunHistoryEntry
} from './models';
import { detectProjectActions, type DetectedProjectIntegration } from './projectActions';
import { createDefaultPipelineSteps, normalizeRequestedPipelineSteps } from './requests';
import {
  createBuiltinPipelineTemplates,
  mergePipelineTemplates,
  parsePipelineTemplateYaml,
  PipelineTemplateStore,
  serializePipelineTemplateYaml,
  type PipelineTemplate
} from './templates';
import { detectScanner } from './scanner/detector';

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value) return value;
  }
  return '';
}

interface PipelineMessage extends ModuleWebviewMessage {
  analysisInclusions?: string;
  analysisExclusions?: string;
  buildCommand?: string;
  testCommand?: string;
  customScannerCommand?: string;
  preAnalysisCommands?: string;
  postAnalysisCommands?: string;
  scannerMode?: unknown;
  analysisSteps?: AnalysisExecutionStep[];
  templateName?: string;
  templateDescription?: string;
  templateId?: string;
  executionId?: string;
}

export class PipelineDashboardController implements vscode.Disposable {
  private bridge: DashboardModuleBridge | undefined;
  private analysisService: AnalysisService | undefined;
  private templateStore: PipelineTemplateStore | undefined;
  private pendingHistoryEntryId = '';
  private readonly analysisPermissions = new Map<string, AnalysisPermissionStatus>();
  private readonly analysisEmitter = new vscode.EventEmitter<AnalysisState>();
  private readonly languageEmitter = new vscode.EventEmitter<DashboardLanguage>();

  readonly onDidChangeAnalysis = this.analysisEmitter.event;
  readonly onDidChangeLanguage = this.languageEmitter.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  attachDashboard(bridge: DashboardModuleBridge): void {
    this.bridge = bridge;
  }

  activate(): void {
    if (this.analysisService) return;
    this.templateStore = new PipelineTemplateStore(this.context);
    this.analysisService = new AnalysisService(this.context, state => {
      const localized = localizeAnalysisState(state, this.language);
      this.postMessage({ type: 'analysisState', state: localized });
      this.analysisEmitter.fire(localized);
    });
  }

  deactivate(): void {
    if (!this.analysisService) return;
    this.analysisService.cancel();
    this.analysisService.dispose();
    this.analysisService = undefined;
    this.templateStore = undefined;
    const state = localizeAnalysisState(emptyAnalysisState(), this.language);
    this.postMessage({ type: 'analysisState', state });
    this.analysisEmitter.fire(state);
  }

  isRunning(): boolean {
    return this.analysisService?.isRunning() === true;
  }

  getAnalysisState(): AnalysisState {
    return localizeAnalysisState(
      this.analysisService?.getState() ?? emptyAnalysisState(),
      this.language
    );
  }

  refreshLanguage(): void {
    this.languageEmitter.fire(this.language);
    this.postMessage({ type: 'analysisState', state: this.getAnalysisState() });
  }

  onDashboardReady(): void {
    this.postMessage({ type: 'analysisState', state: this.getAnalysisState() });
  }

  onDashboardVisible(): void {
    this.postMessage({ type: 'analysisState', state: this.getAnalysisState() });
  }

  async confirmDisable(): Promise<boolean> {
    const confirmLabel = localizeRuntimeText('Desactivar', this.language);
    const text = this.isRunning()
      ? 'Hay un análisis de Pipeline en ejecución. Si desactivas el módulo Pipeline, el análisis se cancelará y sus vistas y funciones dejarán de estar disponibles. ¿Quieres continuar?'
      : '¿Seguro que quieres desactivar el módulo Pipeline? Sus vistas y funciones dejarán de estar disponibles hasta que vuelvas a activarlo.';
    const selected = await vscode.window.showWarningMessage(
      localizeRuntimeText(text, this.language),
      { modal: true },
      confirmLabel
    );
    return selected === confirmLabel;
  }

  async analyzeSelectedFolder(): Promise<void> {
    if (!isDashboardModuleEnabled('pipeline')) {
      await vscode.window.showInformationMessage(
        localizeRuntimeText(
          'El módulo Pipeline está desactivado. Actívalo en Configuración > Módulos para analizar el repositorio.',
          this.language
        )
      );
      await this.bridge?.showPage('configuration');
      return;
    }
    const confirmed = await vscode.window.showWarningMessage(
      localizeRuntimeText(
        'El análisis puede ejecutar herramientas, compilaciones y scripts del repositorio. ¿Quieres continuar?',
        this.language
      ),
      { modal: true },
      localizeRuntimeText('Analizar', this.language)
    );
    if (confirmed) {
      await this.analyzeRepository(this.bridge?.getSelectedFolderUri());
    }
  }

  cancel(): void {
    this.analysisService?.cancel();
  }

  async handleMessage(message: ModuleWebviewMessage): Promise<boolean> {
    const pipelineMessage = message as PipelineMessage;
    switch (pipelineMessage.type) {
      case 'saveAnalysisScope':
        await this.saveAnalysisScope(pipelineMessage);
        return true;
      case 'savePipeline':
        await this.savePipeline(pipelineMessage);
        return true;
      case 'savePipelineTemplate':
        await this.savePipelineTemplate(pipelineMessage);
        return true;
      case 'deletePipelineTemplate':
        await this.deletePipelineTemplate(pipelineMessage);
        return true;
      case 'exportPipelineTemplate':
        await this.exportPipelineTemplate(pipelineMessage);
        return true;
      case 'importPipelineTemplate':
        await this.importPipelineTemplate(pipelineMessage);
        return true;
      case 'loadPipelineHistory':
        await this.sendPipelineHistory(pipelineMessage.folderUri);
        return true;
      case 'clearPipelineHistory':
        await this.clearPipelineHistory(pipelineMessage.folderUri);
        return true;
      case 'analyze':
        await this.analyzeRepository(pipelineMessage.folderUri, {
          steps: normalizeRequestedPipelineSteps(pipelineMessage.analysisSteps)
        });
        return true;
      case 'cancelAnalysis':
        this.cancel();
        return true;
      default:
        return false;
    }
  }

  async configurationState(
    folder: vscode.WorkspaceFolder | undefined,
    form: FolderSonarFormConfig | undefined,
    connectionDraftDirty: boolean
  ): Promise<Record<string, unknown>> {
    if (!folder || !form) {
      return this.emptyConfigurationState();
    }

    const config = await getPipelineFolderConfig(this.context, folder);
    const rootPath = this.analysisRoot(folder, form.baseDir) ?? folder.uri.fsPath;
    const actions = await detectProjectActions(rootPath);
    const templates = mergePipelineTemplates(
      createBuiltinPipelineTemplates(
        actions,
        firstNonEmpty(config.buildCommand, actions.buildCommand),
        firstNonEmpty(config.testCommand, actions.testCommand)
      ),
      await this.getTemplateStore().list(folder.uri.toString())
    );
    const permission = connectionDraftDirty
      ? 'unknown'
      : await this.analysisPermission(folder);

    return {
      ...config,
      analysisInclusions: connectionDraftDirty ? '' : config.analysisInclusions,
      analysisExclusions: connectionDraftDirty ? '' : config.analysisExclusions,
      detectedBuildCommand: actions.buildCommand ?? '',
      detectedTestCommand: actions.testCommand ?? '',
      detectedIntegrations: actions.integrations,
      pipelineTemplates: templates,
      analysisPermission: permission,
      pipelineModuleEnabled: true
    };
  }

  emptyConfigurationState(): Record<string, unknown> {
    return {
      scannerMode: 'auto',
      analysisInclusions: '',
      analysisExclusions: '',
      buildCommand: '',
      testCommand: '',
      detectedBuildCommand: '',
      detectedTestCommand: '',
      detectedIntegrations: [],
      pipelineTemplates: [],
      customScannerCommand: '',
      preAnalysisCommands: '',
      postAnalysisCommands: '',
      analysisPermission: 'unknown',
      pipelineModuleEnabled: isDashboardModuleEnabled('pipeline')
    };
  }

  async saveConfiguration(
    folder: vscode.WorkspaceFolder,
    message: ModuleWebviewMessage,
    saveContext: ModuleConfigurationSaveContext
  ): Promise<Record<string, unknown>> {
    const value = message as PipelineMessage;
    const analysisInclusions = saveContext.connectionChanged
      ? ''
      : (value.analysisInclusions ?? '').trim();
    const analysisExclusions = saveContext.connectionChanged
      ? ''
      : (value.analysisExclusions ?? '').trim();
    await savePipelineFolderConfig(this.context, folder, {
      scannerMode: normalizeScannerMode(value.scannerMode),
      analysisInclusions,
      analysisExclusions,
      buildCommand: value.buildCommand ?? '',
      testCommand: value.testCommand ?? '',
      customScannerCommand: value.customScannerCommand ?? '',
      preAnalysisCommands: value.preAnalysisCommands ?? '',
      postAnalysisCommands: value.postAnalysisCommands ?? ''
    });
    this.analysisPermissions.delete(folder.uri.toString());
    const form = await getPipelineFolderConfig(this.context, folder);
    const rootPath = this.analysisRoot(folder, (await getFolderConfig(this.context, folder))?.baseDir) ?? folder.uri.fsPath;
    const actions = await detectProjectActions(rootPath);
    const templates = mergePipelineTemplates(
      createBuiltinPipelineTemplates(
        actions,
        firstNonEmpty(form.buildCommand, actions.buildCommand),
        firstNonEmpty(form.testCommand, actions.testCommand)
      ),
      await this.getTemplateStore().list(folder.uri.toString())
    );
    const permission = await this.analysisPermission(folder);
    return {
      ...form,
      detectedBuildCommand: actions.buildCommand ?? '',
      detectedTestCommand: actions.testCommand ?? '',
      detectedIntegrations: actions.integrations,
      pipelineTemplates: templates,
      analysisPermission: permission,
      pipelineModuleEnabled: true
    };
  }

  async collectDiagnosticsContribution(
    folder: vscode.WorkspaceFolder | undefined
  ): Promise<Record<string, unknown>> {
    if (!folder) {
      return { scanner: '', scannerKind: '', scannerEvidence: '', commands: [], tools: [] };
    }
    const pipeline = await getPipelineFolderConfig(this.context, folder);
    const sonar = await getFolderConfig(this.context, folder);
    const rootPath = this.analysisRoot(folder, sonar?.baseDir) ?? folder.uri.fsPath;
    const errors: string[] = [];
    let scanner = '';
    let scannerKind = '';
    let scannerEvidence = '';
    let commands: Array<Record<string, string>> = [];
    let tools: Array<Record<string, string>> = [];
    try {
      const actions = await detectProjectActions(rootPath);
      commands = [];
      if (actions.buildCommand) {
        commands.push({
          name: 'Compilar el proyecto',
          command: actions.buildCommand,
          source: 'Detectado automáticamente',
          evidence: actions.evidence ?? ''
        });
      }
      if (actions.testCommand) {
        commands.push({
          name: 'Ejecutar tests',
          command: actions.testCommand,
          source: 'Detectado automáticamente',
          evidence: actions.evidence ?? ''
        });
      }
      tools = actions.integrations.map((integration: DetectedProjectIntegration) => ({
        name: integration.name,
        command: integration.command,
        category: integration.category,
        evidence: integration.evidence ?? ''
      }));
    } catch (error) {
      errors.push(`No se pudieron detectar comandos y herramientas: ${this.errorMessage(error)}`);
    }
    try {
      const detected = await detectScanner(rootPath, pipeline.scannerMode);
      scanner = detected.label;
      scannerKind = detected.kind;
      scannerEvidence = detected.evidence;
    } catch (error) {
      errors.push(`No se pudo detectar el scanner: ${this.errorMessage(error)}`);
    }
    return { scanner, scannerKind, scannerEvidence, commands, tools, moduleDiagnosticErrors: errors };
  }

  async getPipelineExecutions(): Promise<PipelineRunHistoryEntry[]> {
    return this.getExecutions();
  }

  async showPipelineExecution(executionId: string): Promise<void> {
    await this.showExecution(executionId);
  }

  async getExecutions(): Promise<PipelineRunHistoryEntry[]> {
    if (!this.analysisService || !isDashboardModuleEnabled('pipeline')) return [];
    const folder = this.bridge?.getWorkspaceFolder(this.bridge.getSelectedFolderUri()) ??
      vscode.workspace.workspaceFolders?.[0];
    if (!folder) return [];
    try {
      return await this.pipelineHistoryEntries(folder);
    } catch {
      return [];
    }
  }

  async showExecution(executionId: string): Promise<void> {
    if (!isDashboardModuleEnabled('pipeline')) return;
    this.pendingHistoryEntryId = executionId;
    await this.bridge?.showPage('history');
  }

  dispose(): void {
    this.deactivate();
    this.analysisEmitter.dispose();
    this.languageEmitter.dispose();
  }

  private async saveAnalysisScope(message: PipelineMessage): Promise<void> {
    const folder = this.bridge?.getWorkspaceFolder(message.folderUri);
    if (!folder) {
      this.postMessage({
        type: 'analysisScopeSaveError',
        message: 'Abre una carpeta antes de guardar las inclusiones y exclusiones.'
      });
      return;
    }
    const sonar = await getFolderConfig(this.context, folder);
    if (!sonar || this.bridge?.isConnectionDraftDirty(folder.uri.toString())) {
      this.postMessage({
        type: 'analysisScopeSaveError',
        message: 'Sincroniza primero un proyecto antes de guardar las inclusiones y exclusiones.'
      });
      return;
    }
    const analysisInclusions = (message.analysisInclusions ?? '').trim();
    const analysisExclusions = (message.analysisExclusions ?? '').trim();
    try {
      await savePipelineFolderConfig(this.context, folder, {
        analysisInclusions,
        analysisExclusions
      });
      this.postMessage({ type: 'analysisScopeSaved', analysisInclusions, analysisExclusions });
    } catch (error) {
      this.postMessage({
        type: 'analysisScopeSaveError',
        message: `No se pudieron guardar las inclusiones y exclusiones: ${this.errorMessage(error)}`
      });
    }
  }

  private async savePipeline(message: PipelineMessage): Promise<void> {
    const folder = this.bridge?.getWorkspaceFolder(message.folderUri);
    if (!folder) {
      this.postMessage({ type: 'pipelineSaveError', message: 'Abre una carpeta antes de guardar el pipeline.' });
      return;
    }
    try {
      await savePipelineFolderConfig(this.context, folder, {
        buildCommand: message.buildCommand ?? '',
        testCommand: message.testCommand ?? '',
        preAnalysisCommands: message.preAnalysisCommands ?? '',
        postAnalysisCommands: message.postAnalysisCommands ?? ''
      });
      const sonar = await getFolderConfig(this.context, folder);
      const rootPath = this.analysisRoot(folder, sonar?.baseDir) ?? folder.uri.fsPath;
      const actions = await detectProjectActions(rootPath);
      const templates = mergePipelineTemplates(
        createBuiltinPipelineTemplates(
          actions,
          message.buildCommand ?? actions.buildCommand ?? '',
          message.testCommand ?? actions.testCommand ?? ''
        ),
        await this.getTemplateStore().list(folder.uri.toString())
      );
      this.postMessage({
        type: 'pipelineSaved',
        config: {
          buildCommand: message.buildCommand ?? '',
          testCommand: message.testCommand ?? '',
          detectedBuildCommand: actions.buildCommand ?? '',
          detectedTestCommand: actions.testCommand ?? '',
          detectedIntegrations: actions.integrations,
          pipelineTemplates: templates,
          preAnalysisCommands: message.preAnalysisCommands ?? '',
          postAnalysisCommands: message.postAnalysisCommands ?? ''
        }
      });
    } catch (error) {
      this.postMessage({ type: 'pipelineSaveError', message: `No se pudo guardar el pipeline: ${this.errorMessage(error)}` });
    }
  }

  private async pipelineTemplatesForFolder(folder: vscode.WorkspaceFolder): Promise<PipelineTemplate[]> {
    const sonar = await getFolderConfig(this.context, folder);
    const config = await getPipelineFolderConfig(this.context, folder);
    const rootPath = this.analysisRoot(folder, sonar?.baseDir) ?? folder.uri.fsPath;
    const actions = await detectProjectActions(rootPath);
    const builtin = createBuiltinPipelineTemplates(
      actions,
      firstNonEmpty(config.buildCommand, actions.buildCommand),
      firstNonEmpty(config.testCommand, actions.testCommand)
    );
    const saved = await this.getTemplateStore().list(folder.uri.toString());
    return mergePipelineTemplates(builtin, saved);
  }

  private async savePipelineTemplate(message: PipelineMessage): Promise<void> {
    const folder = this.bridge?.getWorkspaceFolder(message.folderUri ?? this.bridge.getSelectedFolderUri());
    const name = message.templateName?.trim() ?? '';
    if (!folder || !name || !message.analysisSteps?.length) {
      this.postMessage({ type: 'pipelineTemplateError', message: 'Indica un nombre y al menos un paso para guardar la plantilla.' });
      return;
    }
    try {
      const templateId = firstNonEmpty(message.templateId?.trim(), `custom-${Date.now().toString(36)}`);
      const builtin = templateId.startsWith('builtin-');
      await this.getTemplateStore().save(folder.uri.toString(), {
        id: templateId,
        name,
        description: firstNonEmpty(
          message.templateDescription?.trim(),
          builtin ? 'Plantilla integrada personalizada para este workspace.' : 'Plantilla personalizada del workspace.'
        ),
        builtin,
        steps: message.analysisSteps
      });
      this.postMessage({
        type: 'pipelineTemplatesUpdated',
        templates: await this.pipelineTemplatesForFolder(folder),
        templateId,
        message: 'Plantilla guardada.'
      });
    } catch (error) {
      this.postMessage({ type: 'pipelineTemplateError', message: `No se pudo guardar la plantilla: ${this.errorMessage(error)}` });
    }
  }

  private async deletePipelineTemplate(message: PipelineMessage): Promise<void> {
    const folder = this.bridge?.getWorkspaceFolder(message.folderUri ?? this.bridge.getSelectedFolderUri());
    if (!folder || !message.templateId) return;
    try {
      const selected = (await this.pipelineTemplatesForFolder(folder)).find(template => template.id === message.templateId);
      if (!selected) return;
      const resetBuiltin = selected.builtin === true;
      const action = localizeRuntimeText(resetBuiltin ? 'Restablecer' : 'Eliminar', this.language);
      const question = localizeRuntimeText(
        resetBuiltin
          ? '¿Restablecer la plantilla seleccionada a su configuración integrada?'
          : '¿Eliminar la plantilla seleccionada? Esta acción no se puede deshacer.',
        this.language
      );
      const confirmation = await vscode.window.showWarningMessage(`${question}\n\n${selected.name}`, { modal: true }, action);
      if (confirmation !== action) {
        this.postMessage({ type: 'pipelineTemplateActionCancelled', templateId: selected.id });
        return;
      }
      await this.getTemplateStore().delete(folder.uri.toString(), message.templateId);
      this.postMessage({
        type: 'pipelineTemplatesUpdated',
        templates: await this.pipelineTemplatesForFolder(folder),
        templateId: resetBuiltin ? message.templateId : '',
        message: resetBuiltin ? 'Plantilla integrada restablecida.' : 'Plantilla eliminada.'
      });
    } catch (error) {
      this.postMessage({ type: 'pipelineTemplateError', message: `No se pudo eliminar la plantilla: ${this.errorMessage(error)}` });
    }
  }

  private async exportPipelineTemplate(message: PipelineMessage): Promise<void> {
    const folder = this.bridge?.getWorkspaceFolder(message.folderUri ?? this.bridge.getSelectedFolderUri());
    if (!folder || !message.templateId) return;
    try {
      const template = (await this.pipelineTemplatesForFolder(folder)).find(item => item.id === message.templateId);
      if (!template) throw new Error('No se encontró la plantilla seleccionada.');
      const target = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.joinPath(folder.uri, '.sonarqube-dashboard.yml'),
        filters: { 'SonarQube Dashboard pipeline': ['yml', 'yaml'] },
        saveLabel: 'Exportar pipeline'
      });
      if (!target) return;
      await vscode.workspace.fs.writeFile(target, Buffer.from(serializePipelineTemplateYaml(template), 'utf8'));
      this.postMessage({ type: 'pipelineTemplatesUpdated', templates: await this.pipelineTemplatesForFolder(folder), message: 'Plantilla exportada.' });
    } catch (error) {
      this.postMessage({ type: 'pipelineTemplateError', message: `No se pudo exportar la plantilla: ${this.errorMessage(error)}` });
    }
  }

  private async importPipelineTemplate(message: PipelineMessage): Promise<void> {
    const folder = this.bridge?.getWorkspaceFolder(message.folderUri ?? this.bridge.getSelectedFolderUri());
    if (!folder) return;
    try {
      const selected = await vscode.window.showOpenDialog({
        defaultUri: folder.uri,
        canSelectMany: false,
        filters: { 'SonarQube Dashboard pipeline': ['yml', 'yaml'] },
        openLabel: 'Importar pipeline'
      });
      if (!selected?.[0]) return;
      const bytes = await vscode.workspace.fs.readFile(selected[0]);
      const template = parsePipelineTemplateYaml(Buffer.from(bytes).toString('utf8'));
      await this.getTemplateStore().save(folder.uri.toString(), template);
      this.postMessage({
        type: 'pipelineTemplatesUpdated',
        templates: await this.pipelineTemplatesForFolder(folder),
        templateId: template.id,
        message: 'Plantilla importada.'
      });
    } catch (error) {
      this.postMessage({ type: 'pipelineTemplateError', message: `No se pudo importar la plantilla: ${this.errorMessage(error)}` });
    }
  }

  private async pipelineHistoryEntries(folder: vscode.WorkspaceFolder): Promise<PipelineRunHistoryEntry[]> {
    const sonar = await getFolderConfig(this.context, folder);
    const rootPath = this.analysisRoot(folder, sonar?.baseDir) ?? folder.uri.fsPath;
    const saved = await this.getAnalysisService().listHistory(rootPath);
    const state = this.getAnalysisService().getState();
    if (!state.running) return saved;
    const project = sonar ?? {
      serverUrl: '', projectKey: '', projectName: folder.name, token: '', branch: '', baseDir: ''
    };
    return [createRunningPipelineHistoryEntry(rootPath, project, folder.name, state), ...saved];
  }

  private async sendPipelineHistory(folderUri?: string): Promise<void> {
    const folder = this.bridge?.getWorkspaceFolder(folderUri ?? this.bridge.getSelectedFolderUri());
    if (!folder) {
      this.postMessage({ type: 'pipelineHistory', entries: [], selectedEntryId: this.pendingHistoryEntryId });
      return;
    }
    try {
      this.postMessage({
        type: 'pipelineHistory',
        entries: await this.pipelineHistoryEntries(folder),
        selectedEntryId: this.pendingHistoryEntryId
      });
    } catch (error) {
      this.postMessage({ type: 'pipelineHistoryError', message: `No se pudo cargar el historial: ${this.errorMessage(error)}` });
    }
  }

  private async clearPipelineHistory(folderUri?: string): Promise<void> {
    const folder = this.bridge?.getWorkspaceFolder(folderUri ?? this.bridge.getSelectedFolderUri());
    if (!folder) return;
    const sonar = await getFolderConfig(this.context, folder);
    const rootPath = this.analysisRoot(folder, sonar?.baseDir) ?? folder.uri.fsPath;
    await this.getAnalysisService().clearHistory(rootPath);
    await this.sendPipelineHistory(folder.uri.toString());
  }

  private async analyzeRepository(
    folderUri?: string,
    requestedActions?: Partial<AnalysisExecutionOptions>
  ): Promise<void> {
    if (!isDashboardModuleEnabled('pipeline')) {
      this.postStatus('error', 'El módulo Pipeline está desactivado. Actívalo en Configuración > Módulos para analizar el repositorio.');
      return;
    }
    const service = this.getAnalysisService();
    if (service.isRunning()) {
      this.postMessage({ type: 'showAnalysisDialog' });
      return;
    }
    const folder = this.resolveAnalysisFolder(folderUri);
    if (!folder) {
      this.postStatus('error', 'Abre una carpeta antes de iniciar el análisis.');
      return;
    }
    if (!(await this.ensureTrustedWorkspace())) return;
    const request = await this.prepareAnalysis(folder, requestedActions);
    if (!request || !isDashboardModuleEnabled('pipeline')) return;
    this.bridge?.navigate('data');
    this.postMessage({ type: 'showAnalysisDialog' });
    try {
      await service.analyze(request);
      if (!this.isActive(service)) return;
      service.setRefreshing();
      const summary = await this.bridge!.refreshFromModule('analysis');
      if (!this.isActive(service)) return;
      this.bridge?.setRefreshSummary(summary, true);
      if (summary.errors.length === 0) {
        await this.updateAnalysisBaselineComparison(request, service);
      }
      this.reportRefreshResult(summary, service);
      this.bridge?.navigate('data');
    } catch (error) {
      this.handleAnalysisFailure(error, service);
    } finally {
      if (this.isActive(service)) await this.sendPipelineHistory(folder.uri.toString());
    }
  }

  private resolveAnalysisFolder(folderUri?: string): vscode.WorkspaceFolder | undefined {
    const requested = folderUri ?? this.bridge?.getSelectedFolderUri();
    const configured = this.bridge?.getWorkspaceFolder(requested);
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    const active = activeUri ? vscode.workspace.getWorkspaceFolder(activeUri) : undefined;
    return configured ?? active ?? vscode.workspace.workspaceFolders?.[0];
  }

  private async ensureTrustedWorkspace(): Promise<boolean> {
    if (vscode.workspace.isTrusted) return true;
    const manageTrust = localizeRuntimeText('Gestionar confianza', this.language);
    const action = await vscode.window.showWarningMessage(
      localizeRuntimeText(
        'Analizar el repositorio puede ejecutar herramientas y comandos del proyecto. Confía en el workspace antes de continuar.',
        this.language
      ),
      manageTrust
    );
    if (action === manageTrust) await vscode.commands.executeCommand('workbench.trust.manage');
    this.postStatus('error', 'Analizar el repositorio requiere confiar en el workspace.');
    return false;
  }

  private async prepareAnalysis(
    folder: vscode.WorkspaceFolder,
    requestedActions?: Partial<AnalysisExecutionOptions>
  ): Promise<AnalysisRequest | undefined> {
    const config = await getPipelineAnalysisConfig(this.context, folder);
    if (!config) {
      this.postStatus('error', 'Configura primero el servidor, el token y el proyecto.');
      this.bridge?.navigate('configuration');
      return undefined;
    }
    const permission = await checkAnalysisPermission(config);
    this.analysisPermissions.set(folder.uri.toString(), permission);
    if (permission === 'denied') {
      await this.bridge?.requestStateRefresh();
      this.postStatus('error', 'El token no tiene el permiso Ejecutar análisis para este proyecto de SonarQube.');
      return undefined;
    }
    const rootPath = this.analysisRoot(folder, config.baseDir);
    if (!rootPath) {
      this.postStatus('error', 'La subcarpeta configurada no pertenece al workspace.');
      return undefined;
    }
    const baseline = await this.captureAnalysisBaseline(config);
    const detected = await detectProjectActions(rootPath);
    const buildCommand = firstNonEmpty(config.buildCommand?.trim(), detected.buildCommand);
    const testCommand = firstNonEmpty(config.testCommand?.trim(), detected.testCommand);
    const requestedSteps = requestedActions?.steps ?? [];
    const steps = requestedSteps.length > 0
      ? requestedSteps
      : createDefaultPipelineSteps(config, buildCommand, testCommand);
    return { config, rootPath, actions: { steps }, baseline };
  }

  private async captureAnalysisBaseline(config: PipelineAnalysisConfig): Promise<AnalysisBaselineSnapshot | undefined> {
    try {
      return createAnalysisBaselineSnapshot(await fetchAnalysisBaselineData(config));
    } catch (error) {
      console.warn('[SonarQube Dashboard] no se pudo capturar la línea base previa al pipeline', error);
      return undefined;
    }
  }

  private async updateAnalysisBaselineComparison(
    request: AnalysisRequest,
    service: AnalysisService
  ): Promise<void> {
    if (!request.baseline) return;
    try {
      const after = createAnalysisBaselineSnapshot(await fetchAnalysisBaselineData(request.config));
      await service.setBaselineComparison(
        request,
        compareAnalysisBaselines(request.baseline, after, {
          projectKey: request.config.projectKey,
          branch: request.config.branch,
          serverUrl: request.config.serverUrl
        })
      );
    } catch (error) {
      console.warn('[SonarQube Dashboard] no se pudo completar la comparación antes/después', error);
    }
  }

  private reportRefreshResult(summary: RefreshSummary, service: AnalysisService): void {
    if (summary.errors.length > 0) {
      service.setRefreshError(summary.errors.join(' | '));
      return;
    }
    service.setRefreshCompleted(`Análisis finalizado. ${summary.published} issues encontrados.`);
  }

  private handleAnalysisFailure(error: unknown, service: AnalysisService): void {
    const state = service.getState();
    if (state.phase === 'cancelled') return;
    if (state.phase === 'refreshing') service.setRefreshError(this.errorMessage(error));
  }

  private isActive(service: AnalysisService): boolean {
    return isDashboardModuleEnabled('pipeline') && this.analysisService === service;
  }

  private async analysisPermission(folder: vscode.WorkspaceFolder): Promise<AnalysisPermissionStatus> {
    const key = folder.uri.toString();
    const cached = this.analysisPermissions.get(key);
    if (cached) return cached;
    const config = await getFolderConfig(this.context, folder);
    if (!config) return 'unknown';
    try {
      const permission = await checkAnalysisPermission(config);
      this.analysisPermissions.set(key, permission);
      return permission;
    } catch {
      return 'unknown';
    }
  }

  private analysisRoot(folder: vscode.WorkspaceFolder, baseDir?: string): string | undefined {
    const normalized = (baseDir ?? '').trim().replaceAll('\\', '/');
    const segments = normalized.split('/').map(segment => segment.trim()).filter(Boolean);
    if (segments.includes('..')) return undefined;
    const root = path.resolve(folder.uri.fsPath, ...segments);
    const relative = path.relative(folder.uri.fsPath, root);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return undefined;
    return root;
  }

  private get language() {
    return this.bridge?.getLanguage() ?? getDashboardLanguage();
  }

  private getAnalysisService(): AnalysisService {
    this.activate();
    if (!this.analysisService) throw new Error('El módulo Pipeline está desactivado.');
    return this.analysisService;
  }

  private getTemplateStore(): PipelineTemplateStore {
    this.activate();
    if (!this.templateStore) throw new Error('El módulo Pipeline está desactivado.');
    return this.templateStore;
  }

  private postMessage(message: Record<string, unknown>): void {
    this.bridge?.postMessage(message);
  }

  private postStatus(kind: 'loading' | 'success' | 'error', message: string): void {
    this.bridge?.postStatus(kind, message);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
