export const ANALYSIS_STYLES = `
    .configuration-section-intro {
      display: grid;
      gap: 5px;
      margin-bottom: 18px;
    }
    .configuration-section-intro p { margin: 0; }
    .create-component-dialog {
      width: min(680px, calc(100vw - 40px));
    }
    .rule-dialog-body.create-component-form {
      display: block;
      padding: 14px 16px 16px;
      line-height: 1.4;
      white-space: normal;
    }
    .create-component-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px 16px;
      align-content: start;
      align-items: start;
    }
    .create-component-grid .field {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 6px;
    }
    .create-component-grid .field > label {
      margin: 0;
    }
    .create-component-grid .field > input,
    .create-component-grid .field > textarea,
    .create-component-grid .field > .select-dropdown,
    .create-component-grid .field > .hint {
      margin: 0;
    }
    .create-component-grid .field > .hint {
      line-height: 1.35;
    }
    .create-component-grid .field--wide {
      grid-column: 1 / -1;
    }
    .create-component-grid #createComponentTypeField[hidden] + .field {
      grid-column: 1 / -1;
    }
    .create-component-form textarea {
      width: 100%;
      min-height: 72px;
      box-sizing: border-box;
      resize: vertical;
    }
    .create-component-form .connection-status {
      margin: 0 0 12px;
    }
    @media (max-width: 760px) {
      .create-component-grid { grid-template-columns: 1fr; }
    }
`;
