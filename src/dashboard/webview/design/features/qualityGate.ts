export const QUALITY_GATE_FEATURE_STYLES = `
    .gate-condition-table {
      table-layout: fixed;
    }
    .gate-condition-table th {
      position: static;
    }
    .gate-condition-table .condition-metric {
      width: 34%;
    }
    .gate-condition-table .condition-scope {
      width: 100px;
    }
    .gate-condition-table .condition-status {
      width: 86px;
    }
    .condition-state {
      display: inline-flex;
      min-width: 58px;
      justify-content: center;
      padding: 2px 6px;
      border-radius: 10px;
      color: #fff;
      background: var(--vscode-disabledForeground);
      font-size: 10px;
      font-weight: 600;
    }
    .condition-state.ok {
      background: var(--dashboard-quality-gate-ok);
    }
    .condition-state.warn {
      color: #111827;
      background: var(--dashboard-quality-gate-warn);
    }
    .condition-state.error {
      background: var(--dashboard-quality-gate-error);
    }

    .ratings-comparison {
      display: grid;
      grid-template-columns: minmax(130px, 1fr) 80px 90px;
      gap: 7px 10px;
      align-items: center;
    }
    .ratings-comparison strong {
      text-align: center;
    }
    .rating-badge {
      display: grid;
      width: 24px;
      height: 24px;
      margin: 0 auto;
      place-items: center;
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 2px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-weight: 700;
    }
    .rating-badge.a {
      color: var(--dashboard-rating-a);
      background: var(--dashboard-rating-a-bg);
      border-color: transparent;
    }
    .rating-badge.b {
      color: var(--dashboard-rating-b);
      background: var(--dashboard-rating-b-bg);
      border-color: transparent;
    }
    .rating-badge.c {
      color: var(--dashboard-rating-c);
      background: var(--dashboard-rating-c-bg);
      border-color: transparent;
    }
    .rating-badge.d {
      color: var(--dashboard-rating-d);
      background: var(--dashboard-rating-d-bg);
      border-color: transparent;
    }
    .rating-badge.e {
      color: var(--dashboard-rating-e);
      background: var(--dashboard-rating-e-bg);
      border-color: transparent;
    }
`;
