export const COVERAGE_FEATURE_STYLES = `
    .coverage-summary .coverage-covered {
      border-top-color: #22a447;
    }
    .coverage-summary .coverage-partial {
      border-top-color: #eabf00;
    }
    .coverage-summary .coverage-uncovered {
      border-top-color: #d4333f;
    }
    .coverage-summary .coverage-duplicated {
      border-top-color: #8b5cf6;
    }
    .compact-metrics {
      margin-bottom: 0;
    }
    .compact-metrics .metric-summary {
      min-width: 120px;
      padding: 10px 12px;
    }
    .compact-metrics .metric-summary strong {
      font-size: 20px;
    }
    .coverage-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }
    .coverage-legend-item i {
      width: 9px;
      height: 9px;
      border-radius: 50%;
    }
    .duplication-groups {
      display: grid;
      gap: 10px;
    }
    .duplication-group {
      padding: 10px;
      border: 1px solid var(--vscode-panel-border);
    }
    .duplication-group h4 {
      margin: 0;
    }
    .duplication-group-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }
    .duplication-location {
      margin: 0 7px 7px 0;
    }
`;
