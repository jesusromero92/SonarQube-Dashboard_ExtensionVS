export const EMPTY_STATE_SCRIPT = `
    function formatSuccessfulSyncTime(value) {
      if (!value) {
        return '';
      }
      const parsed = new Date(value);
      if (!Number.isFinite(parsed.getTime())) {
        return '';
      }
      return 'Última sincronización correcta: ' + parsed.toLocaleString(dashboardLocale);
    }

    function renderSyncFailureState(configured, showResults) {
      const errors = Array.isArray(currentSummary.errors)
        ? currentSummary.errors.filter(Boolean)
        : [];
      const syncFailed = currentSummary.syncStatus === 'error' && errors.length > 0;
      const hasSuccessfulSync = currentSummary.hasSuccessfulSync === true;
      const unavailable = hasWorkspace && configured && summaryVisible && syncFailed && !hasSuccessfulSync;
      const stale = showResults && syncFailed && hasSuccessfulSync;

      elements.dataUnavailable.hidden = !unavailable;
      elements.dataStaleWarning.hidden = !stale;
      elements.unavailableProject.hidden = !currentConfig.projectKey;
      elements.unavailableProject.textContent = currentConfig.projectName || currentConfig.projectKey || '';
      elements.unavailableError.textContent = errors.join(' | ');
      elements.staleSyncError.textContent = errors.join(' | ');
      elements.staleSyncTime.textContent = stale
        ? formatSuccessfulSyncTime(currentSummary.lastSuccessfulAt)
        : '';

      return unavailable;
    }

    function renderEmptyState() {
      elements.dataLoading.hidden = !dashboardLoading;
      if (dashboardLoading) {
        elements.results.hidden = true;
        elements.dataEmpty.hidden = true;
        elements.dataUnavailable.hidden = true;
        elements.dataStaleWarning.hidden = true;
        elements.analysisPanel.hidden = true;
        return;
      }

      const configured = isConfigured();
      const syncFailedWithoutData =
        currentSummary.syncStatus === 'error' &&
        currentSummary.hasSuccessfulSync !== true;
      const showResults =
        hasWorkspace && configured && summaryVisible && !syncFailedWithoutData;
      const unavailable = renderSyncFailureState(configured, showResults);

      elements.results.hidden = !showResults;
      elements.dataEmpty.hidden = showResults || unavailable;
      elements.analysisPanel.hidden = !showResults || !canAnalyze();

      if (showResults || unavailable) {
        return;
      }

      elements.emptyProject.hidden = !configured;
      elements.emptyProject.textContent = configured ? currentConfig.projectKey : '';
      elements.analyzeEmpty.hidden = !configured || !canAnalyze();
      elements.syncEmpty.hidden = !configured;

      if (!hasWorkspace) {
        elements.emptyTitle.textContent = 'No hay ninguna carpeta abierta';
        elements.emptyText.textContent = 'Abre el proyecto local que quieres vincular con SonarQube y vuelve a SonarQube Dashboard.';
        elements.goConfiguration.textContent = 'Ver configuración';
        elements.analyzeEmpty.hidden = true;
        elements.syncEmpty.hidden = true;
      } else if (!configured) {
        elements.emptyTitle.textContent = 'No hay un proyecto vinculado';
        elements.emptyText.textContent = 'Configura el servidor, el token y el proyecto de SonarQube para cargar sus defectos.';
        elements.goConfiguration.textContent = 'Configurar proyecto';
      } else {
        elements.emptyTitle.textContent = 'El proyecto está vinculado';
        elements.emptyText.textContent = 'Analiza el repositorio para enviar un nuevo análisis a SonarQube o sincroniza los datos existentes.';
        elements.goConfiguration.textContent = 'Revisar configuración';
      }
    }

    function setDashboardLoading(loading) {
      dashboardLoading = Boolean(loading);
      setBusy(dashboardLoading);
      renderEmptyState();
    }
`;
