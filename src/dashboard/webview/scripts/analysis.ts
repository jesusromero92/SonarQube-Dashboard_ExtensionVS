export const ANALYSIS_SCRIPT = `    function requestAnalysis() {
      if (!isConfigured()) {
        navigate('configuration');
        setStatus('error', 'Configura primero la conexión y el proyecto.');
        return;
      }
      if (!canAnalyze()) {
        setStatus('error', 'El token no tiene permiso para ejecutar análisis en este proyecto.');
        return;
      }

      const selectedFolder = elements.folder.selectedOptions[0];
      const selectedProject = elements.projectKey.selectedOptions[0];
      elements.analysisConfirmationProject.textContent =
        selectedProject?.dataset.projectName ||
        currentConfig.projectName ||
        currentConfig.projectKey ||
        '—';
      elements.analysisConfirmationFolder.textContent =
        selectedFolder?.textContent || currentFolderUri || '—';
      elements.analysisConfirmationScanner.textContent =
        elements.scannerMode.selectedOptions[0]?.textContent ||
        elements.scannerMode.value ||
        'Automático';

      renderAnalysisRunSteps();
      if (!elements.analysisConfirmationDialog.open) {
        elements.analysisConfirmationDialog.showModal();
      }
    }

    function confirmRepositoryAnalysis() {
      updateAnalysisConfirmAvailability();
      const incompleteRow = [...elements.analysisRunSteps.querySelectorAll('.analysis-run-step')]
        .find(analysisRunStepIsIncomplete);
      if (incompleteRow) {
        incompleteRow.querySelector(
          '.pipeline-step-name-dropdown .select-dropdown__trigger'
        )?.focus();
        return;
      }

      const steps = collectAnalysisRunSteps();
      const invalidStep = steps.find(step =>
        step.enabled && step.kind !== 'sonar' && !step.command
      );
      if (invalidStep) {
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
