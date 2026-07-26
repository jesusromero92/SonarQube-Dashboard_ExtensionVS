export const CONFIGURATION_CORE_SCRIPT = `
    function values() {
      return {
        folderUri: elements.folder.value,
        serverUrl: elements.serverUrl.value.trim(),
        token: elements.token.value,
        projectKey: elements.projectKey.value,
        branch: elements.branch.value.trim(),
        baseDir: elements.baseDir.value.trim(),
        scannerMode: elements.scannerMode.value,
        buildCommand: elements.buildCommand.value.trim(),
        customScannerCommand: elements.customScannerCommand.value.trim(),
        notificationsEnabled: elements.notificationsEnabled.checked,
        significantIncreasePercent: Number(elements.significantIncreasePercent.value) || 20,
        significantIncreaseMinimum: Number(elements.significantIncreaseMinimum.value) || 5
      };
    }

    function setBusy(busy) {
      elements.loadProjects.disabled = busy;
      elements.save.disabled = busy;
      elements.refresh.disabled = busy;
      elements.syncEmpty.disabled = busy;
    }

    function setStatus(kind) {
      setBusy(kind === 'loading');
    }

    function setProjectOptions(projects, preferredKey) {
      loadedProjects = projects;
      const desiredKey =
        preferredKey ||
        selectedProjectKey ||
        elements.projectKey.value ||
        currentConfig.projectKey;

      elements.projectKey.textContent = '';

      if (!projects.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No hay proyectos o aplicaciones visibles';
        elements.projectKey.appendChild(option);
        elements.projectKey.disabled = true;
        selectedProjectKey = '';
        return;
      }

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Selecciona un proyecto o aplicación';
      elements.projectKey.appendChild(placeholder);

      for (const project of projects) {
        const option = document.createElement('option');
        option.value = project.key;
        const type = project.qualifier === 'APP' ? 'Aplicación' : 'Proyecto';
        option.textContent = project.name + ' — ' + project.key + ' · ' + type;
        elements.projectKey.appendChild(option);
      }

      elements.projectKey.disabled = false;
      const exists = projects.some(project => project.key === desiredKey);
      elements.projectKey.value = exists ? desiredKey : '';
      selectedProjectKey = elements.projectKey.value;
    }

    function renderState(message) {
      const folders = message.folders || [];
      elements.language.value = message.language || dashboardLanguage;
      hasWorkspace = folders.length > 0;
      elements.emptyWorkspace.hidden = hasWorkspace;
      elements.configurationContent.hidden = !hasWorkspace;

      if (!hasWorkspace) {
        currentConfig = {
          serverUrl: '',
          projectKey: '',
          branch: '',
          baseDir: '',
          hasToken: false,
          scannerMode: 'auto',
          buildCommand: '',
          customScannerCommand: ''
        };
        elements.configState.textContent = 'Sin carpeta abierta';
        renderEmptyState();
        return;
      }

      workspaceTrusted = message.workspaceTrusted !== false;
      const folderChanged =
        currentFolderUri &&
        currentFolderUri !== message.selectedFolderUri;
      currentFolderUri = message.selectedFolderUri;

      elements.folder.textContent = '';
      for (const folder of folders) {
        const option = document.createElement('option');
        option.value = folder.uri;
        option.textContent = folder.name;
        elements.folder.appendChild(option);
      }
      elements.folder.value = message.selectedFolderUri;
      elements.folderField.hidden = folders.length === 1;

      currentConfig = message.config || {};
      elements.serverUrl.value = currentConfig.serverUrl || '';
      elements.token.value = '';
      elements.token.placeholder = currentConfig.hasToken
        ? 'Token guardado · escribe otro para sustituirlo'
        : 'Introduce el token';
      elements.tokenHint.textContent = currentConfig.hasToken
        ? currentConfig.analysisPermission === 'denied'
          ? 'El token puede consultar datos, pero no tiene permiso para ejecutar análisis en este proyecto.'
          : 'Hay un token guardado de forma segura para esta carpeta.'
        : 'El token se guardará en SecretStorage, no en settings.json.';
      elements.branch.value = currentConfig.branch || '';
      elements.baseDir.value = currentConfig.baseDir || '';
      elements.scannerMode.value = currentConfig.scannerMode || 'auto';
      elements.buildCommand.value = currentConfig.buildCommand || '';
      elements.customScannerCommand.value = currentConfig.customScannerCommand || '';
      elements.notificationsEnabled.checked = currentConfig.notificationsEnabled !== false;
      elements.significantIncreasePercent.value = String(
        currentConfig.significantIncreasePercent || 20
      );
      elements.significantIncreaseMinimum.value = String(
        currentConfig.significantIncreaseMinimum || 5
      );
      elements.customScannerField.hidden = elements.scannerMode.value !== 'custom';
      elements.configState.textContent = currentConfig.projectKey
        ? 'Configurado: ' + currentConfig.projectKey
        : 'Sin configurar';

      if (folderChanged) {
        loadedProjects = [];
        selectedProjectKey = '';
        summaryVisible = false;
      }

      selectedProjectKey = currentConfig.projectKey || selectedProjectKey;

      if (loadedProjects.length && !folderChanged) {
        setProjectOptions(loadedProjects, selectedProjectKey);
      } else if (currentConfig.projectKey) {
        setProjectOptions(
          [
            {
              key: currentConfig.projectKey,
              name: currentConfig.projectKey,
              qualifier: 'TRK'
            }
          ],
          currentConfig.projectKey
        );
      } else {
        elements.projectKey.textContent = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Introduce servidor y token para cargar la lista';
        elements.projectKey.appendChild(option);
        elements.projectKey.disabled = true;
      }

      renderAnalysisState(currentAnalysisState);
      renderEmptyState();
    }

    function renderConfigurationSaved(config) {
      currentConfig = config;
      selectedProjectKey = config.projectKey || selectedProjectKey;
      elements.projectKey.value = selectedProjectKey;
      elements.configState.textContent = selectedProjectKey
        ? 'Configurado: ' + selectedProjectKey
        : 'Sin configurar';
      elements.token.value = '';
      elements.token.placeholder = 'Token guardado · escribe otro para sustituirlo';
      elements.tokenHint.textContent =
        'Hay un token guardado de forma segura para esta carpeta.';
      if (config.analysisPermission === 'denied') {
        elements.tokenHint.textContent =
          'El token puede consultar datos, pero no tiene permiso para ejecutar análisis en este proyecto.';
      }
      elements.scannerMode.value = config.scannerMode || 'auto';
      elements.buildCommand.value = config.buildCommand || '';
      elements.customScannerCommand.value = config.customScannerCommand || '';
      elements.customScannerField.hidden = elements.scannerMode.value !== 'custom';
      renderEmptyState();
    }
`;
