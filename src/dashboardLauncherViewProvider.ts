import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import {
  DASHBOARD_COLORS,
  DashboardPanel
} from './dashboardPanel';

export const DASHBOARD_VIEW_ID = 'sonarQubeDashboard.launcher';

export class DashboardLauncherViewProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;

  constructor(
    context: vscode.ExtensionContext,
    private readonly dashboardPanel: DashboardPanel
  ) {
    context.subscriptions.push(
      dashboardPanel.onDidChangeSummary(() => this.postState()),
      dashboardPanel.onDidChangeLoading(() => this.postState()),
      dashboardPanel.onDidChangePage(() => this.postState())
    );
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(message => {
      if (message?.type === 'ready') {
        this.postState();
      } else if (message?.type === 'navigate') {
        const page = message.page === 'configuration' ? 'configuration' : 'data';
        void this.dashboardPanel.showPage(page);
      } else if (message?.type === 'refresh') {
        void this.dashboardPanel.refresh();
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
    :root {
      color-scheme: light dark;
      --blocker: ${DASHBOARD_COLORS.severities.BLOCKER};
      --critical: ${DASHBOARD_COLORS.severities.CRITICAL};
      --high: ${DASHBOARD_COLORS.severities.HIGH};
      --major: ${DASHBOARD_COLORS.severities.MAJOR};
      --medium: ${DASHBOARD_COLORS.severities.MEDIUM};
      --minor: ${DASHBOARD_COLORS.severities.MINOR};
      --low: ${DASHBOARD_COLORS.severities.LOW};
      --info: ${DASHBOARD_COLORS.severities.INFO};
    }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    body {
      margin: 0;
      padding: 12px;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    button {
      border: 1px solid transparent;
      border-radius: 2px;
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
      cursor: pointer;
      font: inherit;
    }
    button:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button:disabled { cursor: default; opacity: .55; }
    .toolbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 32px;
      gap: 8px;
      margin-bottom: 10px;
    }
    .tabs {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      padding: 2px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      background: var(--vscode-editor-background);
    }
    .tab {
      min-height: 29px;
      padding: 4px 6px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
    }
    .tab.active {
      color: var(--vscode-foreground);
      background: var(--vscode-list-activeSelectionBackground);
    }
    .reload {
      display: grid;
      width: 32px;
      height: 35px;
      padding: 6px;
      place-items: center;
    }
    .reload svg { width: 16px; height: 16px; }
    .reload.busy svg { animation: spin .8s linear infinite; }
    .summary {
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorWidget-background);
    }
    .header {
      padding: 11px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      font-weight: 600;
    }
    .loading-state {
      display: grid;
      min-height: 160px;
      place-items: center;
      color: var(--vscode-descriptionForeground);
    }
    .loading-inner { text-align: center; }
    .spinner {
      width: 28px;
      height: 28px;
      margin: 0 auto 10px;
      border: 3px solid var(--vscode-panel-border);
      border-top-color: var(--vscode-progressBar-background);
      border-radius: 50%;
      animation: spin .8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .content { padding: 12px; }
    .total {
      padding-bottom: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .total strong { display: block; font-size: 28px; font-weight: 400; }
    .label { color: var(--vscode-descriptionForeground); font-size: 11px; }
    .severity-list { display: grid; gap: 7px; margin-top: 12px; }
    .severity {
      display: grid;
      grid-template-columns: 5px 1fr auto;
      align-items: center;
      gap: 8px;
    }
    .severity-bar { width: 5px; height: 22px; border-radius: 3px; background: var(--info); }
    .severity.blocker .severity-bar { background: var(--blocker); }
    .severity.critical .severity-bar { background: var(--critical); }
    .severity.high .severity-bar { background: var(--high); }
    .severity.major .severity-bar { background: var(--major); }
    .severity.medium .severity-bar { background: var(--medium); }
    .severity.minor .severity-bar { background: var(--minor); }
    .severity.low .severity-bar { background: var(--low); }
    .severity.info .severity-bar { background: var(--info); }
    .severity strong { font-variant-numeric: tabular-nums; }
    .empty { padding: 24px 12px; color: var(--vscode-descriptionForeground); text-align: center; }
  </style>
</head>
<body>
  <div class="toolbar">
    <nav class="tabs" aria-label="Secciones">
      <button id="dataTab" class="tab active" type="button">Datos</button>
      <button id="configurationTab" class="tab" type="button">Configuración</button>
    </nav>
    <button id="reload" class="reload" type="button" title="Actualizar datos" aria-label="Actualizar datos">
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M13.7 2.3a.75.75 0 0 1 0 1.06l-1.05 1.05A6 6 0 1 1 8 2a.75.75 0 0 1 0 1.5 4.5 4.5 0 1 0 3.58 1.77l-1.05 1.05a.75.75 0 0 1-1.28-.53V2.75A.75.75 0 0 1 10 2h3.17a.75.75 0 0 1 .53.3Z"/>
      </svg>
    </button>
  </div>
  <section class="summary">
    <div class="header">Resumen</div>
    <div id="loading" class="loading-state">
      <div class="loading-inner">
        <div class="spinner" aria-hidden="true"></div>
        <span>Sincronizando datos…</span>
      </div>
    </div>
    <div id="content" class="content" hidden>
      <div class="total">
        <strong id="total">0</strong>
        <span class="label">Issues publicados</span>
      </div>
      <div id="severityList" class="severity-list"></div>
      <div id="empty" class="empty" hidden>No hay datos sincronizados.</div>
    </div>
  </section>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const dataTab = document.getElementById('dataTab');
    const configurationTab = document.getElementById('configurationTab');
    const reload = document.getElementById('reload');
    const loading = document.getElementById('loading');
    const content = document.getElementById('content');
    const total = document.getElementById('total');
    const severityList = document.getElementById('severityList');
    const empty = document.getElementById('empty');

    function render(state) {
      const page = state.page === 'configuration' ? 'configuration' : 'data';
      dataTab.classList.toggle('active', page === 'data');
      configurationTab.classList.toggle('active', page === 'configuration');
      reload.disabled = state.loading;
      reload.classList.toggle('busy', state.loading);
      loading.hidden = !state.loading;
      content.hidden = state.loading;
      if (state.loading) return;

      const summary = state.summary || {};
      const severities = summary.severity || [];
      total.textContent = String(summary.published || 0);
      severityList.textContent = '';
      empty.hidden = Boolean((summary.published || 0) || severities.length);

      for (const item of severities) {
        const row = document.createElement('div');
        row.className = 'severity ' + String(item.name || 'info').toLowerCase();
        const bar = document.createElement('span');
        bar.className = 'severity-bar';
        const name = document.createElement('span');
        name.textContent = item.name || 'UNKNOWN';
        const count = document.createElement('strong');
        count.textContent = String(item.count || 0);
        row.append(bar, name, count);
        severityList.appendChild(row);
      }
    }

    dataTab.addEventListener('click', () => {
      vscode.postMessage({ type: 'navigate', page: 'data' });
    });
    configurationTab.addEventListener('click', () => {
      vscode.postMessage({ type: 'navigate', page: 'configuration' });
    });
    reload.addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });

    window.addEventListener('message', event => {
      if (event.data?.type === 'state') render(event.data);
    });
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
