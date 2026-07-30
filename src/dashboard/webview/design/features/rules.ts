export const RULE_FEATURE_STYLES = `
    .rule-detail-meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 18px;
    }
    .rule-location-meta {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px 18px;
    }
    .rule-meta-item {
      display: grid;
      grid-template-columns: minmax(110px, max-content) minmax(0, 1fr);
      gap: 8px;
      align-items: start;
      min-height: 22px;
    }
    .rule-meta-item-full {
      grid-column: 1 / -1;
    }
    .rule-meta-label {
      color: var(--vscode-descriptionForeground);
    }
    .rule-meta-value {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .rule-meta-value .badge {
      min-width: 70px;
      vertical-align: middle;
    }
    .rule-type-value {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .rule-type-value .type-icon {
      width: 18px;
      height: 18px;
      flex: 0 0 18px;
    }
    .rule-rich-text {
      color: var(--vscode-foreground);
      line-height: 1.55;
      white-space: pre-wrap;
    }
    .rule-parameter-list {
      display: grid;
      gap: 8px;
    }
    .rule-parameter-item {
      padding: 10px 12px;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-background);
    }
    .rule-parameter-item p {
      margin: 6px 0 0;
      color: var(--vscode-descriptionForeground);
      white-space: pre-wrap;
    }
    .rule-parameter-meta {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 6px 12px;
      margin: 0;
    }
    .rule-parameter-meta {
      margin-top: 7px;
      font-size: 12px;
    }
    .rule-parameter-meta dt {
      color: var(--vscode-descriptionForeground);
    }
    .rule-parameter-meta dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    @media (max-width: 720px) {
      .rule-detail-meta {
        grid-template-columns: 1fr;
      }
    }
`;
