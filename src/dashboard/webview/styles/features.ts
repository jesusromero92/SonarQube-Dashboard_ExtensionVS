export const FEATURE_STYLES = `
    .body-scroll-table .defects-table thead tr,
    .body-scroll-table .defects-table tbody tr {
      grid-template-columns: 92px 58px minmax(220px, 36%) minmax(0, 1fr) 54px;
    }
    .col-actions { width: 54px; text-align: center; }
    .issue-actions-cell { text-align: center; }
    .icon-button {
      min-width: 30px;
      min-height: 28px;
      padding: 2px 8px;
      color: var(--vscode-foreground);
      background: transparent;
    }
    .icon-button:hover { background: var(--vscode-toolbar-hoverBackground); }
    textarea {
      width: 100%;
      padding: 8px 9px;
      resize: vertical;
      border: 1px solid var(--vscode-input-border, transparent);
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      font: inherit;
    }
    .detail-dialog {
      width: min(980px, calc(100vw - 42px));
      max-height: calc(100vh - 42px);
      padding: 0;
      overflow: hidden;
      border: 1px solid var(--vscode-panel-border);
      color: var(--vscode-foreground);
      background: var(--vscode-editorWidget-background);
      box-shadow: 0 8px 28px var(--vscode-widget-shadow);
    }
    .detail-dialog::backdrop { background: rgba(0, 0, 0, .58); }
    .detail-dialog[open] { display: flex; }
    .detail-dialog-shell {
      display: flex;
      width: 100%;
      max-height: calc(100vh - 42px);
      flex-direction: column;
    }
    .detail-dialog-header,
    .detail-dialog-footer {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--vscode-editorGroupHeader-tabsBackground);
    }
    .detail-dialog-header { border-bottom: 1px solid var(--vscode-panel-border); }
    .detail-dialog-header h2 { margin: 0; font-size: 16px; }
    .detail-dialog-header .icon-button { margin-left: auto; font-size: 20px; }
    .detail-dialog-footer { justify-content: flex-end; border-top: 1px solid var(--vscode-panel-border); }
    .detail-dialog-body { min-height: 180px; overflow-y: auto; }
    .dialog-loading { padding: 32px 18px; color: var(--vscode-descriptionForeground); text-align: center; }
    .detail-section { padding: 15px 16px; border-bottom: 1px solid var(--vscode-panel-border); }
    .detail-section:last-child { border-bottom: 0; }
    .detail-section h3 { margin: 0 0 10px; font-size: 13px; }
    .detail-meta {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr) max-content minmax(0, 1fr);
      gap: 6px 12px;
      margin: 12px 0 0;
    }
    .detail-meta dt { color: var(--vscode-descriptionForeground); }
    .detail-meta dd { margin: 0; overflow-wrap: anywhere; }
    .dialog-badges { display: flex; gap: 7px; margin-top: 6px; }
    .status-chip {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      font-size: 11px;
    }
    .action-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .inline-form { display: grid; grid-template-columns: 150px minmax(220px, 1fr) auto; gap: 10px; align-items: end; margin-top: 14px; }
    .comment-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: end; margin-top: 14px; }
    .comment-form label { grid-column: 1 / -1; margin-bottom: -4px; }
    .section-heading-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
    .section-heading-row p { margin: 0 0 10px; }
    .dialog-nav-actions { display: flex; gap: 6px; }
    .flow-list { display: grid; gap: 7px; margin: 12px 0 0; padding: 0; list-style: none; }
    .flow-location {
      display: grid;
      width: 100%;
      grid-template-columns: 130px minmax(180px, 1fr);
      gap: 3px 12px;
      min-height: 0;
      padding: 9px 11px;
      border: 1px solid var(--vscode-panel-border);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      text-align: left;
    }
    .flow-location:hover,
    .flow-location.active { border-color: var(--vscode-focusBorder); background: var(--vscode-list-hoverBackground); }
    .flow-location small { grid-column: 2; color: var(--vscode-descriptionForeground); }
    .activity-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .activity-list { display: grid; gap: 8px; }
    .activity-item { padding: 10px; border: 1px solid var(--vscode-panel-border); background: var(--vscode-editor-background); }
    .activity-item time { display: block; margin-top: 2px; color: var(--vscode-descriptionForeground); font-size: 11px; }
    .activity-item p { margin: 7px 0 0; white-space: pre-wrap; }
    .coverage-summary .coverage-covered { border-top-color: ${'#22a447'}; }
    .coverage-summary .coverage-partial { border-top-color: ${'#eabf00'}; }
    .coverage-summary .coverage-uncovered { border-top-color: ${'#d4333f'}; }
    .coverage-summary .coverage-duplicated { border-top-color: ${'#8b5cf6'}; }
    .compact-metrics { margin-bottom: 0; }
    .compact-metrics .metric-summary { min-width: 120px; padding: 10px 12px; }
    .compact-metrics .metric-summary strong { font-size: 20px; }
    .coverage-legend-item { display: inline-flex; align-items: center; gap: 7px; }
    .coverage-legend-item i { width: 9px; height: 9px; border-radius: 50%; }
    .duplication-groups { display: grid; gap: 10px; }
    .duplication-group { padding: 10px; border: 1px solid var(--vscode-panel-border); }
    .duplication-group h4 { margin: 0 0 8px; }
    .duplication-location { margin: 0 7px 7px 0; }
    @media (max-width: 920px) {
      .activity-grid { grid-template-columns: 1fr; }
      .inline-form, .comment-form { grid-template-columns: 1fr; }
      .detail-meta { grid-template-columns: max-content minmax(0, 1fr); }
    }
`;
