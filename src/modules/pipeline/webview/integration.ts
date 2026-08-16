export const PIPELINE_INTEGRATION_SCRIPT = `
    let analysisScopeSaving = false;
    let pipelineSaving = false;
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
      renderDetectedPackageManager(config);
      renderDetectedIntegrations(config.detectedIntegrations, config);
    }

    function detectedNodePackageManager(config = currentConfig) {
      const manager = String(config?.detectedPackageManager || '').trim().toLowerCase();
      return ['npm', 'pnpm', 'yarn', 'bun'].includes(manager) ? manager : '';
    }

    function nodeDevInstallCommand(packageName, config = currentConfig) {
      const manager = detectedNodePackageManager(config);
      if (manager === 'npm') return 'npm install -D ' + packageName;
      if (manager === 'pnpm') return 'pnpm add -D ' + packageName;
      if (manager === 'yarn') return 'yarn add -D ' + packageName;
      if (manager === 'bun') return 'bun add -d ' + packageName;
      return '';
    }

    function nodeInstallCommand(config = currentConfig) {
      const manager = detectedNodePackageManager(config);
      if (manager === 'npm') return 'npm install';
      if (manager === 'pnpm') return 'pnpm install';
      if (manager === 'yarn') return 'yarn install';
      if (manager === 'bun') return 'bun install';
      return '';
    }

    function renderDetectedPackageManager(config = currentConfig) {
      if (!elements.detectedPackageManagerHint) return;
      const manager = detectedNodePackageManager(config);
      elements.detectedPackageManagerHint.textContent = manager
        ? translateLocalizationValue('Gestor de paquetes detectado: ') + manager +
          translateLocalizationValue('. Los comandos Node se adaptan automáticamente.')
        : translateLocalizationValue('No se detectó un gestor de paquetes Node en este proyecto.');
    }

    function supportedIntegrationCatalog(config = currentConfig) {
      const packageManager = detectedNodePackageManager(config);
      return [
        {
          id: 'sonarqube',
          name: 'SonarQube',
          description: 'Analiza el proyecto con SonarQube y publica sus resultados en el servidor configurado.',
          setupHint: 'Configura la conexión y el proyecto desde la pestaña SonarQube.'
        },
        {
          id: 'dependency-audit',
          name: packageManager ? packageManager + ' audit' : 'Auditoría de dependencias Node',
          description: 'Audita las dependencias conocidas del proyecto.',
          setupCommand: nodeInstallCommand(config),
          setupHint: 'Instala las dependencias con el gestor detectado para generar o actualizar su lockfile.'
        },
        {
          id: 'eslint',
          name: 'ESLint',
          description: 'Ejecuta el análisis estático de JavaScript y TypeScript.',
          setupCommand: nodeDevInstallCommand('eslint', config),
          setupHint: 'Añade ESLint como dependencia de desarrollo y configura un script o eslint.config.*.'
        },
        {
          id: 'react-doctor',
          name: 'React Doctor',
          description: 'Revisa proyectos React para detectar problemas de rendimiento, seguridad, corrección y arquitectura.',
          setupCommand: nodeDevInstallCommand('react-doctor', config),
          setupHint: 'Ejecuta React Doctor desde la raíz del proyecto o añádelo a un script de package.json.'
        },
        {
          id: 'biome',
          name: 'Biome',
          description: 'Comprueba formato, lint y calidad de código JavaScript y TypeScript con Biome.',
          setupCommand: nodeDevInstallCommand('@biomejs/biome', config),
          setupHint: 'Añade Biome al proyecto y crea biome.json o biome.jsonc.'
        },
        {
          id: 'stylelint',
          name: 'Stylelint',
          description: 'Analiza CSS y preprocesadores compatibles mediante reglas Stylelint.',
          setupCommand: nodeDevInstallCommand('stylelint', config),
          setupHint: 'Añade Stylelint al proyecto y crea una configuración Stylelint.'
        },
        {
          id: 'prettier',
          name: 'Prettier',
          description: 'Comprueba que el formato del proyecto cumple la configuración de Prettier.',
          setupCommand: nodeDevInstallCommand('prettier', config),
          setupHint: 'Añade Prettier como dependencia de desarrollo y una configuración o script si lo necesitas.'
        },
        {
          id: 'semgrep',
          name: 'Semgrep',
          description: 'Busca patrones de seguridad y calidad mediante reglas Semgrep.',
          setupCommand: 'pipx install semgrep',
          setupHint: 'Instala el CLI de Semgrep y añade una configuración o script de análisis al proyecto.'
        },
        {
          id: 'snyk',
          name: 'Snyk',
          description: 'Comprueba vulnerabilidades de dependencias con Snyk.',
          setupCommand: nodeDevInstallCommand('snyk', config),
          setupHint: 'Añade Snyk al proyecto y autentica el CLI antes de ejecutar análisis.'
        },
        {
          id: 'trivy',
          name: 'Trivy',
          description: 'Escanea vulnerabilidades, secretos y configuraciones inseguras.',
          setupHint: 'Instala el CLI de Trivy con el método recomendado para tu sistema y añade una configuración, script o archivo de contenedor detectable.'
        },
        {
          id: 'owasp-dependency-check',
          name: 'OWASP Dependency-Check',
          description: 'Analiza dependencias conocidas mediante OWASP Dependency-Check.',
          setupHint: 'Añade OWASP Dependency-Check como plugin de Maven o Gradle en la configuración del proyecto.'
        },
        {
          id: 'ruff',
          name: 'Ruff',
          description: 'Ejecuta lint y comprobaciones rápidas de calidad para proyectos Python.',
          setupCommand: 'pip install ruff',
          setupHint: 'Instala Ruff y configúralo en pyproject.toml, ruff.toml o .ruff.toml.'
        },
        {
          id: 'bandit',
          name: 'Bandit',
          description: 'Busca problemas de seguridad habituales en código Python.',
          setupCommand: 'pip install bandit',
          setupHint: 'Instala Bandit y añádelo a requirements o a su configuración del proyecto.'
        },
        {
          id: 'checkov',
          name: 'Checkov',
          description: 'Analiza infraestructura como código y configuraciones cloud en busca de riesgos.',
          setupCommand: 'pip install checkov',
          setupHint: 'Instala Checkov y añade una configuración .checkov.yml/.yaml o una dependencia de proyecto.'
        },
        {
          id: 'golangci-lint',
          name: 'golangci-lint',
          description: 'Ejecuta una colección de linters sobre proyectos Go.',
          setupHint: 'Instala golangci-lint con el método recomendado para tu entorno y añade un archivo .golangci.* al proyecto.'
        }
      ];
    }

    function detectedProjectTools(integrations, config) {
      const tools = Array.isArray(integrations) ? [...integrations] : [];
      const sonarVersion = String(config?.sonarCompatibility?.version || '').trim();
      const projectKey = String(config?.projectKey || '').trim();
      if (sonarVersion || projectKey) {
        tools.unshift({
          id: 'sonarqube',
          name: 'SonarQube',
          description: 'Analiza el proyecto con SonarQube y publica sus resultados en el servidor configurado.',
          command: '',
          evidence: sonarVersion
            ? 'Servidor SonarQube ' + sonarVersion + (projectKey ? ' · ' + projectKey : '')
            : 'Proyecto configurado: ' + projectKey,
          category: 'quality'
        });
      }

      const unique = new Map();
      for (const tool of tools) {
        const id = String(tool?.id || tool?.name || '').trim();
        if (id && !unique.has(id)) unique.set(id, tool);
      }
      return [...unique.values()].sort((left, right) =>
        String(left.name || left.id).localeCompare(String(right.name || right.id))
      );
    }

    function integrationCard(integration, available) {
      const card = document.createElement('article');
      card.className = 'detected-integration-card' + (available ? '' : ' detected-integration-card--unavailable');

      const content = document.createElement('div');
      content.className = 'detected-integration-content';

      const title = document.createElement('strong');
      title.textContent = integration.name || integration.id;

      const description = document.createElement('span');
      description.textContent = translateLocalizationValue(integration.description || '');
      content.append(title, description);

      if (available && integration.command) {
        const command = document.createElement('code');
        command.textContent = integration.command;
        content.appendChild(command);
      }

      if (available && integration.evidence) {
        const evidence = document.createElement('span');
        evidence.className = 'detected-integration-evidence';
        evidence.textContent = translateLocalizationValue('Detectado por: ') + integration.evidence;
        content.appendChild(evidence);
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
      const detected = detectedProjectTools(integrations, config);
      const detectedIds = new Set(detected.map(integration => String(integration.id || '').trim()));
      const unavailable = supportedIntegrationCatalog(config)
        .filter(integration => !detectedIds.has(integration.id))
        .sort((left, right) => left.name.localeCompare(right.name));

      elements.availableIntegrationsCount.textContent = '(' + detected.length + ')';
      elements.unavailableIntegrationsCount.textContent = '(' + unavailable.length + ')';

      renderIntegrationList(
        elements.detectedIntegrations,
        detected,
        true,
        'No se ha detectado ninguna integración compatible.'
      );
      renderIntegrationList(
        elements.unavailableIntegrations,
        unavailable,
        false,
        'Todas las integraciones compatibles están disponibles.'
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
        case 'pipelineTemplatesUpdated':
          renderPipelineTemplates(message.templates || [], message.templateId);
          setPipelineTemplateStatus('success', message.message || 'Plantillas actualizadas.');
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
      },
      refreshConfigurationDropdowns: rebuild => {
        refreshSelectDropdown(elements.scannerMode, rebuild);
        refreshSelectDropdown(elements.pipelineTemplate, rebuild);
        refreshSelectDropdown(elements.analysisPipelineTemplate, rebuild);
      },
      renderState: config => {
        pipelineSaving = false; clearPipelineSaveStatus(); analysisScopeSaving = false; clearAnalysisScopeSaveStatus();
        elements.scannerMode.value = config.scannerMode || 'auto';
        elements.analysisInclusions.value = connectionDraftDirty ? '' : config.analysisInclusions || '';
        elements.analysisExclusions.value = connectionDraftDirty ? '' : config.analysisExclusions || '';
        elements.buildCommand.value = config.buildCommand || ''; elements.testCommand.value = config.testCommand || '';
        renderDetectedProjectActions(config);
        elements.customScannerCommand.value = config.customScannerCommand || '';
        elements.preAnalysisCommands.value = config.preAnalysisCommands || ''; elements.postAnalysisCommands.value = config.postAnalysisCommands || '';
        renderPipelineConfigurationFromFields(); renderPipelineTemplates(config.pipelineTemplates || []);
        elements.customScannerField.hidden = elements.scannerMode.value !== 'custom';
        if (config.analysisPermission === 'denied') elements.tokenHint.textContent = 'El token puede consultar datos, pero no tiene permiso para ejecutar análisis en este proyecto.';
        renderAnalysisState(currentAnalysisState);
      },
      renderConfigurationSaved: config => {
        analysisScopeSaving = false; clearAnalysisScopeSaveStatus();
        elements.scannerMode.value = config.scannerMode || 'auto'; elements.analysisInclusions.value = config.analysisInclusions || ''; elements.analysisExclusions.value = config.analysisExclusions || '';
        elements.buildCommand.value = config.buildCommand || ''; elements.testCommand.value = config.testCommand || ''; renderDetectedProjectActions(config);
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
