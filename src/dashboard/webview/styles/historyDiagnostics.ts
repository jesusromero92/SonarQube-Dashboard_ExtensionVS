export const HISTORY_DIAGNOSTICS_STYLES = `
    .page-empty-state,
    .diagnostics-loading {
      padding: 34px 18px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
    }
    .diagnostics-content { display: grid; }
    .diagnostics-section {
      padding: 15px 16px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .diagnostics-section h3 { margin: 0 0 10px; font-size: 13px; }
    .diagnostics-grid {
      display: grid;
      grid-template-columns: minmax(150px, max-content) minmax(0, 1fr);
      gap: 7px 14px;
      margin: 0;
    }
    .diagnostics-grid dt { color: var(--vscode-descriptionForeground); }
    .diagnostics-grid dd { margin: 0; overflow-wrap: anywhere; }
    .diagnostics-columns {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }
    .diagnostics-tabs {
      display: inline-flex;
      gap: 8px;
      margin-bottom: 12px;
      padding: 4px;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-background);
    }
    .diagnostics-tab {
      min-height: 28px;
      padding: 4px 12px;
      border: 1px solid transparent;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      cursor: pointer;
    }
    .diagnostics-tab:hover {
      color: var(--vscode-foreground);
      background: var(--vscode-list-hoverBackground);
    }
    .diagnostics-tab--active {
      color: var(--vscode-foreground);
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-activeSelectionBackground);
    }
    .diagnostics-tab-panels { display: block; }
    .diagnostics-tab-panel[hidden] { display: none; }
    .diagnostics-list { display: grid; gap: 8px; }
    .diagnostics-list-item {
      display: grid;
      grid-template-columns: 30px minmax(0, 1fr);
      gap: 10px;
      align-items: start;
      padding: 10px 12px;
      overflow: hidden;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-background);
    }
    .diagnostics-list-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .diagnostics-list-item--status-healthy {
      border-left: 3px solid var(--vscode-testing-iconPassed, #2ea043);
    }
    .diagnostics-list-item--status-warning {
      border-left: 3px solid var(--vscode-testing-iconQueued, #d29922);
    }
    .diagnostics-list-item--status-error {
      border-left: 3px solid var(--vscode-errorForeground, #f85149);
    }
    .diagnostics-card-icon {
      display: grid;
      width: 28px;
      height: 28px;
      place-items: center;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
    }
    .diagnostics-card-icon--status-healthy {
      color: var(--vscode-testing-iconPassed, #2ea043);
      border-color: color-mix(in srgb, var(--vscode-testing-iconPassed, #2ea043) 55%, transparent);
      background: color-mix(in srgb, var(--vscode-testing-iconPassed, #2ea043) 12%, transparent);
    }
    .diagnostics-card-icon--status-warning {
      color: var(--vscode-testing-iconQueued, #d29922);
      border-color: color-mix(in srgb, var(--vscode-testing-iconQueued, #d29922) 55%, transparent);
      background: color-mix(in srgb, var(--vscode-testing-iconQueued, #d29922) 12%, transparent);
    }
    .diagnostics-card-icon--status-error {
      color: var(--vscode-errorForeground, #f85149);
      border-color: color-mix(in srgb, var(--vscode-errorForeground, #f85149) 55%, transparent);
      background: color-mix(in srgb, var(--vscode-errorForeground, #f85149) 12%, transparent);
    }
    .diagnostics-card-icon svg {
      width: 15px;
      height: 15px;
      fill: currentColor;
    }
    .diagnostics-card-body {
      display: grid;
      min-width: 0;
      gap: 6px;
    }
    .diagnostics-card-header {
      display: flex;
      min-width: 0;
      align-items: baseline;
      gap: 8px;
    }
    .diagnostics-card-header strong {
      min-width: 0;
      overflow-wrap: anywhere;
      font-weight: 600;
    }
    .diagnostics-card-badge {
      flex: 0 0 auto;
      padding-left: 8px;
      border-left: 1px solid var(--vscode-panel-border);
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      font-weight: 400;
      line-height: 1.4;
    }
    .diagnostics-card-command {
      display: block;
      padding: 5px 7px;
      overflow-wrap: anywhere;
      border: 0;
      color: var(--vscode-textPreformat-foreground);
      background: var(--vscode-textCodeBlock-background, var(--vscode-editorWidget-background));
      font-size: 12px;
    }
    .diagnostics-card-hint {
      color: var(--vscode-descriptionForeground);
      overflow-wrap: anywhere;
    }
    .diagnostics-list-empty {
      padding: 14px 12px;
      border: 1px solid var(--vscode-panel-border);
      color: var(--vscode-descriptionForeground);
      text-align: center;
    }
    .diagnostics-failure {
      display: grid;
      gap: 5px;
      padding: 10px 12px;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-background);
      overflow-wrap: anywhere;
    }
    .diagnostics-security-note { margin: 0; padding: 12px 16px 16px; }
    @media (max-width: 760px) {
      .diagnostics-columns { grid-template-columns: 1fr; }
      .diagnostics-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
    }
`;
