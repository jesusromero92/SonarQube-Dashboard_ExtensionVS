export const DIALOG_COMPONENT_STYLES = `
    html.modal-scroll-locked {
      overscroll-behavior: none;
    }
    body:has(dialog[open]) {
      overscroll-behavior: none;
    }
    dialog[open] {
      overscroll-behavior: contain;
    }

    .rule-dialog,
    .detail-dialog {
      max-height: calc(100vh - 48px);
      padding: 0;
      overflow: hidden;
      overscroll-behavior: contain;
      border: 1px solid var(--vscode-panel-border);
      color: var(--vscode-foreground);
      background: var(--vscode-editorWidget-background);
      box-shadow: 0 8px 28px var(--vscode-widget-shadow);
    }
    .rule-dialog {
      width: min(620px, calc(100vw - 48px));
    }
    .detail-dialog {
      width: min(980px, calc(100vw - 42px));
      max-height: calc(100vh - 42px);
    }
    .rule-dialog::backdrop,
    .detail-dialog::backdrop {
      background: rgba(0, 0, 0, .58);
    }
    .rule-dialog[open] {
      display: flex;
      flex-direction: column;
    }
    .detail-dialog[open] {
      display: flex;
    }

    .detail-dialog-shell {
      display: flex;
      width: 100%;
      max-height: calc(100vh - 42px);
      flex-direction: column;
    }
    .detail-dialog-header,
    .detail-dialog-footer,
    .rule-dialog-header,
    .dialog-actions {
      display: flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--vscode-editorGroupHeader-tabsBackground);
    }
    .detail-dialog-header,
    .rule-dialog-header {
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .detail-dialog-header h2,
    .rule-dialog-header h2 {
      margin: 0;
      font-size: 16px;
    }
    .detail-dialog-header .icon-button,
    .rule-dialog-close {
      margin-left: auto;
    }
    .rule-dialog-close {
      min-width: 32px;
      padding: 3px 8px;
      font-size: 18px;
      line-height: 1;
    }
    .detail-dialog-footer,
    .dialog-actions {
      justify-content: flex-end;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .detail-dialog-body,
    .dialog-scroll-body,
    .rule-dialog-body {
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .detail-dialog-body {
      min-height: 180px;
    }
    .dialog-scroll-body {
      flex: 1 1 auto;
    }
    .rule-dialog-body {
      padding: 18px 16px 20px;
      line-height: 1.55;
      white-space: pre-wrap;
    }
    .dialog-scroll-body .table-wrap {
      max-height: none;
      overflow: visible;
    }
    .dialog-loading {
      padding: 32px 18px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
    }

    .wide-dialog {
      width: min(820px, calc(100vw - 48px));
    }
    .detail-section,
    .dialog-section {
      padding: 15px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .detail-section:last-child,
    .dialog-section:last-child {
      border-bottom: 0;
    }
    .detail-section h3,
    .dialog-section h3 {
      margin: 0 0 10px;
      font-size: 13px;
    }
    .dialog-section p {
      margin: 0;
      color: var(--vscode-descriptionForeground);
      white-space: pre-wrap;
    }

    .detail-meta {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr) max-content minmax(0, 1fr);
      gap: 6px 12px;
      margin: 12px 0 0;
    }
    .detail-meta dt {
      color: var(--vscode-descriptionForeground);
    }
    .detail-meta dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .dialog-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      color: var(--vscode-descriptionForeground);
    }
    .dialog-badges {
      display: flex;
      gap: 7px;
      margin-top: 6px;
    }
    .status-chip {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      font-size: 11px;
    }
    .no-results {
      padding: 28px 14px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
    }

    @media (max-width: 920px) {
      .detail-meta {
        grid-template-columns: max-content minmax(0, 1fr);
      }
    }
`;
