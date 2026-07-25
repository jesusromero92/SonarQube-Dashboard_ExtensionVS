import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import {
  getFolderFormConfig,
  saveFolderConfig,
  tokenKey
} from './configuration';
import { fetchVisibleProjects } from './sonarClient';
import { RefreshSummary } from './types';

export const DASHBOARD_PANEL_VIEW_TYPE = 'issueDashboard.panel';

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
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      DASHBOARD_PANEL_VIEW_TYPE,
      'Issue Dashboard',
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
    panel.title = 'Issue Dashboard';
    panel.iconPath = vscode.Uri.joinPath(
      this.context.extensionUri,
      'media',
      'issue-dashboard.svg'
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
    } else if (summary.errors.length > 0) {
      this.postStatus('error', summary.errors.join(' | '));
    } else {
      this.postStatus('success', `${summary.published} issues publicados en Problems.`);
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

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"
  >
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Issue Dashboard</title>
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
    .shell { min-width: 720px; }
    .topbar {
      display: flex;
      align-items: center;
      gap: 14px;
      min-height: 68px;
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
    .brand-mark svg {
      width: 34px;
      height: 34px;
      overflow: visible;
    }
    .brand h1 { margin: 0; font-size: 21px; font-weight: 500; }
    .brand p { margin: 3px 0 0; color: var(--vscode-descriptionForeground); }
    .top-actions { display: flex; gap: 8px; margin-left: auto; }
    .content { padding: 18px 22px 32px; }
    .panel {
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorWidget-background);
    }
    .panel-header {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 44px;
      padding: 8px 14px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-sideBarSectionHeader-background);
    }
    .panel-header h2 { margin: 0; font-size: 13px; font-weight: 600; }
    .panel-header .muted { margin-left: auto; }
    .form-grid {
      display: grid;
      grid-template-columns: minmax(230px, 1fr) minmax(230px, 1fr) minmax(210px, auto);
      gap: 14px;
      padding: 16px;
      align-items: start;
    }
    .field { min-width: 0; }
    .folder-field { grid-column: 1 / -1; }
    .project-field { grid-column: span 2; }
    .action-field button { width: 100%; height: 32px; white-space: nowrap; }
    label {
      display: flex;
      gap: 5px;
      align-items: center;
      margin-bottom: 6px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .required { color: var(--vscode-inputValidation-errorBorder); }
    input, select {
      width: 100%;
      height: 32px;
      padding: 5px 9px;
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 2px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
    }
    input:disabled, select:disabled { opacity: .65; }
    .hint { margin-top: 5px; color: var(--vscode-descriptionForeground); font-size: 11px; }
    .form-footer {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    button {
      min-height: 30px;
      padding: 5px 12px;
      border: 1px solid transparent;
      border-radius: 2px;
      cursor: pointer;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button:disabled { cursor: default; opacity: .55; }
    .spacer { flex: 1; }
    .advanced {
      margin: 0 16px 16px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .advanced summary {
      padding: 11px 0;
      cursor: pointer;
      color: var(--vscode-descriptionForeground);
      user-select: none;
    }
    .advanced-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(220px, 1fr));
      gap: 14px;
      padding-bottom: 4px;
    }
    .status {
      display: none;
      margin: 14px 0;
      padding: 10px 12px;
      border-left: 3px solid var(--vscode-descriptionForeground);
      background: var(--vscode-textBlockQuote-background);
      line-height: 1.4;
    }
    .status.visible { display: block; }
    .status.success { border-left-color: var(--vscode-testing-iconPassed); }
    .status.error { border-left-color: var(--vscode-testing-iconFailed); }
    .status.loading { border-left-color: var(--vscode-progressBar-background); }
    .empty {
      padding: 20px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
    }
    .results { margin-top: 18px; }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px;
      margin-bottom: 14px;
    }
    .card {
      min-height: 82px;
      padding: 12px;
      border: 1px solid var(--vscode-panel-border);
      border-top: 3px solid var(--vscode-badge-background);
      background: var(--vscode-editorWidget-background);
    }
    .card strong { display: block; font-size: 24px; font-weight: 500; }
    .card span { color: var(--vscode-descriptionForeground); font-size: 11px; }
    .card.blocker, .card.critical, .card.high {
      border-top-color: var(--vscode-testing-iconFailed);
    }
    .card.major, .card.medium {
      border-top-color: var(--vscode-charts-yellow);
    }
    .card.minor, .card.low, .card.info {
      border-top-color: var(--vscode-charts-blue);
    }
    .table-toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .table-toolbar h2 { margin: 0; font-size: 13px; }
    .table-toolbar input { width: min(360px, 45vw); margin-left: auto; }
    .table-wrap { overflow: auto; max-height: 520px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td {
      padding: 9px 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
      text-align: left;
      vertical-align: top;
    }
    th {
      position: sticky;
      top: 0;
      z-index: 1;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-sideBarSectionHeader-background);
      font-size: 11px;
      font-weight: 600;
    }
    tbody tr { cursor: pointer; }
    tbody tr:hover { background: var(--vscode-list-hoverBackground); }
    .col-severity { width: 116px; }
    .col-type { width: 118px; }
    .col-file { width: 25%; }
    .col-line { width: 70px; }
    .col-rule { width: 145px; }
    .badge {
      display: inline-block;
      min-width: 70px;
      padding: 3px 7px;
      border-radius: 10px;
      text-align: center;
      font-size: 10px;
      font-weight: 700;
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
    }
    .badge.blocker, .badge.critical, .badge.high {
      background: var(--vscode-testing-iconFailed);
    }
    .badge.major, .badge.medium {
      color: var(--vscode-editor-background);
      background: var(--vscode-charts-yellow);
    }
    .badge.minor, .badge.low, .badge.info {
      background: var(--vscode-charts-blue);
    }
    .path { overflow-wrap: anywhere; }
    .message { line-height: 1.35; overflow-wrap: anywhere; }
    .muted { color: var(--vscode-descriptionForeground); }
    .no-results {
      padding: 24px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
    }
    @media (max-width: 980px) {
      .shell { min-width: 640px; }
      .form-grid {
        grid-template-columns: repeat(2, minmax(220px, 1fr));
      }
      .folder-field { grid-column: 1 / -1; }
      .project-field { grid-column: 1 / -1; }
      .action-field { grid-column: 1 / -1; }
      .action-field button { width: auto; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="topbar">
      <div class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path fill="currentColor" d="M9.4 2.2a1 1 0 0 1 1.4.2L12 4l1.2-1.6a1 1 0 1 1 1.6 1.2L13.75 5H15a4 4 0 0 1 4 4v1h2a1 1 0 1 1 0 2h-2v2h2a1 1 0 1 1 0 2h-2v1a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-1H3a1 1 0 1 1 0-2h2v-2H3a1 1 0 1 1 0-2h2V9a4 4 0 0 1 4-4h1.25L9.2 3.6a1 1 0 0 1 .2-1.4ZM7 12v5a2 2 0 0 0 2 2h2v-7H7Zm6 7h2a2 2 0 0 0 2-2v-5h-4v7ZM9 7a2 2 0 0 0-2 2v1h10V9a2 2 0 0 0-2-2H9Z"/>
        </svg>
      </div>
      <div class="brand">
        <h1>Issue Dashboard</h1>
        <p>Conecta SonarQube, publica los issues en Problems y revisa los defectos más críticos.</p>
      </div>
      <div class="top-actions">
        <button id="openProblems" class="secondary" type="button">Abrir Problems</button>
        <button id="refreshTop" type="button">Actualizar</button>
      </div>
    </header>

    <main class="content">
      <section class="panel">
        <div class="panel-header">
          <h2>Conexión con SonarQube</h2>
          <span class="muted">La configuración se guarda por carpeta del workspace</span>
        </div>

        <div id="emptyWorkspace" class="empty" hidden>
          Abre una carpeta o un workspace para configurar Issue Dashboard.
        </div>

        <div id="configurationContent">
          <div class="form-grid">
            <div id="folderField" class="field folder-field">
              <label for="folder"><span class="required">*</span> Carpeta</label>
              <select id="folder"></select>
            </div>

            <div class="field">
              <label for="serverUrl"><span class="required">*</span> Servidor SonarQube</label>
              <input id="serverUrl" type="url" placeholder="http://localhost:9000" spellcheck="false">
            </div>

            <div class="field">
              <label for="token"><span class="required">*</span> Token</label>
              <input id="token" type="password" autocomplete="off" placeholder="Introduce el token">
              <div id="tokenHint" class="hint">Se guardará en SecretStorage.</div>
            </div>

            <div class="field action-field">
              <label>&nbsp;</label>
              <button id="loadProjects" type="button">Conectar</button>
            </div>

            <div class="field project-field">
              <label for="projectKey"><span class="required">*</span> Proyecto o aplicación visible</label>
              <select id="projectKey" disabled>
                <option value="">Introduce servidor y token para cargar la lista</option>
              </select>
              <div class="hint">El desplegable incluye únicamente los componentes visibles para el token.</div>
            </div>

            <div class="field action-field">
              <label>&nbsp;</label>
              <button id="save" type="button">Sincronizar</button>
            </div>
          </div>

          <details class="advanced">
            <summary>Configuración avanzada</summary>
            <div class="advanced-grid">
              <div class="field">
                <label for="branch">Rama</label>
                <input id="branch" type="text" placeholder="main" spellcheck="false">
                <div class="hint">Vacío utiliza la rama principal configurada en SonarQube.</div>
              </div>
              <div class="field">
                <label for="baseDir">Subcarpeta local</label>
                <input id="baseDir" type="text" placeholder="packages/backend" spellcheck="false">
                <div class="hint">Solo es necesaria cuando la raíz analizada está dentro de una subcarpeta.</div>
              </div>
            </div>
          </details>

          <div class="form-footer">
            <button id="refresh" class="secondary" type="button">Actualizar issues</button>
            <button id="clear" class="secondary" type="button">Limpiar Problems</button>
            <div class="spacer"></div>
            <span id="configState" class="muted">Sin configurar</span>
          </div>
        </div>
      </section>

      <div id="status" class="status" role="status" aria-live="polite"></div>

      <section id="results" class="results" hidden>
        <div id="cards" class="cards"></div>

        <section class="panel">
          <div class="table-toolbar">
            <h2>Top de defectos por severidad</h2>
            <span id="tableCount" class="muted">0 issues</span>
            <input id="filter" type="search" placeholder="Filtrar por archivo, regla o descripción">
          </div>
          <div class="table-wrap">
            <table aria-label="Top de defectos por severidad">
              <thead>
                <tr>
                  <th class="col-severity">Severidad</th>
                  <th class="col-type">Tipo</th>
                  <th class="col-file">Archivo</th>
                  <th class="col-line">Línea</th>
                  <th class="col-rule">Regla</th>
                  <th>Descripción</th>
                </tr>
              </thead>
              <tbody id="issuesBody"></tbody>
            </table>
            <div id="noResults" class="no-results">No se han encontrado issues para la aplicación seleccionada.</div>
          </div>
        </section>
      </section>
    </main>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const elements = {
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
      status: document.getElementById('status'),
      configState: document.getElementById('configState'),
      results: document.getElementById('results'),
      cards: document.getElementById('cards'),
      tableCount: document.getElementById('tableCount'),
      filter: document.getElementById('filter'),
      issuesBody: document.getElementById('issuesBody'),
      noResults: document.getElementById('noResults')
    };

    let currentConfig = { projectKey: '', hasToken: false };
    let currentIssues = [];
    let loadedProjects = [];
    let selectedProjectKey = '';
    let currentFolderUri = '';

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
    }

    function setStatus(kind, message) {
      elements.status.className = 'status visible ' + kind;
      elements.status.textContent = message;
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

    function renderState(message) {
      const folders = message.folders || [];
      const hasWorkspace = folders.length > 0;
      elements.emptyWorkspace.hidden = hasWorkspace;
      elements.configurationContent.hidden = !hasWorkspace;

      if (!hasWorkspace) {
        elements.configState.textContent = 'Sin carpeta abierta';
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

      currentConfig = message.config;
      elements.serverUrl.value = message.config.serverUrl || '';
      elements.token.value = '';
      elements.token.placeholder = message.config.hasToken
        ? 'Token guardado · escribe otro para sustituirlo'
        : 'Introduce el token';
      elements.tokenHint.textContent = message.config.hasToken
        ? 'Hay un token guardado de forma segura para esta carpeta.'
        : 'El token se guardará en SecretStorage, no en settings.json.';
      elements.branch.value = message.config.branch || '';
      elements.baseDir.value = message.config.baseDir || '';
      elements.configState.textContent = message.config.projectKey
        ? 'Configurado: ' + message.config.projectKey
        : 'Sin configurar';

      if (folderChanged) {
        loadedProjects = [];
        selectedProjectKey = '';
      }

      selectedProjectKey = message.config.projectKey || selectedProjectKey;

      if (loadedProjects.length && !folderChanged) {
        setProjectOptions(loadedProjects, selectedProjectKey);
      } else if (message.config.projectKey) {
        setProjectOptions([
          {
            key: message.config.projectKey,
            name: message.config.projectKey,
            qualifier: 'TRK'
          }
        ], message.config.projectKey);
      } else {
        elements.projectKey.textContent = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Introduce servidor y token para cargar la lista';
        elements.projectKey.appendChild(option);
        elements.projectKey.disabled = true;
      }
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
    }

    function severityClass(severity) {
      return String(severity || 'UNKNOWN').toLowerCase();
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

    function renderIssues() {
      const query = elements.filter.value.trim().toLowerCase();
      const filtered = currentIssues.filter(issue => {
        if (!query) {
          return true;
        }
        return [issue.relativePath, issue.rule, issue.message, issue.type, issue.severity]
          .join(' ')
          .toLowerCase()
          .includes(query);
      });

      elements.issuesBody.textContent = '';
      elements.tableCount.textContent = String(filtered.length) + ' issues';
      elements.noResults.hidden = filtered.length > 0;

      if (!filtered.length) {
        elements.noResults.textContent = currentIssues.length
          ? 'No hay issues que coincidan con el filtro.'
          : 'No se han encontrado issues para la aplicación seleccionada.';
        return;
      }

      for (const issue of filtered) {
        const row = document.createElement('tr');
        row.tabIndex = 0;
        row.title = 'Abrir ' + issue.relativePath + ':' + issue.line;

        const severityCell = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = 'badge ' + severityClass(issue.severity);
        badge.textContent = issue.severity;
        severityCell.appendChild(badge);
        row.appendChild(severityCell);
        row.appendChild(createCell(issue.type || 'ISSUE'));
        row.appendChild(createCell(issue.relativePath, 'path'));
        row.appendChild(createCell(String(issue.line)));
        row.appendChild(createCell(issue.rule));
        row.appendChild(createCell(issue.message, 'message'));

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
        elements.issuesBody.appendChild(row);
      }
    }

    function renderSummary(summary, visible) {
      elements.results.hidden = !visible;
      if (!visible) {
        return;
      }

      renderCards(summary);
      currentIssues = summary.issues || [];
      renderIssues();
    }

    elements.folder.addEventListener('change', () => {
      currentFolderUri = elements.folder.value;
      loadedProjects = [];
      selectedProjectKey = '';
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

    function requestRefresh() {
      setStatus('loading', 'Actualizando issues…');
      vscode.postMessage({ type: 'refresh' });
    }

    elements.refresh.addEventListener('click', requestRefresh);
    elements.refreshTop.addEventListener('click', requestRefresh);
    elements.clear.addEventListener('click', () => vscode.postMessage({ type: 'clear' }));
    elements.openProblems.addEventListener('click', () => vscode.postMessage({ type: 'openProblems' }));
    elements.filter.addEventListener('input', renderIssues);

    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
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

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
