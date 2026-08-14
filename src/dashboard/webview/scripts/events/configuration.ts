export const CONFIGURATION_EVENTS_SCRIPT = `
    const configurationTabs = [
      {
        button: elements.configurationSonarTab,
        panel: elements.configurationSonarPanel
      },
      {
        button: elements.configurationModulesTab,
        panel: elements.configurationModulesPanel
      },
      {
        button: elements.configurationPipelineTab,
        panel: elements.configurationPipelinePanel
      },
      {
        button: elements.configurationLiveRemediationTab,
        panel: elements.configurationLiveRemediationPanel
      },
      {
        button: elements.configurationNotificationsTab,
        panel: elements.configurationNotificationsPanel
      }
    ];

    function visibleConfigurationTabs() {
      return configurationTabs.filter(entry => !entry.button.hidden);
    }

    function activateConfigurationTab(button, focus = false) {
      const requestedEntry = configurationTabs.find(
        entry => entry.button === button
      );
      const targetButton = requestedEntry && !requestedEntry.button.hidden
        ? button
        : elements.configurationModulesTab;

      for (const entry of configurationTabs) {
        const active = entry.button === targetButton && !entry.button.hidden;
        entry.button.classList.toggle('active', active);
        entry.button.setAttribute('aria-selected', String(active));
        entry.button.tabIndex = active ? 0 : -1;
        entry.panel.hidden = !active;
      }

      if (focus) {
        targetButton.focus();
      }
    }

    function updateModuleConfigurationVisibility() {
      const pipelineEnabled = elements.pipelineModuleEnabled.checked;
      const liveRemediationEnabled =
        elements.liveRemediationModuleEnabled.checked;

      elements.configurationPipelineTab.hidden = !pipelineEnabled;
      elements.configurationLiveRemediationTab.hidden =
        !liveRemediationEnabled;

      const activeEntry = configurationTabs.find(
        entry => entry.button.classList.contains('active')
      );
      if (activeEntry?.button.hidden) {
        activateConfigurationTab(elements.configurationModulesTab);
      }
    }

    for (const entry of configurationTabs) {
      entry.button.addEventListener('click', () => {
        if (!entry.button.hidden) {
          activateConfigurationTab(entry.button);
        }
      });
      entry.button.addEventListener('keydown', event => {
        const visibleTabs = visibleConfigurationTabs();
        const index = visibleTabs.findIndex(
          candidate => candidate.button === entry.button
        );
        if (index < 0) return;

        let nextIndex = index;
        if (event.key === 'ArrowRight') {
          nextIndex = (index + 1) % visibleTabs.length;
        } else if (event.key === 'ArrowLeft') {
          nextIndex = (index - 1 + visibleTabs.length) % visibleTabs.length;
        } else if (event.key === 'Home') {
          nextIndex = 0;
        } else if (event.key === 'End') {
          nextIndex = visibleTabs.length - 1;
        } else {
          return;
        }

        event.preventDefault();
        activateConfigurationTab(visibleTabs[nextIndex].button, true);
      });
    }

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
      if (selectedValue !== currentConfig.projectKey) {
        resetAnalysisScopeFields();
      }
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
      resetAnalysisScopeFields();
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

    elements.analysisInclusions.addEventListener('input', () => {
      clearAnalysisScopeSaveStatus();
    });

    elements.analysisExclusions.addEventListener('input', () => {
      clearAnalysisScopeSaveStatus();
    });

    elements.pipelineModuleEnabled.addEventListener('change', () => {
      currentConfig.pipelineModuleEnabled =
        elements.pipelineModuleEnabled.checked;
      updateModuleConfigurationVisibility();
      renderAnalysisState(currentAnalysisState);
      renderEmptyState();
      vscode.postMessage({
        type: 'setModule',
        moduleId: 'pipeline',
        moduleEnabled: elements.pipelineModuleEnabled.checked
      });
    });

    elements.liveRemediationModuleEnabled.addEventListener('change', () => {
      currentConfig.liveRemediationModuleEnabled =
        elements.liveRemediationModuleEnabled.checked;
      updateModuleConfigurationVisibility();
      vscode.postMessage({
        type: 'setModule',
        moduleId: 'liveRemediation',
        moduleEnabled: elements.liveRemediationModuleEnabled.checked
      });
    });

    elements.liveRemediationEnabled.addEventListener('change', () => {
      vscode.postMessage({
        type: 'setLiveRemediation',
        liveRemediationEnabled: elements.liveRemediationEnabled.checked
      });
    });

    elements.saveAnalysisScope.addEventListener('click', () => {
      setAnalysisScopeSaveStatus(
        'loading',
        'Guardando inclusiones y exclusiones…'
      );
      vscode.postMessage({
        type: 'saveAnalysisScope',
        folderUri: elements.folder.value,
        analysisInclusions: elements.analysisInclusions.value.trim(),
        analysisExclusions: elements.analysisExclusions.value.trim()
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

    elements.addPipelineStep.addEventListener('click', addConfigurationPipelineStep);

    elements.pipelineTemplate.addEventListener('change', () => {
      renderPipelineTemplateEditor(
        pipelineTemplateById(elements.pipelineTemplate.value)
      );
    });
    elements.newPipelineTemplate.addEventListener('click', createNewPipelineTemplateDraft);
    elements.addPipelineTemplateStep.addEventListener('click', addPipelineTemplateStep);
    elements.pipelineTemplateName.addEventListener('input', updatePipelineTemplateActions);
    elements.pipelineTemplateDescriptionInput.addEventListener(
      'input',
      updatePipelineTemplateActions
    );
    elements.savePipelineTemplate.addEventListener('click', () => {
      const draft = pipelineTemplateDraft();
      if (!draft.name) {
        setPipelineTemplateStatus('error', 'Introduce un nombre para la plantilla.');
        elements.pipelineTemplateName.focus();
        return;
      }
      if (!pipelineTemplateDraftIsValid()) {
        setPipelineTemplateStatus('error', 'Selecciona todos los pasos de la plantilla.');
        return;
      }
      setPipelineTemplateStatus('loading', 'Guardando plantilla…');
      vscode.postMessage({
        type: 'savePipelineTemplate',
        folderUri: elements.folder.value,
        templateId: draft.id || undefined,
        templateName: draft.name,
        templateDescription: draft.description,
        analysisSteps: draft.steps
      });
    });
    elements.deletePipelineTemplate.addEventListener('click', () => {
      const selected = pipelineTemplateById(elements.pipelineTemplate.value);
      if (!selected) return;
      setPipelineTemplateStatus(
        'loading',
        selected.builtin ? 'Restableciendo plantilla…' : 'Eliminando plantilla…'
      );
      vscode.postMessage({
        type: 'deletePipelineTemplate',
        folderUri: elements.folder.value,
        templateId: elements.pipelineTemplate.value
      });
    });
    elements.exportPipelineTemplate.addEventListener('click', () => {
      vscode.postMessage({
        type: 'exportPipelineTemplate',
        folderUri: elements.folder.value,
        templateId: elements.pipelineTemplate.value
      });
    });
    elements.importPipelineTemplate.addEventListener('click', () => {
      vscode.postMessage({
        type: 'importPipelineTemplate',
        folderUri: elements.folder.value
      });
    });

    elements.savePipeline.addEventListener('click', () => {
      syncConfigurationPipelineFields();
      setPipelineSaveStatus('loading', 'Guardando pipeline…');
      vscode.postMessage({
        type: 'savePipeline',
        folderUri: elements.folder.value,
        buildCommand: elements.buildCommand.value.trim(),
        testCommand: elements.testCommand.value.trim(),
        preAnalysisCommands: elements.preAnalysisCommands.value.trim(),
        postAnalysisCommands: elements.postAnalysisCommands.value.trim()
      });
    });
`;
