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
    .diagnostics-card-icon {
      display: grid;
      width: 28px;
      height: 28px;
      place-items: center;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
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
    }
`;
