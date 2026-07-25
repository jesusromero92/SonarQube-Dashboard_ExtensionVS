import * as vscode from 'vscode';
import { DASHBOARD_LAUNCHER_VIEW_ID } from './constants';
import { getDashboardLauncherHtml } from './dashboard/launcherWebview';
import { DashboardPanel } from './dashboardPanel';

export const DASHBOARD_VIEW_ID = DASHBOARD_LAUNCHER_VIEW_ID;

export class DashboardLauncherViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly dashboardPanel: DashboardPanel
  ) {
    this.context.subscriptions.push(
      dashboardPanel.onDidChangeSummary(() => this.postState()),
      dashboardPanel.onDidChangeLoading(() => this.postState()),
      dashboardPanel.onDidChangePage(() => this.postState())
    );
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'assets')
      ]
    };
    webviewView.webview.html = getDashboardLauncherHtml(webviewView.webview, this.context.extensionUri);

    webviewView.webview.onDidReceiveMessage(message => {
      if (message?.type === 'ready') {
        this.postState();
      } else if (message?.type === 'navigate') {
        const page = message.page === 'configuration' ? 'configuration' : 'data';
        void this.dashboardPanel.showPage(page);
      } else if (message?.type === 'refresh') {
        void this.dashboardPanel.refresh();
      } else if (message?.type === 'qualityGate') {
        void this.dashboardPanel.showQualityGate();
      }
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        void this.dashboardPanel.show();
        this.postState();
      }
    });

    queueMicrotask(() => void this.dashboardPanel.show());
  }

  private postState(): void {
    void this.view?.webview.postMessage({
      type: 'state',
      loading: this.dashboardPanel.isLoading(),
      page: this.dashboardPanel.getCurrentPage(),
      summary: this.dashboardPanel.getRefreshSummary()
    });
  }

}
