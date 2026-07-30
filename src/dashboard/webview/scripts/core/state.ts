export const DASHBOARD_STATE_SCRIPT = `
    let currentPage = 'data';
    let currentConfig = { serverUrl: '', projectKey: '', projectName: '', hasToken: false };
    let currentSummary = { published: 0, issues: [], severity: [], evolution: [] };
    let summaryVisible = false;
    let currentIssues = [];
    let currentHotspots = [];
    let currentScope = 'overall';
    let currentDataView = 'issues';
    const evolutionGranularities = {
      types: 'week',
      severity: 'week',
      coverage: 'week',
      duplication: 'week'
    };
    const topSort = {
      files: { key: 'count', direction: 'desc' },
      rules: { key: 'count', direction: 'desc' }
    };
    let selectedHotspot = null;
    let selectedRuleIssue = null;
    let loadedProjects = [];
    let creationCapabilities = {
      canCreateProjects: false,
      canCreateApplications: false
    };
    let createComponentKind = 'project';
    let componentKeyEdited = false;
    let selectedProjectKey = '';
    let currentFolderUri = '';
    let connectionDraftDirty = false;
    let connectionDraftFolderUri = '';
    let connectionValidated = false;
    let connectionAttemptPending = false;
    let configurationBusy = false;
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
