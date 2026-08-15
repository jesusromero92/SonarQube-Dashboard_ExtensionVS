import * as vscode from 'vscode';
import type {
  DashboardModule,
  DashboardModuleBridge,
  DashboardModuleCapability,
  ModuleActivationContext,
  ModuleConfigurationSaveContext,
  ModuleWebviewMessage
} from '../contracts';
import type { FolderSonarFormConfig } from '../../types';
import { PIPELINE_CONFIGURATION_SECTION, savePipelineFolderConfig } from './configuration';
import { PIPELINE_COMMANDS, PIPELINE_EXECUTION_TREE_VIEW_ID } from './constants';
import { PipelineDashboardController } from './controller';
import { PipelineExecutionTreeProvider } from './executionTreeView';
import { PIPELINE_WEBVIEW_CONTRIBUTION } from './webview';

export class PipelineModule implements DashboardModule {
  readonly id = 'pipeline' as const;
  readonly displayName = 'Pipeline';
  readonly webview = PIPELINE_WEBVIEW_CONTRIBUTION;

  private tree: PipelineExecutionTreeProvider | undefined;
  private readonly activeDisposables: vscode.Disposable[] = [];
  private readonly controller: PipelineDashboardController;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.controller = new PipelineDashboardController(context);
  }

  attachDashboard(bridge: DashboardModuleBridge): void {
    this.controller.attachDashboard(bridge);
  }

  activate(_context: ModuleActivationContext): void {
    if (this.tree) return;
    this.controller.activate();
    const tree = new PipelineExecutionTreeProvider(this.controller);
    this.tree = tree;
    this.activeDisposables.push(
      vscode.window.registerTreeDataProvider(PIPELINE_EXECUTION_TREE_VIEW_ID, tree),
      vscode.commands.registerCommand(
        PIPELINE_COMMANDS.analyze,
        () => this.controller.analyzeSelectedFolder()
      ),
      vscode.commands.registerCommand(
        PIPELINE_COMMANDS.cancelAnalysis,
        () => this.controller.cancel()
      ),
      vscode.commands.registerCommand(
        PIPELINE_COMMANDS.openExecution,
        (executionId: string) => this.controller.showExecution(executionId)
      ),
      tree
    );
  }

  deactivate(): void {
    while (this.activeDisposables.length > 0) {
      this.activeDisposables.pop()?.dispose();
    }
    this.tree = undefined;
    this.controller.deactivate();
  }

  confirmDisable(): Promise<boolean> {
    return this.controller.confirmDisable();
  }

  affectsConfiguration(event: vscode.ConfigurationChangeEvent): boolean {
    return event.affectsConfiguration(PIPELINE_CONFIGURATION_SECTION);
  }

  ownsMessage(type: string | undefined): boolean {
    return Boolean(type && [
      'saveAnalysisScope',
      'savePipeline',
      'savePipelineTemplate',
      'deletePipelineTemplate',
      'exportPipelineTemplate',
      'importPipelineTemplate',
      'loadPipelineHistory',
      'clearPipelineHistory',
      'analyze',
      'cancelAnalysis'
    ].includes(type));
  }

  handleWebviewMessage(message: ModuleWebviewMessage): Promise<boolean> {
    return this.controller.handleMessage(message);
  }

  getConfigurationState(
    folder: vscode.WorkspaceFolder | undefined,
    form: FolderSonarFormConfig | undefined,
    connectionDraftDirty: boolean,
    enabled: boolean
  ): Promise<Record<string, unknown>> {
    if (!enabled) {
      return Promise.resolve({
        ...this.controller.emptyConfigurationState(),
        pipelineModuleEnabled: false
      });
    }
    return this.controller.configurationState(folder, form, connectionDraftDirty);
  }

  async saveConfiguration(
    folder: vscode.WorkspaceFolder,
    message: ModuleWebviewMessage,
    context: ModuleConfigurationSaveContext
  ): Promise<Record<string, unknown>> {
    return this.controller.saveConfiguration(folder, message, context);
  }

  async resetConnectionScopedConfiguration(folder: vscode.WorkspaceFolder): Promise<void> {
    await savePipelineFolderConfig(this.context, folder, {
      analysisInclusions: '',
      analysisExclusions: ''
    });
  }

  clearWorkspaceState(): void {
    // Pipeline history/templates intentionally remain available across Dashboard clears.
    // There is no transient workspace state owned by the module that should be erased here.
  }

  refreshLanguage(): void {
    this.controller.refreshLanguage();
  }

  onDashboardReady(): void {
    this.controller.onDashboardReady();
  }

  onDashboardVisible(): void {
    this.controller.onDashboardVisible();
  }

  collectDiagnosticsContribution(
    folder: vscode.WorkspaceFolder | undefined
  ): Promise<Record<string, unknown>> {
    return this.controller.collectDiagnosticsContribution(folder);
  }

  hasCapability(capability: DashboardModuleCapability): boolean {
    return capability === 'analyzeRepository';
  }

  async executeCapability(capability: DashboardModuleCapability): Promise<boolean> {
    if (capability !== 'analyzeRepository') return false;
    await this.controller.analyzeSelectedFolder();
    return true;
  }

  refreshTree(): void {
    this.tree?.refresh();
  }

  dispose(): void {
    this.deactivate();
    this.controller.dispose();
  }
}
