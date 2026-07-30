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
import { getWebviewLocalizationBundle } from './i18n/runtimeWebview';
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
import {
  connectionErrorMessage,
  connectionFingerprint,
  connectionNeedsValidation,
  normalizeConnectionServerUrl
} from './dashboard/connectionValidation';
import { getDashboardHtml } from './dashboard/webview';
import { AnalysisService } from './scanner/analysisService';
import { CoverageDecorationManager } from './coverageDecorations';
import { IssueFlowController } from './issueFlowController';
import { DuplicationComparisonPanel } from './dashboard/duplicationComparisonPanel';
import {
  checkAnalysisPermission,
  fetchHotspotDetail,
  fetchIssueLifecycle,
  fetchRuleDetail,
  fetchSonarCompatibilityInfo,
  fetchVisibleProjects,
  fetchCreationCapabilities,
  createSonarComponent,
  mutateIssue,
  validateSonarToken
} from './sonarClient';
import {
  AnalysisPermissionStatus,
  DashboardHotspot,
  DashboardIssue,
  FolderSonarConfig,
  IssueMutationRequest,
  RefreshSummary,
  ScannerMode,
  SonarCreationCapabilities,
  SonarCreatableComponentKind
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
  private managedIssue: DashboardIssue | undefined;
  private pendingHotspotDetail: DashboardHotspot | undefined;
  private readonly analysisPermissions = new Map<string, AnalysisPermissionStatus>();
  private readonly dirtyConnectionFolders = new Set<string>();
  private readonly validatedConnections = new Map<string, string>();
  private readonly creationCapabilities = new Map<
    string,
    {
      fingerprint: string;
      value: SonarCreationCapabilities;
    }
  >();
  private readonly panelDisposables: vscode.Disposable[] = [];
  private readonly summaryEmitter = new vscode.EventEmitter<RefreshSummary>();
  private readonly loadingEmitter = new vscode.EventEmitter<boolean>();
  private readonly pageEmitter = new vscode.EventEmitter<DashboardPage>();
  private readonly languageEmitter = new vscode.EventEmitter<DashboardLanguage>();
  private readonly analysisService: AnalysisService;
  private readonly duplicationComparison: DuplicationComparisonPanel;

  readonly onDidChangeSummary = this.summaryEmitter.event;
  readonly onDidChangeLoading = this.loadingEmitter.event;
  readonly onDidChangePage = this.pageEmitter.event;
  readonly onDidChangeLanguage = this.languageEmitter.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly refreshCallback: RefreshCallback,
    private readonly clearCallback: ClearCallback,
    private readonly coverageDecorations: CoverageDecorationManager,
    private readonly flowController: IssueFlowController,
    private readonly scopeCallback: (scope: 'overall' | 'newCode') => void
  ) {
    this.duplicationComparison = new DuplicationComparisonPanel(coverageDecorations);
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
    const confirmed = await vscode.window.showWarningMessage(
      localizeRuntimeText(
        'El análisis puede ejecutar herramientas, compilaciones y scripts del repositorio. ¿Quieres continuar?',
        this.language
      ),
      { modal: true },
      localizeRuntimeText('Analizar', this.language)
    );
    if (confirmed) {
      await this.analyzeRepository(this.selectedFolderUri);
    }
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
    this.duplicationComparison.dispose();
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
    panel.iconPath = {
      light: vscode.Uri.joinPath(
        this.context.extensionUri,
        'media',
        'SonarQube-light.svg'
      ),
      dark: vscode.Uri.joinPath(
        this.context.extensionUri,
        'media',
        'SonarQube-dark.svg'
      )
    };
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
        (message: DashboardWebviewMessage) => {
          this.runBackgroundTask(this.handleMessage(message));
        }
      ),
      panel.onDidDispose(() => {
        this.disposePanelListeners();
        this.panel = undefined;
      }),
      panel.onDidChangeViewState(event => {
        if (event.webviewPanel.visible) {
          this.runBackgroundTask(this.sendState());
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
        this.validatedConnections.clear();
        this.scopeCallback('overall');
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
        if (this.selectedFolderUri) {
          this.dirtyConnectionFolders.delete(this.selectedFolderUri);
          this.validatedConnections.delete(this.selectedFolderUri);
        }
        this.selectedFolderUri = message.folderUri;
        await this.sendState();
        break;
      case 'setLanguage':
        await this.changeLanguage(normalizeDashboardLanguage(message.language));
        break;
      case 'scopeChanged':
        if (message.scope) {
          this.scopeCallback(message.scope);
        }
        break;
      case 'navigate':
        if (message.page) {
          await this.showPage(message.page);
        }
        break;
      case 'loadHotspotDetail':
        await this.loadHotspotDetail(message);
        break;
      case 'loadRuleDetail':
        await this.loadRuleDetail(message);
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
      case 'openDuplicationComparison':
        await this.openDuplicationComparison(message);
        break;
      case 'selectFlowLocation':
        await this.selectFlowLocation(message);
        break;
      case 'loadProjects':
        await this.loadProjects(message);
        break;
      case 'createComponent':
        await this.createComponent(message);
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
    await this.refreshConfiguredFolderCount(folders);
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
          projectName: '',
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
    const connectionDraftDirty = this.dirtyConnectionFolders.has(
      this.selectedFolderUri
    );
    let analysisPermission: AnalysisPermissionStatus = 'unknown';
    let creationCapabilities = this.emptyCreationCapabilities();
    if (!connectionDraftDirty) {
      [analysisPermission, creationCapabilities] = await Promise.all([
        this.analysisPermission(selectedFolder),
        this.creationCapabilitiesForFolder(selectedFolder, config)
      ]);
    }

    this.postMessage({
      type: 'state',
      folders: folders.map(folder => ({
        name: folder.name,
        uri: folder.uri.toString()
      })),
      selectedFolderUri: this.selectedFolderUri,
      workspaceTrusted: vscode.workspace.isTrusted,
      language: this.language,
      connectionDraftDirty,
      creationCapabilities,
      config: {
        ...config,
        projectKey: connectionDraftDirty ? '' : config.projectKey,
        projectName: connectionDraftDirty ? '' : config.projectName,
        hasToken: connectionDraftDirty ? false : config.hasToken,
        analysisPermission,
        notificationsEnabled: vscode.workspace.getConfiguration(DASHBOARD_CONFIGURATION_SECTION).get<boolean>(DASHBOARD_CONFIGURATION_KEYS.notificationsEnabled, true),
        significantIncreasePercent: vscode.workspace.getConfiguration(DASHBOARD_CONFIGURATION_SECTION).get<number>(DASHBOARD_CONFIGURATION_KEYS.significantIncreasePercent, 20),
        significantIncreaseMinimum: vscode.workspace.getConfiguration(DASHBOARD_CONFIGURATION_SECTION).get<number>(DASHBOARD_CONFIGURATION_KEYS.significantIncreaseMinimum, 5)
      }
    });
    if (!connectionDraftDirty) {
      this.runBackgroundTask(this.sendSonarCompatibility(selectedFolder));
    }
  }

  private async loadProjects(message: DashboardWebviewMessage): Promise<void> {
    const folder = this.getWorkspaceFolder(message.folderUri);
    if (!folder) {
      this.postStatus('error', 'Abre una carpeta antes de conectar con SonarQube.');
      return;
    }

    const folderUri = folder.uri.toString();
    const serverUrl = normalizeConnectionServerUrl(message.serverUrl ?? '');
    if (!this.isValidHttpUrl(serverUrl)) {
      await this.invalidateConnection(folderUri);
      this.postStatus('error', 'Introduce una URL válida de SonarQube.');
      return;
    }

    const savedConnection = await getFolderFormConfig(this.context, folder);
    const replacementToken = (message.token ?? '').trim();
    const replaceStoredToken = Boolean(
      replacementToken &&
      savedConnection.serverUrl.trim().replace(/\/+$/, '') === serverUrl
    );
    const token = replacementToken ||
      await this.context.secrets.get(tokenKey(folder));

    if (!token) {
      await this.invalidateConnection(folderUri);
      this.postStatus('error', 'Introduce un token para consultar los proyectos visibles.');
      return;
    }

    this.projectLoadController?.abort();
    this.projectLoadController = new AbortController();
    this.dirtyConnectionFolders.add(folderUri);
    this.validatedConnections.delete(folderUri);
    await this.refreshConfiguredFolderCount(
      vscode.workspace.workspaceFolders ?? []
    );
    this.postMessage({ type: 'projectsLoading' });

    try {
      await validateSonarToken(
        serverUrl,
        token,
        this.projectLoadController.signal
      );
    } catch (error) {
      if (this.projectLoadController.signal.aborted) {
        return;
      }
      await this.invalidateConnection(folderUri);
      this.postMessage({
        type: 'sonarCompatibility',
        folderUri,
        serverUrl,
        sonarCompatibility: undefined
      });
      this.postStatus(
        'error',
        localizeRuntimeText(connectionErrorMessage(error), this.language)
      );
      return;
    }

    try {
      const compatibilityPromise = fetchSonarCompatibilityInfo(serverUrl, token);
      const [projects, sonarCompatibility, creationCapabilities] = await Promise.all([
        fetchVisibleProjects(
          serverUrl,
          token,
          this.projectLoadController.signal
        ),
        compatibilityPromise,
        fetchCreationCapabilities(
          serverUrl,
          token,
          this.projectLoadController.signal
        )
      ]);
      const fingerprint = connectionFingerprint(serverUrl, token);
      this.validatedConnections.set(folderUri, fingerprint);
      this.creationCapabilities.set(folderUri, {
        fingerprint,
        value: creationCapabilities
      });
      if (replaceStoredToken) {
        await this.context.secrets.store(tokenKey(folder), replacementToken);
      }

      this.postMessage({
        type: 'projectsLoaded',
        projects,
        folderUri,
        serverUrl,
        tokenStored: replaceStoredToken,
        sonarCompatibility,
        creationCapabilities
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
      await this.invalidateConnection(folderUri);
      this.postMessage({
        type: 'sonarCompatibility',
        folderUri,
        serverUrl,
        sonarCompatibility: undefined
      });
      this.postStatus(
        'error',
        localizeRuntimeText(connectionErrorMessage(error), this.language)
      );
    }
  }

  private async createComponent(
    message: DashboardWebviewMessage
  ): Promise<void> {
    const folder = this.getWorkspaceFolder(message.folderUri);
    if (!folder) {
      this.postMessage({
        type: 'componentCreationError',
        message: 'Abre una carpeta antes de crear un proyecto o aplicación.'
      });
      return;
    }

    const serverUrl = normalizeConnectionServerUrl(message.serverUrl ?? '');
    const replacementToken = (message.token ?? '').trim();
    const token = replacementToken ||
      await this.context.secrets.get(tokenKey(folder));
    const kind = message.componentKind;
    const key = (message.componentKey ?? '').trim();
    const name = (message.componentName ?? '').trim();

    if (!this.isValidHttpUrl(serverUrl) || !token) {
      this.postMessage({
        type: 'componentCreationError',
        message: 'Conecta primero con un servidor y un token válidos.'
      });
      return;
    }
    if (kind !== 'project' && kind !== 'application') {
      this.postMessage({
        type: 'componentCreationError',
        message: 'Selecciona un tipo de componente válido.'
      });
      return;
    }
    if (!name || !this.isValidComponentKey(key)) {
      this.postMessage({
        type: 'componentCreationError',
        message: 'Introduce un nombre y una clave válidos.'
      });
      return;
    }
    if (
      this.validatedConnections.get(folder.uri.toString()) !==
      connectionFingerprint(serverUrl, token)
    ) {
      this.postMessage({
        type: 'componentCreationError',
        message: 'Pulsa Conectar y valida el servidor y el token antes de crear el componente.'
      });
      return;
    }

    this.postMessage({ type: 'componentCreationLoading' });
    try {
      const capabilities = await fetchCreationCapabilities(serverUrl, token);
      this.creationCapabilities.set(folder.uri.toString(), {
        fingerprint: connectionFingerprint(serverUrl, token),
        value: capabilities
      });
      if (!this.canCreateComponent(capabilities, kind)) {
        throw new Error(
          kind === 'application'
            ? 'El token no tiene permiso para crear aplicaciones.'
            : 'El token no tiene permiso para crear proyectos.'
        );
      }

      const component = await createSonarComponent(serverUrl, token, {
        kind,
        key,
        name,
        description: (message.componentDescription ?? '').trim(),
        visibility: message.componentVisibility ?? 'private'
      });
      const projects = await fetchVisibleProjects(serverUrl, token);

      this.postMessage({
        type: 'componentCreated',
        component,
        projects,
        creationCapabilities: capabilities
      });
      this.postStatus(
        'success',
        kind === 'application'
          ? 'La aplicación se ha creado correctamente.'
          : 'El proyecto se ha creado correctamente.'
      );
    } catch (error) {
      this.postMessage({
        type: 'componentCreationError',
        message: `No se pudo crear el componente: ${this.errorMessage(error)}`
      });
    }
  }

  private canCreateComponent(
    capabilities: SonarCreationCapabilities,
    kind: SonarCreatableComponentKind
  ): boolean {
    return kind === 'application'
      ? capabilities.canCreateApplications
      : capabilities.canCreateProjects;
  }

  private isValidComponentKey(key: string): boolean {
    return Boolean(
      key &&
      !/^\d+$/.test(key) &&
      /^[A-Za-z0-9_.:-]+$/.test(key)
    );
  }

  private async save(message: DashboardWebviewMessage): Promise<void> {
    const folder = this.getWorkspaceFolder(message.folderUri);
    if (!folder) {
      this.postStatus('error', 'Abre una carpeta antes de guardar la configuración.');
      return;
    }

    const serverUrl = normalizeConnectionServerUrl(message.serverUrl ?? '');
    const projectKey = (message.projectKey ?? '').trim();
    const projectName = (message.projectName ?? '').trim() || projectKey;
    const token = (message.token ?? '').trim();
    const existingToken = await this.context.secrets.get(tokenKey(folder));
    const savedConnection = await getFolderFormConfig(this.context, folder);

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

    const effectiveToken = token || existingToken || '';
    const requiresValidation = connectionNeedsValidation(
      savedConnection.serverUrl,
      existingToken,
      serverUrl,
      token
    );
    const validatedConnection = this.validatedConnections.get(
      folder.uri.toString()
    );
    if (
      requiresValidation &&
      validatedConnection !== connectionFingerprint(serverUrl, effectiveToken)
    ) {
      this.postStatus(
        'error',
        'Pulsa Conectar y valida el servidor y el token antes de sincronizar.'
      );
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
        projectName,
        branch: message.branch ?? '',
        baseDir: message.baseDir ?? '',
        token,
        scannerMode,
        buildCommand: message.buildCommand ?? '',
        customScannerCommand: message.customScannerCommand ?? ''
      });
      this.analysisPermissions.delete(folder.uri.toString());
      const savedConfig = await getFolderConfig(this.context, folder);
      const [analysisPermission, sonarCompatibility] = savedConfig
        ? await Promise.all([
            checkAnalysisPermission(savedConfig),
            fetchSonarCompatibilityInfo(savedConfig.serverUrl, savedConfig.token)
          ])
        : ['unknown' as const, undefined];
      this.analysisPermissions.set(folder.uri.toString(), analysisPermission);

      const configurationSavedMessage = {
        type: 'configurationSaved',
        config: {
          serverUrl,
          projectKey,
          projectName,
          branch: message.branch ?? '',
          baseDir: message.baseDir ?? '',
          hasToken: Boolean(token || existingToken),
          analysisPermission,
          scannerMode,
          buildCommand: message.buildCommand ?? '',
          customScannerCommand: message.customScannerCommand ?? '',
          sonarCompatibility,
          notificationsEnabled: message.notificationsEnabled !== false,
          significantIncreasePercent: Math.max(1, Number(message.significantIncreasePercent) || 20),
          significantIncreaseMinimum: Math.max(1, Number(message.significantIncreaseMinimum) || 5)
        }
      };
      this.postStatus('loading', 'Configuración guardada. Sincronizando issues…');
      const summary = await this.refreshCallback('sync');
      this.dirtyConnectionFolders.delete(folder.uri.toString());
      this.validatedConnections.delete(folder.uri.toString());
      this.setRefreshSummary(summary, true);
      this.postMessage(configurationSavedMessage);

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

    const folder = this.resolveAnalysisFolder(folderUri);
    if (!folder) {
      this.postStatus('error', 'Abre una carpeta antes de iniciar el análisis.');
      return;
    }

    if (!(await this.ensureTrustedWorkspace())) {
      return;
    }

    const analysisContext = await this.prepareAnalysis(folder);
    if (!analysisContext) {
      return;
    }

    this.navigate('data');
    this.postMessage({ type: 'showAnalysisDialog' });

    try {
      await this.runAnalysis(analysisContext);
    } catch (error) {
      this.handleAnalysisFailure(error);
    }
  }

  private resolveAnalysisFolder(folderUri?: string): vscode.WorkspaceFolder | undefined {
    const requestedFolderUri = folderUri ?? this.selectedFolderUri;
    const configuredFolder = this.getWorkspaceFolder(requestedFolderUri);
    const activeEditorUri = vscode.window.activeTextEditor?.document.uri;
    const activeFolder = activeEditorUri
      ? vscode.workspace.getWorkspaceFolder(activeEditorUri)
      : undefined;

    return configuredFolder ?? activeFolder ?? vscode.workspace.workspaceFolders?.[0];
  }

  private async ensureTrustedWorkspace(): Promise<boolean> {
    if (vscode.workspace.isTrusted) {
      return true;
    }

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
    return false;
  }

  private async prepareAnalysis(
    folder: vscode.WorkspaceFolder
  ): Promise<{ config: FolderSonarConfig; rootPath: string } | undefined> {
    const config = await getFolderConfig(this.context, folder);
    if (!config) {
      this.postStatus('error', 'Configura primero el servidor, el token y el proyecto.');
      this.navigate('configuration');
      return undefined;
    }

    const analysisPermission = await checkAnalysisPermission(config);
    this.analysisPermissions.set(folder.uri.toString(), analysisPermission);
    if (analysisPermission === 'denied') {
      await this.sendState();
      this.postStatus(
        'error',
        'El token no tiene el permiso Ejecutar análisis para este proyecto de SonarQube.'
      );
      return undefined;
    }

    const rootPath = this.analysisRoot(folder, config.baseDir);
    if (!rootPath) {
      this.postStatus('error', 'La subcarpeta configurada no pertenece al workspace.');
      return undefined;
    }

    return { config, rootPath };
  }

  private async runAnalysis(
    analysisContext: { config: FolderSonarConfig; rootPath: string }
  ): Promise<void> {
    await this.analysisService.analyze(analysisContext);
    this.analysisService.setRefreshing();

    const summary = await this.refreshCallback('analysis');
    this.setRefreshSummary(summary, true);
    this.reportAnalysisRefreshResult(summary);
    this.navigate('data');
  }

  private reportAnalysisRefreshResult(summary: RefreshSummary): void {
    if (summary.errors.length > 0) {
      const message = summary.errors.join(' | ');
      this.analysisService.setRefreshError(message);
      this.postStatus('error', message);
      return;
    }

    const message = `Análisis finalizado. ${summary.published} issues encontrados.`;
    this.analysisService.setRefreshCompleted(message);
    this.postStatus('success', message);
  }

  private handleAnalysisFailure(error: unknown): void {
    const analysisState = this.analysisService.getState();
    if (analysisState.phase === 'cancelled') {
      return;
    }

    const message = this.errorMessage(error);
    if (analysisState.phase === 'refreshing') {
      this.analysisService.setRefreshError(message);
    }
    this.postStatus('error', message);
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

  private emptyCreationCapabilities(): SonarCreationCapabilities {
    return {
      canCreateProjects: false,
      canCreateApplications: false
    };
  }

  private async creationCapabilitiesForFolder(
    folder: vscode.WorkspaceFolder,
    config: {
      serverUrl: string;
      hasToken: boolean;
    }
  ): Promise<SonarCreationCapabilities> {
    if (!config.serverUrl || !config.hasToken) {
      return this.emptyCreationCapabilities();
    }

    const token = await this.context.secrets.get(tokenKey(folder));
    if (!token) {
      return this.emptyCreationCapabilities();
    }

    const folderUri = folder.uri.toString();
    const fingerprint = connectionFingerprint(config.serverUrl, token);
    const cached = this.creationCapabilities.get(folderUri);
    if (cached?.fingerprint === fingerprint) {
      if (
        cached.value.canCreateProjects ||
        cached.value.canCreateApplications
      ) {
        this.validatedConnections.set(folderUri, fingerprint);
      }
      return cached.value;
    }

    try {
      const value = await fetchCreationCapabilities(config.serverUrl, token);
      this.creationCapabilities.set(folderUri, {
        fingerprint,
        value
      });
      if (value.canCreateProjects || value.canCreateApplications) {
        this.validatedConnections.set(folderUri, fingerprint);
      }
      return value;
    } catch {
      this.creationCapabilities.delete(folderUri);
      return this.emptyCreationCapabilities();
    }
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
    const selectedFolder = this.getWorkspaceFolder(this.selectedFolderUri);
    if (selectedFolder) {
      this.runBackgroundTask(this.sendSonarCompatibility(selectedFolder));
    }

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

  private async sendSonarCompatibility(
    folder: vscode.WorkspaceFolder
  ): Promise<void> {
    const folderUri = folder.uri.toString();
    if (this.dirtyConnectionFolders.has(folderUri)) {
      return;
    }
    const config = await getFolderConfig(this.context, folder);
    if (!config) {
      this.postMessage({
        type: 'sonarCompatibility',
        folderUri,
        sonarCompatibility: undefined
      });
      return;
    }

    try {
      const sonarCompatibility = await fetchSonarCompatibilityInfo(
        config.serverUrl,
        config.token
      );
      this.postMessage({
        type: 'sonarCompatibility',
        folderUri,
        serverUrl: config.serverUrl,
        sonarCompatibility
      });
    } catch (error) {
      this.postMessage({
        type: 'sonarCompatibilityError',
        folderUri,
        serverUrl: config.serverUrl,
        message: localizeRuntimeText(
          connectionErrorMessage(error),
          this.language
        )
      });
    }
  }

  private async refreshConfiguredFolderCount(
    folders: readonly vscode.WorkspaceFolder[]
  ): Promise<void> {
    const configs = await Promise.all(
      folders.map(folder => getFolderConfig(this.context, folder))
    );
    const configuredFolders = configs.filter(
      (config, index) =>
        Boolean(config) &&
        !this.dirtyConnectionFolders.has(folders[index].uri.toString())
    ).length;
    if (this.lastSummary.configuredFolders === configuredFolders) {
      return;
    }
    this.setRefreshSummary({
      ...this.lastSummary,
      configuredFolders
    });
  }

  private async invalidateConnection(folderUri: string): Promise<void> {
    this.dirtyConnectionFolders.add(folderUri);
    this.validatedConnections.delete(folderUri);
    this.creationCapabilities.delete(folderUri);
    await this.refreshConfiguredFolderCount(
      vscode.workspace.workspaceFolders ?? []
    );
    this.postMessage({
      type: 'connectionValidationFailed',
      folderUri
    });
  }


  private findIssue(issueKey?: string): DashboardIssue | undefined {
    if (!issueKey) return undefined;
    return [...this.lastSummary.issues, ...this.lastSummary.newIssues]
      .find(issue => issue.key === issueKey) ??
      (this.managedIssue?.key === issueKey ? this.managedIssue : undefined);
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
    const folder = this.getWorkspaceFolder(message.folderUri ?? issue.folderUri);
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
      this.managedIssue = detail.issue;
      this.postMessage({ type: 'issueLifecycle', detail });
    } catch (error) {
      this.postMessage({
        type: 'issueLifecycleError',
        message: `No se pudo cargar la gestión del defecto: ${this.errorMessage(error)}`
      });
    }
  }

  private async mutateIssue(message: DashboardWebviewMessage): Promise<void> {
    const mutationContext = await this.getIssueMutationContext(message);
    if (!mutationContext) {
      return;
    }

    if (!(await this.confirmIssueMutation(message))) {
      return;
    }

    const { issue, folder, config } = mutationContext;
    const request: IssueMutationRequest = {
      kind: mutationContext.mutationKind,
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
      this.managedIssue = detail.issue;
      this.postMessage({ type: 'issueLifecycle', detail });
      this.postStatus('success', 'El defecto se ha actualizado en SonarQube.');
    } catch (error) {
      this.postMessage({
        type: 'issueLifecycleError',
        message: `No se pudo modificar el defecto: ${this.errorMessage(error)}`
      });
    }
  }

  private async getIssueMutationContext(
    message: DashboardWebviewMessage
  ): Promise<{
    issue: DashboardIssue;
    folder: vscode.WorkspaceFolder;
    config: FolderSonarConfig;
    mutationKind: IssueMutationRequest['kind'];
  } | undefined> {
    const issue = this.findIssue(message.issueKey);
    if (!issue || !message.mutationKind) {
      this.postMessage({
        type: 'issueLifecycleError',
        message: 'No se pudo identificar la acción del defecto.'
      });
      return undefined;
    }

    const folder = this.getWorkspaceFolder(message.folderUri ?? issue.folderUri);
    if (!folder) {
      this.postMessage({
        type: 'issueLifecycleError',
        message: 'La carpeta no tiene una conexión válida con SonarQube.'
      });
      return undefined;
    }

    const config = await getFolderConfig(this.context, folder);
    if (!config) {
      this.postMessage({
        type: 'issueLifecycleError',
        message: 'La carpeta no tiene una conexión válida con SonarQube.'
      });
      return undefined;
    }

    return {
      issue,
      folder,
      config,
      mutationKind: message.mutationKind
    };
  }

  private async confirmIssueMutation(message: DashboardWebviewMessage): Promise<boolean> {
    const actionLabel = this.issueMutationActionLabel(message);
    const confirmLabel = this.language === 'es' ? 'Confirmar' : 'Confirm';
    const confirmationMessage = this.language === 'es'
      ? `¿Quieres ${actionLabel}? Esta acción modificará SonarQube.`
      : `Do you want to ${actionLabel}? This action will modify SonarQube.`;
    const selected = await vscode.window.showWarningMessage(
      confirmationMessage,
      { modal: true },
      confirmLabel
    );
    return selected === confirmLabel;
  }

  private issueMutationActionLabel(message: DashboardWebviewMessage): string {
    switch (message.mutationKind) {
      case 'transition':
        return this.transitionMutationLabel(message.transition);
      case 'assign':
        return this.assignmentMutationLabel(message.assignee);
      case 'comment':
        return this.language === 'es' ? 'añadir el comentario' : 'add the comment';
      default:
        return this.language === 'es' ? 'modificar el defecto' : 'modify the issue';
    }
  }

  private transitionMutationLabel(transition?: string): string {
    const operation = this.language === 'es'
      ? 'cambiar el estado mediante'
      : 'change the status using';
    return `${operation} “${transition ?? ''}”`;
  }

  private assignmentMutationLabel(assignee?: string): string {
    const operation = this.language === 'es'
      ? 'asignar el defecto a'
      : 'assign the issue to';
    const normalizedAssignee = assignee?.trim();
    let target = normalizedAssignee?.length ? normalizedAssignee : undefined;
    target ??= this.language === 'es' ? 'Sin asignar' : 'Unassigned';
    return `${operation} “${target}”`;
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

  private async openDuplicationComparison(
    message: DashboardWebviewMessage
  ): Promise<void> {
    if (!message.fileUri) {
      this.postStatus('error', 'No se pudo identificar el archivo duplicado.');
      return;
    }
    try {
      await this.duplicationComparison.show(
        message.fileUri,
        Math.max(0, message.groupIndex ?? 0)
      );
    } catch (error) {
      this.postStatus(
        'error',
        `No se pudo abrir la comparación de duplicados: ${this.errorMessage(error)}`
      );
    }
  }

  private async loadRuleDetail(message: DashboardWebviewMessage): Promise<void> {
    const ruleKey = message.ruleKey?.trim();
    const folderUri = message.folderUri?.trim();
    if (!ruleKey || !folderUri) {
      this.postMessage({
        type: 'ruleDetailError',
        message: 'No se pudo identificar la regla de SonarQube.'
      });
      return;
    }

    const folder = this.getWorkspaceFolder(folderUri);
    if (!folder) {
      this.postMessage({
        type: 'ruleDetailError',
        message: 'La carpeta asociada a la regla ya no está abierta.'
      });
      return;
    }

    const config = await getFolderConfig(this.context, folder);
    if (!config) {
      this.postMessage({
        type: 'ruleDetailError',
        message: 'La carpeta no tiene una conexión válida con SonarQube.'
      });
      return;
    }

    this.postMessage({ type: 'ruleDetailLoading', ruleKey });
    try {
      const detail = await fetchRuleDetail(config, ruleKey);
      this.postMessage({ type: 'ruleDetail', detail });
    } catch (error) {
      this.postMessage({
        type: 'ruleDetailError',
        message: `No se pudo cargar el detalle de la regla: ${this.errorMessage(error)}`
      });
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
    const webview = this.panel?.webview;
    if (!webview) {
      return;
    }

    if (
      message &&
      typeof message === 'object' &&
      'message' in message &&
      typeof (message as { message?: unknown }).message === 'string'
    ) {
      const value = message as { message: string };
      this.sendWebviewMessage(webview, {
        ...value,
        message: localizeRuntimeText(value.message, this.language)
      });
      return;
    }
    this.sendWebviewMessage(webview, message);
  }

  private sendWebviewMessage(webview: vscode.Webview, message: unknown): void {
    webview.postMessage(message).then(
      () => undefined,
      () => undefined
    );
  }

  private runBackgroundTask(task: Promise<unknown>): void {
    task.then(
      () => undefined,
      error => this.postStatus('error', this.errorMessage(error))
    );
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
    if (language !== this.language) {
      await setDashboardLanguage(language);
      this.language = language;
      this.languageEmitter.fire(language);
    }

    this.postLanguageChanged();
  }

  async refreshLanguage(): Promise<void> {
    const language = getDashboardLanguage();
    if (language === this.language) {
      return;
    }

    this.language = language;
    this.languageEmitter.fire(language);
    this.postLanguageChanged();
  }

  private postLanguageChanged(): void {
    this.postMessage({
      type: 'languageChanged',
      localization: getWebviewLocalizationBundle(this.language)
    });
  }

  getLanguage(): DashboardLanguage {
    return this.language;
  }
}
