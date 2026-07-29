export const DASHBOARD_STATE_SCRIPT = `
    let currentPage = 'data';
    let currentConfig = { serverUrl: '', projectKey: '', projectName: '', hasToken: false };
    let currentSummary = { published: 0, issues: [], severity: [], evolution: [] };
    let summaryVisible = false;
    let currentIssues = [];
    let currentHotspots = [];
    let currentScope = 'overall';
    let currentDataView = 'issues';
    const topSort = {
      files: { key: 'count', direction: 'desc' },
      rules: { key: 'count', direction: 'desc' }
    };
    let selectedHotspot = null;
    let loadedProjects = [];
    let selectedProjectKey = '';
    let currentFolderUri = '';
    let connectionDraftDirty = false;
    let hasWorkspace = false;
    let dashboardLoading = true;
    let workspaceTrusted = true;
    let currentAnalysisState = {
      running: false,
      phase: 'idle',
      message: 'Listo para analizar el repositorio.',
      scanner: '',
      canCancel: false,
      log: []
    };
    const hiddenChartSeries = {
      types: new Set(),
      severity: new Set()
    };
`;
