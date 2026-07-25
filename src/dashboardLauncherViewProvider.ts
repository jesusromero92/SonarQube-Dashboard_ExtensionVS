import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { DashboardPanel } from './dashboardPanel';

export const DASHBOARD_VIEW_ID = 'issueDashboard.launcher';

export class DashboardLauncherViewProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly dashboardPanel: DashboardPanel
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(
      message => {
        if (message?.type === 'open') {
          void this.dashboardPanel.show();
        }
      },
      undefined,
      this.context.subscriptions
    );

    webviewView.onDidChangeVisibility(
      () => {
        if (webviewView.visible) {
          void this.dashboardPanel.show();
        }
      },
      undefined,
      this.context.subscriptions
    );

    // Primera pulsación sobre el icono de la Activity Bar.
    queueMicrotask(() => void this.dashboardPanel.show());
  }

  private getHtml(): string {
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
    body {
      margin: 0;
      padding: 16px;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    .launcher {
      padding: 14px;
      border: 1px solid var(--vscode-widget-border);
      background: var(--vscode-editorWidget-background);
    }
    h2 { margin: 0 0 7px; font-size: 14px; }
    p { margin: 0 0 13px; color: var(--vscode-descriptionForeground); line-height: 1.45; }
    button {
      width: 100%;
      min-height: 31px;
      border: 1px solid transparent;
      border-radius: 2px;
      cursor: pointer;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      font: inherit;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
  </style>
</head>
<body>
  <div class="launcher">
    <h2>Issue Dashboard</h2>
    <p>El dashboard se abre como una pestaña dentro de esta misma ventana de VS Code.</p>
    <button id="open" type="button">Abrir dashboard</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('open').addEventListener('click', () => {
      vscode.postMessage({ type: 'open' });
    });
  </script>
</body>
</html>`;
  }
}
