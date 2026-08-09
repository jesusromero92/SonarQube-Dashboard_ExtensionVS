export const DISCLOSURE_STYLES = `
    .configuration-panel-body {
      padding: 0;
    }
    .configuration-tabs {
      display: flex;
      gap: 2px;
      padding: 0;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorGroupHeader-tabsBackground);
    }
    .configuration-tabs button {
      min-height: 40px;
      padding: 8px 14px;
      border: 0;
      border-bottom: 2px solid transparent;
      border-radius: 0;
      color: var(--vscode-descriptionForeground);
      background: transparent;
    }
    .configuration-tabs button:hover {
      color: var(--vscode-foreground);
      background: var(--vscode-list-hoverBackground);
    }
    .configuration-tabs button.active {
      color: var(--vscode-foreground);
      border-bottom-color: var(--vscode-focusBorder);
      background: var(--vscode-editorWidget-background);
    }
    .configuration-tabs button:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -2px;
    }
    .configuration-tab-panel {
      padding: 16px;
    }
    .configuration-tab-panel[hidden] {
      display: none;
    }
    .configuration-disclosure {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .configuration-tab-panel > .configuration-disclosure:first-child {
      margin-top: 0;
      padding-top: 0;
      border-top: 0;
    }
    .configuration-disclosure > summary {
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      user-select: none;
    }
    .configuration-disclosure > summary:hover {
      color: var(--vscode-foreground);
    }
    .configuration-disclosure-content {
      padding-top: 14px;
    }
    .analysis-scope-note {
      margin-top: 10px;
    }
    .analysis-scope-save-row .pipeline-save-status {
      margin-right: 0;
    }

    @media (max-width: 620px) {
      .configuration-tabs {
        padding: 0;
        overflow-x: auto;
      }
      .configuration-tabs button {
        flex: 1 0 auto;
      }
      .configuration-tab-panel {
        padding: 14px 12px;
      }
    }
`;
