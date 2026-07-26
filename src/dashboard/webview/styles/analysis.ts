export const ANALYSIS_STYLES = `    .analysis-panel {
      display: flex;
      align-items: center;
      gap: 18px;
      margin-bottom: 16px;
      padding: 14px 16px;
      border: 1px solid var(--vscode-panel-border);
      border-left: 3px solid var(--vscode-progressBar-background);
      background: var(--vscode-editorWidget-background);
    }
    .analysis-summary { display: flex; min-width: 0; align-items: center; gap: 12px; }
    .analysis-summary p { margin: 3px 0; color: var(--vscode-descriptionForeground); }
    .analysis-icon {
      display: grid;
      width: 34px;
      height: 34px;
      flex: 0 0 auto;
      place-items: center;
      border-radius: 50%;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .analysis-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-left: auto; }
    .analysis-dialog-status {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .analysis-status-indicator {
      width: 14px;
      height: 14px;
      flex: 0 0 auto;
      border: 2px solid var(--vscode-descriptionForeground);
      border-radius: 50%;
    }
    .analysis-status-indicator.detecting,
    .analysis-status-indicator.installing,
    .analysis-status-indicator.building,
    .analysis-status-indicator.scanning,
    .analysis-status-indicator.processing,
    .analysis-status-indicator.refreshing {
      border-color: var(--vscode-progressBar-background);
      border-top-color: transparent;
      animation: dashboard-spin .8s linear infinite;
    }
    .analysis-status-indicator.success { border-color: var(--dashboard-quality-gate-ok); background: var(--dashboard-quality-gate-ok); }
    .analysis-status-indicator.error { border-color: var(--dashboard-quality-gate-error); background: var(--dashboard-quality-gate-error); }
    .analysis-status-indicator.cancelled { border-color: var(--vscode-descriptionForeground); background: var(--vscode-descriptionForeground); }
    .analysis-log-wrap { min-height: 260px; max-height: 55vh; padding: 12px; overflow: hidden; }
    .analysis-log {
      height: 100%;
      min-height: 240px;
      max-height: 50vh;
      margin: 0;
      padding: 12px;
      overflow: auto;
      border: 1px solid var(--vscode-panel-border);
      color: var(--vscode-terminal-foreground, var(--vscode-foreground));
      background: var(--vscode-terminal-background, var(--vscode-editor-background));
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }
    @media (max-width: 760px) {
      .analysis-panel { align-items: flex-start; flex-direction: column; }
      .analysis-actions { width: 100%; margin-left: 0; }
      .analysis-actions button { flex: 1; }
    }
`;
