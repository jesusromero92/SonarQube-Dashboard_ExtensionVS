export const CONFIGURATION_EVENTS_SCRIPT = `
    const pendingModuleChanges = new Set();
    const configurationTabs = [...document.querySelectorAll('.configuration-tabs [role="tab"][aria-controls]')]
      .map(button => ({
        button,
        panel: document.getElementById(button.getAttribute('aria-controls'))
      }))
      .filter(entry => entry.panel);

    function visibleConfigurationTabs() {
      return configurationTabs.filter(entry => !entry.button.hidden);
    }

    function activateConfigurationTab(button, focus = false) {
      const requestedEntry = configurationTabs.find(entry => entry.button === button);
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

      if (focus) targetButton.focus();
    }

    function restoreConfigurationTab(panelId) {
      const entry = configurationTabs.find(candidate => candidate.panel.id === panelId);
      if (entry && !entry.button.hidden) activateConfigurationTab(entry.button);
    }

    function updateModuleConfigurationVisibility() {
      for (const tab of document.querySelectorAll('[data-module-tab]')) {
        const moduleId = tab.dataset.moduleTab;
        const toggle = document.querySelector('[data-module-toggle="' + moduleId + '"]');
        tab.hidden = Boolean(toggle && !toggle.checked);
      }

      const activeEntry = configurationTabs.find(
        entry => entry.button.classList.contains('active')
      );
      if (activeEntry?.button.hidden) {
        activateConfigurationTab(elements.configurationModulesTab);
      }
    }

    function syncModuleConfigurationState(config = currentConfig) {
      for (const toggle of document.querySelectorAll('[data-module-toggle]')) {
        const moduleId = toggle.dataset.moduleToggle;
        if (!moduleId) continue;
        const enabled = config?.[moduleId + 'ModuleEnabled'];
        if (typeof enabled === 'boolean') {
          toggle.checked = enabled;
        }
        toggle.disabled = false;
        pendingModuleChanges.delete(moduleId);
      }
      updateModuleConfigurationVisibility();
    }

    for (const entry of configurationTabs) {
      entry.button.addEventListener('click', () => {
        if (!entry.button.hidden) activateConfigurationTab(entry.button);
      });
      entry.button.addEventListener('keydown', event => {
        const visibleTabs = visibleConfigurationTabs();
        const index = visibleTabs.findIndex(candidate => candidate.button === entry.button);
        if (index < 0) return;

        let nextIndex = index;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % visibleTabs.length;
        else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + visibleTabs.length) % visibleTabs.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = visibleTabs.length - 1;
        else return;

        event.preventDefault();
        activateConfigurationTab(visibleTabs[nextIndex].button, true);
      });
    }

    for (const toggle of document.querySelectorAll('[data-module-toggle]')) {
      toggle.addEventListener('change', () => {
        const moduleId = toggle.dataset.moduleToggle;
        if (!moduleId) return;
        const confirmedEnabled = currentConfig?.[moduleId + 'ModuleEnabled'] === true;
        const requestedEnabled = toggle.checked;

        // A checkbox is only a request. Keep showing the last confirmed state
        // until the extension host accepts the modal confirmation and replies.
        toggle.checked = confirmedEnabled;
        if (requestedEnabled === confirmedEnabled || pendingModuleChanges.has(moduleId)) return;
        toggle.disabled = true;
        pendingModuleChanges.add(moduleId);
        vscode.postMessage({
          type: 'setModule',
          moduleId,
          moduleEnabled: requestedEnabled,
          configurationTab: configurationTabs.find(
            entry => entry.button.classList.contains('active')
          )?.panel.id
        });
      });
    }

    elements.goConfiguration.addEventListener('click', () => {
      vscode.postMessage({ type: 'navigate', page: 'configuration' });
    });
    elements.syncEmpty.addEventListener('click', requestRefresh);

    elements.language.addEventListener('change', () => {
      vscode.postMessage({ type: 'setLanguage', language: elements.language.value });
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
      vscode.postMessage({ type: 'selectFolder', folderUri: elements.folder.value });
    });

    elements.projectKey.addEventListener('change', () => {
      const selectedValue = elements.projectKey.value;
      if (
        selectedValue === CREATE_PROJECT_OPTION ||
        selectedValue === CREATE_APPLICATION_OPTION
      ) {
        const kind = selectedValue === CREATE_APPLICATION_OPTION ? 'application' : 'project';
        elements.projectKey.value = '';
        selectedProjectKey = '';
        refreshSelectDropdown(elements.projectKey);
        updateSaveAvailability();
        openCreateComponentDialog(kind);
        return;
      }

      selectedProjectKey = selectedValue;
      if (selectedValue !== currentConfig.projectKey) {
        runDashboardModuleHooks('resetConnectionScopedFields');
      }
      updateSaveAvailability();
    });

    function markConnectionDraftDirty() {
      connectionDraftDirty = true;
      connectionDraftFolderUri = currentFolderUri;
      connectionValidated = false;
      currentConfig.sonarCompatibility = undefined;
      creationCapabilities = { canCreateProjects: false, canCreateApplications: false };
      elements.sonarCompatibility.hidden = true;
      restoreProjectOptions();
      clearStatus();
      updateSaveAvailability();
    }

    elements.serverUrl.addEventListener('input', markConnectionDraftDirty);
    elements.token.addEventListener('input', markConnectionDraftDirty);

    elements.loadProjects.addEventListener('click', () => {
      connectionAttemptPending = true;
      connectionDraftDirty = true;
      connectionDraftFolderUri = currentFolderUri;
      connectionValidated = false;
      selectedProjectKey = '';
      currentConfig.projectKey = '';
      currentConfig.projectName = '';
      runDashboardModuleHooks('resetConnectionScopedFields');
      summaryVisible = false;
      elements.configState.textContent = 'Sin configurar';
      updateSaveAvailability();
      renderEmptyState();
      resetProjectOptionsForDisconnectedConnection();
      setConnectionBusy(true);
      elements.sonarCompatibility.hidden = true;
      vscode.postMessage({ type: 'loadProjects', ...values() });
    });

    elements.save.addEventListener('click', () => {
      selectedProjectKey = elements.projectKey.value;
      setStatus('loading', 'Guardando configuración…');
      vscode.postMessage({ type: 'save', ...values() });
    });
`;
