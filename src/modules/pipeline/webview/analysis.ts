export const ANALYSIS_SCRIPT = `    function analysisTimingCommandKey(command) {
      return String(command || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }

    function analysisStepTiming(step) {
      const stats = Array.isArray(currentConfig.pipelineStepTimingStatistics)
        ? currentConfig.pipelineStepTimingStatistics
        : [];
      const commandKey = analysisTimingCommandKey(step.command);
      return stats.find(item => {
        if (step.kind === 'sonar' && item.kind === 'sonar') return true;
        if (commandKey && analysisTimingCommandKey(item.command) === commandKey) return true;
        return item.id === step.id;
      });
    }

    function formatAnalysisDuration(durationMs) {
      const value = Math.max(0, Number(durationMs) || 0);
      if (value < 1000) return Math.round(value) + ' ms';
      if (value < 60000) return (value / 1000).toFixed(value < 10000 ? 1 : 0) + ' s';
      const minutes = Math.floor(value / 60000);
      const seconds = Math.round((value % 60000) / 1000);
      return minutes + ' min ' + seconds + ' s';
    }

    function analysisConfirmationFolderLabel() {
      const selectedFolder = elements.folder.selectedOptions[0];
      const folderName = selectedFolder?.textContent || currentFolderUri || '—';
      const baseDir = String(currentConfig.baseDir || '').trim();
      return baseDir ? folderName + ' / ' + baseDir : folderName;
    }

    function analysisConfirmationSelectedTemplateLabel() {
      const selectedOption = elements.analysisPipelineTemplate.selectedOptions[0];
      return selectedOption?.textContent?.trim() || translateLocalizationValue('Sin plantilla');
    }

    function analysisConfirmationScopeLabel(value, emptyLabel) {
      const normalized = String(value || '').trim();
      return normalized || translateLocalizationValue(emptyLabel);
    }

    function refreshAnalysisConfirmationSummary() {
      const selectedProject = elements.projectKey.selectedOptions[0];
      elements.analysisConfirmationProject.textContent =
        selectedProject?.dataset.projectName ||
        currentConfig.projectName ||
        currentConfig.projectKey ||
        '—';
      elements.analysisConfirmationFolder.textContent = analysisConfirmationFolderLabel();
      elements.analysisConfirmationFolder.title = currentFolderUri || '';
      elements.analysisConfirmationBranch.textContent =
        currentConfig.branch || translateLocalizationValue('Rama principal');
      elements.analysisConfirmationScanner.textContent =
        elements.scannerMode.selectedOptions[0]?.textContent ||
        elements.scannerMode.value ||
        translateLocalizationValue('Automático');
      elements.analysisConfirmationTemplate.textContent = analysisConfirmationSelectedTemplateLabel();
      elements.analysisConfirmationInclusions.textContent = analysisConfirmationScopeLabel(
        currentConfig.analysisInclusions,
        'Sin inclusiones configuradas'
      );
      elements.analysisConfirmationExclusions.textContent = analysisConfirmationScopeLabel(
        currentConfig.analysisExclusions,
        'Sin exclusiones configuradas'
      );

      const steps = collectAnalysisRunSteps().filter(step => step.enabled);
      elements.analysisConfirmationStepsSummary.textContent = '';
      for (const [index, step] of steps.entries()) {
        const item = document.createElement('li');
        const number = document.createElement('span');
        number.className = 'analysis-confirmation-step-number';
        number.textContent = String(index + 1);

        const copy = document.createElement('span');
        copy.className = 'analysis-confirmation-step-copy';
        const name = document.createElement('strong');
        name.textContent = step.name || translateLocalizationValue('Nuevo paso');
        const detail = document.createElement('small');
        detail.textContent = step.kind === 'sonar'
          ? translateLocalizationValue('Scanner configurado')
          : resolvePipelineCommandPreview(step.command || '—');
        const meta = document.createElement('small');
        meta.className = 'muted';
        const timing = analysisStepTiming(step);
        const policy = step.kind === 'sonar' || step.failurePolicy !== 'continue'
          ? translateLocalizationValue('Detener si falla')
          : translateLocalizationValue('Continuar si falla');
        const timingLabel = timing
          ? translateLocalizationValue('Media histórica: ') + formatAnalysisDuration(timing.averageDurationMs) +
            ' · ' + translateLocalizationValue('Última: ') + formatAnalysisDuration(timing.lastDurationMs)
          : translateLocalizationValue('Sin histórico de duración');
        meta.textContent = policy + ' · ' + timingLabel;
        copy.append(name, detail, meta);
        item.append(number, copy);
        elements.analysisConfirmationStepsSummary.appendChild(item);
      }
      elements.analysisConfirmationStepCount.textContent = String(steps.length);
      const estimatedDurationMs = steps.reduce((total, step) =>
        total + Number(analysisStepTiming(step)?.averageDurationMs || 0), 0
      );
      elements.analysisConfirmationEstimatedDuration.textContent = estimatedDurationMs > 0
        ? translateLocalizationValue('Duración estimada: ') + formatAnalysisDuration(estimatedDurationMs)
        : translateLocalizationValue('Duración estimada: sin histórico');
    }

    function showAnalysisConfirmationStep(stepNumber) {
      const review = stepNumber === 2;
      elements.analysisConfirmationTemplateStep.hidden = review;
      elements.analysisConfirmationReviewStep.hidden = !review;
      elements.analysisConfirmationBack.hidden = !review;
      elements.analysisConfirmationNext.hidden = review;
      elements.analysisConfirmationConfirm.hidden = !review;

      elements.analysisConfirmationTemplateStepIndicator.classList.toggle('is-active', !review);
      elements.analysisConfirmationTemplateStepIndicator.classList.toggle('is-complete', review);
      elements.analysisConfirmationReviewStepIndicator.classList.toggle('is-active', review);
      elements.analysisConfirmationReviewStepIndicator.classList.remove('is-complete');
      if (review) {
        elements.analysisConfirmationTemplateStepIndicator.removeAttribute('aria-current');
        elements.analysisConfirmationReviewStepIndicator.setAttribute('aria-current', 'step');
      } else {
        elements.analysisConfirmationTemplateStepIndicator.setAttribute('aria-current', 'step');
        elements.analysisConfirmationReviewStepIndicator.removeAttribute('aria-current');
      }

      if (review) {
        refreshAnalysisConfirmationSummary();
        elements.analysisConfirmationConfirm.focus();
      } else {
        requestAnimationFrame(() => {
          elements.analysisPipelineTemplate.closest('.select-dropdown')
            ?.querySelector('.select-dropdown__trigger')
            ?.focus();
        });
      }
    }

    function focusIncompleteAnalysisStep() {
      const incompleteRow = [...elements.analysisRunSteps.querySelectorAll('.analysis-run-step')]
        .find(analysisRunStepIsIncomplete);
      if (!incompleteRow) return false;
      incompleteRow.querySelector(
        '.pipeline-step-name-dropdown .select-dropdown__trigger'
      )?.focus();
      return true;
    }

    function reviewRepositoryAnalysis() {
      updateAnalysisConfirmAvailability();
      if (focusIncompleteAnalysisStep()) return;
      refreshAnalysisConfirmationSummary();
      showAnalysisConfirmationStep(2);
    }

    function requestAnalysis() {
      if (!isConfigured()) {
        navigate('configuration');
        setStatus('error', 'Configura primero la conexión y el proyecto.');
        return;
      }
      if (!canAnalyze()) {
        setStatus('error', 'El token no tiene permiso para ejecutar análisis en este proyecto.');
        return;
      }

      renderAnalysisRunSteps();
      refreshAnalysisConfirmationSummary();
      showAnalysisConfirmationStep(1);
      if (!elements.analysisConfirmationDialog.open) {
        elements.analysisConfirmationDialog.showModal();
      }
    }

    function confirmRepositoryAnalysis() {
      updateAnalysisConfirmAvailability();
      if (focusIncompleteAnalysisStep()) {
        showAnalysisConfirmationStep(1);
        return;
      }

      const steps = collectAnalysisRunSteps();
      const invalidStep = steps.find(step =>
        step.enabled && step.kind !== 'sonar' && !step.command
      );
      if (invalidStep) {
        showAnalysisConfirmationStep(1);
        const row = elements.analysisRunSteps.querySelector(
          '[data-step-id="' + CSS.escape(invalidStep.id) + '"]'
        );
        const templateTrigger = row?.querySelector(
          '.pipeline-step-name-dropdown .select-dropdown__trigger'
        );
        if (templateTrigger) templateTrigger.focus();
        else row?.querySelector('.pipeline-step-command')?.focus();
        return;
      }

      if (elements.analysisConfirmationDialog.open) {
        elements.analysisConfirmationDialog.close();
      }
      renderAnalysisState({
        running: true,
        phase: 'detecting',
        message: 'Detectando el tipo de proyecto…',
        scanner: '',
        startedAt: new Date().toISOString(),
        canCancel: false,
        log: [],
        steps: steps
          .filter(step => step.enabled)
          .map(step => ({ ...step, status: 'pending' }))
      });
      if (!elements.analysisDialog.open) elements.analysisDialog.showModal();
      vscode.postMessage({
        type: 'analyze',
        folderUri: currentFolderUri,
        analysisSteps: steps
      });
    }

    function cancelRepositoryAnalysis() {
      vscode.postMessage({ type: 'cancelAnalysis' });
    }

    function renderAnalysisState(state) {
      currentAnalysisState = state || {
        running: false,
        phase: 'idle',
        message: 'Listo para analizar el repositorio.',
        scanner: '',
        canCancel: false,
        log: [],
        steps: []
      };

      const running = Boolean(currentAnalysisState.running);
      const phase = currentAnalysisState.phase || 'idle';
      const message = currentAnalysisState.message || 'Listo para analizar el repositorio.';
      const scanner = currentAnalysisState.scanner || '';
      const logs = currentAnalysisState.log || [];

      elements.analysisMessage.textContent = message;
      elements.analysisScanner.textContent = scanner ? 'Scanner: ' + scanner : '';
      elements.analysisTitle.textContent = running ? 'Análisis en ejecución' : 'Análisis del repositorio';
      elements.analysisIcon.classList.toggle('running', running);
      elements.analyzeRepository.disabled = running;
      elements.analyzeEmpty.disabled = running;
      elements.cancelAnalysis.hidden = !currentAnalysisState.canCancel;
      elements.analysisDialogCancel.hidden = !currentAnalysisState.canCancel;
      elements.showAnalysisLog.disabled = logs.length === 0 && phase === 'idle';

      renderAnalysisStepper(currentAnalysisState.steps || []);
      elements.analysisDialogMessage.textContent = message;
      elements.analysisDialogScanner.textContent = scanner ? 'Scanner: ' + scanner : 'Detección automática';
      elements.analysisDialogIndicator.className = 'analysis-status-indicator ' + phase;
      renderTerminalLog(
        elements.analysisLog,
        logs,
        running
          ? 'Esperando la salida del nuevo análisis…'
          : 'Todavía no se ha ejecutado ningún análisis.'
      );

      const started = currentAnalysisState.startedAt ? new Date(currentAnalysisState.startedAt) : null;
      const completed = currentAnalysisState.completedAt ? new Date(currentAnalysisState.completedAt) : null;
      elements.analysisDialogTime.textContent = started
        ? 'Inicio: ' + started.toLocaleString(dashboardLocale) + (completed ? ' · Fin: ' + completed.toLocaleString(dashboardLocale) : '')
        : '';
    }

`;
