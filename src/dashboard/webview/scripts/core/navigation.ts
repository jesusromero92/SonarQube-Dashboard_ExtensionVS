export const NAVIGATION_CORE_SCRIPT = `
    function navigate(page) {
      const corePages = new Set(['data', 'configuration', 'diagnostics']);
      const modulePage = dashboardModuleHooks.page.has(page);
      currentPage = corePages.has(page) || modulePage ? page : 'data';
      elements.dataPage.hidden = currentPage !== 'data';
      elements.configurationPage.hidden = currentPage !== 'configuration';
      elements.diagnosticsPage.hidden = currentPage !== 'diagnostics';
      for (const [modulePageName, handler] of dashboardModuleHooks.page.entries()) {
        const pageElement = elements[modulePageName + 'Page'];
        if (pageElement) pageElement.hidden = currentPage !== modulePageName;
        if (currentPage === modulePageName) handler();
      }
      if (currentPage === 'diagnostics') {
        elements.diagnosticsLoading.hidden = false;
        elements.diagnosticsContent.hidden = true;
        vscode.postMessage({ type: 'loadDiagnostics', folderUri: currentFolderUri });
      }
    }

    function isConfigured() {
      return Boolean(
        currentConfig.serverUrl &&
        currentConfig.projectKey &&
        currentConfig.hasToken
      );
    }

    function canAnalyze() {
      return moduleCapabilityAvailable('analysis');
    }
`;
