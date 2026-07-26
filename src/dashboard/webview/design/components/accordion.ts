export const ACCORDION_STYLES = `
    .accordion-group {
      display: grid;
      gap: 8px;
    }
    .accordion {
      margin: 0;
      padding: 0;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-background);
    }
    .accordion > summary {
      padding: 10px 12px;
      color: var(--vscode-foreground);
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      user-select: none;
    }
    .accordion > summary:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .accordion > summary .muted {
      margin-left: 6px;
      font-weight: 400;
    }
    .accordion__content {
      padding: 10px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .accordion__content--activity {
      display: grid;
      gap: 0;
    }
`;
