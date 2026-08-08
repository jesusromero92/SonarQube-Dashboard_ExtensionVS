
export const RESPONSIVE_STYLES = `    @media (max-width: 980px) {
      .topbar { flex-wrap: wrap; }
      .navigation { order: 3; width: 100%; margin-left: 54px; }
      .nav-button { flex: 1; }
      .connection-row, .project-row, .advanced-grid, .rank-grid, .evolution-grid { grid-template-columns: 1fr; }
      .table-toolbar { flex-wrap: wrap; }
      .table-toolbar input { width: 100%; margin-left: 0; }
      .issues-toolbar #filter { order: 4; flex: 1 0 calc(100% - 44px); }
      .dashboard-controls { flex-wrap: wrap; }
      .scope-control { margin-left: 0; }
      .evolution-heading { align-items: flex-start; flex-wrap: wrap; }
    }
  `;
