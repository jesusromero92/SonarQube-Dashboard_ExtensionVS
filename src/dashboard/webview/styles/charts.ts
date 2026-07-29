
export const CHART_STYLES = `    .rank-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-top: 16px;
    }
    .rank-grid > .panel { margin-top: 0; }
    .compact-table {
      display: flex;
      min-height: 376px;
      flex-direction: column;
    }
    .compact-table .body-scroll-table {
      height: auto;
      max-height: none;
    }
    .compact-table .body-scroll-table tbody {
      height: 290px;
      max-height: 290px;
    }
    .compact-table .body-scroll-table thead tr,
    .compact-table .body-scroll-table tbody tr {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 92px 82px;
    }
    .compact-table th, .compact-table td { padding: 8px 10px; }
    .count-cell { width: 82px; text-align: right; font-variant-numeric: tabular-nums; }
    .severity-cell { width: 92px; }
    .evolution-section { margin-top: 20px; }
    .evolution-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
    }
    .evolution-heading h2 { margin: 0; font-size: 15px; }
    .chart-card-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      gap: 0 14px;
    }
    .chart-card-header > h3 {
      align-self: center;
    }
    .chart-card-header > .chart-granularity {
      justify-self: end;
    }
    .chart-card-header > p {
      grid-column: 1 / -1;
    }
    .evolution-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .evolution-grid > .panel {
      min-width: 0;
      margin-top: 0;
    }
    .chart-card {
      position: relative;
      min-width: 0;
      padding: 16px;
      overflow: visible;
    }
    .chart-card-header h3 { margin: 0; font-size: 13px; }
    .chart-card-header p {
      min-height: 34px;
      margin: 5px 0 12px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 1.4;
    }
    .chart-stage {
      position: relative;
      width: 100%;
      min-width: 0;
      height: 280px;
      border: 1px dashed var(--vscode-panel-border);
      background: var(--vscode-editor-background);
    }
    .chart-stage > .chart-svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    .chart-empty {
      display: grid;
      place-items: center;
      height: 100%;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .chart-tooltip {
      position: fixed;
      z-index: 99999;
      width: max-content;
      min-width: 150px;
      max-width: 280px;
      padding: 8px 10px;
      overflow: hidden;
      border: 1px solid #1e293b;
      border-radius: 6px;
      color: #ffffff;
      background: #020617;
      box-shadow: 0 10px 24px rgba(0, 0, 0, .38);
      pointer-events: none;
      font-size: 11px;
      line-height: 16px;
    }
    .chart-tooltip-title {
      overflow: hidden;
      color: #ffffff;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chart-tooltip-subtitle {
      overflow: hidden;
      margin-bottom: 6px;
      color: #94a3b8;
      font-size: 10px;
      line-height: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chart-tooltip-row { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
    .chart-tooltip-bar {
      width: 4px;
      height: 12px;
      flex: 0 0 auto;
      border-radius: 999px;
    }
    .chart-tooltip-name {
      min-width: 0;
      max-width: 180px;
      flex: 1;
      overflow: hidden;
      color: #cbd5e1;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chart-tooltip-value {
      margin-left: 12px;
      color: #ffffff;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .chart-legend {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px 12px;
      margin-top: 12px;
    }
    .chart-legend button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 24px;
      padding: 2px 5px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
    }
    .chart-legend button.hidden-series { opacity: .45; text-decoration: line-through; }
    .chart-legend-dot { width: 8px; height: 8px; flex: 0 0 auto; }
`;
