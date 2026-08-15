import * as vscode from 'vscode';
export { DASHBOARD_LAUNCHER_VIEW_ID as DASHBOARD_VIEW_ID } from './constants';
import { getDashboardLauncherHtml } from './dashboard/launcherWebview';
import { DashboardPanel } from './dashboardPanel';
import { localizeRuntimeText } from './i18n';
import { getWebviewLocalizationBundle } from './i18n/runtimeWebview';


export class DashboardLauncherViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly dashboardPanel: DashboardPanel
  ) {
    this.context.subscriptions.push(
      dashboardPanel.onDidChangeSummary(() => void this.postState()),
      dashboardPanel.onDidChangeLoading(() => void this.postState()),
      dashboardPanel.onDidChangePage(() => void this.postState()),
      dashboardPanel.onDidChangeLanguage(() => {
        this.postLanguage();
        void this.postState();
      })
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
    webviewView.webview.html = getDashboardLauncherHtml(
      webviewView.webview,
      this.context.extensionUri,
      this.dashboardPanel.getLanguage()
    );

    webviewView.webview.onDidReceiveMessage(message => {
      if (message?.type === 'ready') {
        void this.postState();
      } else if (message?.type === 'navigate') {
        const page = typeof message.page === 'string' && message.page.trim()
          ? message.page
          : 'data';
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
        void this.postState();
      }
    });

    queueMicrotask(() => void this.dashboardPanel.show());
  }

  private postLanguage(): void {
    this.view?.webview.postMessage({
      type: 'languageChanged',
      localization: getWebviewLocalizationBundle(
        this.dashboardPanel.getLanguage()
      )
    }).then(undefined, error => {
      console.error('[SonarQube Dashboard] launcher language update failed', error);
    });
  }

  private async postState(): Promise<void> {
    const summary = this.dashboardPanel.getRefreshSummary();
    const issueCount = summary.configuredFolders > 0
      ? Math.max(0, Math.trunc(summary.published))
      : 0;

    if (this.view) {
      this.view.badge = issueCount > 0
        ? {
            value: issueCount,
            tooltip: localizeRuntimeText(
              `${issueCount} ${issueCount === 1 ? 'issue encontrado' : 'issues encontrados'}`,
              this.dashboardPanel.getLanguage()
            )
          }
        : undefined;
    }

    await this.view?.webview.postMessage({
      type: 'state',
      loading: this.dashboardPanel.isLoading(),
      page: this.dashboardPanel.getCurrentPage(),
      summary
    });
  }

}
