export const CONFIGURATION_EVENTS_SCRIPT = `
    elements.goConfiguration.addEventListener('click', () => {
      vscode.postMessage({
        type: 'navigate',
        page: 'configuration'
      });
    });
    elements.analyzeEmpty.addEventListener('click', requestAnalysis);
    elements.syncEmpty.addEventListener('click', requestRefresh);

    elements.language.addEventListener('change', () => {
      vscode.postMessage({
        type: 'setLanguage',
        language: elements.language.value
      });
    });

    elements.folder.addEventListener('change', () => {
      currentFolderUri = elements.folder.value;
      connectionValidated = false;
      updateSaveAvailability();
      loadedProjects = [];
      selectedProjectKey = '';
      summaryVisible = false;
      renderEmptyState();
      vscode.postMessage({
        type: 'selectFolder',
        folderUri: elements.folder.value
      });
    });

    elements.scannerMode.addEventListener('change', () => {
      elements.customScannerField.hidden =
        elements.scannerMode.value !== 'custom';
    });

    elements.projectKey.addEventListener('change', () => {
      selectedProjectKey = elements.projectKey.value;
      updateSaveAvailability();
    });

    function markConnectionDraftDirty() {
      connectionDraftDirty = true;
      connectionValidated = false;
      currentConfig.sonarCompatibility = undefined;
      elements.sonarCompatibility.hidden = true;
      updateSaveAvailability();
    }

    elements.serverUrl.addEventListener('input', () => {
      markConnectionDraftDirty();
    });

    elements.token.addEventListener('input', () => {
      markConnectionDraftDirty();
    });

    elements.loadProjects.addEventListener('click', () => {
      connectionAttemptPending = true;
      connectionDraftDirty = true;
      connectionValidated = false;
      selectedProjectKey = '';
      currentConfig.projectKey = '';
      currentConfig.projectName = '';
      summaryVisible = false;
      elements.configState.textContent = 'Sin configurar';
      updateSaveAvailability();
      renderEmptyState();
      elements.projectKey.textContent = '';
      const loadingOption = document.createElement('option');
      loadingOption.value = '';
      loadingOption.textContent =
        'Consultando proyectos y aplicaciones visibles…';
      elements.projectKey.appendChild(loadingOption);
      elements.projectKey.disabled = true;
      setStatus(
        'loading',
        'Consultando proyectos y aplicaciones visibles…'
      );
      renderSonarCompatibility(undefined, true);
      vscode.postMessage({
        type: 'loadProjects',
        ...values()
      });
    });

    elements.save.addEventListener('click', () => {
      selectedProjectKey = elements.projectKey.value;
      setStatus('loading', 'Guardando configuración…');
      vscode.postMessage({
        type: 'save',
        ...values()
      });
    });
`;
