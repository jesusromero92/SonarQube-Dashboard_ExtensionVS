import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import {
  getFolderFormConfig,
  saveFolderConfig,
  tokenKey
} from './configuration';
import { fetchVisibleProjects } from './sonarClient';
import { RefreshSummary } from './types';

export const DASHBOARD_PANEL_VIEW_TYPE = 'sonarQubeDashboard.panel';

type RefreshCallback = () => Promise<RefreshSummary>;
type ClearCallback = () => void;

interface WebviewMessage {
  type?: string;
  folderUri?: string;
  serverUrl?: string;
  token?: string;
  projectKey?: string;
  branch?: string;
  baseDir?: string;
  fileUri?: string;
  line?: number;
}

function emptySummary(): RefreshSummary {
  return {
    configuredFolders: 0,
    published: 0,
    skipped: 0,
    errors: [],
    issues: [],
    severity: []
  };
}

export class DashboardPanel {
  private panel: vscode.WebviewPanel | undefined;
  private selectedFolderUri: string | undefined;
  private projectLoadController: AbortController | undefined;
  private lastSummary: RefreshSummary = emptySummary();
  private resultsVisible = false;
  private savingConfig = false;
  private panelDisposables: vscode.Disposable[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly refreshCallback: RefreshCallback,
    private readonly clearCallback: ClearCallback
  ) {}

  async show(): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One, false);
      await this.sendState();
      this.setRefreshSummary(this.lastSummary);
      this.postMessage({ type: 'navigate', page: 'data' });
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
  }

  async revive(panel: vscode.WebviewPanel): Promise<void> {
    this.attachPanel(panel);
    await this.sendState();
    this.setRefreshSummary(this.lastSummary);
    this.postMessage({ type: 'navigate', page: 'data' });
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
  }

  dispose(): void {
    this.projectLoadController?.abort();
    this.disposePanelListeners();
    this.panel?.dispose();
    this.panel = undefined;
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
    panel.webview.html = this.getHtml(panel.webview);

    this.panelDisposables.push(
      panel.webview.onDidReceiveMessage(
        (message: WebviewMessage) => void this.handleMessage(message)
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

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        await this.sendState();
        this.setRefreshSummary(this.lastSummary);
        this.postMessage({ type: 'navigate', page: 'data' });
        break;
      case 'selectFolder':
        this.selectedFolderUri = message.folderUri;
        await this.sendState();
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
        this.lastSummary = emptySummary();
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

  private async loadProjects(message: WebviewMessage): Promise<void> {
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

  private async save(message: WebviewMessage): Promise<void> {
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
          `${summary.published} issues publicados en Problems.`
        );
        this.postMessage({ type: 'navigate', page: 'data' });
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
      this.postMessage({ type: 'navigate', page: 'configuration' });
    } else if (summary.errors.length > 0) {
      this.postStatus('error', summary.errors.join(' | '));
    } else {
      this.postStatus('success', `${summary.published} issues publicados en Problems.`);
      this.postMessage({ type: 'navigate', page: 'data' });
    }
  }

  private async openIssue(message: WebviewMessage): Promise<void> {
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

  private getHtml(webview: vscode.Webview): string {
    const nonce = randomBytes(16).toString('hex');
    const bugIconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'bug-svgrepo-com.svg')
    );
    const codeSmellIconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'radiation-svgrepo-com.svg')
    );
    const vulnerabilityIconUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'assets', 'shield-exclamation-svgrepo-com.svg')
    );

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${webview.cspSource}; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"
  >
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SonarQube Dashboard</title>
  <style nonce="${nonce}">
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    button, input, select { font: inherit; }
    button:focus-visible, input:focus-visible, select:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }
    [hidden] { display: none !important; }
    .shell { min-width: 760px; }
    .topbar {
      display: flex;
      align-items: center;
      gap: 14px;
      min-height: 72px;
      padding: 14px 22px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorGroupHeader-tabsBackground);
    }
    .brand-mark {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      flex: 0 0 auto;
      color: var(--vscode-charts-orange);
    }
    .brand-mark svg { width: 34px; height: 34px; }
    .brand h1 { margin: 0; font-size: 21px; font-weight: 600; }
    .brand p { margin: 3px 0 0; color: var(--vscode-descriptionForeground); }
    .navigation {
      display: flex;
      gap: 4px;
      margin-left: 22px;
      padding: 3px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      background: var(--vscode-editor-background);
    }
    .nav-button {
      min-width: 106px;
      min-height: 30px;
      padding: 5px 14px;
      border: 0;
      border-radius: 2px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      cursor: pointer;
    }
    .nav-button:hover { color: var(--vscode-foreground); background: var(--vscode-list-hoverBackground); }
    .nav-button.active {
      color: var(--vscode-foreground);
      background: var(--vscode-list-activeSelectionBackground);
    }
    .top-actions { display: flex; gap: 8px; margin-left: auto; }
    .content { padding: 18px 22px 34px; }
    .page { display: block; }
    .panel {
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorWidget-background);
    }
    .panel + .panel { margin-top: 16px; }
    .panel-header {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 44px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorGroupHeader-tabsBackground);
    }
    .panel-header h2 { margin: 0; font-size: 13px; }
    .panel-header .muted { margin-left: auto; }
    .panel-body { padding: 16px; }
    .muted, .hint { color: var(--vscode-descriptionForeground); }
    .hint { margin-top: 6px; font-size: 12px; line-height: 1.4; }
    button {
      min-height: 32px;
      padding: 5px 14px;
      border: 1px solid transparent;
      border-radius: 2px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      cursor: pointer;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button.link-button {
      padding: 4px 8px;
      color: var(--vscode-textLink-foreground);
      background: transparent;
    }
    button:disabled { cursor: default; opacity: .55; }
    input, select {
      width: 100%;
      min-height: 32px;
      padding: 5px 9px;
      border: 1px solid var(--vscode-input-border, transparent);
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
    }
    label { display: block; margin-bottom: 6px; color: var(--vscode-descriptionForeground); }
    .required { color: var(--vscode-errorForeground); }
    .form-grid { display: grid; gap: 14px; }
    .connection-row { grid-template-columns: minmax(210px, 1fr) minmax(210px, 1fr) auto; align-items: start; }
    .project-row { grid-template-columns: minmax(320px, 1fr) auto; align-items: start; margin-top: 14px; }
    .action-field button { width: 100%; white-space: nowrap; }
    .workspace-row { margin-bottom: 14px; }
    .advanced-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 12px; }
    details { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--vscode-panel-border); }
    summary { color: var(--vscode-descriptionForeground); cursor: pointer; }
    .form-footer {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .spacer { flex: 1; }
    .empty-state {
      display: grid;
      place-items: center;
      min-height: 360px;
      padding: 46px 24px;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorWidget-background);
      text-align: center;
    }
    .empty-state-inner { max-width: 560px; }
    .empty-icon {
      display: grid;
      place-items: center;
      width: 58px;
      height: 58px;
      margin: 0 auto 16px;
      border-radius: 50%;
      color: var(--vscode-charts-orange);
      background: var(--vscode-badge-background);
    }
    .empty-icon svg { width: 30px; height: 30px; }
    .empty-state h2 { margin: 0 0 8px; font-size: 20px; }
    .empty-state p { margin: 0 auto 20px; color: var(--vscode-descriptionForeground); line-height: 1.55; }
    .empty-actions { display: flex; justify-content: center; gap: 10px; }
    .project-summary {
      display: inline-flex;
      margin-bottom: 14px;
      padding: 5px 9px;
      border-radius: 12px;
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }
    .card {
      min-height: 92px;
      padding: 15px 13px;
      border: 1px solid var(--vscode-panel-border);
      border-top: 3px solid var(--vscode-charts-blue);
      background: var(--vscode-editorWidget-background);
    }
    .card.blocker { border-top-color: var(--vscode-charts-red); }
    .card.critical, .card.high { border-top-color: var(--vscode-charts-red); }
    .card.major, .card.medium { border-top-color: var(--vscode-charts-yellow); }
    .card.minor, .card.low { border-top-color: var(--vscode-charts-blue); }
    .card.info { border-top-color: var(--vscode-charts-purple); }
    .card strong { display: block; margin-bottom: 5px; font-size: 24px; font-weight: 400; }
    .card span { color: var(--vscode-descriptionForeground); font-size: 12px; }
    .table-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 48px;
      padding: 9px 13px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .table-toolbar h2 { margin: 0; font-size: 13px; }
    .table-toolbar input { width: min(360px, 42vw); margin-left: auto; }
    .table-wrap { overflow: auto; max-height: 410px; }
    table { width: 100%; border-collapse: collapse; }
    .issues-table { table-layout: fixed; }
    th, td {
      padding: 9px 11px;
      border-bottom: 1px solid var(--vscode-panel-border);
      text-align: left;
      vertical-align: top;
    }
    th {
      position: sticky;
      top: 0;
      z-index: 1;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-editorWidget-background);
      font-size: 12px;
      font-weight: 600;
    }
    tbody tr { cursor: pointer; }
    tbody tr:hover { background: var(--vscode-list-hoverBackground); }
    .badge {
      display: inline-flex;
      min-width: 70px;
      justify-content: center;
      padding: 2px 7px;
      border-radius: 10px;
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
      font-size: 11px;
    }
    .badge.blocker, .badge.critical, .badge.high { background: var(--vscode-charts-red); }
    .badge.major, .badge.medium { color: var(--vscode-editor-background); background: var(--vscode-charts-yellow); }
    .badge.minor, .badge.low { background: var(--vscode-charts-blue); }
    .badge.info { background: var(--vscode-charts-purple); }
    .path { min-width: 220px; max-width: 370px; }
    .file-name {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .file-line {
      display: block;
      margin-top: 4px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    .type-icon-cell { text-align: center; }
    .type-icon {
      display: inline-block;
      width: 20px;
      height: 20px;
      vertical-align: middle;
    }
    .type-icon.code-smell {
      background: var(--vscode-charts-yellow, #cca700);
      -webkit-mask: url('${codeSmellIconUri}') center / contain no-repeat;
      mask: url('${codeSmellIconUri}') center / contain no-repeat;
    }
    .type-icon.bug {
      background: var(--vscode-charts-green, #2ea043);
      -webkit-mask: url('${bugIconUri}') center / contain no-repeat;
      mask: url('${bugIconUri}') center / contain no-repeat;
    }
    .type-icon.vulnerability {
      background: var(--vscode-charts-red, #f14c4c);
      -webkit-mask: url('${vulnerabilityIconUri}') center / contain no-repeat;
      mask: url('${vulnerabilityIconUri}') center / contain no-repeat;
    }
    .rule-button {
      min-height: 0;
      padding: 0;
      border: 0;
      color: var(--vscode-textLink-foreground);
      background: transparent;
      text-align: left;
    }
    .rule-button:hover {
      color: var(--vscode-textLink-activeForeground);
      background: transparent;
      text-decoration: underline;
    }
    .rule-dialog {
      width: min(620px, calc(100vw - 48px));
      padding: 0;
      border: 1px solid var(--vscode-panel-border);
      color: var(--vscode-foreground);
      background: var(--vscode-editorWidget-background);
      box-shadow: 0 8px 28px var(--vscode-widget-shadow);
    }
    .rule-dialog::backdrop { background: rgba(0, 0, 0, .55); }
    .rule-dialog-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorGroupHeader-tabsBackground);
    }
    .rule-dialog-header h2 { margin: 0; font-size: 15px; }
    .rule-dialog-close {
      min-width: 32px;
      margin-left: auto;
      padding: 3px 8px;
      font-size: 18px;
      line-height: 1;
    }
    .rule-dialog-body {
      padding: 18px 16px 20px;
      line-height: 1.55;
      white-space: pre-wrap;
    }
    .col-severity { width: 92px; }
    .col-type { width: 58px; text-align: center; }
    .col-file { width: 42%; }
    .col-rule { width: auto; }
    .no-results { padding: 28px 14px; color: var(--vscode-descriptionForeground); text-align: center; }
    .rank-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .rank-grid > .panel { margin-top: 0; }
    .compact-table {
      display: flex;
      min-height: 376px;
      flex-direction: column;
    }
    .compact-table .table-wrap {
      height: 330px;
      max-height: 330px;
    }
    .compact-table th, .compact-table td { padding: 8px 10px; }
    .count-cell { width: 82px; text-align: right; font-variant-numeric: tabular-nums; }
    .severity-cell { width: 92px; }
    @media (max-width: 980px) {
      .topbar { flex-wrap: wrap; }
      .navigation { order: 3; width: 100%; margin-left: 54px; }
      .nav-button { flex: 1; }
      .connection-row, .project-row, .advanced-grid, .rank-grid { grid-template-columns: 1fr; }
      .table-toolbar { flex-wrap: wrap; }
      .table-toolbar input { width: 100%; margin-left: 0; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.4 2.2a1 1 0 0 1 1.4.2L12 4l1.2-1.6a1 1 0 1 1 1.6 1.2L13.75 5H15a4 4 0 0 1 4 4v1h2a1 1 0 1 1 0 2h-2v2h2a1 1 0 1 1 0 2h-2v1a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-1H3a1 1 0 1 1 0-2h2v-2H3a1 1 0 1 1 0-2h2V9a4 4 0 0 1 4-4h1.25L9.2 3.6a1 1 0 0 1 .2-1.4ZM7 12v5a2 2 0 0 0 2 2h2v-7H7Zm6 7h2a2 2 0 0 0 2-2v-5h-4v7ZM9 7a2 2 0 0 0-2 2v1h10V9a2 2 0 0 0-2-2H9Z"/>
        </svg>
      </div>
      <div class="brand">
        <h1>SonarQube Dashboard</h1>
        <p>Defectos de SonarQube asociados a la carpeta abierta.</p>
      </div>
      <nav class="navigation" aria-label="Secciones del dashboard">
        <button id="navData" class="nav-button active" type="button">Datos</button>
        <button id="navConfiguration" class="nav-button" type="button">Configuración</button>
      </nav>
      <div class="top-actions">
        <button id="openProblems" class="secondary" type="button">Abrir Problems</button>
        <button id="refreshTop" type="button">Actualizar</button>
      </div>
    </header>

    <main class="content">
      <section id="dataPage" class="page">
        <section id="dataEmpty" class="empty-state">
          <div class="empty-state-inner">
            <div class="empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9.4 2.2a1 1 0 0 1 1.4.2L12 4l1.2-1.6a1 1 0 1 1 1.6 1.2L13.75 5H15a4 4 0 0 1 4 4v1h2a1 1 0 1 1 0 2h-2v2h2a1 1 0 1 1 0 2h-2v1a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-1H3a1 1 0 1 1 0-2h2v-2H3a1 1 0 1 1 0-2h2V9a4 4 0 0 1 4-4h1.25L9.2 3.6a1 1 0 0 1 .2-1.4ZM7 12v5a2 2 0 0 0 2 2h2v-7H7Zm6 7h2a2 2 0 0 0 2-2v-5h-4v7ZM9 7a2 2 0 0 0-2 2v1h10V9a2 2 0 0 0-2-2H9Z"/>
              </svg>
            </div>
            <div id="emptyProject" class="project-summary" hidden></div>
            <h2 id="emptyTitle">Configura SonarQube Dashboard</h2>
            <p id="emptyText">Vincula la carpeta abierta con un proyecto de SonarQube para consultar sus defectos.</p>
            <div class="empty-actions">
              <button id="goConfiguration" type="button">Ir a configuración</button>
              <button id="syncEmpty" class="secondary" type="button" hidden>Sincronizar datos</button>
            </div>
          </div>
        </section>

        <section id="results" hidden>
          <div id="cards" class="cards"></div>

          <section class="panel">
            <div class="table-toolbar">
              <h2>Defectos</h2>
              <span id="tableCount" class="muted">0 issues</span>
              <input id="filter" type="search" placeholder="Filtrar por archivo, regla o descripción">
            </div>
            <div class="table-wrap">
              <table class="issues-table" aria-label="Defectos">
                <thead>
                  <tr>
                    <th class="col-severity">Severidad</th>
                    <th class="col-type">Tipo</th>
                    <th class="col-file">Archivo</th>
                    <th class="col-rule">Regla</th>
                  </tr>
                </thead>
                <tbody id="issuesBody"></tbody>
              </table>
              <div id="noResults" class="no-results">No se han encontrado defectos para el proyecto seleccionado.</div>
            </div>
          </section>

          <div class="rank-grid">
            <section class="panel compact-table">
              <div class="panel-header">
                <h2>Top Archivos</h2>
                <span id="filesCount" class="muted">0 archivos</span>
              </div>
              <div class="table-wrap">
                <table aria-label="Top Archivos">
                  <thead>
                    <tr>
                      <th>Archivo</th>
                      <th class="severity-cell">Máxima</th>
                      <th class="count-cell">Defectos</th>
                    </tr>
                  </thead>
                  <tbody id="filesBody"></tbody>
                </table>
                <div id="noFiles" class="no-results">No hay archivos con defectos.</div>
              </div>
            </section>

            <section class="panel compact-table">
              <div class="panel-header">
                <h2>Top Reglas</h2>
                <span id="rulesCount" class="muted">0 reglas</span>
              </div>
              <div class="table-wrap">
                <table aria-label="Top Reglas">
                  <thead>
                    <tr>
                      <th>Regla</th>
                      <th class="severity-cell">Máxima</th>
                      <th class="count-cell">Defectos</th>
                    </tr>
                  </thead>
                  <tbody id="rulesBody"></tbody>
                </table>
                <div id="noRules" class="no-results">No hay reglas con defectos.</div>
              </div>
            </section>
          </div>
        </section>
      </section>

      <section id="configurationPage" class="page" hidden>
        <section class="panel">
          <div class="panel-header">
            <h2>Conexión con SonarQube</h2>
            <span class="muted">La configuración se guarda por carpeta del workspace</span>
          </div>

          <div id="emptyWorkspace" class="panel-body" hidden>
            <strong>No hay ninguna carpeta abierta.</strong>
            <p class="muted">Abre el proyecto local que corresponde al proyecto de SonarQube.</p>
          </div>

          <div id="configurationContent">
            <div class="panel-body">
              <div id="folderField" class="workspace-row" hidden>
                <label for="folder">Carpeta del workspace</label>
                <select id="folder"></select>
              </div>

              <div class="form-grid connection-row">
                <div class="field">
                  <label for="serverUrl"><span class="required">*</span> Servidor SonarQube</label>
                  <input id="serverUrl" type="url" placeholder="https://sonarqube.example.com" spellcheck="false">
                </div>
                <div class="field">
                  <label for="token"><span class="required">*</span> Token</label>
                  <input id="token" type="password" placeholder="Introduce el token" autocomplete="off">
                  <div id="tokenHint" class="hint">El token se guarda de forma segura para esta carpeta.</div>
                </div>
                <div class="field action-field">
                  <label aria-hidden="true">&nbsp;</label>
                  <button id="loadProjects" type="button">Conectar y cargar aplicaciones</button>
                </div>
              </div>

              <div class="form-grid project-row">
                <div class="field">
                  <label for="projectKey"><span class="required">*</span> Proyecto o aplicación visible</label>
                  <select id="projectKey" disabled>
                    <option value="">Introduce servidor y token para cargar la lista</option>
                  </select>
                  <div class="hint">El desplegable incluye únicamente los componentes visibles para el token.</div>
                </div>
                <div class="field action-field">
                  <label aria-hidden="true">&nbsp;</label>
                  <button id="save" type="button">Guardar y sincronizar</button>
                </div>
              </div>

              <details>
                <summary>Configuración avanzada</summary>
                <div class="form-grid advanced-grid">
                  <div class="field">
                    <label for="branch">Rama</label>
                    <input id="branch" type="text" placeholder="main" spellcheck="false">
                    <div class="hint">Déjala vacía para consultar la rama principal.</div>
                  </div>
                  <div class="field">
                    <label for="baseDir">Subcarpeta local</label>
                    <input id="baseDir" type="text" placeholder="packages/backend" spellcheck="false">
                    <div class="hint">Solo es necesaria cuando la raíz analizada está dentro de una subcarpeta.</div>
                  </div>
                </div>
              </details>
            </div>

            <div class="form-footer">
              <button id="refresh" class="secondary" type="button">Actualizar issues</button>
              <button id="clear" class="secondary" type="button">Limpiar Problems</button>
              <div class="spacer"></div>
              <span id="configState" class="muted">Sin configurar</span>
            </div>
          </div>
        </section>
      </section>
    </main>
  </div>

  <dialog id="ruleDialog" class="rule-dialog" aria-labelledby="ruleDialogTitle">
    <div class="rule-dialog-header">
      <h2 id="ruleDialogTitle"></h2>
      <button id="ruleDialogClose" class="rule-dialog-close secondary" type="button" aria-label="Cerrar">×</button>
    </div>
    <div id="ruleDialogDescription" class="rule-dialog-body"></div>
  </dialog>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const typeIconClasses = {
      BUG: 'bug',
      CODE_SMELL: 'code-smell',
      VULNERABILITY: 'vulnerability'
    };
    const elements = {
      navData: document.getElementById('navData'),
      navConfiguration: document.getElementById('navConfiguration'),
      dataPage: document.getElementById('dataPage'),
      configurationPage: document.getElementById('configurationPage'),
      dataEmpty: document.getElementById('dataEmpty'),
      emptyProject: document.getElementById('emptyProject'),
      emptyTitle: document.getElementById('emptyTitle'),
      emptyText: document.getElementById('emptyText'),
      goConfiguration: document.getElementById('goConfiguration'),
      syncEmpty: document.getElementById('syncEmpty'),
      emptyWorkspace: document.getElementById('emptyWorkspace'),
      configurationContent: document.getElementById('configurationContent'),
      folderField: document.getElementById('folderField'),
      folder: document.getElementById('folder'),
      serverUrl: document.getElementById('serverUrl'),
      token: document.getElementById('token'),
      tokenHint: document.getElementById('tokenHint'),
      projectKey: document.getElementById('projectKey'),
      branch: document.getElementById('branch'),
      baseDir: document.getElementById('baseDir'),
      loadProjects: document.getElementById('loadProjects'),
      save: document.getElementById('save'),
      refresh: document.getElementById('refresh'),
      refreshTop: document.getElementById('refreshTop'),
      clear: document.getElementById('clear'),
      openProblems: document.getElementById('openProblems'),
      configState: document.getElementById('configState'),
      results: document.getElementById('results'),
      cards: document.getElementById('cards'),
      tableCount: document.getElementById('tableCount'),
      filter: document.getElementById('filter'),
      issuesBody: document.getElementById('issuesBody'),
      noResults: document.getElementById('noResults'),
      filesCount: document.getElementById('filesCount'),
      filesBody: document.getElementById('filesBody'),
      noFiles: document.getElementById('noFiles'),
      rulesCount: document.getElementById('rulesCount'),
      rulesBody: document.getElementById('rulesBody'),
      noRules: document.getElementById('noRules'),
      ruleDialog: document.getElementById('ruleDialog'),
      ruleDialogTitle: document.getElementById('ruleDialogTitle'),
      ruleDialogDescription: document.getElementById('ruleDialogDescription'),
      ruleDialogClose: document.getElementById('ruleDialogClose')
    };

    let currentPage = 'data';
    let currentConfig = { serverUrl: '', projectKey: '', hasToken: false };
    let currentSummary = { published: 0, issues: [], severity: [] };
    let summaryVisible = false;
    let currentIssues = [];
    let loadedProjects = [];
    let selectedProjectKey = '';
    let currentFolderUri = '';
    let hasWorkspace = false;

    function navigate(page) {
      currentPage = page === 'configuration' ? 'configuration' : 'data';
      elements.dataPage.hidden = currentPage !== 'data';
      elements.configurationPage.hidden = currentPage !== 'configuration';
      elements.navData.classList.toggle('active', currentPage === 'data');
      elements.navConfiguration.classList.toggle('active', currentPage === 'configuration');
    }

    function isConfigured() {
      return Boolean(
        currentConfig.serverUrl &&
        currentConfig.projectKey &&
        currentConfig.hasToken
      );
    }

    function values() {
      return {
        folderUri: elements.folder.value,
        serverUrl: elements.serverUrl.value.trim(),
        token: elements.token.value,
        projectKey: elements.projectKey.value,
        branch: elements.branch.value.trim(),
        baseDir: elements.baseDir.value.trim()
      };
    }

    function setBusy(busy) {
      elements.loadProjects.disabled = busy;
      elements.save.disabled = busy;
      elements.refresh.disabled = busy;
      elements.refreshTop.disabled = busy;
      elements.syncEmpty.disabled = busy;
    }

    function setStatus(kind) {
      setBusy(kind === 'loading');
    }

    function setProjectOptions(projects, preferredKey) {
      loadedProjects = projects;
      const desiredKey = preferredKey || selectedProjectKey || elements.projectKey.value || currentConfig.projectKey;
      elements.projectKey.textContent = '';

      if (!projects.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No hay proyectos o aplicaciones visibles';
        elements.projectKey.appendChild(option);
        elements.projectKey.disabled = true;
        selectedProjectKey = '';
        return;
      }

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Selecciona un proyecto o aplicación';
      elements.projectKey.appendChild(placeholder);

      for (const project of projects) {
        const option = document.createElement('option');
        option.value = project.key;
        const type = project.qualifier === 'APP' ? 'Aplicación' : 'Proyecto';
        option.textContent = project.name + ' — ' + project.key + ' · ' + type;
        elements.projectKey.appendChild(option);
      }

      elements.projectKey.disabled = false;
      const exists = projects.some(project => project.key === desiredKey);
      elements.projectKey.value = exists ? desiredKey : '';
      selectedProjectKey = elements.projectKey.value;
    }

    function renderEmptyState() {
      const configured = isConfigured();
      const showResults = hasWorkspace && configured && summaryVisible;
      elements.results.hidden = !showResults;
      elements.dataEmpty.hidden = showResults;

      if (showResults) {
        return;
      }

      elements.emptyProject.hidden = !configured;
      elements.emptyProject.textContent = configured ? currentConfig.projectKey : '';
      elements.syncEmpty.hidden = !configured;

      if (!hasWorkspace) {
        elements.emptyTitle.textContent = 'No hay ninguna carpeta abierta';
        elements.emptyText.textContent = 'Abre el proyecto local que quieres vincular con SonarQube y vuelve a SonarQube Dashboard.';
        elements.goConfiguration.textContent = 'Ver configuración';
        elements.syncEmpty.hidden = true;
      } else if (!configured) {
        elements.emptyTitle.textContent = 'No hay un proyecto vinculado';
        elements.emptyText.textContent = 'Configura el servidor, el token y el proyecto de SonarQube para cargar sus defectos.';
        elements.goConfiguration.textContent = 'Configurar proyecto';
      } else {
        elements.emptyTitle.textContent = 'El proyecto está vinculado';
        elements.emptyText.textContent = 'Sincroniza para cargar los defectos, el top de archivos y el top de reglas.';
        elements.goConfiguration.textContent = 'Revisar configuración';
      }
    }

    function renderState(message) {
      const folders = message.folders || [];
      hasWorkspace = folders.length > 0;
      elements.emptyWorkspace.hidden = hasWorkspace;
      elements.configurationContent.hidden = !hasWorkspace;

      if (!hasWorkspace) {
        currentConfig = { serverUrl: '', projectKey: '', branch: '', baseDir: '', hasToken: false };
        elements.configState.textContent = 'Sin carpeta abierta';
        renderEmptyState();
        return;
      }

      const folderChanged = currentFolderUri && currentFolderUri !== message.selectedFolderUri;
      currentFolderUri = message.selectedFolderUri;

      elements.folder.textContent = '';
      for (const folder of folders) {
        const option = document.createElement('option');
        option.value = folder.uri;
        option.textContent = folder.name;
        elements.folder.appendChild(option);
      }
      elements.folder.value = message.selectedFolderUri;
      elements.folderField.hidden = folders.length === 1;

      currentConfig = message.config || {};
      elements.serverUrl.value = currentConfig.serverUrl || '';
      elements.token.value = '';
      elements.token.placeholder = currentConfig.hasToken
        ? 'Token guardado · escribe otro para sustituirlo'
        : 'Introduce el token';
      elements.tokenHint.textContent = currentConfig.hasToken
        ? 'Hay un token guardado de forma segura para esta carpeta.'
        : 'El token se guardará en SecretStorage, no en settings.json.';
      elements.branch.value = currentConfig.branch || '';
      elements.baseDir.value = currentConfig.baseDir || '';
      elements.configState.textContent = currentConfig.projectKey
        ? 'Configurado: ' + currentConfig.projectKey
        : 'Sin configurar';

      if (folderChanged) {
        loadedProjects = [];
        selectedProjectKey = '';
        summaryVisible = false;
      }

      selectedProjectKey = currentConfig.projectKey || selectedProjectKey;

      if (loadedProjects.length && !folderChanged) {
        setProjectOptions(loadedProjects, selectedProjectKey);
      } else if (currentConfig.projectKey) {
        setProjectOptions([
          {
            key: currentConfig.projectKey,
            name: currentConfig.projectKey,
            qualifier: 'TRK'
          }
        ], currentConfig.projectKey);
      } else {
        elements.projectKey.textContent = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Introduce servidor y token para cargar la lista';
        elements.projectKey.appendChild(option);
        elements.projectKey.disabled = true;
      }

      renderEmptyState();
    }

    function renderConfigurationSaved(config) {
      currentConfig = config;
      selectedProjectKey = config.projectKey || selectedProjectKey;
      elements.projectKey.value = selectedProjectKey;
      elements.configState.textContent = selectedProjectKey
        ? 'Configurado: ' + selectedProjectKey
        : 'Sin configurar';
      elements.token.value = '';
      elements.token.placeholder = 'Token guardado · escribe otro para sustituirlo';
      elements.tokenHint.textContent = 'Hay un token guardado de forma segura para esta carpeta.';
      renderEmptyState();
    }

    function severityClass(severity) {
      return String(severity || 'UNKNOWN').toLowerCase();
    }

    function createBadge(severity) {
      const badge = document.createElement('span');
      badge.className = 'badge ' + severityClass(severity);
      badge.textContent = severity || 'UNKNOWN';
      return badge;
    }

    function createCard(value, label, className) {
      const card = document.createElement('div');
      card.className = 'card' + (className ? ' ' + className : '');

      const number = document.createElement('strong');
      number.textContent = String(value);
      card.appendChild(number);

      const caption = document.createElement('span');
      caption.textContent = label;
      card.appendChild(caption);
      return card;
    }

    function renderCards(summary) {
      elements.cards.textContent = '';
      elements.cards.appendChild(createCard(summary.published || 0, 'Total publicados', ''));

      for (const item of summary.severity || []) {
        elements.cards.appendChild(
          createCard(item.count || 0, item.name || 'UNKNOWN', severityClass(item.name))
        );
      }
    }

    function createCell(text, className) {
      const cell = document.createElement('td');
      cell.textContent = text;
      if (className) {
        cell.className = className;
      }
      return cell;
    }

    function createTypeCell(type) {
      const normalizedType = String(type || 'ISSUE').toUpperCase();
      const cell = document.createElement('td');
      cell.className = 'type-icon-cell';
      cell.title = normalizedType;

      const iconClass = typeIconClasses[normalizedType];
      if (iconClass) {
        const icon = document.createElement('span');
        icon.className = 'type-icon ' + iconClass;
        icon.setAttribute('role', 'img');
        icon.setAttribute('aria-label', normalizedType);
        cell.appendChild(icon);
      } else {
        cell.textContent = normalizedType;
      }
      return cell;
    }

    const fileCellUtils = {
      fileName(relativePath) {
        const normalizedPath = String(relativePath || '').replace(/\\\\/g, '/');
        const pathParts = normalizedPath.split('/');
        return pathParts[pathParts.length - 1] || normalizedPath;
      },

      create(relativePath, lineNumber) {
        const cell = document.createElement('td');
        cell.className = 'path';
        cell.title = relativePath;

        const name = document.createElement('span');
        name.className = 'file-name';
        name.textContent = this.fileName(relativePath);
        cell.appendChild(name);

        if (lineNumber !== undefined && lineNumber !== null) {
          const line = document.createElement('span');
          line.className = 'file-line';
          line.textContent = 'Línea ' + String(lineNumber);
          cell.appendChild(line);
        }
        return cell;
      }
    };

    function showRuleDialog(issue) {
      elements.ruleDialogTitle.textContent = issue.ruleName || issue.rule;
      elements.ruleDialogDescription.textContent = issue.message;
      elements.ruleDialog.showModal();
    }

    function createRuleCell(issue) {
      const cell = document.createElement('td');
      const button = document.createElement('button');
      button.className = 'rule-button';
      button.type = 'button';
      button.textContent = issue.ruleName || issue.rule;
      button.title = 'Ver descripción' +
        (issue.ruleName && issue.ruleName !== issue.rule ? ' · ' + issue.rule : '');
      button.setAttribute('aria-haspopup', 'dialog');

      button.addEventListener('click', event => {
        event.stopPropagation();
        showRuleDialog(issue);
      });

      cell.appendChild(button);
      return cell;
    }

    function bindOpen(row, issue) {
      if (!issue) {
        return;
      }
      row.tabIndex = 0;
      row.title = 'Abrir ' + issue.relativePath + ':' + issue.line;
      const open = () => vscode.postMessage({
        type: 'openIssue',
        fileUri: issue.fileUri,
        line: issue.line
      });
      row.addEventListener('click', open);
      row.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    }

    function renderIssues() {
      const query = elements.filter.value.trim().toLowerCase();
      const filtered = currentIssues.filter(issue => {
        if (!query) {
          return true;
        }
        return [
          issue.relativePath,
          issue.ruleName,
          issue.rule,
          issue.message,
          issue.type,
          issue.severity
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);
      });
      elements.issuesBody.textContent = '';
      elements.tableCount.textContent = String(filtered.length) + ' issues';
      elements.noResults.hidden = filtered.length > 0;

      if (!filtered.length) {
        elements.noResults.textContent = currentIssues.length
          ? 'No hay defectos que coincidan con el filtro.'
          : 'No se han encontrado defectos para el proyecto seleccionado.';
        return;
      }

      for (const issue of filtered) {
        const row = document.createElement('tr');
        bindOpen(row, issue);

        const severityCell = document.createElement('td');
        severityCell.appendChild(createBadge(issue.severity));
        row.appendChild(severityCell);
        row.appendChild(createTypeCell(issue.type));
        row.appendChild(fileCellUtils.create(issue.relativePath, issue.line));
        row.appendChild(createRuleCell(issue));
        elements.issuesBody.appendChild(row);
      }
    }

    function aggregateBy(keyName) {
      const groups = new Map();
      for (const issue of currentIssues) {
        const key = issue[keyName] || 'UNKNOWN';
        let group = groups.get(key);
        if (!group) {
          group = {
            key,
            count: 0,
            severity: issue.severity,
            severityRank: issue.severityRank || 0,
            issue
          };
          groups.set(key, group);
        }
        group.count += 1;
        if ((issue.severityRank || 0) > group.severityRank) {
          group.severity = issue.severity;
          group.severityRank = issue.severityRank || 0;
          group.issue = issue;
        }
      }
      return Array.from(groups.values()).sort((left, right) =>
        right.count - left.count ||
        right.severityRank - left.severityRank ||
        String(left.key).localeCompare(String(right.key), 'es', { sensitivity: 'base' })
      );
    }

    function renderTopFiles() {
      const allRows = aggregateBy('relativePath');
      const rows = allRows.slice(0, 15);
      elements.filesBody.textContent = '';
      elements.filesCount.textContent = allRows.length > rows.length
        ? String(rows.length) + ' de ' + String(allRows.length) + ' archivos'
        : String(rows.length) + (rows.length === 1 ? ' archivo' : ' archivos');
      elements.noFiles.hidden = rows.length > 0;

      for (const item of rows) {
        const row = document.createElement('tr');
        bindOpen(row, item.issue);
        row.appendChild(fileCellUtils.create(item.key));
        const severityCell = document.createElement('td');
        severityCell.appendChild(createBadge(item.severity));
        row.appendChild(severityCell);
        row.appendChild(createCell(String(item.count), 'count-cell'));
        elements.filesBody.appendChild(row);
      }
    }

    function renderTopRules() {
      const allRows = aggregateBy('rule');
      const rows = allRows.slice(0, 15);
      elements.rulesBody.textContent = '';
      elements.rulesCount.textContent = allRows.length > rows.length
        ? String(rows.length) + ' de ' + String(allRows.length) + ' reglas'
        : String(rows.length) + (rows.length === 1 ? ' regla' : ' reglas');
      elements.noRules.hidden = rows.length > 0;

      for (const item of rows) {
        const row = document.createElement('tr');
        bindOpen(row, item.issue);
        row.appendChild(createRuleCell(item.issue));
        const severityCell = document.createElement('td');
        severityCell.appendChild(createBadge(item.severity));
        row.appendChild(severityCell);
        row.appendChild(createCell(String(item.count), 'count-cell'));
        elements.rulesBody.appendChild(row);
      }
    }

    function renderSummary(summary, visible) {
      currentSummary = summary || { published: 0, issues: [], severity: [] };
      summaryVisible = Boolean(visible);
      currentIssues = currentSummary.issues || [];
      renderCards(currentSummary);
      renderIssues();
      renderTopFiles();
      renderTopRules();
      renderEmptyState();
    }

    function requestRefresh() {
      if (!isConfigured()) {
        navigate('configuration');
        setStatus('error', 'Configura primero la conexión y el proyecto.');
        return;
      }
      setStatus('loading', 'Actualizando issues…');
      vscode.postMessage({ type: 'refresh' });
    }

    elements.navData.addEventListener('click', () => navigate('data'));
    elements.navConfiguration.addEventListener('click', () => navigate('configuration'));
    elements.goConfiguration.addEventListener('click', () => navigate('configuration'));
    elements.syncEmpty.addEventListener('click', requestRefresh);

    elements.folder.addEventListener('change', () => {
      currentFolderUri = elements.folder.value;
      loadedProjects = [];
      selectedProjectKey = '';
      summaryVisible = false;
      renderEmptyState();
      vscode.postMessage({ type: 'selectFolder', folderUri: elements.folder.value });
    });

    elements.projectKey.addEventListener('change', () => {
      selectedProjectKey = elements.projectKey.value;
    });

    elements.loadProjects.addEventListener('click', () => {
      selectedProjectKey = elements.projectKey.value || selectedProjectKey;
      setStatus('loading', 'Consultando proyectos y aplicaciones visibles…');
      vscode.postMessage({ type: 'loadProjects', ...values() });
    });

    elements.save.addEventListener('click', () => {
      selectedProjectKey = elements.projectKey.value;
      setStatus('loading', 'Guardando configuración…');
      vscode.postMessage({ type: 'save', ...values() });
    });

    elements.refresh.addEventListener('click', requestRefresh);
    elements.refreshTop.addEventListener('click', requestRefresh);
    elements.clear.addEventListener('click', () => vscode.postMessage({ type: 'clear' }));
    elements.openProblems.addEventListener('click', () => vscode.postMessage({ type: 'openProblems' }));
    elements.filter.addEventListener('input', renderIssues);
    elements.ruleDialogClose.addEventListener('click', () => elements.ruleDialog.close());
    elements.ruleDialog.addEventListener('click', event => {
      if (event.target === elements.ruleDialog) {
        elements.ruleDialog.close();
      }
    });

    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'navigate':
          navigate(message.page);
          break;
        case 'state':
          renderState(message);
          break;
        case 'configurationSaved':
          renderConfigurationSaved(message.config || {});
          break;
        case 'projectsLoading':
          setStatus('loading', 'Consultando proyectos y aplicaciones visibles…');
          break;
        case 'projectsLoaded':
          setProjectOptions(
            message.projects || [],
            selectedProjectKey || currentConfig.projectKey
          );
          setBusy(false);
          break;
        case 'status':
          setStatus(message.kind, message.message);
          if (message.kind !== 'loading') {
            setBusy(false);
          }
          break;
        case 'summary':
          renderSummary(message.summary || {}, Boolean(message.visible));
          break;
      }
    });

    navigate('data');
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
