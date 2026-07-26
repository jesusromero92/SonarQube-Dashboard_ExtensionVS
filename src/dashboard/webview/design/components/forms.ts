export const FORM_COMPONENT_STYLES = `
    textarea {
      width: 100%;
      padding: 8px 9px;
      resize: vertical;
      border: 1px solid var(--vscode-input-border, transparent);
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      font: inherit;
    }
    textarea:focus-visible {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }
    .action-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 130px;
      gap: 10px;
      align-items: end;
      margin-top: 14px;
    }
    .action-form label {
      grid-column: 1 / -1;
    }
    .action-form--comment label {
      margin-bottom: -4px;
    }
    .action-form button {
      width: 100%;
      min-width: 0;
    }
    @media (max-width: 920px) {
      .action-form {
        grid-template-columns: 1fr;
      }
    }
`;
