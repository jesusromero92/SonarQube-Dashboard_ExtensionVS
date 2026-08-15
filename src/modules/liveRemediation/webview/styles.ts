export const LIVE_REMEDIATION_STYLES = `
    .live-remediation-analyzer-status {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      margin-top: 2px;
      padding: 10px 12px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      background: var(--vscode-textBlockQuote-background);
    }
    .live-remediation-analyzer-icon {
      display: inline-flex;
      flex: 0 0 20px;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border: 1px solid currentColor;
      border-radius: 50%;
      font-weight: 700;
      line-height: 1;
    }
    .live-remediation-analyzer-copy {
      display: grid;
      gap: 3px;
      min-width: 0;
    }
    .live-remediation-analyzer-status--active {
      border-color: var(--vscode-testing-iconPassed);
    }
    .live-remediation-analyzer-status--active .live-remediation-analyzer-icon {
      color: var(--vscode-testing-iconPassed);
    }
    .live-remediation-analyzer-status--inactive .live-remediation-analyzer-icon {
      color: var(--vscode-editorWarning-foreground);
    }
    .live-remediation-analyzer-status--missing .live-remediation-analyzer-icon {
      color: var(--vscode-descriptionForeground);
    }
`;
