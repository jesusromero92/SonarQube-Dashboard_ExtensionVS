import { DASHBOARD_COLORS } from '../../../constants';
import { DashboardWebviewAssets } from '../assets';

export function getBaseStyles({ bugIconUri, codeSmellIconUri, vulnerabilityIconUri }: DashboardWebviewAssets): string {
  return `
    :root {
      color-scheme: light dark;
      --dashboard-type-bug: ${DASHBOARD_COLORS.types.BUG};
      --dashboard-type-code-smell: ${DASHBOARD_COLORS.types.CODE_SMELL};
      --dashboard-type-vulnerability: ${DASHBOARD_COLORS.types.VULNERABILITY};
      --dashboard-type-security-hotspot: ${DASHBOARD_COLORS.types.SECURITY_HOTSPOT};
      --dashboard-severity-blocker: ${DASHBOARD_COLORS.severities.BLOCKER};
      --dashboard-severity-critical: ${DASHBOARD_COLORS.severities.CRITICAL};
      --dashboard-severity-high: ${DASHBOARD_COLORS.severities.HIGH};
      --dashboard-severity-major: ${DASHBOARD_COLORS.severities.MAJOR};
      --dashboard-severity-medium: ${DASHBOARD_COLORS.severities.MEDIUM};
      --dashboard-severity-minor: ${DASHBOARD_COLORS.severities.MINOR};
      --dashboard-severity-low: ${DASHBOARD_COLORS.severities.LOW};
      --dashboard-severity-info: ${DASHBOARD_COLORS.severities.INFO};
      --dashboard-quality-gate-ok: ${DASHBOARD_COLORS.qualityGate.OK};
      --dashboard-quality-gate-warn: ${DASHBOARD_COLORS.qualityGate.WARN};
      --dashboard-quality-gate-error: ${DASHBOARD_COLORS.qualityGate.ERROR};
      --dashboard-rating-a: ${DASHBOARD_COLORS.ratings.A.foreground};
      --dashboard-rating-a-bg: ${DASHBOARD_COLORS.ratings.A.background};
      --dashboard-rating-b: ${DASHBOARD_COLORS.ratings.B.foreground};
      --dashboard-rating-b-bg: ${DASHBOARD_COLORS.ratings.B.background};
      --dashboard-rating-c: ${DASHBOARD_COLORS.ratings.C.foreground};
      --dashboard-rating-c-bg: ${DASHBOARD_COLORS.ratings.C.background};
      --dashboard-rating-d: ${DASHBOARD_COLORS.ratings.D.foreground};
      --dashboard-rating-d-bg: ${DASHBOARD_COLORS.ratings.D.background};
      --dashboard-rating-e: ${DASHBOARD_COLORS.ratings.E.foreground};
      --dashboard-rating-e-bg: ${DASHBOARD_COLORS.ratings.E.background};
    }
    html {
      overflow-y: auto;
      scrollbar-gutter: stable;
    }
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
    .language-row { justify-content: start; }
    .language-row .configuration-select {
      width: 220px;
      max-width: 100%;
    }
    .connection-row { grid-template-columns: minmax(210px, 1fr) minmax(210px, 1fr) auto; align-items: start; }
    .connection-status {
      margin-top: 14px;
      padding: 8px 10px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      color: var(--vscode-foreground);
      background: var(--vscode-textBlockQuote-background);
      font-size: 12px;
      line-height: 1.4;
    }
    .connection-status--error {
      border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-errorForeground));
      color: var(--vscode-errorForeground);
      background: var(--vscode-inputValidation-errorBackground, var(--vscode-textBlockQuote-background));
    }
    .connection-status--success {
      border-color: var(--vscode-testing-iconPassed);
      color: var(--vscode-testing-iconPassed);
    }
    .connection-status--loading {
      color: var(--vscode-descriptionForeground);
    }
    .compatibility-summary {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px 16px;
      min-height: 38px;
      margin-top: 14px;
      padding: 8px 10px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      background: var(--vscode-textBlockQuote-background);
      font-size: 12px;
    }
    .compatibility-summary[hidden] { display: none; }
    .compatibility-title { font-weight: 600; }
    .compatibility-item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }
    .compatibility-item code {
      padding: 1px 5px;
      border-radius: 3px;
      color: var(--vscode-textPreformat-foreground);
      background: var(--vscode-textCodeBlock-background);
    }
    .compatibility-badge {
      padding: 2px 7px;
      border: 1px solid var(--vscode-editorWarning-foreground);
      border-radius: 10px;
      color: var(--vscode-editorWarning-foreground);
      font-size: 11px;
      font-weight: 600;
    }
    .fallback-badge {
      border-color: var(--vscode-testing-iconPassed);
      color: var(--vscode-testing-iconPassed);
    }
    #sonarCompatibilityHint { margin-left: auto; }
    .project-row { grid-template-columns: minmax(320px, 1fr) auto; align-items: start; margin-top: 14px; }
    .action-field button { width: 100%; white-space: nowrap; }
    .workspace-row { margin-bottom: 14px; }
    .advanced-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 12px; }
    .full-width-field { grid-column: 1 / -1; }
    .pipeline-save-row {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 12px;
    }
    .pipeline-save-status {
      margin-right: auto;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .pipeline-save-status--success {
      color: var(--vscode-testing-iconPassed);
    }
    .pipeline-save-status--error {
      color: var(--vscode-errorForeground);
    }
    .checkbox-field label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      cursor: pointer;
      color: var(--vscode-foreground);
    }
    .checkbox-field input[type="checkbox"] {
      width: 16px;
      height: 16px;
      min-height: 0;
      flex: 0 0 16px;
      margin: 0;
      padding: 0;
      accent-color: var(--vscode-checkbox-background, var(--vscode-button-background));
      cursor: pointer;
    }
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
    .dashboard-loading {
      display: grid;
      min-height: 360px;
      place-items: center;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorWidget-background);
      color: var(--vscode-descriptionForeground);
      text-align: center;
    }
    .dashboard-spinner {
      width: 38px;
      height: 38px;
      margin: 0 auto 12px;
      border: 4px solid var(--vscode-panel-border);
      border-top-color: var(--vscode-progressBar-background);
      border-radius: 50%;
      animation: dashboard-spin .8s linear infinite;
    }
    @keyframes dashboard-spin { to { transform: rotate(360deg); } }
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
    .sync-unavailable-icon {
      color: var(--vscode-errorForeground);
      background: var(--vscode-inputValidation-errorBackground, var(--vscode-badge-background));
    }
    .sync-error-detail {
      max-width: 760px;
      margin: -8px auto 18px;
      color: var(--vscode-errorForeground);
      font-size: 12px;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .sync-stale-warning {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 14px;
      padding: 10px 12px;
      border: 1px solid var(--vscode-inputValidation-warningBorder, var(--vscode-editorWarning-foreground));
      border-radius: 3px;
      background: var(--vscode-inputValidation-warningBackground, var(--vscode-textBlockQuote-background));
      color: var(--vscode-foreground);
    }
    .sync-stale-warning strong,
    .sync-stale-warning span { margin-right: 5px; }
    .sync-stale-warning .sync-error-detail {
      margin: 5px 0 0;
      color: var(--vscode-descriptionForeground);
    }
`;
}
