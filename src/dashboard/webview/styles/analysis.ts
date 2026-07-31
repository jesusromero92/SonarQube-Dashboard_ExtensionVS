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
    .analysis-icon::before {
      width: 0;
      height: 0;
      content: "";
      border-top: 6px solid transparent;
      border-bottom: 6px solid transparent;
      border-left: 9px solid currentColor;
      transform: translateX(1.5px);
    }
    .analysis-icon.running::before {
      width: 15px;
      height: 15px;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: 50%;
      transform: none;
      animation: dashboard-spin .8s linear infinite;
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
    .analysis-status-indicator.preActions,
    .analysis-status-indicator.postActions,
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
    .confirmation-dialog {
      width: min(560px, calc(100vw - 40px));
    }
    .rule-dialog-body.confirmation-dialog-body {
      display: grid;
      gap: 12px;
      padding: 14px 16px 16px;
      line-height: 1.4;
      white-space: normal;
    }
    .confirmation-dialog-body p { margin: 0; }
    .confirmation-warning {
      padding: 10px 12px;
      border-left: 3px solid var(--vscode-editorWarning-foreground);
      background: var(--vscode-textBlockQuote-background);
    }
    .confirmation-details {
      display: flex;
      flex-direction: column;
      margin: 0;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      background: var(--vscode-editor-background);
    }
    .confirmation-details > div {
      display: flex;
      gap: 12px;
      padding: 7px 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .confirmation-details > div:last-child { border-bottom: 0; }
    .confirmation-details dt {
      width: 92px;
      flex: 0 0 92px;
      color: var(--vscode-descriptionForeground);
    }
    .confirmation-details dd {
      min-width: 0;
      flex: 1 1 auto;
      margin: 0;
      overflow-wrap: anywhere;
    }
    .confirmation-note {
      margin: 0;
      font-size: 12px;
    }
    .analysis-action-selection {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 10px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
    }
    .analysis-action-selection legend {
      padding: 0 5px;
      font-weight: 600;
    }
    .analysis-action-option {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 9px;
      align-items: start;
      padding: 7px 8px;
      border-radius: 3px;
    }
    .analysis-action-option:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .analysis-action-option input {
      margin-top: 3px;
    }
    .analysis-action-option span {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .analysis-action-option small {
      color: var(--vscode-descriptionForeground);
      overflow-wrap: anywhere;
    }
    .analysis-action-option:has(input:disabled) {
      opacity: .58;
    }

    .pipeline-confirmation-dialog {
      width: min(860px, calc(100vw - 40px));
    }
    .pipeline-editor-heading,
    .analysis-run-heading {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .analysis-run-heading > button {
      flex: 0 0 auto;
      white-space: nowrap;
    }
    .pipeline-step-list {
      display: grid;
      gap: 8px;
      min-height: 42px;
      margin-top: 8px;
    }
    .pipeline-step-list.is-empty::before {
      padding: 12px;
      border: 1px dashed var(--vscode-panel-border);
      color: var(--vscode-descriptionForeground);
      content: "No hay pasos personalizados.";
      text-align: center;
    }
    .pipeline-step-row {
      display: grid;
      grid-template-columns: auto minmax(130px, .7fr) minmax(220px, 1.5fr) minmax(145px, auto) auto;
      gap: 8px;
      align-items: center;
      padding: 8px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      background: var(--vscode-editor-background);
    }
    .pipeline-config-step {
      grid-template-columns: auto minmax(130px, .7fr) minmax(220px, 1.5fr) minmax(145px, auto) auto;
    }
    .pipeline-step-row.dragging {
      opacity: .5;
      outline: 1px solid var(--vscode-focusBorder);
    }
    .analysis-run-step.is-incomplete {
      border-color: var(--vscode-inputValidation-warningBorder, var(--vscode-editorWarning-foreground));
    }
    .pipeline-step-drag {
      padding: 5px 2px;
      color: var(--vscode-descriptionForeground);
      cursor: grab;
      font-weight: 700;
      letter-spacing: -3px;
      user-select: none;
    }
    .pipeline-step-drag:active,
    .pipeline-step-row.dragging .pipeline-step-drag { cursor: grabbing; }
    .pipeline-step-row input[type="text"],
    .pipeline-step-row .select-dropdown {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
    .pipeline-step-remove {
      min-width: 30px;
      padding: 3px 8px;
      font-size: 18px;
      line-height: 1;
    }
    .analysis-run-steps {
      max-height: min(46vh, 430px);
      overflow: auto;
      overscroll-behavior: contain;
    }
    .analysis-run-step {
      grid-template-columns: auto minmax(0, 1fr) minmax(160px, auto) auto;
    }
    .pipeline-step-drag.is-disabled {
      cursor: default;
      opacity: .45;
    }
    .pipeline-step-content {
      display: grid;
      gap: 5px;
      min-width: 0;
    }
    .analysis-run-step .pipeline-step-name,
    .analysis-run-step .pipeline-step-name-dropdown .select-dropdown__trigger {
      font-weight: 600;
    }
    .analysis-run-step input[readonly] {
      color: var(--vscode-foreground);
      background: transparent;
    }
    .analysis-stepper {
      display: flex;
      gap: 0;
      margin: 0;
      padding: 12px 16px;
      overflow-x: auto;
      border-bottom: 1px solid var(--vscode-panel-border);
      list-style: none;
      overscroll-behavior-x: contain;
    }
    .analysis-step {
      position: relative;
      display: grid;
      min-width: 92px;
      flex: 1 0 92px;
      gap: 5px;
      justify-items: center;
      color: var(--vscode-descriptionForeground);
      text-align: center;
    }
    .analysis-step:not(:last-child)::after {
      position: absolute;
      z-index: 0;
      top: 11px;
      left: calc(50% + 13px);
      width: calc(100% - 26px);
      height: 2px;
      content: "";
      background: var(--vscode-panel-border);
    }
    .analysis-step-icon {
      position: relative;
      z-index: 1;
      display: grid;
      width: 22px;
      height: 22px;
      place-items: center;
      border: 2px solid var(--vscode-panel-border);
      border-radius: 50%;
      background: var(--vscode-editorWidget-background);
    }
    .analysis-step--running .analysis-step-icon {
      border-color: var(--vscode-progressBar-background);
      border-top-color: transparent;
      animation: dashboard-spin .8s linear infinite;
    }
    .analysis-step--success .analysis-step-icon {
      border-color: var(--dashboard-quality-gate-ok);
      color: var(--vscode-editor-background);
      background: var(--dashboard-quality-gate-ok);
    }
    .analysis-step--failed .analysis-step-icon {
      border-color: var(--dashboard-quality-gate-error);
      color: var(--vscode-editor-background);
      background: var(--dashboard-quality-gate-error);
    }
    .analysis-step--warning .analysis-step-icon {
      border-color: var(--vscode-editorWarning-foreground);
      color: var(--vscode-editor-background);
      background: var(--vscode-editorWarning-foreground);
    }
    .analysis-step-status-icon {
      display: block;
      width: 14px;
      height: 14px;
      fill: currentColor;
      pointer-events: none;
    }
    .analysis-step--skipped .analysis-step-icon {
      color: var(--vscode-descriptionForeground);
    }
    .analysis-step-label {
      max-width: 130px;
      overflow: hidden;
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

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


    @media (prefers-reduced-motion: reduce) {
      .analysis-icon.running::before,
      .analysis-status-indicator {
        animation: none;
      }
    }
    @media (max-width: 760px) {
      .create-component-grid { grid-template-columns: 1fr; }
      .confirmation-details dt { width: 78px; flex-basis: 78px; }
      .analysis-panel { align-items: flex-start; flex-direction: column; }
      .analysis-actions { width: 100%; margin-left: 0; }
      .analysis-actions button { flex: 1; }
      .pipeline-step-row,
      .analysis-run-step { grid-template-columns: auto minmax(0, 1fr) auto; }
      .pipeline-step-row .pipeline-step-command,
      .pipeline-step-row .pipeline-step-policy-dropdown,
      .analysis-run-step .pipeline-step-policy-dropdown { grid-column: 2 / -1; }
      .analysis-run-heading { flex-direction: column; }
    }
`;
