
export const MODAL_STYLES = `    .rule-dialog {
      width: min(620px, calc(100vw - 48px));
      max-height: calc(100vh - 48px);
      padding: 0;
      overflow: hidden;
      border: 1px solid var(--vscode-panel-border);
      color: var(--vscode-foreground);
      background: var(--vscode-editorWidget-background);
      box-shadow: 0 8px 28px var(--vscode-widget-shadow);
    }
    .rule-dialog[open] {
      display: flex;
      flex-direction: column;
    }
    .rule-dialog::backdrop { background: rgba(0, 0, 0, .55); }
    .rule-dialog-header {
      display: flex;
      flex: 0 0 auto;
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
      overflow-y: auto;
      line-height: 1.55;
      white-space: pre-wrap;
    }
    .dialog-scroll-body {
      min-height: 0;
      flex: 1 1 auto;
      overflow-x: hidden;
      overflow-y: auto;
    }
    .dialog-scroll-body .table-wrap {
      max-height: none;
      overflow: visible;
    }
    .wide-dialog { width: min(820px, calc(100vw - 48px)); }
    .dialog-section {
      padding: 14px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .dialog-section:last-child { border-bottom: 0; }
    .dialog-section h3 { margin: 0 0 9px; font-size: 13px; }
    .dialog-section p { margin: 0; color: var(--vscode-descriptionForeground); white-space: pre-wrap; }
    .dialog-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      color: var(--vscode-descriptionForeground);
    }
    .gate-condition-table { table-layout: fixed; }
    .gate-condition-table th { position: static; }
    .gate-condition-table .condition-metric { width: 34%; }
    .gate-condition-table .condition-scope { width: 100px; }
    .gate-condition-table .condition-status { width: 86px; }
    .condition-state {
      display: inline-flex;
      min-width: 58px;
      justify-content: center;
      padding: 2px 6px;
      border-radius: 10px;
      color: #fff;
      background: var(--vscode-disabledForeground);
      font-size: 10px;
      font-weight: 600;
    }
    .condition-state.ok { background: var(--dashboard-quality-gate-ok); }
    .condition-state.warn { color: #111827; background: var(--dashboard-quality-gate-warn); }
    .condition-state.error { background: var(--dashboard-quality-gate-error); }
    .ratings-comparison {
      display: grid;
      grid-template-columns: minmax(130px, 1fr) 80px 90px;
      gap: 7px 10px;
      align-items: center;
    }
    .ratings-comparison strong { text-align: center; }
    .rating-badge {
      display: grid;
      width: 24px;
      height: 24px;
      margin: 0 auto;
      place-items: center;
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 2px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-weight: 700;
    }
    .rating-badge.a {
      color: var(--dashboard-rating-a);
      background: var(--dashboard-rating-a-bg);
      border-color: transparent;
    }
    .rating-badge.b {
      color: var(--dashboard-rating-b);
      background: var(--dashboard-rating-b-bg);
      border-color: transparent;
    }
    .rating-badge.c {
      color: var(--dashboard-rating-c);
      background: var(--dashboard-rating-c-bg);
      border-color: transparent;
    }
    .rating-badge.d {
      color: var(--dashboard-rating-d);
      background: var(--dashboard-rating-d-bg);
      border-color: transparent;
    }
    .rating-badge.e {
      color: var(--dashboard-rating-e);
      background: var(--dashboard-rating-e-bg);
      border-color: transparent;
    }
    .dialog-actions {
      display: flex;
      flex: 0 0 auto;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .col-severity { width: 92px; }
    .col-type { width: 58px; text-align: center; }
    .col-file { width: 42%; }
    .col-rule { width: auto; }
    .no-results { padding: 28px 14px; color: var(--vscode-descriptionForeground); text-align: center; }
`;
