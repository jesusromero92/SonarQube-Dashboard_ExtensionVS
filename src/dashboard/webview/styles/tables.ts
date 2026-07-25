import { DashboardWebviewAssets } from '../assets';


export function getTableStyles({ bugIconUri, codeSmellIconUri, vulnerabilityIconUri }: DashboardWebviewAssets): string {
  return `    .metrics-summary {
      display: flex;
      overflow-x: auto;
      margin-bottom: 16px;
      border-top: 1px solid var(--vscode-panel-border);
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .metric-summary {
      min-width: 150px;
      flex: 1 0 150px;
      padding: 13px 15px;
      border-top: 3px solid var(--vscode-charts-blue);
      border-right: 1px solid var(--vscode-panel-border);
    }
    .metric-summary:last-child { border-right: 0; }
    .metric-summary.blocker { border-top-color: var(--dashboard-severity-blocker); }
    .metric-summary.critical { border-top-color: var(--dashboard-severity-critical); }
    .metric-summary.high { border-top-color: var(--dashboard-severity-high); }
    .metric-summary.major { border-top-color: var(--dashboard-severity-major); }
    .metric-summary.medium { border-top-color: var(--dashboard-severity-medium); }
    .metric-summary.minor { border-top-color: var(--dashboard-severity-minor); }
    .metric-summary.low { border-top-color: var(--dashboard-severity-low); }
    .metric-summary.info { border-top-color: var(--dashboard-severity-info); }
    .metric-summary strong {
      display: block;
      margin-bottom: 4px;
      font-size: 24px;
      font-weight: 400;
      font-variant-numeric: tabular-nums;
    }
    .metric-label {
      display: block;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .metric-delta {
      display: block;
      min-height: 16px;
      margin-top: 7px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .metric-delta.increase { color: var(--vscode-testing-iconFailed); }
    .metric-delta.decrease { color: var(--vscode-testing-iconPassed); }
    .dashboard-controls {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .segmented {
      display: inline-flex;
      padding: 2px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 3px;
      background: var(--vscode-editor-background);
    }
    .segmented button {
      min-height: 28px;
      padding: 4px 12px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
    }
    .segmented button.active {
      color: var(--vscode-foreground);
      background: var(--vscode-list-activeSelectionBackground);
    }
    .scope-control { margin-left: auto; }
    .quality-gate-button {
      min-height: 32px;
      padding: 5px 11px;
    }
    .quality-gate-button.ok { background: var(--dashboard-quality-gate-ok); }
    .quality-gate-button.warn { color: #111827; background: var(--dashboard-quality-gate-warn); }
    .quality-gate-button.error { background: var(--dashboard-quality-gate-error); }
    .table-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 48px;
      padding: 9px 13px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .table-toolbar h2 { margin: 0; font-size: 13px; }
    .table-toolbar input { width: min(360px, 42vw); margin-left: auto; }
    .table-wrap { overflow: auto; max-height: 410px; }
    .body-scroll-table {
      overflow: hidden;
      max-height: none;
    }
    .body-scroll-table table {
      display: flex;
      flex-direction: column;
    }
    .body-scroll-table thead {
      flex: 0 0 auto;
      padding-right: 10px;
    }
    .body-scroll-table tbody {
      display: block;
      max-height: 370px;
      overflow-x: hidden;
      overflow-y: auto;
      scrollbar-gutter: stable;
    }
    .body-scroll-table thead tr,
    .body-scroll-table tbody tr {
      display: table;
      width: 100%;
      table-layout: fixed;
    }
    .body-scroll-table tbody:empty { display: none; }
    table { width: 100%; border-collapse: collapse; }
    .issues-table { table-layout: fixed; }
    th, td {
      padding: 9px 11px;
      border-bottom: 1px solid var(--vscode-panel-border);
      text-align: left;
      vertical-align: top;
    }
    th {
      z-index: 1;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-editorWidget-background);
      font-size: 12px;
      font-weight: 600;
    }
    .sort-button {
      display: inline-flex;
      width: 100%;
      align-items: center;
      gap: 5px;
      padding: 0;
      border: 0;
      color: inherit;
      background: transparent;
      text-align: inherit;
    }
    .sort-button:hover {
      color: var(--vscode-foreground);
      background: transparent;
    }
    .sort-indicator {
      width: 10px;
      color: var(--vscode-foreground);
      font-size: 10px;
      line-height: 1;
    }
    .count-cell .sort-button { justify-content: flex-end; }
    tbody tr { cursor: pointer; }
    tbody tr:hover { background: var(--vscode-list-hoverBackground); }
    .badge {
      display: inline-flex;
      min-width: 70px;
      justify-content: center;
      padding: 2px 7px;
      border-radius: 10px;
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
      font-size: 11px;
    }
    .badge.blocker { background: var(--dashboard-severity-blocker); }
    .badge.critical { background: var(--dashboard-severity-critical); }
    .badge.high { background: var(--dashboard-severity-high); }
    .badge.major { background: var(--dashboard-severity-major); }
    .badge.medium { background: var(--dashboard-severity-medium); }
    .badge.minor { color: #111827; background: var(--dashboard-severity-minor); }
    .badge.low { color: #111827; background: var(--dashboard-severity-low); }
    .badge.info { background: var(--dashboard-severity-info); }
    .hotspot-priority {
      display: inline-flex;
      min-width: 66px;
      justify-content: center;
      padding: 2px 7px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
    }
    .hotspot-priority.high { color: #fff; background: var(--dashboard-type-security-hotspot); }
    .hotspot-priority.medium { color: #111827; background: var(--dashboard-severity-major); }
    .hotspot-priority.low { color: #111827; background: var(--dashboard-severity-minor); }
    .hotspot-status { color: var(--vscode-descriptionForeground); }
    .pending-filter {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .pending-filter input { width: auto; margin: 0; }
    .path { min-width: 220px; max-width: 370px; }
    .file-name {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .file-line {
      display: block;
      margin-top: 4px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    .type-icon-cell { text-align: center; }
    .type-icon {
      display: inline-block;
      width: 20px;
      height: 20px;
      vertical-align: middle;
    }
    .type-icon.code-smell {
      background: var(--dashboard-type-code-smell);
      -webkit-mask: url('${codeSmellIconUri}') center / contain no-repeat;
      mask: url('${codeSmellIconUri}') center / contain no-repeat;
    }
    .type-icon.bug {
      background: var(--dashboard-type-bug);
      -webkit-mask: url('${bugIconUri}') center / contain no-repeat;
      mask: url('${bugIconUri}') center / contain no-repeat;
    }
    .type-icon.vulnerability {
      background: var(--dashboard-type-vulnerability);
      -webkit-mask: url('${vulnerabilityIconUri}') center / contain no-repeat;
      mask: url('${vulnerabilityIconUri}') center / contain no-repeat;
    }
    .rule-button {
      min-height: 0;
      padding: 0;
      border: 0;
      color: var(--vscode-textLink-foreground);
      background: transparent;
      text-align: left;
    }
    .rule-button:hover {
      color: var(--vscode-textLink-activeForeground);
      background: transparent;
      text-decoration: underline;
    }
`;
}
