export const NAVIGATION_CORE_SCRIPT = `
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

    function canAnalyze() {
      return currentConfig.analysisPermission !== 'denied';
    }
`;
