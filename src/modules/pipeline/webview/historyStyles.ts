export const PIPELINE_HISTORY_STYLES = `
    .pipeline-execution-panel {
      overflow: hidden;
    }
    .pipeline-execution-page-header {
      align-items: center;
      justify-content: space-between;
    }
    .pipeline-execution-page-header > div {
      display: grid;
      gap: 3px;
    }
    .pipeline-execution-detail {
      --pipeline-accent: var(--vscode-descriptionForeground);
      display: grid;
      gap: 16px;
      padding: 18px;
      background:
        linear-gradient(
          135deg,
          color-mix(in srgb, var(--pipeline-accent) 8%, transparent),
          transparent 42%
        ),
        var(--vscode-editor-background);
    }
    .pipeline-execution-detail--running { --pipeline-accent: var(--vscode-progressBar-background); }
    .pipeline-execution-detail--success { --pipeline-accent: var(--vscode-testing-iconPassed); }
    .pipeline-execution-detail--warning { --pipeline-accent: var(--vscode-editorWarning-foreground); }
    .pipeline-execution-detail--failed { --pipeline-accent: var(--vscode-testing-iconFailed, var(--vscode-errorForeground)); }
    .pipeline-execution-detail--cancelled { --pipeline-accent: var(--vscode-descriptionForeground); }
    .pipeline-execution-hero {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr) max-content;
      align-items: center;
      gap: 14px;
      padding: 18px;
      border: 1px solid var(--vscode-panel-border);
      border-left: 4px solid var(--pipeline-accent);
      background: var(--vscode-editorWidget-background);
      box-shadow: 0 8px 22px color-mix(in srgb, var(--vscode-widget-shadow) 28%, transparent);
    }
    .pipeline-execution-status-icon {
      display: grid;
      width: 44px;
      height: 44px;
      place-items: center;
      border: 1px solid color-mix(in srgb, var(--pipeline-accent) 62%, transparent);
      border-radius: 50%;
      color: var(--pipeline-accent);
      background: color-mix(in srgb, var(--pipeline-accent) 12%, transparent);
    }
    .pipeline-execution-status-icon .analysis-step-status-icon {
      width: 22px;
      height: 22px;
      fill: currentColor;
    }
    .pipeline-execution-status-icon[data-status="running"]::before {
      width: 20px;
      height: 20px;
      border: 2px solid color-mix(in srgb, var(--pipeline-accent) 35%, transparent);
      border-top-color: var(--pipeline-accent);
      border-radius: 50%;
      content: '';
      animation: dashboard-spin .8s linear infinite;
    }
    .pipeline-execution-hero-copy {
      display: grid;
      gap: 4px;
      min-width: 0;
    }
    .pipeline-execution-eyebrow {
      color: var(--pipeline-accent);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .08em;
      text-transform: uppercase;
    }
    .pipeline-execution-hero h3 {
      margin: 0;
      font-size: 18px;
      overflow-wrap: anywhere;
    }
    .pipeline-execution-hero p {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .pipeline-history-status {
      min-width: 108px;
      padding: 4px 10px;
      border: 1px solid color-mix(in srgb, var(--pipeline-accent) 55%, transparent);
      border-radius: 999px;
      color: var(--pipeline-accent);
      background: color-mix(in srgb, var(--pipeline-accent) 12%, transparent);
      font-size: 11px;
      font-weight: 700;
      text-align: center;
    }
    .pipeline-execution-summary-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
    }
    .pipeline-execution-summary-card {
      display: grid;
      gap: 6px;
      min-width: 0;
      padding: 12px 14px;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorWidget-background);
    }
    .pipeline-execution-summary-card span {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      text-transform: uppercase;
    }
    .pipeline-execution-summary-card strong {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .pipeline-execution-accordions {
      gap: 12px;
    }
    .pipeline-execution-accordions > .accordion {
      border-color: color-mix(in srgb, var(--pipeline-accent) 24%, var(--vscode-panel-border));
      background: var(--vscode-editorWidget-background);
    }
    .pipeline-execution-accordions > .accordion > summary {
      position: relative;
      padding: 13px 15px;
      font-size: 13px;
    }
    .pipeline-execution-accordions > .accordion[open] > .accordion__content {
      animation: pipeline-accordion-reveal .18s ease-out;
      transform-origin: top;
    }
    .pipeline-execution-steps {
      display: grid;
      gap: 8px;
      padding: 12px;
    }
    .pipeline-execution-step {
      --step-accent: var(--vscode-descriptionForeground);
      border-left: 3px solid var(--step-accent);
      background: var(--vscode-editor-background);
    }
    .pipeline-execution-step--running { --step-accent: var(--vscode-progressBar-background); }
    .pipeline-execution-step--success { --step-accent: var(--vscode-testing-iconPassed); }
    .pipeline-execution-step--warning { --step-accent: var(--vscode-editorWarning-foreground); }
    .pipeline-execution-step--failed { --step-accent: var(--vscode-testing-iconFailed, var(--vscode-errorForeground)); }
    .pipeline-execution-step-summary {
      display: grid;
      grid-template-columns: 22px minmax(0, 1fr) max-content max-content;
      align-items: center;
      gap: 10px;
      list-style: none;
    }
    .pipeline-execution-step-summary::-webkit-details-marker { display: none; }
    .pipeline-history-step-icon {
      display: grid;
      width: 18px;
      height: 18px;
      place-items: center;
      color: var(--step-accent);
    }
    .pipeline-history-step-icon .analysis-step-status-icon {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }
    .pipeline-execution-step--running .pipeline-history-step-icon::before {
      width: 12px;
      height: 12px;
      border: 2px solid color-mix(in srgb, var(--step-accent) 35%, transparent);
      border-top-color: var(--step-accent);
      border-radius: 50%;
      content: '';
      animation: dashboard-spin .8s linear infinite;
    }
    .pipeline-execution-step-status {
      color: var(--step-accent);
      font-size: 11px;
      font-weight: 600;
    }
    .pipeline-execution-step-duration {
      min-width: 62px;
      text-align: right;
    }
    .pipeline-execution-step-details {
      display: grid;
      gap: 0;
      padding: 0;
    }
    .pipeline-execution-step-detail {
      display: grid;
      grid-template-columns: minmax(120px, max-content) minmax(0, 1fr);
      gap: 14px;
      padding: 9px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .pipeline-execution-step-detail:last-child { border-bottom: 0; }
    .pipeline-execution-step-detail > span {
      color: var(--vscode-descriptionForeground);
    }
    .pipeline-execution-step-detail code,
    .pipeline-execution-step-detail strong {
      min-width: 0;
      overflow-wrap: anywhere;
      font-weight: 400;
    }
    .pipeline-execution-log-content {
      padding: 12px;
    }
    .pipeline-history-log {
      min-height: 280px;
      max-height: 58vh;
      margin: 0;
      padding: 14px;
      overflow: auto;
      border: 1px solid var(--vscode-panel-border);
      color: var(--vscode-terminal-foreground, var(--vscode-foreground));
      background: var(--vscode-terminal-background, var(--vscode-editor-background));
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      line-height: 1.45;
      white-space: pre;
      word-break: normal;
      tab-size: 8;
    }
    @keyframes pipeline-accordion-reveal {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 1100px) {
      .pipeline-execution-summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 700px) {
      .pipeline-execution-detail { padding: 12px; }
      .pipeline-execution-hero {
        grid-template-columns: max-content minmax(0, 1fr);
      }
      .pipeline-history-status {
        grid-column: 1 / -1;
        justify-self: start;
      }
      .pipeline-execution-summary-grid { grid-template-columns: 1fr; }
      .pipeline-execution-step-summary {
        grid-template-columns: 22px minmax(0, 1fr) max-content;
      }
      .pipeline-execution-step-status { display: none; }
      .pipeline-execution-step-detail { grid-template-columns: 1fr; gap: 4px; }
    }
    .pipeline-template-manager {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: start;
      padding: 14px;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-background);
    }
    .pipeline-template-selector-field,
    .pipeline-template-toolbar-field { min-width: 0; }
    .pipeline-template-toolbar-field > label { visibility: hidden; }
    .pipeline-template-toolbar,
    .analysis-template-toolbar {
      display: flex;
      align-items: end;
      gap: 8px;
    }
    .pipeline-template-toolbar {
      min-height: 28px;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
    }
    .pipeline-template-toolbar .configuration-select,
    .analysis-template-field { flex: 1 1 auto; }
    .pipeline-template-status {
      display: inline-flex;
      min-height: 28px;
      align-items: center;
      margin: 0;
    }
    .pipeline-template-status[hidden] { display: none; }
    .pipeline-template-editor {
      display: grid;
      gap: 16px;
      margin-top: 14px;
      padding: 16px;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editorWidget-background);
    }
    .pipeline-template-editor[hidden] { display: none; }
    .pipeline-template-metadata { margin: 0; }
    .pipeline-template-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      min-height: 44px;
      padding-top: 14px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    .pipeline-template-actions .pipeline-template-status {
      margin-right: auto;
    }
    .analysis-template-toolbar {
      padding: 10px;
      border: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-background);
    }
    .analysis-template-field label { margin-bottom: 5px; }
    @media (max-width: 760px) {
      .pipeline-history-item > summary { grid-template-columns: 1fr; }
      .pipeline-template-manager { grid-template-columns: 1fr; }
      .pipeline-template-toolbar,
      .analysis-template-toolbar { align-items: stretch; flex-direction: column; }
      .pipeline-template-actions > .spacer { display: none; }
      .pipeline-template-actions button { flex: 1 1 auto; }
    }
    .pipeline-save-row {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 12px;
    }
    .pipeline-save-status {
      margin-right: auto;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .pipeline-save-status--success {
      color: var(--vscode-testing-iconPassed);
    }
    .pipeline-save-status--error {
      color: var(--vscode-errorForeground);
    }
    .analysis-scope-note {
      margin-top: 10px;
    }
    .analysis-scope-save-row .pipeline-save-status {
      margin-right: 0;
    }
`;
