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
      connectionDraftDirty = false;
      connectionDraftFolderUri = '';
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
      const selectedValue = elements.projectKey.value;
      if (
        selectedValue === CREATE_PROJECT_OPTION ||
        selectedValue === CREATE_APPLICATION_OPTION
      ) {
        const kind = selectedValue === CREATE_APPLICATION_OPTION
          ? 'application'
          : 'project';
        elements.projectKey.value = '';
        selectedProjectKey = '';
        refreshSelectDropdown(elements.projectKey);
        updateSaveAvailability();
        openCreateComponentDialog(kind);
        return;
      }

      selectedProjectKey = selectedValue;
      updateSaveAvailability();
    });

    function markConnectionDraftDirty() {
      connectionDraftDirty = true;
      connectionDraftFolderUri = currentFolderUri;
      connectionValidated = false;
      currentConfig.sonarCompatibility = undefined;
      creationCapabilities = {
        canCreateProjects: false,
        canCreateApplications: false
      };
      elements.sonarCompatibility.hidden = true;
      restoreProjectOptions();
      clearStatus();
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
      connectionDraftFolderUri = currentFolderUri;
      connectionValidated = false;
      selectedProjectKey = '';
      currentConfig.projectKey = '';
      currentConfig.projectName = '';
      summaryVisible = false;
      elements.configState.textContent = 'Sin configurar';
      updateSaveAvailability();
      renderEmptyState();
      resetProjectOptionsForDisconnectedConnection();
      setConnectionBusy(true);
      elements.sonarCompatibility.hidden = true;
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
