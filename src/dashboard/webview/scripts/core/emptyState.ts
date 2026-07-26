export const EMPTY_STATE_SCRIPT = `
    function renderEmptyState() {
      elements.dataLoading.hidden = !dashboardLoading;
      if (dashboardLoading) {
        elements.results.hidden = true;
        elements.dataEmpty.hidden = true;
        elements.analysisPanel.hidden = true;
        return;
      }

      const configured = isConfigured();
      const showResults = hasWorkspace && configured && summaryVisible;
      elements.results.hidden = !showResults;
      elements.dataEmpty.hidden = showResults;
      elements.analysisPanel.hidden = !showResults || !canAnalyze();

      if (showResults) {
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
