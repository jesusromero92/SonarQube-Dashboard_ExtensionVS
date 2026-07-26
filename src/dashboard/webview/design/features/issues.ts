export const ISSUE_FEATURE_STYLES = `
    .body-scroll-table .defects-table thead tr,
    .body-scroll-table .defects-table tbody tr {
      grid-template-columns: 92px 58px minmax(210px, 32%) 112px minmax(0, 1fr) 54px;
    }
    .col-actions {
      width: 54px;
      text-align: center;
    }
    .issue-actions-cell {
      text-align: center;
    }
    .issue-status-cell {
      display: flex;
      align-items: flex-start;
    }
    .issue-status {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .issue-status.accepted {
      border-color: var(--vscode-testing-iconPassed);
      color: var(--vscode-testing-iconPassed);
    }
    .issue-status.false-positive {
      border-color: var(--vscode-descriptionForeground);
      color: var(--vscode-descriptionForeground);
    }

    .action-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .section-heading-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
    }
    .section-heading-row p {
      margin: 0 0 10px;
    }
    .dialog-nav-actions {
      display: flex;
      gap: 6px;
    }

    .flow-list {
      display: grid;
      gap: 7px;
      margin: 12px 0 0;
      padding: 0;
      list-style: none;
    }
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
    .flow-location.active {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-hoverBackground);
    }
    .flow-location small {
      grid-column: 2;
      color: var(--vscode-descriptionForeground);
    }

    .activity-list {
      display: grid;
      gap: 8px;
    }
    .activity-item {
      padding: 10px;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-background);
    }
    .activity-item time {
      display: block;
      margin-top: 2px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    .activity-item p {
      margin: 7px 0 0;
      white-space: pre-wrap;
    }
`;
