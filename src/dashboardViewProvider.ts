import * as vscode from 'vscode';
import { DASHBOARD_CONFIGURATION_VIEW_ID } from './constants';
import { getDashboardConfigurationHtml } from './dashboard/configurationWebview';
import {
  getFolderFormConfig,
  saveFolderConfig,
  tokenKey
} from './configuration';
import { fetchVisibleProjects } from './sonarClient';
import { RefreshSummary } from './types';

export const DASHBOARD_VIEW_ID = DASHBOARD_CONFIGURATION_VIEW_ID;

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
    webviewView.webview.html = getDashboardConfigurationHtml(webviewView.webview);

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

}
