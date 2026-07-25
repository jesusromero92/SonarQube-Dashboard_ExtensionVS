import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import {
  getFolderFormConfig,
  saveFolderConfig,
  tokenKey
} from './configuration';
import { fetchVisibleProjects } from './sonarClient';
import { RefreshSummary } from './types';

export const DASHBOARD_VIEW_ID = 'sonarQubeDashboard.configuration';

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
}

export class DashboardViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private selectedFolderUri: string | undefined;
  private projectLoadController: AbortController | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly refreshCallback: RefreshCallback,
    private readonly clearCallback: ClearCallback
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      (message: WebviewMessage) => void this.handleMessage(message),
      undefined,
      this.context.subscriptions
    );

    webviewView.onDidChangeVisibility(
      () => {
        if (webviewView.visible) {
          void this.sendState();
        }
      },
      undefined,
      this.context.subscriptions
    );

    void this.sendState();
  }

  async show(): Promise<void> {
    if (this.view) {
      this.view.show(false);
      await this.sendState();
      return;
    }

    await vscode.commands.executeCommand(`${DASHBOARD_VIEW_ID}.focus`);
  }

  async refreshWorkspaceState(): Promise<void> {
    await this.sendState();
  }

  setRefreshSummary(summary: RefreshSummary): void {
    this.postMessage({
      type: 'summary',
      summary
    });
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        await this.sendState();
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
        await this.refreshFromView();
        break;
      case 'clear':
        this.clearCallback();
        this.postStatus('success', 'Se han eliminado los diagnósticos de Problems.');
        this.setRefreshSummary({
          configuredFolders: 0,
          published: 0,
          newPublished: 0,
          skipped: 0,
          errors: [],
          issues: [],
          newIssues: [],
          hotspots: [],
          newHotspots: [],
          severity: [],
          newSeverity: [],
          evolution: [],
          qualityGate: { status: 'NONE', conditions: [] },
          ratings: {
            overall: {
              maintainability: 'NONE',
              reliability: 'NONE',
              security: 'NONE',
              securityReview: 'NONE'
            },
            newCode: {
              maintainability: 'NONE',
              reliability: 'NONE',
              security: 'NONE',
              securityReview: 'NONE'
            }
          },
          types: {
            bugs: 0,
            codeSmells: 0,
            vulnerabilities: 0,
            securityHotspots: 0
          },
          newTypes: {
            bugs: 0,
            codeSmells: 0,
            vulnerabilities: 0,
            securityHotspots: 0
          }
        });
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
    if (!this.view) {
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
          ? 'Se ha encontrado 1 proyecto visible.'
          : `Se han encontrado ${projects.length} proyectos visibles.`
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
      this.postStatus('error', 'Carga la lista y selecciona un proyecto.');
      return;
    }

    if (!token && !existingToken) {
      this.postStatus('error', 'Introduce un token de SonarQube.');
      return;
    }

    try {
      await saveFolderConfig(this.context, folder, {
        serverUrl,
        projectKey,
        branch: message.branch ?? '',
        baseDir: message.baseDir ?? '',
        token
      });

      this.postStatus('loading', 'Configuración guardada. Sincronizando issues…');
      await this.sendState();
      const summary = await this.refreshCallback();
      this.setRefreshSummary(summary);

      if (summary.errors.length > 0) {
        this.postStatus('error', summary.errors.join(' | '));
      } else {
        this.postStatus(
          'success',
          `${summary.published} issues encontrados.`
        );
      }
    } catch (error) {
      this.postStatus('error', this.errorMessage(error));
    }
  }

  private async refreshFromView(): Promise<void> {
    this.postStatus('loading', 'Actualizando issues…');
    const summary = await this.refreshCallback();
    this.setRefreshSummary(summary);

    if (summary.configuredFolders === 0) {
      this.postStatus('error', 'Guarda primero la conexión y el proyecto.');
    } else if (summary.errors.length > 0) {
      this.postStatus('error', summary.errors.join(' | '));
    } else {
      this.postStatus('success', `${summary.published} issues encontrados.`);
    }
  }

  private postStatus(kind: 'loading' | 'success' | 'error', message: string): void {
    this.postMessage({ type: 'status', kind, message });
  }

  private postMessage(message: unknown): void {
    void this.view?.webview.postMessage(message);
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
  <style nonce="${nonce}">
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 14px;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    h2 { margin: 0 0 4px; font-size: 15px; }
    .subtitle {
      margin: 0 0 16px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }
    .field { margin-bottom: 12px; }
    label {
      display: block;
      margin-bottom: 5px;
      font-size: 12px;
      font-weight: 600;
    }
    input, select {
      width: 100%;
      min-height: 30px;
      padding: 5px 7px;
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 2px;
      outline: none;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      font-family: inherit;
    }
    input:focus, select:focus {
      border-color: var(--vscode-focusBorder);
    }
    select:disabled, input:disabled { opacity: .65; }
    .hint {
      margin-top: 4px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      line-height: 1.35;
    }
    .actions {
      display: grid;
      gap: 8px;
      margin: 14px 0;
    }
    button {
      min-height: 30px;
      padding: 5px 10px;
      border: 1px solid transparent;
      border-radius: 2px;
      cursor: pointer;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      font-family: inherit;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }
    button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    button:disabled { cursor: default; opacity: .65; }
    .status {
      display: none;
      margin: 10px 0 14px;
      padding: 8px;
      border-left: 3px solid var(--vscode-descriptionForeground);
      background: var(--vscode-textBlockQuote-background);
      line-height: 1.4;
      overflow-wrap: anywhere;
    }
    .status.visible { display: block; }
    .status.success { border-left-color: var(--vscode-testing-iconPassed); }
    .status.error { border-left-color: var(--vscode-testing-iconFailed); }
    .status.loading { border-left-color: var(--vscode-progressBar-background); }
    .summary {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 14px;
    }
    .card {
      padding: 9px;
      border: 1px solid var(--vscode-widget-border);
      background: var(--vscode-editorWidget-background);
    }
    .card strong { display: block; font-size: 18px; }
    .card span { color: var(--vscode-descriptionForeground); font-size: 11px; }
    .divider {
      height: 1px;
      margin: 18px 0;
      background: var(--vscode-widget-border);
    }
    .empty {
      padding: 12px;
      border: 1px dashed var(--vscode-widget-border);
      color: var(--vscode-descriptionForeground);
      line-height: 1.45;
    }
  </style>
</head>
<body>
  <main id="app">
    <h2>Conexión SonarQube</h2>
    <p class="subtitle">Configura la carpeta actual y publica sus issues directamente en Problems.</p>

    <div id="emptyWorkspace" class="empty" hidden>
      Abre una carpeta o un workspace para configurar SonarQube Dashboard.
    </div>

    <section id="formSection">
      <div id="folderField" class="field">
        <label for="folder">Carpeta del workspace</label>
        <select id="folder"></select>
      </div>

      <div class="field">
        <label for="serverUrl">URL de SonarQube</label>
        <input id="serverUrl" type="url" placeholder="http://localhost:9000" spellcheck="false">
      </div>

      <div class="field">
        <label for="token">Token</label>
        <input id="token" type="password" autocomplete="off" placeholder="Introduce el token">
        <div id="tokenHint" class="hint">El token se guarda en SecretStorage y no en settings.json.</div>
      </div>

      <div class="actions">
        <button id="loadProjects" type="button">Conectar y cargar proyectos</button>
      </div>

      <div class="field">
        <label for="projectKey">Proyecto o aplicación</label>
        <select id="projectKey" disabled>
          <option value="">Conecta primero con SonarQube</option>
        </select>
        <div class="hint">Solo se muestran los componentes visibles para el token utilizado.</div>
      </div>

      <div class="field">
        <label for="branch">Rama (opcional)</label>
        <input id="branch" type="text" placeholder="main" spellcheck="false">
      </div>

      <div class="field">
        <label for="baseDir">Subcarpeta local (opcional)</label>
        <input id="baseDir" type="text" placeholder="packages/backend" spellcheck="false">
        <div class="hint">Úsala cuando la raíz analizada por SonarQube corresponde a una subcarpeta local.</div>
      </div>

      <div id="status" class="status" role="status" aria-live="polite"></div>

      <div class="actions">
        <button id="save" type="button">Sincronizar</button>
        <button id="refresh" class="secondary" type="button">Actualizar issues</button>
        <button id="clear" class="secondary" type="button">Limpiar Problems</button>
      </div>

      <div class="divider"></div>

      <h2>Última sincronización</h2>
      <div class="summary">
        <div class="card"><strong id="published">0</strong><span>Publicados</span></div>
        <div class="card"><strong id="skipped">0</strong><span>Omitidos</span></div>
      </div>
    </section>
  </main>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const elements = {
      emptyWorkspace: document.getElementById('emptyWorkspace'),
      formSection: document.getElementById('formSection'),
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
      clear: document.getElementById('clear'),
      status: document.getElementById('status'),
      published: document.getElementById('published'),
      skipped: document.getElementById('skipped')
    };

    let currentConfig = {
      projectKey: '',
      hasToken: false
    };

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
    }

    function setStatus(kind, message) {
      elements.status.className = 'status visible ' + kind;
      elements.status.textContent = message;
      setBusy(kind === 'loading');
    }

    function setProjectOptions(projects, selectedKey) {
      elements.projectKey.textContent = '';

      if (!projects.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No hay proyectos visibles';
        elements.projectKey.appendChild(option);
        elements.projectKey.disabled = true;
        return;
      }

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Selecciona un proyecto';
      elements.projectKey.appendChild(placeholder);

      for (const project of projects) {
        const option = document.createElement('option');
        option.value = project.key;
        const type = project.qualifier === 'APP' ? 'Aplicación' : 'Proyecto';
        option.textContent = project.name + ' — ' + project.key + ' · ' + type;
        elements.projectKey.appendChild(option);
      }

      elements.projectKey.disabled = false;
      elements.projectKey.value = selectedKey || '';
    }

    function renderState(message) {
      const folders = message.folders || [];
      const hasWorkspace = folders.length > 0;
      elements.emptyWorkspace.hidden = hasWorkspace;
      elements.formSection.hidden = !hasWorkspace;

      if (!hasWorkspace) {
        return;
      }

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
        ? 'Token guardado · escribe uno para sustituirlo'
        : 'Introduce el token';
      elements.tokenHint.textContent = message.config.hasToken
        ? 'Hay un token guardado de forma segura para esta carpeta.'
        : 'El token se guarda en SecretStorage y no en settings.json.';
      elements.branch.value = message.config.branch || '';
      elements.baseDir.value = message.config.baseDir || '';

      if (message.config.projectKey) {
        setProjectOptions([
          {
            key: message.config.projectKey,
            name: message.config.projectKey,
            qualifier: 'TRK'
          }
        ], message.config.projectKey);
      } else {
        elements.projectKey.innerHTML = '<option value="">Conecta primero con SonarQube</option>';
        elements.projectKey.disabled = true;
      }
    }

    elements.folder.addEventListener('change', () => {
      vscode.postMessage({
        type: 'selectFolder',
        folderUri: elements.folder.value
      });
    });

    elements.loadProjects.addEventListener('click', () => {
      setStatus('loading', 'Consultando proyectos visibles…');
      vscode.postMessage({ type: 'loadProjects', ...values() });
    });

    elements.save.addEventListener('click', () => {
      setStatus('loading', 'Guardando configuración…');
      vscode.postMessage({ type: 'save', ...values() });
    });

    elements.refresh.addEventListener('click', () => {
      setStatus('loading', 'Actualizando issues…');
      vscode.postMessage({ type: 'refresh' });
    });

    elements.clear.addEventListener('click', () => {
      vscode.postMessage({ type: 'clear' });
    });

    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'state':
          renderState(message);
          break;
        case 'projectsLoading':
          setStatus('loading', 'Consultando proyectos visibles…');
          break;
        case 'projectsLoaded':
          setProjectOptions(message.projects || [], currentConfig.projectKey);
          setBusy(false);
          break;
        case 'status':
          setStatus(message.kind, message.message);
          if (message.kind !== 'loading') {
            setBusy(false);
          }
          break;
        case 'summary':
          elements.published.textContent = String(message.summary.published || 0);
          elements.skipped.textContent = String(message.summary.skipped || 0);
          break;
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
