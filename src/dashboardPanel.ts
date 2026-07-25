import * as vscode from 'vscode';
import { DASHBOARD_PANEL_VIEW_TYPE } from './constants';
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
import { fetchHotspotDetail, fetchVisibleProjects } from './sonarClient';
import { RefreshSummary } from './types';

export class DashboardPanel {
  private panel: vscode.WebviewPanel | undefined;
  private selectedFolderUri: string | undefined;
  private projectLoadController: AbortController | undefined;
  private lastSummary: RefreshSummary = createEmptyRefreshSummary();
  private resultsVisible = false;
  private savingConfig = false;
  private loading = false;
  private currentPage: DashboardPage = 'data';
  private panelDisposables: vscode.Disposable[] = [];
  private readonly summaryEmitter = new vscode.EventEmitter<RefreshSummary>();
  private readonly loadingEmitter = new vscode.EventEmitter<boolean>();
  private readonly pageEmitter = new vscode.EventEmitter<DashboardPage>();

  readonly onDidChangeSummary = this.summaryEmitter.event;
  readonly onDidChangeLoading = this.loadingEmitter.event;
  readonly onDidChangePage = this.pageEmitter.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly refreshCallback: RefreshCallback,
    private readonly clearCallback: ClearCallback
  ) {}

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

  async showQualityGate(): Promise<void> {
    await this.show('data');
    this.postMessage({ type: 'showQualityGate' });
  }

  private navigate(page: DashboardPage): void {
    this.currentPage = page;
    this.postMessage({ type: 'navigate', page });
    this.pageEmitter.fire(page);
  }

  dispose(): void {
    this.projectLoadController?.abort();
    this.disposePanelListeners();
    this.panel?.dispose();
    this.panel = undefined;
    this.summaryEmitter.dispose();
    this.loadingEmitter.dispose();
    this.pageEmitter.dispose();
  }

  private attachPanel(panel: vscode.WebviewPanel): void {
    this.disposePanelListeners();
    this.panel = panel;
    panel.title = 'SonarQube Dashboard';
    panel.iconPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      'media',
      'sonarqube-dashboard.svg'
    );
    panel.webview.options = {
      enableScripts: true
    };
    panel.webview.html = getDashboardHtml(panel.webview, this.context.extensionUri);

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
        this.navigate(this.currentPage);
        break;
      case 'selectFolder':
        this.selectedFolderUri = message.folderUri;
        await this.sendState();
        break;
      case 'navigate':
        if (message.page) {
          await this.showPage(message.page);
        }
        break;
      case 'loadHotspotDetail':
        await this.loadHotspotDetail(message);
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
        config: {
          serverUrl: '',
          projectKey: '',
          branch: '',
          baseDir: '',
          hasToken: false
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

    this.postMessage({
      type: 'state',
      folders: folders.map(folder => ({
        name: folder.name,
        uri: folder.uri.toString()
      })),
      selectedFolderUri: this.selectedFolderUri,
      config
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
      await saveFolderConfig(this.context, folder, {
        serverUrl,
        projectKey,
        branch: message.branch ?? '',
        baseDir: message.baseDir ?? '',
        token
      });

      this.postMessage({
        type: 'configurationSaved',
        config: {
          serverUrl,
          projectKey,
          branch: message.branch ?? '',
          baseDir: message.baseDir ?? '',
          hasToken: Boolean(token || existingToken)
        }
      });
      this.postStatus('loading', 'Configuración guardada. Sincronizando issues…');
      const summary = await this.refreshCallback();
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
    this.postMessage({ type: 'status', kind, message });
  }

  private postMessage(message: unknown): void {
    void this.panel?.webview.postMessage(message);
  }

  private isValidHttpUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

}
