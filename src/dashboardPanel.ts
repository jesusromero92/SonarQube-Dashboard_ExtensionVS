import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  DASHBOARD_CONFIGURATION_KEYS,
  DASHBOARD_CONFIGURATION_SECTION,
  DASHBOARD_PANEL_VIEW_TYPE
} from './constants';
import {
  DashboardLanguage,
  getDashboardLanguage,
  localizeAnalysisState,
  localizeRuntimeText,
  normalizeDashboardLanguage,
  setDashboardLanguage
} from './i18n';
import {
  getFolderConfig,
  getFolderFormConfig,
  saveFolderConfig,
  tokenKey
} from './configuration';
import {
  ClearCallback,
  DashboardPage,
  DashboardWebviewMessage,
  RefreshCallback
} from './dashboard/contracts';
import { createEmptyRefreshSummary } from './dashboard/summary';
import { getDashboardHtml } from './dashboard/webview';
import { AnalysisService } from './scanner/analysisService';
import { CoverageDecorationManager } from './coverageDecorations';
import { IssueFlowController } from './issueFlowController';
import {
  checkAnalysisPermission,
  fetchHotspotDetail,
  fetchIssueLifecycle,
  fetchVisibleProjects,
  mutateIssue
} from './sonarClient';
import {
  AnalysisPermissionStatus,
  DashboardHotspot,
  DashboardIssue,
  IssueMutationRequest,
  RefreshSummary,
  ScannerMode
} from './types';

export class DashboardPanel {
  private panel: vscode.WebviewPanel | undefined;
  private selectedFolderUri: string | undefined;
  private projectLoadController: AbortController | undefined;
  private lastSummary: RefreshSummary = createEmptyRefreshSummary();
  private resultsVisible = false;
  private savingConfig = false;
  private loading = false;
  private currentPage: DashboardPage = 'data';
  private language: DashboardLanguage = getDashboardLanguage();
  private pendingIssueDetail: DashboardIssue | undefined;
  private pendingHotspotDetail: DashboardHotspot | undefined;
  private readonly analysisPermissions = new Map<string, AnalysisPermissionStatus>();
  private panelDisposables: vscode.Disposable[] = [];
  private readonly summaryEmitter = new vscode.EventEmitter<RefreshSummary>();
  private readonly loadingEmitter = new vscode.EventEmitter<boolean>();
  private readonly pageEmitter = new vscode.EventEmitter<DashboardPage>();
  private readonly languageEmitter = new vscode.EventEmitter<DashboardLanguage>();
  private readonly analysisService: AnalysisService;

  readonly onDidChangeSummary = this.summaryEmitter.event;
  readonly onDidChangeLoading = this.loadingEmitter.event;
  readonly onDidChangePage = this.pageEmitter.event;
  readonly onDidChangeLanguage = this.languageEmitter.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly refreshCallback: RefreshCallback,
    private readonly clearCallback: ClearCallback,
    private readonly coverageDecorations: CoverageDecorationManager,
    private readonly flowController: IssueFlowController
  ) {
    this.analysisService = new AnalysisService(context, state => {
      this.postMessage({
        type: 'analysisState',
        state: localizeAnalysisState(state, this.language)
      });
    });
  }

  async show(page: DashboardPage = this.currentPage): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One, false);
      await this.sendState();
      this.setRefreshSummary(this.lastSummary);
      this.navigate(page);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      DASHBOARD_PANEL_VIEW_TYPE,
      'SonarQube Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.attachPanel(panel);
    await this.sendState();
    this.setRefreshSummary(this.lastSummary);
    this.navigate(page);
  }

  async revive(panel: vscode.WebviewPanel): Promise<void> {
    this.attachPanel(panel);
    await this.sendState();
    this.setRefreshSummary(this.lastSummary);
    this.navigate(this.currentPage);
  }

  async refreshWorkspaceState(): Promise<void> {
    if (this.savingConfig) {
      return;
    }
    this.analysisPermissions.clear();
    await this.sendState();
  }

  setRefreshSummary(summary: RefreshSummary, revealResults = false): void {
    this.lastSummary = summary;
    if (revealResults) {
      this.resultsVisible = true;
    }
    this.postMessage({
      type: 'summary',
      summary,
      visible: this.resultsVisible
    });
    this.summaryEmitter.fire(summary);
  }

  getRefreshSummary(): RefreshSummary {
    return this.lastSummary;
  }

  isLoading(): boolean {
    return this.loading;
  }

  setLoading(loading: boolean): void {
    if (this.loading === loading) {
      return;
    }
    this.loading = loading;
    this.postMessage({ type: 'loading', loading });
    this.loadingEmitter.fire(loading);
  }

  getCurrentPage(): DashboardPage {
    return this.currentPage;
  }

  async showPage(page: DashboardPage): Promise<void> {
    await this.show(page);
  }

  async refresh(): Promise<void> {
    await this.refreshFromPanel();
  }

  async analyze(): Promise<void> {
    await this.analyzeRepository(this.selectedFolderUri);
  }

  cancelAnalysis(): void {
    this.analysisService.cancel();
  }

  async showQualityGate(): Promise<void> {
    await this.show('data');
    this.postMessage({ type: 'showQualityGate' });
  }

  async showCoverage(fileUri?: string): Promise<void> {
    await this.show('data');
    this.postMessage({ type: 'showCoverageView', fileUri });
  }

  async showIssueDetail(issue: DashboardIssue): Promise<void> {
    this.flowController.setIssue(issue);
    const panelWasOpen = Boolean(this.panel);
    this.pendingIssueDetail = issue;
    await this.show('data');
    if (panelWasOpen) {
      this.postPendingIssueDetail();
    }
  }

  async showHotspotDetail(hotspot: DashboardHotspot): Promise<void> {
    const panelWasOpen = Boolean(this.panel);
    this.pendingHotspotDetail = hotspot;
    await this.show('data');
    if (panelWasOpen) {
      this.postPendingHotspotDetail();
    }
  }

  private navigate(page: DashboardPage): void {
    this.currentPage = page;
    this.postMessage({ type: 'navigate', page });
    this.pageEmitter.fire(page);
  }

  dispose(): void {
    this.projectLoadController?.abort();
    this.analysisService.dispose();
    this.disposePanelListeners();
    this.panel?.dispose();
    this.panel = undefined;
    this.summaryEmitter.dispose();
    this.loadingEmitter.dispose();
    this.pageEmitter.dispose();
    this.languageEmitter.dispose();
  }

  private attachPanel(panel: vscode.WebviewPanel): void {
    this.disposePanelListeners();
    this.panel = panel;
    panel.title = 'SonarQube Dashboard';
    panel.iconPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      'media',
      'SonarQube.svg'
    );
    panel.webview.options = {
      enableScripts: true
    };
    panel.webview.html = getDashboardHtml(
      panel.webview,
      this.context.extensionUri,
      this.language
    );

    this.panelDisposables.push(
      panel.webview.onDidReceiveMessage(
        (message: DashboardWebviewMessage) => void this.handleMessage(message)
      ),
      panel.onDidDispose(() => {
        this.disposePanelListeners();
        this.panel = undefined;
      }),
      panel.onDidChangeViewState(event => {
        if (event.webviewPanel.visible) {
          void this.sendState();
          this.setRefreshSummary(this.lastSummary);
          this.postMessage({
            type: 'analysisState',
            state: localizeAnalysisState(this.analysisService.getState(), this.language)
          });
        }
      })
    );
  }

  private disposePanelListeners(): void {
    while (this.panelDisposables.length > 0) {
      this.panelDisposables.pop()?.dispose();
    }
  }

  private async handleMessage(message: DashboardWebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        await this.sendState();
        this.setRefreshSummary(this.lastSummary);
        this.postMessage({ type: 'loading', loading: this.loading });
        this.postMessage({
            type: 'analysisState',
            state: localizeAnalysisState(this.analysisService.getState(), this.language)
          });
        this.navigate(this.currentPage);
        this.postPendingIssueDetail();
        this.postPendingHotspotDetail();
        break;
      case 'selectFolder':
        this.selectedFolderUri = message.folderUri;
        await this.sendState();
        break;
      case 'setLanguage':
        await this.changeLanguage(normalizeDashboardLanguage(message.language));
        break;
      case 'navigate':
        if (message.page) {
          await this.showPage(message.page);
        }
        break;
      case 'loadHotspotDetail':
        await this.loadHotspotDetail(message);
        break;
      case 'loadIssueLifecycle':
        await this.loadIssueLifecycle(message);
        break;
      case 'mutateIssue':
        await this.mutateIssue(message);
        break;
      case 'loadCoverageDetail':
        await this.loadCoverageDetail(message);
        break;
      case 'selectFlowLocation':
        await this.selectFlowLocation(message);
        break;
      case 'loadProjects':
        await this.loadProjects(message);
        break;
      case 'save':
        await this.save(message);
        break;
      case 'refresh':
        await this.refreshFromPanel();
        break;
      case 'analyze':
        await this.analyzeRepository(message.folderUri);
        break;
      case 'cancelAnalysis':
        this.analysisService.cancel();
        break;
      case 'clear':
        this.clearCallback();
        this.lastSummary = createEmptyRefreshSummary();
        this.setRefreshSummary(this.lastSummary);
        this.postStatus('success', 'Se han eliminado los diagnósticos de Problems.');
        break;
      case 'openIssue':
        await this.openIssue(message);
        break;
      case 'openProblems':
        await vscode.commands.executeCommand('workbench.actions.view.problems');
        break;
    }
  }

  private getWorkspaceFolder(folderUri?: string): vscode.WorkspaceFolder | undefined {
    if (!folderUri) {
      return undefined;
    }

    const folders = vscode.workspace.workspaceFolders ?? [];
    return folders.find(folder => folder.uri.toString() === folderUri);
  }

  private async sendState(): Promise<void> {
    if (!this.panel) {
      return;
    }

    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 0) {
      this.postMessage({
        type: 'state',
        folders: [],
        selectedFolderUri: '',
        workspaceTrusted: vscode.workspace.isTrusted,
        language: this.language,
        config: {
          serverUrl: '',
          projectKey: '',
          branch: '',
          baseDir: '',
          hasToken: false,
          scannerMode: 'auto',
          buildCommand: '',
          customScannerCommand: '',
          notificationsEnabled: vscode.workspace.getConfiguration(DASHBOARD_CONFIGURATION_SECTION).get<boolean>(DASHBOARD_CONFIGURATION_KEYS.notificationsEnabled, true),
          significantIncreasePercent: vscode.workspace.getConfiguration(DASHBOARD_CONFIGURATION_SECTION).get<number>(DASHBOARD_CONFIGURATION_KEYS.significantIncreasePercent, 20),
          significantIncreaseMinimum: vscode.workspace.getConfiguration(DASHBOARD_CONFIGURATION_SECTION).get<number>(DASHBOARD_CONFIGURATION_KEYS.significantIncreaseMinimum, 5)
        }
      });
      return;
    }

    const activeFolder = vscode.window.activeTextEditor
      ? vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri)
      : undefined;

    const selectedFolder =
      this.getWorkspaceFolder(this.selectedFolderUri) ?? activeFolder ?? folders[0];
    this.selectedFolderUri = selectedFolder.uri.toString();

    const config = await getFolderFormConfig(this.context, selectedFolder);
    const analysisPermission = await this.analysisPermission(selectedFolder);

    this.postMessage({
      type: 'state',
      folders: folders.map(folder => ({
        name: folder.name,
        uri: folder.uri.toString()
      })),
      selectedFolderUri: this.selectedFolderUri,
      workspaceTrusted: vscode.workspace.isTrusted,
      language: this.language,
      config: {
        ...config,
        analysisPermission,
        notificationsEnabled: vscode.workspace.getConfiguration(DASHBOARD_CONFIGURATION_SECTION).get<boolean>(DASHBOARD_CONFIGURATION_KEYS.notificationsEnabled, true),
        significantIncreasePercent: vscode.workspace.getConfiguration(DASHBOARD_CONFIGURATION_SECTION).get<number>(DASHBOARD_CONFIGURATION_KEYS.significantIncreasePercent, 20),
        significantIncreaseMinimum: vscode.workspace.getConfiguration(DASHBOARD_CONFIGURATION_SECTION).get<number>(DASHBOARD_CONFIGURATION_KEYS.significantIncreaseMinimum, 5)
      }
    });
  }

  private async loadProjects(message: DashboardWebviewMessage): Promise<void> {
    const folder = this.getWorkspaceFolder(message.folderUri);
    if (!folder) {
      this.postStatus('error', 'Abre una carpeta antes de conectar con SonarQube.');
      return;
    }

    const serverUrl = (message.serverUrl ?? '').trim().replace(/\/+$/, '');
    if (!this.isValidHttpUrl(serverUrl)) {
      this.postStatus('error', 'Introduce una URL válida de SonarQube.');
      return;
    }

    const token = (message.token ?? '').trim() ||
      await this.context.secrets.get(tokenKey(folder));

    if (!token) {
      this.postStatus('error', 'Introduce un token para consultar los proyectos visibles.');
      return;
    }

    this.projectLoadController?.abort();
    this.projectLoadController = new AbortController();
    this.postMessage({ type: 'projectsLoading' });

    try {
      const projects = await fetchVisibleProjects(
        serverUrl,
        token,
        this.projectLoadController.signal
      );

      this.postMessage({
        type: 'projectsLoaded',
        projects
      });

      this.postStatus(
        'success',
        projects.length === 1
          ? 'Se ha encontrado 1 proyecto o aplicación visible.'
          : `Se han encontrado ${projects.length} proyectos y aplicaciones visibles.`
      );
    } catch (error) {
      if (this.projectLoadController.signal.aborted) {
        return;
      }
      this.postStatus('error', this.errorMessage(error));
    }
  }

  private async save(message: DashboardWebviewMessage): Promise<void> {
    const folder = this.getWorkspaceFolder(message.folderUri);
    if (!folder) {
      this.postStatus('error', 'Abre una carpeta antes de guardar la configuración.');
      return;
    }

    const serverUrl = (message.serverUrl ?? '').trim().replace(/\/+$/, '');
    const projectKey = (message.projectKey ?? '').trim();
    const token = (message.token ?? '').trim();
    const existingToken = await this.context.secrets.get(tokenKey(folder));

    if (!this.isValidHttpUrl(serverUrl)) {
      this.postStatus('error', 'Introduce una URL válida de SonarQube.');
      return;
    }

    if (!projectKey) {
      this.postStatus('error', 'Carga la lista y selecciona un proyecto o aplicación.');
      return;
    }

    if (!token && !existingToken) {
      this.postStatus('error', 'Introduce un token de SonarQube.');
      return;
    }

    this.savingConfig = true;
    try {
      const scannerMode = this.normalizeScannerMode(message.scannerMode);
      const dashboardConfiguration = vscode.workspace.getConfiguration(DASHBOARD_CONFIGURATION_SECTION);
      await Promise.all([
        dashboardConfiguration.update(DASHBOARD_CONFIGURATION_KEYS.notificationsEnabled, message.notificationsEnabled !== false, vscode.ConfigurationTarget.Global),
        dashboardConfiguration.update(DASHBOARD_CONFIGURATION_KEYS.significantIncreasePercent, Math.max(1, Number(message.significantIncreasePercent) || 20), vscode.ConfigurationTarget.Global),
        dashboardConfiguration.update(DASHBOARD_CONFIGURATION_KEYS.significantIncreaseMinimum, Math.max(1, Number(message.significantIncreaseMinimum) || 5), vscode.ConfigurationTarget.Global)
      ]);
      await saveFolderConfig(this.context, folder, {
        serverUrl,
        projectKey,
        branch: message.branch ?? '',
        baseDir: message.baseDir ?? '',
        token,
        scannerMode,
        buildCommand: message.buildCommand ?? '',
        customScannerCommand: message.customScannerCommand ?? ''
      });
      this.analysisPermissions.delete(folder.uri.toString());
      const savedConfig = await getFolderConfig(this.context, folder);
      const analysisPermission = savedConfig
        ? await checkAnalysisPermission(savedConfig)
        : 'unknown';
      this.analysisPermissions.set(folder.uri.toString(), analysisPermission);

      this.postMessage({
        type: 'configurationSaved',
        config: {
          serverUrl,
          projectKey,
          branch: message.branch ?? '',
          baseDir: message.baseDir ?? '',
          hasToken: Boolean(token || existingToken),
          analysisPermission,
          scannerMode,
          buildCommand: message.buildCommand ?? '',
          customScannerCommand: message.customScannerCommand ?? '',
          notificationsEnabled: message.notificationsEnabled !== false,
          significantIncreasePercent: Math.max(1, Number(message.significantIncreasePercent) || 20),
          significantIncreaseMinimum: Math.max(1, Number(message.significantIncreaseMinimum) || 5)
        }
      });
      this.postStatus('loading', 'Configuración guardada. Sincronizando issues…');
      const summary = await this.refreshCallback('sync');
      this.setRefreshSummary(summary, true);

      if (summary.errors.length > 0) {
        this.postStatus('error', summary.errors.join(' | '));
      } else {
        this.postStatus(
          'success',
          `${summary.published} issues encontrados.`
        );
        this.navigate('data');
      }
    } catch (error) {
      this.postStatus('error', this.errorMessage(error));
    } finally {
      this.savingConfig = false;
    }
  }

  private async analyzeRepository(folderUri?: string): Promise<void> {
    if (this.analysisService.isRunning()) {
      this.postMessage({ type: 'showAnalysisDialog' });
      return;
    }

    const activeFolder = vscode.window.activeTextEditor
      ? vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri)
      : undefined;
    const folder = this.getWorkspaceFolder(folderUri || this.selectedFolderUri)
      ?? activeFolder
      ?? vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      this.postStatus('error', 'Abre una carpeta antes de iniciar el análisis.');
      return;
    }

    if (!vscode.workspace.isTrusted) {
      const manageTrust = localizeRuntimeText('Gestionar confianza', this.language);
      const action = await vscode.window.showWarningMessage(
        localizeRuntimeText(
          'Analizar el repositorio puede ejecutar herramientas y comandos del proyecto. Confía en el workspace antes de continuar.',
          this.language
        ),
        manageTrust
      );
      if (action === manageTrust) {
        await vscode.commands.executeCommand('workbench.trust.manage');
      }
      this.postStatus('error', 'Analizar el repositorio requiere confiar en el workspace.');
      return;
    }

    const config = await getFolderConfig(this.context, folder);
    if (!config) {
      this.postStatus('error', 'Configura primero el servidor, el token y el proyecto.');
      this.navigate('configuration');
      return;
    }

    const analysisPermission = await checkAnalysisPermission(config);
    this.analysisPermissions.set(folder.uri.toString(), analysisPermission);
    if (analysisPermission === 'denied') {
      await this.sendState();
      this.postStatus(
        'error',
        'El token no tiene el permiso Ejecutar análisis para este proyecto de SonarQube.'
      );
      return;
    }

    const rootPath = this.analysisRoot(folder, config.baseDir);
    if (!rootPath) {
      this.postStatus('error', 'La subcarpeta configurada no pertenece al workspace.');
      return;
    }

    this.navigate('data');
    this.postMessage({ type: 'showAnalysisDialog' });

    try {
      await this.analysisService.analyze({ rootPath, config });
      this.analysisService.setRefreshing();
      const summary = await this.refreshCallback('analysis');
      this.setRefreshSummary(summary, true);
      if (summary.errors.length > 0) {
        const message = summary.errors.join(' | ');
        this.analysisService.setRefreshError(message);
        this.postStatus('error', message);
      } else {
        const message = `Análisis finalizado. ${summary.published} issues encontrados.`;
        this.analysisService.setRefreshCompleted(message);
        this.postStatus('success', message);
      }
      this.navigate('data');
    } catch (error) {
      if (this.analysisService.getState().phase !== 'cancelled') {
        this.postStatus('error', this.errorMessage(error));
      }
    }
  }

  private analysisRoot(folder: vscode.WorkspaceFolder, baseDir?: string): string | undefined {
    const normalized = (baseDir ?? '').trim().replace(/\\/g, '/');
    const segments = normalized
      .split('/')
      .map(segment => segment.trim())
      .filter(Boolean);
    if (segments.some(segment => segment === '..')) {
      return undefined;
    }
    const root = path.resolve(folder.uri.fsPath, ...segments);
    const relative = path.relative(folder.uri.fsPath, root);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return undefined;
    }
    return root;
  }

  private async analysisPermission(
    folder: vscode.WorkspaceFolder
  ): Promise<AnalysisPermissionStatus> {
    const key = folder.uri.toString();
    const cached = this.analysisPermissions.get(key);
    if (cached) {
      return cached;
    }

    const config = await getFolderConfig(this.context, folder);
    if (!config) {
      return 'unknown';
    }

    const permission = await checkAnalysisPermission(config);
    this.analysisPermissions.set(key, permission);
    return permission;
  }

  private async refreshFromPanel(): Promise<void> {
    this.postStatus('loading', 'Actualizando issues…');
    const summary = await this.refreshCallback();
    this.setRefreshSummary(summary, summary.configuredFolders > 0);

    if (summary.configuredFolders === 0) {
      this.postStatus('error', 'Guarda primero la conexión y el proyecto.');
      this.navigate('configuration');
    } else if (summary.errors.length > 0) {
      this.postStatus('error', summary.errors.join(' | '));
    } else {
      this.postStatus('success', `${summary.published} issues encontrados.`);
      this.navigate('data');
    }
  }


  private findIssue(issueKey?: string): DashboardIssue | undefined {
    if (!issueKey) return undefined;
    return [...this.lastSummary.issues, ...this.lastSummary.newIssues]
      .find(issue => issue.key === issueKey);
  }

  private async loadIssueLifecycle(message: DashboardWebviewMessage): Promise<void> {
    const issue = this.findIssue(message.issueKey);
    if (!issue) {
      this.postMessage({
        type: 'issueLifecycleError',
        message: 'El defecto ya no está disponible. Actualiza los datos de SonarQube.'
      });
      return;
    }
    const folder = this.getWorkspaceFolder(message.folderUri || issue.folderUri);
    if (!folder) {
      this.postMessage({ type: 'issueLifecycleError', message: 'La carpeta del defecto ya no está abierta.' });
      return;
    }
    const config = await getFolderConfig(this.context, folder);
    if (!config) {
      this.postMessage({ type: 'issueLifecycleError', message: 'La carpeta no tiene una conexión válida con SonarQube.' });
      return;
    }
    this.flowController.setIssue(issue, message.flowIndex ?? 0);
    this.postMessage({ type: 'issueLifecycleLoading', issueKey: issue.key });
    try {
      const detail = await fetchIssueLifecycle(config, issue);
      this.postMessage({ type: 'issueLifecycle', detail });
    } catch (error) {
      this.postMessage({
        type: 'issueLifecycleError',
        message: `No se pudo cargar la gestión del defecto: ${this.errorMessage(error)}`
      });
    }
  }

  private async mutateIssue(message: DashboardWebviewMessage): Promise<void> {
    const issue = this.findIssue(message.issueKey);
    if (!issue || !message.mutationKind) {
      this.postMessage({ type: 'issueLifecycleError', message: 'No se pudo identificar la acción del defecto.' });
      return;
    }
    const folder = this.getWorkspaceFolder(message.folderUri || issue.folderUri);
    const config = folder ? await getFolderConfig(this.context, folder) : undefined;
    if (!folder || !config) {
      this.postMessage({ type: 'issueLifecycleError', message: 'La carpeta no tiene una conexión válida con SonarQube.' });
      return;
    }
    const spanish = this.language === 'es';
    const actionLabel = message.mutationKind === 'transition'
      ? `${spanish ? 'cambiar el estado mediante' : 'change the status using'} “${message.transition ?? ''}”`
      : message.mutationKind === 'assign'
        ? `${spanish ? 'asignar el defecto a' : 'assign the issue to'} “${message.assignee || (spanish ? 'Sin asignar' : 'Unassigned')}”`
        : (spanish ? 'añadir el comentario' : 'add the comment');
    const confirm = spanish ? 'Confirmar' : 'Confirm';
    const selected = await vscode.window.showWarningMessage(
      spanish
        ? `¿Quieres ${actionLabel}? Esta acción modificará SonarQube.`
        : `Do you want to ${actionLabel}? This action will modify SonarQube.`,
      { modal: true },
      confirm
    );
    if (selected !== confirm) {
      return;
    }
    const request: IssueMutationRequest = {
      kind: message.mutationKind,
      issueKey: issue.key,
      folderUri: folder.uri.toString(),
      transition: message.transition,
      assignee: message.assignee,
      comment: message.comment
    };
    this.postMessage({ type: 'issueMutationLoading' });
    try {
      await mutateIssue(config, request);
      const summary = await this.refreshCallback('sync');
      this.setRefreshSummary(summary, true);
      const refreshed = this.findIssue(issue.key) ?? issue;
      const detail = await fetchIssueLifecycle(config, refreshed);
      this.postMessage({ type: 'issueLifecycle', detail });
      this.postStatus('success', 'El defecto se ha actualizado en SonarQube.');
    } catch (error) {
      this.postMessage({
        type: 'issueLifecycleError',
        message: `No se pudo modificar el defecto: ${this.errorMessage(error)}`
      });
    }
  }

  private async loadCoverageDetail(message: DashboardWebviewMessage): Promise<void> {
    if (!message.fileUri) {
      this.postMessage({ type: 'coverageDetailError', message: 'No se pudo identificar el archivo.' });
      return;
    }
    this.postMessage({ type: 'coverageDetailLoading', fileUri: message.fileUri });
    try {
      const detail = await this.coverageDecorations.getDetail(message.fileUri);
      if (!detail) {
        throw new Error('No hay datos de cobertura para el archivo seleccionado.');
      }
      this.postMessage({ type: 'coverageDetail', detail });
    } catch (error) {
      this.postMessage({
        type: 'coverageDetailError',
        message: `No se pudo cargar la cobertura y duplicaciones: ${this.errorMessage(error)}`
      });
    }
  }

  private async selectFlowLocation(message: DashboardWebviewMessage): Promise<void> {
    const issue = this.findIssue(message.issueKey);
    if (!issue) return;
    const flowIndex = Math.max(0, message.flowIndex ?? 0);
    const locationIndex = Math.max(0, message.locationIndex ?? 0);
    this.flowController.setIssue(issue, flowIndex);
    this.flowController.select(flowIndex, locationIndex);
    const location = issue.flows[flowIndex]?.locations[locationIndex]
      ?? issue.secondaryLocations[locationIndex];
    if (location) {
      await this.flowController.openLocation(location);
    }
  }

  private async loadHotspotDetail(message: DashboardWebviewMessage): Promise<void> {
    const hotspotKey = message.hotspotKey?.trim();
    const folderUri = message.folderUri?.trim();
    if (!hotspotKey || !folderUri) {
      this.postMessage({
        type: 'hotspotDetailError',
        message: 'No se pudo identificar el Security Hotspot.'
      });
      return;
    }
    const folder = vscode.workspace.workspaceFolders?.find(
      item => item.uri.toString() === folderUri
    );
    if (!folder) {
      this.postMessage({
        type: 'hotspotDetailError',
        message: 'La carpeta del Security Hotspot ya no está abierta.'
      });
      return;
    }
    const config = await getFolderConfig(this.context, folder);
    if (!config) {
      this.postMessage({
        type: 'hotspotDetailError',
        message: 'La carpeta no tiene una conexión válida con SonarQube.'
      });
      return;
    }
    this.postMessage({ type: 'hotspotDetailLoading', hotspotKey });
    try {
      const detail = await fetchHotspotDetail(config, hotspotKey);
      this.postMessage({ type: 'hotspotDetail', detail });
    } catch (error) {
      this.postMessage({
        type: 'hotspotDetailError',
        message: `No se pudo cargar el detalle: ${this.errorMessage(error)}`
      });
    }
  }

  private async openIssue(message: DashboardWebviewMessage): Promise<void> {
    if (!message.fileUri) {
      return;
    }

    try {
      const uri = vscode.Uri.parse(message.fileUri);
      const document = await vscode.workspace.openTextDocument(uri);
      const line = Math.max(0, (message.line ?? 1) - 1);
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
        preserveFocus: false
      });
      const position = new vscode.Position(line, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenterIfOutsideViewport
      );
      await vscode.commands.executeCommand('workbench.action.closeSidebar');
    } catch (error) {
      this.postStatus('error', `No se pudo abrir el archivo: ${this.errorMessage(error)}`);
    }
  }

  private postStatus(kind: 'loading' | 'success' | 'error', message: string): void {
    this.postMessage({
      type: 'status',
      kind,
      message: localizeRuntimeText(message, this.language)
    });
  }

  private postMessage(message: unknown): void {
    if (
      message &&
      typeof message === 'object' &&
      'message' in message &&
      typeof (message as { message?: unknown }).message === 'string'
    ) {
      const value = message as { message: string };
      void this.panel?.webview.postMessage({
        ...value,
        message: localizeRuntimeText(value.message, this.language)
      });
      return;
    }
    void this.panel?.webview.postMessage(message);
  }

  private postPendingIssueDetail(): void {
    if (!this.pendingIssueDetail) {
      return;
    }
    this.postMessage({
      type: 'showIssueDetail',
      issue: this.pendingIssueDetail
    });
    this.pendingIssueDetail = undefined;
  }

  private postPendingHotspotDetail(): void {
    if (!this.pendingHotspotDetail) {
      return;
    }
    this.postMessage({
      type: 'showHotspotDetail',
      hotspot: this.pendingHotspotDetail
    });
    this.pendingHotspotDetail = undefined;
  }

  private isValidHttpUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private normalizeScannerMode(value?: ScannerMode): ScannerMode {
    return ['auto', 'maven', 'gradle', 'dotnet', 'npm', 'docker', 'custom'].includes(value ?? '')
      ? value as ScannerMode
      : 'auto';
  }

  private errorMessage(error: unknown): string {
    const value = error instanceof Error ? error.message : String(error);
    return localizeRuntimeText(value, this.language);
  }

  private async changeLanguage(language: DashboardLanguage): Promise<void> {
    if (language === this.language) {
      await this.sendState();
      return;
    }

    await setDashboardLanguage(language);
    this.language = language;
    this.languageEmitter.fire(language);

    if (this.panel) {
      this.panel.webview.html = getDashboardHtml(
        this.panel.webview,
        this.context.extensionUri,
        this.language
      );
    }
  }

  async refreshLanguage(): Promise<void> {
    const language = getDashboardLanguage();
    if (language !== this.language) {
      this.language = language;
      this.languageEmitter.fire(language);
      if (this.panel) {
        this.panel.webview.html = getDashboardHtml(
          this.panel.webview,
          this.context.extensionUri,
          this.language
        );
      }
    }
  }

  getLanguage(): DashboardLanguage {
    return this.language;
  }
}
