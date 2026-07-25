import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import {
  DASHBOARD_COLORS,
  DASHBOARD_TYPE_ICON_FILES,
  DashboardPanel
} from './dashboardPanel';

export const DASHBOARD_VIEW_ID = 'sonarQubeDashboard.launcher';

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
    webviewView.webview.html = this.getHtml(webviewView.webview);

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

  private getHtml(webview: vscode.Webview): string {
    const nonce = randomBytes(16).toString('hex');
    const iconUri = (file: string) => webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'assets', file)
    );
    const bugIconUri = iconUri(DASHBOARD_TYPE_ICON_FILES.BUG);
    const codeSmellIconUri = iconUri(DASHBOARD_TYPE_ICON_FILES.CODE_SMELL);
    const vulnerabilityIconUri = iconUri(DASHBOARD_TYPE_ICON_FILES.VULNERABILITY);
    const hotspotIconUri = iconUri(DASHBOARD_TYPE_ICON_FILES.SECURITY_HOTSPOT);

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${webview.cspSource}; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"
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
      --gate-ok: ${DASHBOARD_COLORS.qualityGate.OK};
      --gate-warn: ${DASHBOARD_COLORS.qualityGate.WARN};
      --gate-error: ${DASHBOARD_COLORS.qualityGate.ERROR};
      --rating-a: ${DASHBOARD_COLORS.ratings.A.foreground};
      --rating-a-bg: ${DASHBOARD_COLORS.ratings.A.background};
      --rating-b: ${DASHBOARD_COLORS.ratings.B.foreground};
      --rating-b-bg: ${DASHBOARD_COLORS.ratings.B.background};
      --rating-c: ${DASHBOARD_COLORS.ratings.C.foreground};
      --rating-c-bg: ${DASHBOARD_COLORS.ratings.C.background};
      --rating-d: ${DASHBOARD_COLORS.ratings.D.foreground};
      --rating-d-bg: ${DASHBOARD_COLORS.ratings.D.background};
      --rating-e: ${DASHBOARD_COLORS.ratings.E.foreground};
      --rating-e-bg: ${DASHBOARD_COLORS.ratings.E.background};
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
    .toolbar { margin-bottom: 10px; }
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
      width: 26px;
      height: 26px;
      padding: 4px;
      place-items: center;
      color: var(--vscode-descriptionForeground);
      background: transparent;
    }
    .reload svg { width: 16px; height: 16px; }
    .reload.busy svg { animation: spin .8s linear infinite; }
    .summary {
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorWidget-background);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
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
    .defect-types {
      display: grid;
      gap: 8px;
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .defect-type {
      display: grid;
      grid-template-columns: 22px minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
    }
    .defect-type-icon {
      display: inline-block;
      width: 19px;
      height: 19px;
      background: var(--vscode-descriptionForeground);
    }
    .defect-type-icon.bug {
      background: ${DASHBOARD_COLORS.types.BUG};
      -webkit-mask: url('${bugIconUri}') center / contain no-repeat;
      mask: url('${bugIconUri}') center / contain no-repeat;
    }
    .defect-type-icon.code-smell {
      background: ${DASHBOARD_COLORS.types.CODE_SMELL};
      -webkit-mask: url('${codeSmellIconUri}') center / contain no-repeat;
      mask: url('${codeSmellIconUri}') center / contain no-repeat;
    }
    .defect-type-icon.vulnerability {
      background: ${DASHBOARD_COLORS.types.VULNERABILITY};
      -webkit-mask: url('${vulnerabilityIconUri}') center / contain no-repeat;
      mask: url('${vulnerabilityIconUri}') center / contain no-repeat;
    }
    .defect-type-icon.security-hotspot {
      background: ${DASHBOARD_COLORS.types.SECURITY_HOTSPOT};
      -webkit-mask: url('${hotspotIconUri}') center / contain no-repeat;
      mask: url('${hotspotIconUri}') center / contain no-repeat;
    }
    .defect-type strong { font-variant-numeric: tabular-nums; }
    .quality-section,
    .ratings {
      display: grid;
      gap: 8px;
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .section-title {
      margin-bottom: 2px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .quality-gate {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
    }
    .gate-status {
      min-width: 72px;
      padding: 3px 7px;
      border-radius: 10px;
      color: #fff;
      background: var(--vscode-disabledForeground);
      font-size: 10px;
      font-weight: 600;
      text-align: center;
      cursor: pointer;
    }
    .gate-status.ok { background: var(--gate-ok); }
    .gate-status.warn { color: #1f1f1f; background: var(--gate-warn); }
    .gate-status.error { background: var(--gate-error); }
    .ratings-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 48px 64px;
      align-items: center;
      gap: 7px 8px;
    }
    .ratings-heading {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      text-align: center;
      text-transform: uppercase;
    }
    .rating-label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rating {
      display: grid;
      width: 24px;
      height: 24px;
      margin: 0 auto;
      place-items: center;
      border-radius: 2px;
      border: 1px dashed var(--vscode-panel-border);
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-weight: 700;
    }
    .rating.a { color: var(--rating-a); background: var(--rating-a-bg); border-color: transparent; }
    .rating.b { color: var(--rating-b); background: var(--rating-b-bg); border-color: transparent; }
    .rating.c { color: var(--rating-c); background: var(--rating-c-bg); border-color: transparent; }
    .rating.d { color: var(--rating-d); background: var(--rating-d-bg); border-color: transparent; }
    .rating.e { color: var(--rating-e); background: var(--rating-e-bg); border-color: transparent; }
    .empty { padding: 24px 12px; color: var(--vscode-descriptionForeground); text-align: center; }
  </style>
</head>
<body>
  <div class="toolbar">
    <nav class="tabs" aria-label="Secciones">
      <button id="dataTab" class="tab active" type="button">Datos</button>
      <button id="configurationTab" class="tab" type="button">Configuración</button>
    </nav>
  </div>
  <section class="summary">
    <div class="header">
      <span>Resumen</span>
      <button id="reload" class="reload" type="button" title="Actualizar datos" aria-label="Actualizar datos">
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M13.7 2.3a.75.75 0 0 1 0 1.06l-1.05 1.05A6 6 0 1 1 8 2a.75.75 0 0 1 0 1.5 4.5 4.5 0 1 0 3.58 1.77l-1.05 1.05a.75.75 0 0 1-1.28-.53V2.75A.75.75 0 0 1 10 2h3.17a.75.75 0 0 1 .53.3Z"/>
        </svg>
      </button>
    </div>
    <div id="loading" class="loading-state">
      <div class="loading-inner">
        <div class="spinner" aria-hidden="true"></div>
        <span>Sincronizando datos…</span>
      </div>
    </div>
    <div id="content" class="content" hidden>
      <div class="total">
        <strong id="total">0</strong>
        <span class="label">Issues encontrados</span>
      </div>
      <div id="severityList" class="severity-list"></div>
      <div id="defectTypes" class="defect-types">
        <div class="section-title">Por tipo de defecto</div>
        <div class="defect-type">
          <span class="defect-type-icon bug" role="img" aria-label="Bug"></span>
          <span>Bugs</span>
          <strong id="bugsCount">0</strong>
        </div>
        <div class="defect-type">
          <span class="defect-type-icon code-smell" role="img" aria-label="Code Smell"></span>
          <span>Code Smells</span>
          <strong id="codeSmellsCount">0</strong>
        </div>
        <div class="defect-type">
          <span class="defect-type-icon vulnerability" role="img" aria-label="Vulnerability"></span>
          <span>Vulnerabilities</span>
          <strong id="vulnerabilitiesCount">0</strong>
        </div>
        <div class="defect-type">
          <span class="defect-type-icon security-hotspot" role="img" aria-label="Security Hotspot"></span>
          <span>Security Hotspots</span>
          <strong id="securityHotspotsCount">0</strong>
        </div>
      </div>
      <div id="qualitySection" class="quality-section">
        <div class="section-title">Quality Gate · último análisis</div>
        <div class="quality-gate">
          <span>Estado</span>
          <button id="qualityGate" class="gate-status" type="button">NO DISP.</button>
        </div>
      </div>
      <div id="ratings" class="ratings">
        <div class="section-title">Ratings</div>
        <div class="ratings-grid">
          <span></span>
          <span class="ratings-heading">Overall</span>
          <span class="ratings-heading">New Code</span>
          <span class="rating-label" title="Maintainability">Maintainability</span>
          <span id="overallMaintainability" class="rating">—</span>
          <span id="newCodeMaintainability" class="rating">—</span>
          <span class="rating-label" title="Reliability">Reliability</span>
          <span id="overallReliability" class="rating">—</span>
          <span id="newCodeReliability" class="rating">—</span>
          <span class="rating-label" title="Security">Security</span>
          <span id="overallSecurity" class="rating">—</span>
          <span id="newCodeSecurity" class="rating">—</span>
          <span class="rating-label" title="Security Review">Security Review</span>
          <span id="overallSecurityReview" class="rating">—</span>
          <span id="newCodeSecurityReview" class="rating">—</span>
        </div>
      </div>
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
    const defectTypes = document.getElementById('defectTypes');
    const typeCounts = {
      bugs: document.getElementById('bugsCount'),
      codeSmells: document.getElementById('codeSmellsCount'),
      vulnerabilities: document.getElementById('vulnerabilitiesCount'),
      securityHotspots: document.getElementById('securityHotspotsCount')
    };
    const qualitySection = document.getElementById('qualitySection');
    const qualityGate = document.getElementById('qualityGate');
    const ratings = document.getElementById('ratings');
    const ratingElements = {
      overall: {
        maintainability: document.getElementById('overallMaintainability'),
        reliability: document.getElementById('overallReliability'),
        security: document.getElementById('overallSecurity'),
        securityReview: document.getElementById('overallSecurityReview')
      },
      newCode: {
        maintainability: document.getElementById('newCodeMaintainability'),
        reliability: document.getElementById('newCodeReliability'),
        security: document.getElementById('newCodeSecurity'),
        securityReview: document.getElementById('newCodeSecurityReview')
      }
    };
    const empty = document.getElementById('empty');

    function renderGate(element, status) {
      const normalized = ['OK', 'WARN', 'ERROR'].includes(status) ? status : 'NONE';
      const labels = {
        OK: 'APROBADO',
        WARN: 'AVISO',
        ERROR: 'FALLIDO',
        NONE: 'NO DISP.'
      };
      element.className = 'gate-status ' + normalized.toLowerCase();
      element.textContent = labels[normalized];
      element.title = normalized === 'NONE'
        ? 'Quality Gate no disponible'
        : 'Estado de Quality Gate: ' + labels[normalized];
    }

    function renderRating(element, grade) {
      const normalized = ['A', 'B', 'C', 'D', 'E'].includes(grade) ? grade : 'NONE';
      element.className = 'rating ' + normalized.toLowerCase();
      element.textContent = normalized === 'NONE' ? '—' : normalized;
      element.title = normalized === 'NONE' ? 'Rating no disponible' : 'Rating ' + normalized;
    }

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
      const gate = summary.qualityGate || {};
      const ratingSummary = summary.ratings || {};
      const defectSummary = summary.types || {};
      total.textContent = String(summary.published || 0);
      severityList.textContent = '';
      const hasSummary = Boolean(summary.configuredFolders);
      qualitySection.hidden = !hasSummary;
      ratings.hidden = !hasSummary;
      defectTypes.hidden = !hasSummary;
      empty.hidden = Boolean((summary.published || 0) || severities.length || hasSummary);
      renderGate(qualityGate, gate.status);
      for (const [type, element] of Object.entries(typeCounts)) {
        element.textContent = String(defectSummary[type] || 0);
      }
      for (const scope of ['overall', 'newCode']) {
        const values = ratingSummary[scope] || {};
        for (const rating of ['maintainability', 'reliability', 'security', 'securityReview']) {
          renderRating(ratingElements[scope][rating], values[rating]);
        }
      }

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
    qualityGate.addEventListener('click', () => {
      vscode.postMessage({ type: 'qualityGate' });
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
