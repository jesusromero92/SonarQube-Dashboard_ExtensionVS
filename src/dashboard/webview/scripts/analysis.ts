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
      if (!elements.analysisDialog.open) elements.analysisDialog.showModal();
      vscode.postMessage({ type: 'analyze', folderUri: currentFolderUri });
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
        log: []
      };

      const running = Boolean(currentAnalysisState.running);
      const phase = currentAnalysisState.phase || 'idle';
      const message = currentAnalysisState.message || 'Listo para analizar el repositorio.';
      const scanner = currentAnalysisState.scanner || '';
      const logs = currentAnalysisState.log || [];

      elements.analysisMessage.textContent = message;
      elements.analysisScanner.textContent = scanner ? 'Scanner: ' + scanner : '';
      elements.analysisTitle.textContent = running ? 'Análisis en ejecución' : 'Análisis del repositorio';
      elements.analyzeRepository.disabled = running;
      elements.analyzeEmpty.disabled = running;
      elements.cancelAnalysis.hidden = !currentAnalysisState.canCancel;
      elements.analysisDialogCancel.hidden = !currentAnalysisState.canCancel;
      elements.showAnalysisLog.disabled = logs.length === 0 && phase === 'idle';

      elements.analysisDialogMessage.textContent = message;
      elements.analysisDialogScanner.textContent = scanner ? 'Scanner: ' + scanner : 'Detección automática';
      elements.analysisDialogIndicator.className = 'analysis-status-indicator ' + phase;
      elements.analysisLog.textContent = logs.length ? logs.join('\\n') : 'Todavía no se ha ejecutado ningún análisis.';
      elements.analysisLog.scrollTop = elements.analysisLog.scrollHeight;

      const started = currentAnalysisState.startedAt ? new Date(currentAnalysisState.startedAt) : null;
      const completed = currentAnalysisState.completedAt ? new Date(currentAnalysisState.completedAt) : null;
      elements.analysisDialogTime.textContent = started
        ? 'Inicio: ' + started.toLocaleString(dashboardLocale) + (completed ? ' · Fin: ' + completed.toLocaleString(dashboardLocale) : '')
        : '';
    }

`;
