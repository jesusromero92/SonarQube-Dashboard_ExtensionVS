export const PIPELINE_INTEGRATION_SCRIPT = `
    let analysisScopeSaving = false;
    let pipelineSaving = false;
    let integrationStepSaving = false;
    let integrationTestingId = '';
    let selectedIntegrationCategory = '';
    const integrationTestResults = new Map();
    let currentPipelineHistory = [];
    let currentHistoryEntryId = '';
    let currentAnalysisState = {
      running: false,
      phase: 'idle',
      message: 'Listo para analizar el repositorio.',
      scanner: '',
      canCancel: false,
      log: [],
      steps: []
    };

    function effectiveProjectCommand(manualCommand, detectedCommand) {
      return String(manualCommand || detectedCommand || '').trim();
    }

    function renderDetectedProjectActions(config) {
      const detectedBuild = String(config.detectedBuildCommand || '').trim();
      const detectedTests = String(config.detectedTestCommand || '').trim();

      elements.buildCommand.placeholder = detectedBuild || 'npm run build';
      elements.testCommand.placeholder = detectedTests || 'npm test';
      const detectedPrefix = translateLocalizationValue('Detectado automáticamente: ');
      const detectedSuffix = translateLocalizationValue(' Déjalo vacío para usarlo.');
      elements.detectedBuildCommandHint.textContent = detectedBuild
        ? detectedPrefix + detectedBuild + detectedSuffix
        : 'No se detectó un comando de compilación. Puedes introducirlo manualmente.';
      elements.detectedTestCommandHint.textContent = detectedTests
        ? detectedPrefix + detectedTests + detectedSuffix
        : 'No se detectó un comando de tests. Puedes introducirlo manualmente.';
      renderDetectedProjectStack(config);
      renderDetectedPackageManager(config);
      renderDetectedIntegrations(config.detectedIntegrations, config);
    }

    function detectedNodePackageManager(config = currentConfig) {
      const manager = String(config?.detectedPackageManager || '').trim().toLowerCase();
      return ['npm', 'pnpm', 'yarn', 'bun'].includes(manager) ? manager : '';
    }

    function renderDetectedPackageManager(config = currentConfig) {
      if (!elements.detectedPackageManagerHint) return;
      const manager = detectedNodePackageManager(config);
      elements.detectedPackageManagerHint.textContent = manager
        ? translateLocalizationValue('Gestor de paquetes detectado: ') + manager +
          translateLocalizationValue('. Los comandos Node se adaptan automáticamente.')
        : translateLocalizationValue('No se detectó un gestor de paquetes Node en este proyecto.');
    }

    function renderDetectedProjectStack(config = currentConfig) {
      if (!elements.detectedProjectStackHint) return;
      const technologies = Array.isArray(config?.detectedProjectStack?.technologies)
        ? config.detectedProjectStack.technologies
        : [];
      const names = technologies.map(item => String(item?.displayName || '').trim()).filter(Boolean);
      elements.detectedProjectStackHint.textContent = names.length > 0
        ? translateLocalizationValue('Stack detectado: ') + names.join(' · ')
        : translateLocalizationValue('No se ha detectado todavía el stack del proyecto.');
    }

    function recommendedIntegrationCatalog(config = currentConfig) {
      const catalog = Array.isArray(config?.recommendedIntegrations)
        ? [...config.recommendedIntegrations]
        : [];
      catalog.unshift({
        id: 'sonarqube',
        name: 'SonarQube',
        description: 'Analiza el proyecto con SonarQube y publica sus resultados en el servidor configurado.',
        category: 'sonarqube',
        setupHint: 'Configura la conexión y el proyecto desde la pestaña SonarQube.',
        recommendationReason: 'Integración principal del dashboard para el proyecto abierto.',
        recommendationPriority: 1000
      });

      const unique = new Map();
      for (const integration of catalog) {
        const id = String(integration?.id || '').trim();
        if (id && !unique.has(id)) unique.set(id, integration);
      }
      return [...unique.values()].sort((left, right) =>
        Number(right.recommendationPriority || 0) - Number(left.recommendationPriority || 0) ||
        integrationCategoryLabel(left.category).localeCompare(integrationCategoryLabel(right.category)) ||
        String(left.name || left.id).localeCompare(String(right.name || right.id))
      );
    }

    function integrationMatchesCategory(integration) {
      return !selectedIntegrationCategory || integration?.category === selectedIntegrationCategory;
    }

    function detectedProjectTools(integrations, config) {
      const tools = Array.isArray(integrations) ? [...integrations] : [];
      const sonarVersion = String(config?.sonarCompatibility?.version || '').trim();
      const projectKey = String(config?.projectKey || '').trim();
      if (sonarVersion || projectKey) {
        const sonarEvidence = sonarVersion
          ? 'Servidor SonarQube ' + sonarVersion + (projectKey ? ' · ' + projectKey : '')
          : 'Proyecto configurado: ' + projectKey;
        tools.unshift({
          id: 'sonarqube',
          name: 'SonarQube',
          description: 'Analiza el proyecto con SonarQube y publica sus resultados en el servidor configurado.',
          command: '',
          evidence: sonarEvidence,
          evidences: [{ source: 'server', value: sonarEvidence }],
          category: 'sonarqube',
          configurationStatus: 'configured',
          health: 'healthy',
          version: sonarVersion,
          versionSource: sonarVersion ? 'server' : 'unknown'
        });
      }

      const unique = new Map();
      for (const tool of tools) {
        const id = String(tool?.id || tool?.name || '').trim();
        if (id && !unique.has(id)) unique.set(id, tool);
      }
      return [...unique.values()].sort((left, right) =>
        integrationCategoryLabel(left.category).localeCompare(integrationCategoryLabel(right.category)) ||
        String(left.name || left.id).localeCompare(String(right.name || right.id))
      );
    }

    function integrationCategoryLabel(category) {
      const labels = {
        quality: 'Calidad',
        'security-sast': 'Seguridad / SAST',
        'dependencies-sca': 'Dependencias / SCA',
        'formatting-lint': 'Formato / Lint',
        tests: 'Tests',
        iac: 'Infraestructura / IaC',
        containers: 'Containers',
        sonarqube: 'SonarQube'
      };
      return translateLocalizationValue(labels[String(category || '')] || 'Otros');
    }

    function integrationHealthLabel(health) {
      if (health === 'healthy') return translateLocalizationValue('Operativa');
      if (health === 'warning') return translateLocalizationValue('Requiere revisión');
      return translateLocalizationValue('Estado no verificado');
    }

    function integrationConfigurationLabel(status) {
      if (status === 'configured') return translateLocalizationValue('Configurada');
      if (status === 'partial') return translateLocalizationValue('Configuración parcial');
      return translateLocalizationValue('Configuración no verificada');
    }

    function integrationVersionLabel(source) {
      if (source === 'installed') return 'Versión instalada: ';
      if (source === 'declared') return 'Versión declarada: ';
      if (source === 'server') return 'Versión del servidor: ';
      return 'Versión: ';
    }

    function integrationSourceLabel(source) {
      const labels = {
        dependency: 'dependencia',
        devDependency: 'dependencia de desarrollo',
        script: 'script',
        config: 'configuración',
        lockfile: 'lockfile',
        'project-file': 'archivo del proyecto',
        plugin: 'plugin',
        binary: 'binario',
        server: 'servidor'
      };
      return translateLocalizationValue(labels[String(source || '')] || String(source || ''));
    }

    function integrationOrigins(integration) {
      const evidences = Array.isArray(integration?.evidences) ? integration.evidences : [];
      const sources = [];
      for (const item of evidences) {
        const label = integrationSourceLabel(item?.source);
        if (label && !sources.includes(label)) sources.push(label);
      }
      return sources;
    }

    function integrationAlreadyAvailable(integration) {
      const commandKey = normalizedPipelineCommand(integration?.command);
      return Boolean(commandKey && configuredPipelineCommandKeys().has(commandKey));
    }

    function setIntegrationStepStatus(kind, message = '') {
      if (!elements.integrationStepStatus) return;
      if (!message) {
        elements.integrationStepStatus.hidden = true;
        elements.integrationStepStatus.textContent = '';
        elements.integrationStepStatus.className =
          'pipeline-save-status integration-step-status';
        return;
      }
      elements.integrationStepStatus.hidden = false;
      elements.integrationStepStatus.textContent = translateLocalizationValue(message);
      elements.integrationStepStatus.className =
        'pipeline-save-status integration-step-status pipeline-save-status--' + kind;
    }

    function createIntegrationStepControls(integration) {
      const wrapper = document.createElement('div');
      wrapper.className = 'detected-integration-step-controls';

      if (integration.probeSupported) {
        const test = document.createElement('button');
        test.className = 'secondary detected-integration-test';
        test.type = 'button';
        test.disabled = integrationTestingId === integration.id || !hasWorkspace;
        test.textContent = translateLocalizationValue(
          integrationTestingId === integration.id ? 'Probando…' : 'Probar integración'
        );
        test.addEventListener('click', () => {
          if (integrationTestingId) return;
          integrationTestingId = integration.id;
          integrationTestResults.delete(integration.id);
          setIntegrationStepStatus('loading', 'Probando integración…');
          renderDetectedIntegrations(currentConfig.detectedIntegrations, currentConfig);
          vscode.postMessage({
            type: 'testPipelineIntegration',
            folderUri: elements.folder.value,
            integrationId: integration.id
          });
        });
        wrapper.appendChild(test);
      }

      const add = document.createElement('button');
      add.className = 'secondary detected-integration-add-step';
      add.type = 'button';

      const included = integrationAlreadyAvailable(integration);
      add.disabled = included || integrationStepSaving || !hasWorkspace;
      add.textContent = translateLocalizationValue(
        included ? 'Ya disponible como paso' : 'Añadir a pasos disponibles'
      );
      add.addEventListener('click', () => {
        if (integrationAlreadyAvailable(integration) || integrationStepSaving) return;
        syncConfigurationPipelineFields();
        integrationStepSaving = true;
        setIntegrationStepStatus('loading', 'Añadiendo integración a los pasos disponibles…');
        renderDetectedIntegrations(currentConfig.detectedIntegrations, currentConfig);
        vscode.postMessage({
          type: 'addIntegrationToPipelineSteps',
          folderUri: elements.folder.value,
          integrationId: integration.id,
          configurationTab: 'configurationIntegrationsPanel',
          preAnalysisCommands: elements.preAnalysisCommands.value.trim(),
          postAnalysisCommands: elements.postAnalysisCommands.value.trim()
        });
      });
      wrapper.appendChild(add);
      return wrapper;
    }

    function createIntegrationSetupControls(integration) {
      if (!integration.setupCommand) return null;
      const wrapper = document.createElement('div');
      wrapper.className = 'detected-integration-step-controls detected-integration-setup-controls';

      const copy = document.createElement('button');
      copy.className = 'secondary';
      copy.type = 'button';
      copy.textContent = translateLocalizationValue('Copiar comando');
      copy.addEventListener('click', () => vscode.postMessage({
        type: 'preparePipelineIntegrationInstall',
        folderUri: elements.folder.value,
        integrationId: integration.id,
        integrationSetupAction: 'copy'
      }));

      const terminal = document.createElement('button');
      terminal.className = 'secondary';
      terminal.type = 'button';
      terminal.textContent = translateLocalizationValue('Abrir en terminal');
      terminal.addEventListener('click', () => vscode.postMessage({
        type: 'preparePipelineIntegrationInstall',
        folderUri: elements.folder.value,
        integrationId: integration.id,
        integrationSetupAction: 'terminal'
      }));
      wrapper.append(copy, terminal);
      return wrapper;
    }

    function createIntegrationBadge(text, className) {
      const badge = document.createElement('span');
      badge.className = className;
      badge.textContent = text;
      return badge;
    }

    function appendAvailableIntegrationMetadata(content, integration) {
      const metadata = document.createElement('div');
      metadata.className = 'detected-integration-metadata';

      const health = createIntegrationBadge(
        integrationHealthLabel(integration.health),
        'detected-integration-health detected-integration-health--' + String(integration.health || 'unknown')
      );
      metadata.appendChild(health);

      const version = document.createElement('span');
      const versionLabel = integrationVersionLabel(integration.versionSource);
      version.textContent = translateLocalizationValue(versionLabel) +
        (String(integration.version || '').trim() || translateLocalizationValue('No determinada'));
      metadata.appendChild(version);

      const configuration = document.createElement('span');
      configuration.textContent = translateLocalizationValue('Configuración: ') +
        integrationConfigurationLabel(integration.configurationStatus);
      metadata.appendChild(configuration);

      const origins = integrationOrigins(integration);
      const origin = document.createElement('span');
      origin.textContent = translateLocalizationValue('Origen: ') +
        (origins.length > 0 ? origins.join(' · ') : translateLocalizationValue('No determinado'));
      metadata.appendChild(origin);
      const probe = integrationTestResults.get(integration.id);
      if (probe) {
        const probeResult = document.createElement('span');
        probeResult.className = probe.success
          ? 'detected-integration-probe detected-integration-probe--success'
          : 'detected-integration-probe detected-integration-probe--error';
        probeResult.textContent = probe.success
          ? translateLocalizationValue('Prueba correcta: ') + (probe.output || probe.command) + ' · ' + probe.durationMs + ' ms'
          : translateLocalizationValue('Prueba fallida: ') + (probe.output || probe.command);
        metadata.appendChild(probeResult);
      }
      content.appendChild(metadata);
    }

    function integrationCard(integration, available) {
      const card = document.createElement('article');
      card.className = 'detected-integration-card ' + (
        available ? 'detected-integration-card--available' : 'detected-integration-card--unavailable'
      );
      if (!available && integration.setupCommand) card.classList.add('has-actions');

      const content = document.createElement('div');
      content.className = 'detected-integration-content';

      const titleRow = document.createElement('div');
      titleRow.className = 'detected-integration-title-row';
      const title = document.createElement('strong');
      title.textContent = integration.name || integration.id;
      const category = createIntegrationBadge(
        integrationCategoryLabel(integration.category),
        'detected-integration-category'
      );
      titleRow.append(title, category);

      const description = document.createElement('span');
      description.textContent = translateLocalizationValue(integration.description || '');
      content.append(titleRow, description);

      if (available) {
        appendAvailableIntegrationMetadata(content, integration);
      }

      if (available && integration.command) {
        const commandLabel = document.createElement('span');
        commandLabel.className = 'detected-integration-command-label';
        commandLabel.textContent = translateLocalizationValue('Comando de ejecución:');
        const command = document.createElement('code');
        command.textContent = integration.command;
        content.append(commandLabel, command);
      }

      if (available && integration.evidence) {
        const evidenceText = document.createElement('span');
        evidenceText.className = 'detected-integration-evidence';
        const allEvidence = Array.isArray(integration.evidences) && integration.evidences.length > 0
          ? integration.evidences.map(item => String(item?.value || '')).filter(Boolean).join(' · ')
          : integration.evidence;
        evidenceText.textContent = translateLocalizationValue('Evidencia: ') + allEvidence;
        content.appendChild(evidenceText);
      }

      if (!available && integration.recommendationReason) {
        const reason = document.createElement('span');
        reason.className = 'detected-integration-recommendation';
        reason.textContent = translateLocalizationValue('Por qué se recomienda: ') +
          translateLocalizationValue(integration.recommendationReason);
        content.appendChild(reason);
      }

      if (!available && integration.setupHint) {
        const setup = document.createElement('span');
        setup.className = 'detected-integration-setup';
        setup.textContent = translateLocalizationValue('Cómo habilitarlo: ') +
          translateLocalizationValue(integration.setupHint);
        content.appendChild(setup);
      }

      if (!available && integration.setupCommand) {
        const commandLabel = document.createElement('span');
        commandLabel.className = 'detected-integration-command-label';
        commandLabel.textContent = translateLocalizationValue('Comando sugerido:');
        const command = document.createElement('code');
        command.textContent = integration.setupCommand;
        content.append(commandLabel, command);
      }

      card.appendChild(content);
      if (available && integration.command) {
        card.appendChild(createIntegrationStepControls(integration));
      } else if (available && integration.id === 'sonarqube') {
        const nativeStep = document.createElement('span');
        nativeStep.className = 'detected-integration-step-hint';
        nativeStep.textContent = translateLocalizationValue(
          'SonarQube ya forma parte de todas las plantillas como paso obligatorio.'
        );
        card.appendChild(nativeStep);
      } else if (!available) {
        const setupControls = createIntegrationSetupControls(integration);
        if (setupControls) card.appendChild(setupControls);
      }
      return card;
    }

    function renderIntegrationList(container, integrations, available, emptyMessage) {
      container.textContent = '';
      container.classList.toggle('is-empty', integrations.length === 0);
      if (integrations.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'detected-integration-empty';
        empty.textContent = translateLocalizationValue(emptyMessage);
        container.appendChild(empty);
        return;
      }

      for (const integration of integrations) {
        container.appendChild(integrationCard(integration, available));
      }
    }

    function renderDetectedIntegrations(integrations, config = currentConfig) {
      const allDetected = detectedProjectTools(integrations, config);
      const detectedIds = new Set(allDetected.map(integration => String(integration.id || '').trim()));
      const allRecommended = recommendedIntegrationCatalog(config)
        .filter(integration => !detectedIds.has(integration.id));
      const detected = allDetected.filter(integrationMatchesCategory);
      const recommended = allRecommended.filter(integrationMatchesCategory);

      elements.availableIntegrationsCount.textContent = '(' + detected.length + ')';
      elements.unavailableIntegrationsCount.textContent = '(' + recommended.length + ')';

      renderIntegrationList(
        elements.detectedIntegrations,
        detected,
        true,
        'No se ha detectado ninguna integración compatible en esta categoría.'
      );
      renderIntegrationList(
        elements.unavailableIntegrations,
        recommended,
        false,
        'No hay recomendaciones pendientes para el stack detectado en esta categoría.'
      );
    }

    function canSaveAnalysisScope() {
      return Boolean(
        hasWorkspace &&
        !connectionDraftDirty &&
        currentConfig.projectKey &&
        elements.projectKey.value === currentConfig.projectKey
      );
    }

    function updateSaveAvailability() {
      elements.save.disabled =
        configurationBusy || !canSynchronizeConfiguration();
      elements.saveAnalysisScope.disabled =
        analysisScopeSaving || !canSaveAnalysisScope();
      elements.savePipeline.disabled = pipelineSaving || !hasWorkspace;
    }

    function clearAnalysisScopeSaveStatus() {
      elements.analysisScopeSaveStatus.hidden = true;
      elements.analysisScopeSaveStatus.textContent = '';
      elements.analysisScopeSaveStatus.className = 'pipeline-save-status';
    }

    function setAnalysisScopeSaveStatus(kind, message = '') {
      analysisScopeSaving = kind === 'loading';
      updateSaveAvailability();
      if (!message) {
        clearAnalysisScopeSaveStatus();
        return;
      }

      elements.analysisScopeSaveStatus.hidden = false;
      elements.analysisScopeSaveStatus.textContent =
        translateLocalizationValue(message);
      elements.analysisScopeSaveStatus.className =
        'pipeline-save-status pipeline-save-status--' + kind;
    }

    function resetAnalysisScopeFields() {
      elements.analysisInclusions.value = '';
      elements.analysisExclusions.value = '';
      currentConfig.analysisInclusions = '';
      currentConfig.analysisExclusions = '';
      analysisScopeSaving = false;
      clearAnalysisScopeSaveStatus();
      updateSaveAvailability();
    }

    function clearPipelineSaveStatus() {
      elements.pipelineSaveStatus.hidden = true;
      elements.pipelineSaveStatus.textContent = '';
      elements.pipelineSaveStatus.className = 'pipeline-save-status';
    }

    function setPipelineSaveStatus(kind, message = '') {
      pipelineSaving = kind === 'loading';
      elements.savePipeline.disabled = pipelineSaving || !hasWorkspace;
      if (!message) {
        clearPipelineSaveStatus();
        return;
      }

      elements.pipelineSaveStatus.hidden = false;
      elements.pipelineSaveStatus.textContent = translateLocalizationValue(message);
      elements.pipelineSaveStatus.className =
        'pipeline-save-status pipeline-save-status--' + kind;
    }

    function clearPipelineTemplateStatus() {
      elements.pipelineTemplateStatus.hidden = true;
      elements.pipelineTemplateStatus.textContent = '';
      elements.pipelineTemplateStatus.className =
        'pipeline-save-status pipeline-template-status';
    }

    function setPipelineTemplateStatus(kind, message = '') {
      if (!message) {
        clearPipelineTemplateStatus();
        return;
      }

      elements.pipelineTemplateStatus.hidden = false;
      elements.pipelineTemplateStatus.textContent =
        translateLocalizationValue(message);
      elements.pipelineTemplateStatus.className =
        'pipeline-save-status pipeline-template-status pipeline-save-status--' + kind;
    }


    function handlePipelineModuleMessage(message) {
      if (handlePipelineVariablesMessage(message)) return true;
      switch (message.type) {
        case 'analysisScopeSaved':
          currentConfig = { ...currentConfig, analysisInclusions: message.analysisInclusions || '', analysisExclusions: message.analysisExclusions || '' };
          elements.analysisInclusions.value = currentConfig.analysisInclusions;
          elements.analysisExclusions.value = currentConfig.analysisExclusions;
          setAnalysisScopeSaveStatus('success', 'Inclusiones y exclusiones guardadas.');
          return true;
        case 'analysisScopeSaveError':
          setAnalysisScopeSaveStatus('error', message.message || 'No se pudieron guardar las inclusiones y exclusiones.');
          return true;
        case 'pipelineSaved':
          currentConfig = { ...currentConfig, ...(message.config || {}) };
          elements.buildCommand.value = currentConfig.buildCommand || '';
          elements.testCommand.value = currentConfig.testCommand || '';
          elements.preAnalysisCommands.value = currentConfig.preAnalysisCommands || '';
          elements.postAnalysisCommands.value = currentConfig.postAnalysisCommands || '';
          renderPipelineConfigurationFromFields();
          renderDetectedProjectActions(currentConfig);
          setPipelineSaveStatus('success', 'Pipeline guardado.');
          return true;
        case 'pipelineSaveError':
          setPipelineSaveStatus('error', message.message || 'No se pudo guardar el pipeline.');
          return true;
        case 'pipelineProjectActionsUpdated':
          if (message.folderUri && message.folderUri !== currentFolderUri) return true;
          currentConfig = { ...currentConfig, ...(message.config || {}) };
          renderDetectedProjectActions(currentConfig);
          renderPipelineVariables(currentConfig);
          return true;
        case 'pipelineTemplatesUpdated':
          renderPipelineTemplates(message.templates || [], message.templateId);
          renderDetectedIntegrations(currentConfig.detectedIntegrations, currentConfig);
          setPipelineTemplateStatus('success', message.message || 'Plantillas actualizadas.');
          return true;
        case 'pipelineIntegrationStepUpdated':
          integrationStepSaving = false;
          currentConfig = { ...currentConfig, ...(message.config || {}) };
          elements.preAnalysisCommands.value = currentConfig.preAnalysisCommands || '';
          elements.postAnalysisCommands.value = currentConfig.postAnalysisCommands || '';
          renderPipelineConfigurationFromFields();
          renderDetectedIntegrations(currentConfig.detectedIntegrations, currentConfig);
          setIntegrationStepStatus(
            'success',
            message.message || 'Integración añadida a los pasos disponibles.'
          );
          return true;
        case 'pipelineIntegrationStepError':
          integrationStepSaving = false;
          setIntegrationStepStatus(
            'error',
            message.message || 'No se pudo añadir la integración a los pasos disponibles.'
          );
          renderDetectedIntegrations(currentConfig.detectedIntegrations, currentConfig);
          return true;
        case 'pipelineIntegrationTestResult':
          integrationTestingId = '';
          integrationTestResults.set(message.integrationId, message.result || {});
          setIntegrationStepStatus(
            message.result?.success ? 'success' : 'error',
            message.result?.success ? 'Integración operativa.' : 'La prueba de integración ha fallado.'
          );
          renderDetectedIntegrations(currentConfig.detectedIntegrations, currentConfig);
          return true;
        case 'pipelineIntegrationTestError':
          integrationTestingId = '';
          setIntegrationStepStatus('error', message.message || 'No se pudo probar la integración.');
          renderDetectedIntegrations(currentConfig.detectedIntegrations, currentConfig);
          return true;
        case 'pipelineIntegrationSetupPrepared':
          setIntegrationStepStatus('success', message.message || 'Comando preparado.');
          return true;
        case 'pipelineIntegrationSetupError':
          setIntegrationStepStatus('error', message.message || 'No se pudo preparar el comando.');
          return true;
        case 'pipelineTemplateError':
          setPipelineTemplateStatus('error', message.message || 'No se pudo actualizar la plantilla.');
          return true;
        case 'pipelineTemplateActionCancelled':
          setPipelineTemplateStatus('idle', '');
          return true;
        case 'pipelineHistory':
          currentPipelineHistory = message.entries || [];
          renderPipelineHistory(currentPipelineHistory, message.selectedEntryId || '');
          return true;
        case 'pipelineHistoryError':
          elements.historyLoading.hidden = true;
          elements.historyEmpty.hidden = false;
          elements.historyEmpty.textContent = message.message || 'No se pudo cargar el historial.';
          return true;
        case 'analysisState':
          renderAnalysisState(message.state || {});
          renderLivePipelineHistory(message.state || {});
          return true;
        case 'showAnalysisDialog':
          if (!elements.analysisDialog.open) elements.analysisDialog.showModal();
          return true;
        default:
          return false;
      }
    }

    function bindPipelineEvents() {
      bindPipelineVariableEvents();
      elements.integrationCategoryFilter?.addEventListener('change', () => {
        selectedIntegrationCategory = elements.integrationCategoryFilter.value;
        renderDetectedIntegrations(currentConfig.detectedIntegrations, currentConfig);
      });
      elements.scannerMode.addEventListener('change', () => {
        elements.customScannerField.hidden = elements.scannerMode.value !== 'custom';
      });
      elements.analysisInclusions.addEventListener('input', clearAnalysisScopeSaveStatus);
      elements.analysisExclusions.addEventListener('input', clearAnalysisScopeSaveStatus);
      elements.saveAnalysisScope.addEventListener('click', () => {
        setAnalysisScopeSaveStatus('loading', 'Guardando inclusiones y exclusiones…');
        vscode.postMessage({ type: 'saveAnalysisScope', folderUri: elements.folder.value, analysisInclusions: elements.analysisInclusions.value.trim(), analysisExclusions: elements.analysisExclusions.value.trim() });
      });
      elements.addPipelineStep.addEventListener('click', addConfigurationPipelineStep);
      elements.pipelineTemplate.addEventListener('change', () => renderPipelineTemplateEditor(pipelineTemplateById(elements.pipelineTemplate.value)));
      elements.newPipelineTemplate.addEventListener('click', createNewPipelineTemplateDraft);
      elements.addPipelineTemplateStep.addEventListener('click', addPipelineTemplateStep);
      elements.pipelineTemplateName.addEventListener('input', updatePipelineTemplateActions);
      elements.pipelineTemplateDescriptionInput.addEventListener('input', updatePipelineTemplateActions);
      elements.savePipelineTemplate.addEventListener('click', () => {
        const draft = pipelineTemplateDraft();
        if (!draft.name) { setPipelineTemplateStatus('error', 'Introduce un nombre para la plantilla.'); elements.pipelineTemplateName.focus(); return; }
        if (!pipelineTemplateDraftIsValid()) { setPipelineTemplateStatus('error', 'Selecciona todos los pasos de la plantilla.'); return; }
        setPipelineTemplateStatus('loading', 'Guardando plantilla…');
        vscode.postMessage({ type: 'savePipelineTemplate', folderUri: elements.folder.value, templateId: draft.id || undefined, templateName: draft.name, templateDescription: draft.description, analysisSteps: draft.steps });
      });
      elements.deletePipelineTemplate.addEventListener('click', () => {
        const selected = pipelineTemplateById(elements.pipelineTemplate.value); if (!selected) return;
        setPipelineTemplateStatus('loading', selected.builtin ? 'Restableciendo plantilla…' : 'Eliminando plantilla…');
        vscode.postMessage({ type: 'deletePipelineTemplate', folderUri: elements.folder.value, templateId: elements.pipelineTemplate.value });
      });
      elements.exportPipelineTemplate.addEventListener('click', () => vscode.postMessage({ type: 'exportPipelineTemplate', folderUri: elements.folder.value, templateId: elements.pipelineTemplate.value }));
      elements.importPipelineTemplate.addEventListener('click', () => vscode.postMessage({ type: 'importPipelineTemplate', folderUri: elements.folder.value }));
      elements.savePipeline.addEventListener('click', () => {
        syncConfigurationPipelineFields(); setPipelineSaveStatus('loading', 'Guardando pipeline…');
        vscode.postMessage({ type: 'savePipeline', folderUri: elements.folder.value, buildCommand: elements.buildCommand.value.trim(), testCommand: elements.testCommand.value.trim(), preAnalysisCommands: elements.preAnalysisCommands.value.trim(), postAnalysisCommands: elements.postAnalysisCommands.value.trim() });
      });
      elements.analyzeEmpty.addEventListener('click', requestAnalysis);
      elements.analyzeRepository.addEventListener('click', requestAnalysis);
      elements.cancelAnalysis.addEventListener('click', cancelRepositoryAnalysis);
      elements.refreshHistory.addEventListener('click', () => {
        elements.historyLoading.hidden = false;
        vscode.postMessage({ type: 'loadPipelineHistory', folderUri: currentFolderUri });
      });
      elements.showAnalysisLog.addEventListener('click', () => elements.analysisDialog.showModal());
      bindDialogDismiss(elements.analysisConfirmationDialog, [elements.analysisConfirmationClose, elements.analysisConfirmationCancel]);
      elements.analysisConfirmationBack.addEventListener('click', () => showAnalysisConfirmationStep(1));
      elements.analysisConfirmationNext.addEventListener('click', reviewRepositoryAnalysis);
      elements.analysisConfirmationConfirm.addEventListener('click', confirmRepositoryAnalysis);
      elements.analysisAddStep.addEventListener('click', event => addSelectedAnalysisStep(event));
      elements.analysisPipelineTemplate.addEventListener('change', () => { applyTemplateToAnalysis(pipelineTemplateById(elements.analysisPipelineTemplate.value)); refreshAnalysisConfirmationSummary(); });
      bindDialogDismiss(elements.analysisDialog, [elements.analysisDialogClose, elements.analysisDialogFooterClose]);
      elements.analysisDialogCancel.addEventListener('click', cancelRepositoryAnalysis);
    }

    registerDashboardModuleHooks({
      values: () => ({
        scannerMode: elements.scannerMode.value,
        analysisInclusions: elements.analysisInclusions.value.trim(),
        analysisExclusions: elements.analysisExclusions.value.trim(),
        buildCommand: elements.buildCommand.value.trim(),
        testCommand: elements.testCommand.value.trim(),
        customScannerCommand: elements.customScannerCommand.value.trim(),
        preAnalysisCommands: elements.preAnalysisCommands.value.trim(),
        postAnalysisCommands: elements.postAnalysisCommands.value.trim()
      }),
      resetConnectionScopedFields: resetAnalysisScopeFields,
      updateSaveAvailability: () => {
        elements.saveAnalysisScope.disabled = analysisScopeSaving || !canSaveAnalysisScope();
        elements.savePipeline.disabled = pipelineSaving || !hasWorkspace;
        updatePipelineVariableSaveAvailability();
      },
      refreshConfigurationDropdowns: rebuild => {
        refreshSelectDropdown(elements.scannerMode, rebuild);
        refreshSelectDropdown(elements.pipelineTemplate, rebuild);
        refreshSelectDropdown(elements.analysisPipelineTemplate, rebuild);
      },
      renderState: config => {
        pipelineSaving = false; integrationStepSaving = false; pipelineVariablesSaving = false; clearPipelineSaveStatus(); analysisScopeSaving = false; clearAnalysisScopeSaveStatus(); setIntegrationStepStatus('idle', '');
        elements.scannerMode.value = config.scannerMode || 'auto';
        elements.analysisInclusions.value = connectionDraftDirty ? '' : config.analysisInclusions || '';
        elements.analysisExclusions.value = connectionDraftDirty ? '' : config.analysisExclusions || '';
        elements.buildCommand.value = config.buildCommand || ''; elements.testCommand.value = config.testCommand || '';
        renderDetectedProjectActions(config);
        renderPipelineVariables(config);
        elements.customScannerCommand.value = config.customScannerCommand || '';
        elements.preAnalysisCommands.value = config.preAnalysisCommands || ''; elements.postAnalysisCommands.value = config.postAnalysisCommands || '';
        renderPipelineConfigurationFromFields(); renderPipelineTemplates(config.pipelineTemplates || []);
        elements.customScannerField.hidden = elements.scannerMode.value !== 'custom';
        if (config.analysisPermission === 'denied') elements.tokenHint.textContent = 'El token puede consultar datos, pero no tiene permiso para ejecutar análisis en este proyecto.';
        renderAnalysisState(currentAnalysisState);
      },
      renderConfigurationSaved: config => {
        analysisScopeSaving = false; integrationStepSaving = false; pipelineVariablesSaving = false; clearAnalysisScopeSaveStatus(); setIntegrationStepStatus('idle', '');
        elements.scannerMode.value = config.scannerMode || 'auto'; elements.analysisInclusions.value = config.analysisInclusions || ''; elements.analysisExclusions.value = config.analysisExclusions || '';
        elements.buildCommand.value = config.buildCommand || ''; elements.testCommand.value = config.testCommand || ''; renderDetectedProjectActions(config); renderPipelineVariables(config);
        elements.customScannerCommand.value = config.customScannerCommand || ''; elements.preAnalysisCommands.value = config.preAnalysisCommands || ''; elements.postAnalysisCommands.value = config.postAnalysisCommands || '';
        renderPipelineConfigurationFromFields(); renderPipelineTemplates(config.pipelineTemplates || currentConfig.pipelineTemplates || []);
        elements.customScannerField.hidden = elements.scannerMode.value !== 'custom'; renderAnalysisState(currentAnalysisState);
      },
      message: handlePipelineModuleMessage,
      bindEvents: bindPipelineEvents,
      pages: { history: () => {
        const hasRenderedExecution = Boolean(elements.historyList && !elements.historyList.hidden && elements.historyList.dataset.historyEntryId);
        elements.historyLoading.hidden = hasRenderedExecution;
        vscode.postMessage({ type: 'loadPipelineHistory', folderUri: currentFolderUri });
      } },
      capabilities: { analysis: () => currentConfig.pipelineModuleEnabled !== false && currentConfig.analysisPermission !== 'denied' }
    });
`;
