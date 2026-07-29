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
    });

    function markConnectionDraftDirty() {
      currentConfig.sonarCompatibility = undefined;
      currentConfig.hasToken = false;
      elements.sonarCompatibility.hidden = true;
      elements.configState.textContent = 'Sin configurar';
      renderEmptyState();
      if (!connectionDraftDirty) {
        connectionDraftDirty = true;
        vscode.postMessage({
          type: 'connectionDraftChanged',
          folderUri: currentFolderUri
        });
      }
    }

    elements.serverUrl.addEventListener('input', () => {
      markConnectionDraftDirty();
    });

    elements.token.addEventListener('input', () => {
      markConnectionDraftDirty();
    });

    elements.loadProjects.addEventListener('click', () => {
      selectedProjectKey = '';
      currentConfig.projectKey = '';
      currentConfig.projectName = '';
      elements.projectKey.textContent = '';
      const loadingOption = document.createElement('option');
      loadingOption.value = '';
      loadingOption.textContent =
        'Consultando proyectos y aplicaciones visibles…';
      elements.projectKey.appendChild(loadingOption);
      elements.projectKey.disabled = true;
      elements.configState.textContent = 'Sin configurar';
      renderEmptyState();
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
