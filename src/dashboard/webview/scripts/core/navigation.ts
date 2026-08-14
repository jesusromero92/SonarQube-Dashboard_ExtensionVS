export const NAVIGATION_CORE_SCRIPT = `
    function navigate(page) {
      const allowedPages = new Set(['data', 'configuration', 'history', 'diagnostics']);
      currentPage = allowedPages.has(page) ? page : 'data';
      elements.dataPage.hidden = currentPage !== 'data';
      elements.configurationPage.hidden = currentPage !== 'configuration';
      elements.historyPage.hidden = currentPage !== 'history';
      elements.diagnosticsPage.hidden = currentPage !== 'diagnostics';
      if (currentPage === 'history') {
        const hasRenderedExecution = Boolean(
          elements.historyList &&
          !elements.historyList.hidden &&
          elements.historyList.dataset.historyEntryId
        );
        elements.historyLoading.hidden = hasRenderedExecution;
        vscode.postMessage({ type: 'loadPipelineHistory', folderUri: currentFolderUri });
      } else if (currentPage === 'diagnostics') {
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
      return currentConfig.pipelineModuleEnabled !== false &&
        currentConfig.analysisPermission !== 'denied';
    }
`;
