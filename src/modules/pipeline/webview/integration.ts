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
      renderDetectedIntegrations(config.detectedIntegrations);
    }

    function renderDetectedIntegrations(integrations) {
      elements.detectedIntegrations.textContent = '';
      const detected = availableDetectedIntegrations(integrations);
      elements.detectedIntegrations.classList.toggle('is-empty', detected.length === 0);

      if (detected.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'detected-integration-empty';
        empty.textContent = translateLocalizationValue(
          'No se han detectado integraciones predefinidas para este proyecto.'
        );
        elements.detectedIntegrations.appendChild(empty);
        return;
      }

      for (const integration of detected) {
        const card = document.createElement('article');
        card.className = 'detected-integration-card';

        const content = document.createElement('div');
        content.className = 'detected-integration-content';

        const title = document.createElement('strong');
        title.textContent = integration.name || integration.id;

        const description = document.createElement('span');
        description.textContent = translateLocalizationValue(
          integration.description || ''
        );

        const metadata = document.createElement('code');
        metadata.textContent = integration.command || '';
        metadata.title = integration.evidence || '';

        content.append(title, description, metadata);

        const add = document.createElement('button');
        add.className = 'secondary';
        add.type = 'button';
        add.textContent = translateLocalizationValue('Añadir al pipeline');
        add.addEventListener('click', () => {
          addDetectedIntegrationToPipeline(integration);
        });

        card.append(content, add);
        elements.detectedIntegrations.appendChild(card);
      }
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
