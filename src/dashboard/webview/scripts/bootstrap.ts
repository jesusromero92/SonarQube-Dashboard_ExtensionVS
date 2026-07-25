import {
  DASHBOARD_COLORS,
  DASHBOARD_WEBVIEW_CONSTANTS
} from '../../../constants';

export function getBootstrapScript(): string {
  return `
    const vscode = acquireVsCodeApi();
    const dashboardColors = ${JSON.stringify(DASHBOARD_COLORS)};
    const dashboardConstants = ${JSON.stringify(DASHBOARD_WEBVIEW_CONSTANTS)};
    const typeIconClasses = dashboardConstants.typeIconClasses;
    const elements = {
      dataPage: document.getElementById('dataPage'),
      configurationPage: document.getElementById('configurationPage'),
      dataLoading: document.getElementById('dataLoading'),
      dataEmpty: document.getElementById('dataEmpty'),
      emptyProject: document.getElementById('emptyProject'),
      emptyTitle: document.getElementById('emptyTitle'),
      emptyText: document.getElementById('emptyText'),
      goConfiguration: document.getElementById('goConfiguration'),
      syncEmpty: document.getElementById('syncEmpty'),
      emptyWorkspace: document.getElementById('emptyWorkspace'),
      configurationContent: document.getElementById('configurationContent'),
      folderField: document.getElementById('folderField'),
      folder: document.getElementById('folder'),
      serverUrl: document.getElementById('serverUrl'),
      token: document.getElementById('token'),
      tokenHint: document.getElementById('tokenHint'),
      projectKey: document.getElementById('projectKey'),
      branch: document.getElementById('branch'),
      baseDir: document.getElementById('baseDir'),
      loadProjects: document.getElementById('loadProjects'),
      save: document.getElementById('save'),
      refresh: document.getElementById('refresh'),
      clear: document.getElementById('clear'),
      configState: document.getElementById('configState'),
      results: document.getElementById('results'),
      issuesViewTab: document.getElementById('issuesViewTab'),
      hotspotsViewTab: document.getElementById('hotspotsViewTab'),
      hotspotsTabCount: document.getElementById('hotspotsTabCount'),
      overallScope: document.getElementById('overallScope'),
      newCodeScope: document.getElementById('newCodeScope'),
      qualityGateButton: document.getElementById('qualityGateButton'),
      issuesView: document.getElementById('issuesView'),
      hotspotsView: document.getElementById('hotspotsView'),
      metricsSummary: document.getElementById('metricsSummary'),
      tableCount: document.getElementById('tableCount'),
      filter: document.getElementById('filter'),
      issuesBody: document.getElementById('issuesBody'),
      noResults: document.getElementById('noResults'),
      filesCount: document.getElementById('filesCount'),
      filesBody: document.getElementById('filesBody'),
      noFiles: document.getElementById('noFiles'),
      rulesCount: document.getElementById('rulesCount'),
      rulesBody: document.getElementById('rulesBody'),
      noRules: document.getElementById('noRules'),
      evolutionCount: document.getElementById('evolutionCount'),
      typeChart: document.getElementById('typeChart'),
      typeLegend: document.getElementById('typeLegend'),
      severityChart: document.getElementById('severityChart'),
      severityLegend: document.getElementById('severityLegend'),
      hotspotsCount: document.getElementById('hotspotsCount'),
      pendingHotspotsOnly: document.getElementById('pendingHotspotsOnly'),
      hotspotFilter: document.getElementById('hotspotFilter'),
      hotspotsBody: document.getElementById('hotspotsBody'),
      noHotspots: document.getElementById('noHotspots'),
      ruleDialog: document.getElementById('ruleDialog'),
      ruleDialogTitle: document.getElementById('ruleDialogTitle'),
      ruleDialogDescription: document.getElementById('ruleDialogDescription'),
      ruleDialogClose: document.getElementById('ruleDialogClose'),
      qualityGateDialog: document.getElementById('qualityGateDialog'),
      qualityGateDialogClose: document.getElementById('qualityGateDialogClose'),
      qualityGateDialogFooterClose: document.getElementById('qualityGateDialogFooterClose'),
      qualityGateDialogStatus: document.getElementById('qualityGateDialogStatus'),
      qualityGateConditionCount: document.getElementById('qualityGateConditionCount'),
      qualityGateConditions: document.getElementById('qualityGateConditions'),
      noQualityGateConditions: document.getElementById('noQualityGateConditions'),
      qualityGateRatings: document.getElementById('qualityGateRatings'),
      hotspotDialog: document.getElementById('hotspotDialog'),
      hotspotDialogTitle: document.getElementById('hotspotDialogTitle'),
      hotspotDialogClose: document.getElementById('hotspotDialogClose'),
      closeHotspotDialog: document.getElementById('closeHotspotDialog'),
      hotspotDialogLoading: document.getElementById('hotspotDialogLoading'),
      hotspotDialogContent: document.getElementById('hotspotDialogContent'),
      hotspotDialogMeta: document.getElementById('hotspotDialogMeta'),
      hotspotDialogMessage: document.getElementById('hotspotDialogMessage'),
      hotspotRisk: document.getElementById('hotspotRisk'),
      hotspotVulnerability: document.getElementById('hotspotVulnerability'),
      hotspotRecommendations: document.getElementById('hotspotRecommendations'),
      openHotspotFile: document.getElementById('openHotspotFile')
    };

    let currentPage = 'data';
    let currentConfig = { serverUrl: '', projectKey: '', hasToken: false };
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
    let hasWorkspace = false;
    let dashboardLoading = true;
    const hiddenChartSeries = {
      types: new Set(),
      severity: new Set()
    };

    function navigate(page) {
      currentPage = page === 'configuration' ? 'configuration' : 'data';
      elements.dataPage.hidden = currentPage !== 'data';
      elements.configurationPage.hidden = currentPage !== 'configuration';
    }

    function isConfigured() {
      return Boolean(
        currentConfig.serverUrl &&
        currentConfig.projectKey &&
        currentConfig.hasToken
      );
    }

    function values() {
      return {
        folderUri: elements.folder.value,
        serverUrl: elements.serverUrl.value.trim(),
        token: elements.token.value,
        projectKey: elements.projectKey.value,
        branch: elements.branch.value.trim(),
        baseDir: elements.baseDir.value.trim()
      };
    }

    function setBusy(busy) {
      elements.loadProjects.disabled = busy;
      elements.save.disabled = busy;
      elements.refresh.disabled = busy;
      elements.syncEmpty.disabled = busy;
    }

    function setStatus(kind) {
      setBusy(kind === 'loading');
    }

    function setProjectOptions(projects, preferredKey) {
      loadedProjects = projects;
      const desiredKey = preferredKey || selectedProjectKey || elements.projectKey.value || currentConfig.projectKey;
      elements.projectKey.textContent = '';

      if (!projects.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No hay proyectos o aplicaciones visibles';
        elements.projectKey.appendChild(option);
        elements.projectKey.disabled = true;
        selectedProjectKey = '';
        return;
      }

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Selecciona un proyecto o aplicación';
      elements.projectKey.appendChild(placeholder);

      for (const project of projects) {
        const option = document.createElement('option');
        option.value = project.key;
        const type = project.qualifier === 'APP' ? 'Aplicación' : 'Proyecto';
        option.textContent = project.name + ' — ' + project.key + ' · ' + type;
        elements.projectKey.appendChild(option);
      }

      elements.projectKey.disabled = false;
      const exists = projects.some(project => project.key === desiredKey);
      elements.projectKey.value = exists ? desiredKey : '';
      selectedProjectKey = elements.projectKey.value;
    }

    function renderEmptyState() {
      elements.dataLoading.hidden = !dashboardLoading;
      if (dashboardLoading) {
        elements.results.hidden = true;
        elements.dataEmpty.hidden = true;
        return;
      }
      const configured = isConfigured();
      const showResults = hasWorkspace && configured && summaryVisible;
      elements.results.hidden = !showResults;
      elements.dataEmpty.hidden = showResults;

      if (showResults) {
        return;
      }

      elements.emptyProject.hidden = !configured;
      elements.emptyProject.textContent = configured ? currentConfig.projectKey : '';
      elements.syncEmpty.hidden = !configured;

      if (!hasWorkspace) {
        elements.emptyTitle.textContent = 'No hay ninguna carpeta abierta';
        elements.emptyText.textContent = 'Abre el proyecto local que quieres vincular con SonarQube y vuelve a SonarQube Dashboard.';
        elements.goConfiguration.textContent = 'Ver configuración';
        elements.syncEmpty.hidden = true;
      } else if (!configured) {
        elements.emptyTitle.textContent = 'No hay un proyecto vinculado';
        elements.emptyText.textContent = 'Configura el servidor, el token y el proyecto de SonarQube para cargar sus defectos.';
        elements.goConfiguration.textContent = 'Configurar proyecto';
      } else {
        elements.emptyTitle.textContent = 'El proyecto está vinculado';
        elements.emptyText.textContent = 'Sincroniza para cargar los defectos, el top de archivos y el top de reglas.';
        elements.goConfiguration.textContent = 'Revisar configuración';
      }
    }

    function setDashboardLoading(loading) {
      dashboardLoading = Boolean(loading);
      setBusy(dashboardLoading);
      renderEmptyState();
    }

    function renderState(message) {
      const folders = message.folders || [];
      hasWorkspace = folders.length > 0;
      elements.emptyWorkspace.hidden = hasWorkspace;
      elements.configurationContent.hidden = !hasWorkspace;

      if (!hasWorkspace) {
        currentConfig = { serverUrl: '', projectKey: '', branch: '', baseDir: '', hasToken: false };
        elements.configState.textContent = 'Sin carpeta abierta';
        renderEmptyState();
        return;
      }

      const folderChanged = currentFolderUri && currentFolderUri !== message.selectedFolderUri;
      currentFolderUri = message.selectedFolderUri;

      elements.folder.textContent = '';
      for (const folder of folders) {
        const option = document.createElement('option');
        option.value = folder.uri;
        option.textContent = folder.name;
        elements.folder.appendChild(option);
      }
      elements.folder.value = message.selectedFolderUri;
      elements.folderField.hidden = folders.length === 1;

      currentConfig = message.config || {};
      elements.serverUrl.value = currentConfig.serverUrl || '';
      elements.token.value = '';
      elements.token.placeholder = currentConfig.hasToken
        ? 'Token guardado · escribe otro para sustituirlo'
        : 'Introduce el token';
      elements.tokenHint.textContent = currentConfig.hasToken
        ? 'Hay un token guardado de forma segura para esta carpeta.'
        : 'El token se guardará en SecretStorage, no en settings.json.';
      elements.branch.value = currentConfig.branch || '';
      elements.baseDir.value = currentConfig.baseDir || '';
      elements.configState.textContent = currentConfig.projectKey
        ? 'Configurado: ' + currentConfig.projectKey
        : 'Sin configurar';

      if (folderChanged) {
        loadedProjects = [];
        selectedProjectKey = '';
        summaryVisible = false;
      }

      selectedProjectKey = currentConfig.projectKey || selectedProjectKey;

      if (loadedProjects.length && !folderChanged) {
        setProjectOptions(loadedProjects, selectedProjectKey);
      } else if (currentConfig.projectKey) {
        setProjectOptions([
          {
            key: currentConfig.projectKey,
            name: currentConfig.projectKey,
            qualifier: 'TRK'
          }
        ], currentConfig.projectKey);
      } else {
        elements.projectKey.textContent = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Introduce servidor y token para cargar la lista';
        elements.projectKey.appendChild(option);
        elements.projectKey.disabled = true;
      }

      renderEmptyState();
    }

    function renderConfigurationSaved(config) {
      currentConfig = config;
      selectedProjectKey = config.projectKey || selectedProjectKey;
      elements.projectKey.value = selectedProjectKey;
      elements.configState.textContent = selectedProjectKey
        ? 'Configurado: ' + selectedProjectKey
        : 'Sin configurar';
      elements.token.value = '';
      elements.token.placeholder = 'Token guardado · escribe otro para sustituirlo';
      elements.tokenHint.textContent = 'Hay un token guardado de forma segura para esta carpeta.';
      renderEmptyState();
    }

`;
}
