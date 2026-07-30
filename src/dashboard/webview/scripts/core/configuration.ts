export const CONFIGURATION_CORE_SCRIPT = `
    const CREATE_PROJECT_OPTION = '__create_project__';
    const CREATE_APPLICATION_OPTION = '__create_application__';

    function values() {
      return {
        folderUri: elements.folder.value,
        serverUrl: elements.serverUrl.value.trim(),
        token: elements.token.value,
        projectKey: elements.projectKey.value,
        projectName:
          elements.projectKey.selectedOptions[0]?.dataset.projectName ||
          currentConfig.projectName ||
          elements.projectKey.value,
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

    function canSynchronizeConfiguration() {
      return Boolean(
        hasWorkspace &&
        connectionValidated &&
        !elements.projectKey.disabled &&
        elements.projectKey.value
      );
    }

    function updateSaveAvailability() {
      elements.save.disabled =
        configurationBusy || !canSynchronizeConfiguration();
    }

    function setBusy(busy) {
      configurationBusy = Boolean(busy);
      elements.loadProjects.disabled = configurationBusy;
      elements.refresh.disabled = configurationBusy;
      elements.syncEmpty.disabled = configurationBusy;
      updateSaveAvailability();
    }

    function setConnectionBusy(busy) {
      elements.loadProjects.disabled = Boolean(busy);
    }

    function clearStatus() {
      elements.connectionStatus.hidden = true;
      elements.connectionStatus.textContent = '';
      elements.connectionStatus.className = 'connection-status';
      elements.connectionStatus.setAttribute('role', 'status');
      elements.connectionStatus.setAttribute('aria-live', 'polite');
    }

    function setStatus(kind, message = '') {
      setBusy(kind === 'loading');
      if (!message) {
        clearStatus();
        return;
      }

      elements.connectionStatus.hidden = false;
      elements.connectionStatus.textContent = message;
      elements.connectionStatus.className =
        'connection-status connection-status--' + kind;
      elements.connectionStatus.setAttribute(
        'role',
        kind === 'error' ? 'alert' : 'status'
      );
      elements.connectionStatus.setAttribute(
        'aria-live',
        kind === 'error' ? 'assertive' : 'polite'
      );
    }

    function refreshConfigurationDropdowns(rebuild = false) {
      refreshSelectDropdown(elements.language, rebuild);
      refreshSelectDropdown(elements.folder, rebuild);
      refreshSelectDropdown(elements.projectKey, rebuild);
      refreshSelectDropdown(elements.scannerMode, rebuild);
    }

    function renderSonarCompatibility(compatibility, loading) {
      const hasConnection = Boolean(
        elements.serverUrl.value.trim() &&
        (elements.token.value || currentConfig.hasToken)
      );
      elements.sonarCompatibility.hidden =
        !hasConnection && !compatibility && !loading;

      if (loading) {
        elements.sonarVersion.textContent = 'Detectando…';
        elements.sonarProfile.textContent = '—';
        elements.sonarProfileProvisional.hidden = true;
        elements.sonarProfileFallback.hidden = true;
        elements.sonarCompatibilityHint.textContent =
          'Consultando la compatibilidad del servidor…';
        return;
      }

      if (!compatibility) {
        elements.sonarVersion.textContent = 'No disponible';
        elements.sonarProfile.textContent = '—';
        elements.sonarProfileProvisional.hidden = true;
        elements.sonarProfileFallback.hidden = true;
        elements.sonarCompatibilityHint.textContent =
          hasConnection
            ? 'No se pudo consultar la compatibilidad del servidor.'
            : '';
        return;
      }

      elements.sonarCompatibility.hidden = false;
      elements.sonarVersion.textContent =
        compatibility.version || 'No disponible';
      elements.sonarProfile.textContent =
        (compatibility.appliedProfiles || [compatibility.profile])
          .filter(Boolean)
          .join(' / ') || '—';
      elements.sonarProfileProvisional.hidden =
        !compatibility.provisional;
      elements.sonarProfileFallback.hidden =
        !compatibility.fallbackApplied;

      if (compatibility.fallbackApplied) {
        elements.sonarCompatibilityHint.textContent =
          'SonarQube rechazó parámetros del perfil base; el fallback se recuerda para los endpoints afectados.';
      } else if (compatibility.provisional) {
        elements.sonarCompatibilityHint.textContent =
          compatibility.version
            ? 'La versión no tiene un perfil exacto; se aplica el perfil conocido más cercano.'
            : 'No se pudo detectar la versión; se aplica el perfil de compatibilidad por defecto.';
      } else if (compatibility.capabilitiesAvailable) {
        elements.sonarCompatibilityHint.textContent =
          'Parámetros verificados con la API del servidor.';
      } else {
        elements.sonarCompatibilityHint.textContent =
          'Perfil seleccionado a partir de la versión detectada.';
      }
    }

    function renderSonarUnavailable(message) {
      currentConfig.sonarCompatibility = undefined;
      connectionValidated = false;
      elements.sonarCompatibility.hidden = true;
      elements.sonarVersion.textContent = 'No disponible';
      elements.sonarProfile.textContent = '—';
      elements.sonarProfileProvisional.hidden = true;
      elements.sonarProfileFallback.hidden = true;
      elements.sonarCompatibilityHint.textContent = '';
      setStatus(
        'error',
        message ||
          'SonarQube no está disponible. Comprueba que el servidor esté iniciado y que la URL sea accesible.'
      );
      updateSaveAvailability();
    }

    function setProjectOptions(
      projects,
      preferredKey,
      preserveSelection = true,
      capabilities = creationCapabilities
    ) {
      loadedProjects = projects;
      creationCapabilities = capabilities || {
        canCreateProjects: false,
        canCreateApplications: false
      };
      const desiredKey = preserveSelection
        ? preferredKey ||
          selectedProjectKey ||
          elements.projectKey.value ||
          currentConfig.projectKey
        : '';

      elements.projectKey.textContent = '';

      const canCreate = Boolean(
        creationCapabilities.canCreateProjects ||
        creationCapabilities.canCreateApplications
      );
      if (!projects.length && !canCreate) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No hay proyectos o aplicaciones visibles';
        elements.projectKey.appendChild(option);
        elements.projectKey.disabled = true;
        selectedProjectKey = '';
        refreshSelectDropdown(elements.projectKey, true);
        updateSaveAvailability();
        return;
      }

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Selecciona un proyecto o aplicación';
      elements.projectKey.appendChild(placeholder);

      for (const project of projects) {
        const option = document.createElement('option');
        option.value = project.key;
        option.dataset.projectName = project.name || project.key;
        const type = project.qualifier === 'APP' ? 'Aplicación' : 'Proyecto';
        option.textContent = project.name + ' — ' + project.key + ' · ' + type;
        elements.projectKey.appendChild(option);
      }

      if (creationCapabilities.canCreateProjects) {
        const createProject = document.createElement('option');
        createProject.value = CREATE_PROJECT_OPTION;
        createProject.textContent = '＋ Crear proyecto';
        elements.projectKey.appendChild(createProject);
      }
      if (creationCapabilities.canCreateApplications) {
        const createApplication = document.createElement('option');
        createApplication.value = CREATE_APPLICATION_OPTION;
        createApplication.textContent = '＋ Crear aplicación';
        elements.projectKey.appendChild(createApplication);
      }

      elements.projectKey.disabled = false;
      const exists = projects.some(project => project.key === desiredKey);
      elements.projectKey.value = exists ? desiredKey : '';
      selectedProjectKey = elements.projectKey.value;
      refreshSelectDropdown(elements.projectKey, true);
      updateSaveAvailability();
    }

    function resetProjectOptionsForDisconnectedConnection() {
      loadedProjects = [];
      creationCapabilities = {
        canCreateProjects: false,
        canCreateApplications: false
      };
      selectedProjectKey = '';
      currentConfig.projectKey = '';
      currentConfig.projectName = '';

      if (
        elements.projectKey.disabled &&
        elements.projectKey.options.length === 1 &&
        !elements.projectKey.value
      ) {
        updateSaveAvailability();
        return;
      }

      elements.projectKey.textContent = '';

      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Introduce servidor y token para cargar la lista';
      elements.projectKey.appendChild(option);
      elements.projectKey.disabled = true;
      refreshSelectDropdown(elements.projectKey, true);
      updateSaveAvailability();
    }

    function restoreProjectOptions() {
      if (loadedProjects.length) {
        setProjectOptions(
          loadedProjects,
          selectedProjectKey || currentConfig.projectKey
        );
        return;
      }

      if (currentConfig.projectKey) {
        setProjectOptions(
          [
            {
              key: currentConfig.projectKey,
              name: currentConfig.projectName || currentConfig.projectKey,
              qualifier: 'TRK'
            }
          ],
          currentConfig.projectKey
        );
        return;
      }

      elements.projectKey.textContent = '';
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Introduce servidor y token para cargar la lista';
      elements.projectKey.appendChild(option);
      elements.projectKey.disabled = true;
      refreshSelectDropdown(elements.projectKey, true);
      updateSaveAvailability();
    }

    function renderState(message) {
      const folders = message.folders || [];
      const incomingFolderUri = message.selectedFolderUri || '';
      const folderChanged = Boolean(
        currentFolderUri && currentFolderUri !== incomingFolderUri
      );
      const preserveConnectionDraft = Boolean(
        !folderChanged &&
        connectionDraftDirty &&
        connectionDraftFolderUri === incomingFolderUri
      );
      const draftServerUrl = preserveConnectionDraft
        ? elements.serverUrl.value
        : '';
      const draftToken = preserveConnectionDraft
        ? elements.token.value
        : '';
      const draftConnectionValidated = preserveConnectionDraft &&
        connectionValidated;
      const draftCompatibility = preserveConnectionDraft
        ? currentConfig.sonarCompatibility
        : undefined;
      const draftCreationCapabilities = preserveConnectionDraft
        ? creationCapabilities
        : undefined;

      connectionDraftDirty = Boolean(message.connectionDraftDirty) ||
        preserveConnectionDraft;
      connectionDraftFolderUri = connectionDraftDirty
        ? incomingFolderUri
        : '';

      elements.language.value = message.language || dashboardLanguage;
      hasWorkspace = folders.length > 0;
      elements.emptyWorkspace.hidden = hasWorkspace;
      elements.configurationContent.hidden = !hasWorkspace;

      if (!hasWorkspace) {
        currentConfig = {
          serverUrl: '',
          projectKey: '',
          projectName: '',
          branch: '',
          baseDir: '',
          hasToken: false,
          scannerMode: 'auto',
          buildCommand: '',
          customScannerCommand: ''
        };
        connectionDraftDirty = false;
        connectionDraftFolderUri = '';
        connectionValidated = false;
        elements.folder.disabled = true;
        elements.configState.textContent = 'Sin carpeta abierta';
        refreshConfigurationDropdowns(true);
        updateSaveAvailability();
        renderEmptyState();
        return;
      }

      workspaceTrusted = message.workspaceTrusted !== false;
      currentFolderUri = incomingFolderUri;

      elements.folder.textContent = '';
      for (const folder of folders) {
        const option = document.createElement('option');
        option.value = folder.uri;
        option.textContent = folder.name;
        elements.folder.appendChild(option);
      }
      elements.folder.disabled = false;
      elements.folder.value = incomingFolderUri;
      elements.folderField.hidden = folders.length === 1;

      currentConfig = message.config || {};
      if (preserveConnectionDraft) {
        currentConfig = {
          ...currentConfig,
          serverUrl: draftServerUrl,
          hasToken: currentConfig.hasToken || Boolean(draftToken) || draftConnectionValidated,
          sonarCompatibility: draftCompatibility
        };
      }
      creationCapabilities = draftCreationCapabilities ||
        message.creationCapabilities || {
          canCreateProjects: false,
          canCreateApplications: false
        };
      connectionValidated = Boolean(
        draftConnectionValidated ||
        (!connectionDraftDirty &&
          currentConfig.serverUrl &&
          currentConfig.hasToken)
      );
      elements.serverUrl.value = preserveConnectionDraft
        ? draftServerUrl
        : currentConfig.serverUrl || '';
      elements.token.value = preserveConnectionDraft ? draftToken : '';
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
      renderSonarCompatibility(
        currentConfig.sonarCompatibility,
        Boolean(
          !connectionDraftDirty &&
          currentConfig.serverUrl &&
          currentConfig.hasToken &&
          !currentConfig.sonarCompatibility
        )
      );
      elements.configState.textContent = currentConfig.projectKey
        ? 'Configurado: ' + currentConfig.projectKey
        : 'Sin configurar';

      if (folderChanged) {
        loadedProjects = [];
        selectedProjectKey = '';
        summaryVisible = false;
        connectionDraftDirty = false;
        connectionDraftFolderUri = '';
      }

      selectedProjectKey = connectionDraftDirty
        ? ''
        : currentConfig.projectKey || selectedProjectKey;
      restoreProjectOptions();
      refreshConfigurationDropdowns(true);

      renderAnalysisState(currentAnalysisState);
      renderEmptyState();
    }

    function renderConfigurationSaved(config) {
      connectionDraftDirty = false;
      connectionDraftFolderUri = '';
      connectionValidated = Boolean(config.serverUrl && config.hasToken);
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
      refreshConfigurationDropdowns(true);
      renderSonarCompatibility(config.sonarCompatibility, false);
      updateSaveAvailability();
      renderEmptyState();
    }
`;
