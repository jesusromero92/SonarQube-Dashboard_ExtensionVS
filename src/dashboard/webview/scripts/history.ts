export const HISTORY_SCRIPT = `    function formatDuration(durationMs) {
      const value = Math.max(0, Number(durationMs) || 0);
      if (value < 1000) return value + ' ms';
      const seconds = value / 1000;
      if (seconds < 60) return seconds.toFixed(seconds < 10 ? 1 : 0) + ' s';
      const minutes = Math.floor(seconds / 60);
      const remaining = Math.round(seconds % 60);
      return minutes + ' min ' + remaining + ' s';
    }

    function formatHistoryDate(value) {
      if (!value) return '—';
      const date = new Date(value);
      return Number.isFinite(date.getTime())
        ? date.toLocaleString(dashboardLocale)
        : '—';
    }

    function historyStatusLabel(status) {
      const labels = {
        running: 'En curso',
        success: 'Correcto',
        warning: 'Con advertencias',
        failed: 'Fallido',
        cancelled: 'Cancelado'
      };
      return translateLocalizationValue(labels[status] || status || '—');
    }

    function historyStepStatusLabel(status) {
      const labels = {
        pending: 'Pendiente',
        running: 'En curso',
        success: 'Correcto',
        warning: 'Con advertencias',
        failed: 'Fallido',
        skipped: 'Omitido'
      };
      return translateLocalizationValue(labels[status] || status || '—');
    }

    function historyFailurePolicyLabel(policy) {
      return translateLocalizationValue(
        policy === 'continue' ? 'Continuar si falla' : 'Detener si falla'
      );
    }

    function historyStepsSignature(steps) {
      return JSON.stringify((Array.isArray(steps) ? steps : []).map(step => [
        step.id || '',
        step.name || '',
        step.status || 'pending',
        Number(step.durationMs) || 0,
        step.command || '',
        step.failurePolicy || 'stop',
        step.message || ''
      ]));
    }

    function appendPipelineStepDetail(container, label, value, code) {
      if (!value) return;
      const row = document.createElement('div');
      row.className = 'pipeline-execution-step-detail';
      const term = document.createElement('span');
      term.textContent = translateLocalizationValue(label);
      const description = document.createElement(code ? 'code' : 'strong');
      description.textContent = String(value);
      row.append(term, description);
      container.appendChild(row);
    }

    function renderPipelineHistorySteps(container, steps) {
      const nextSteps = Array.isArray(steps) ? steps : [];
      const signature = historyStepsSignature(nextSteps);
      if (container.dataset.signature === signature) return;

      const expandedStepIds = new Set(
        [...container.querySelectorAll('details[open]')]
          .map(item => item.dataset.stepId)
          .filter(Boolean)
      );
      container.dataset.signature = signature;
      container.replaceChildren();

      for (const step of nextSteps) {
        const item = document.createElement('details');
        item.className = 'accordion pipeline-execution-step pipeline-execution-step--' +
          (step.status || 'pending');
        item.dataset.stepId = step.id || '';
        item.open = step.status === 'running' || expandedStepIds.has(step.id);

        const summary = document.createElement('summary');
        summary.className = 'pipeline-execution-step-summary';
        const icon = document.createElement('span');
        icon.className = 'pipeline-history-step-icon';
        const statusIcon = createAnalysisStepStatusIcon(step.status);
        if (statusIcon) icon.appendChild(statusIcon);

        const name = document.createElement('strong');
        name.textContent = step.name || step.id || '—';
        const status = document.createElement('span');
        status.className = 'pipeline-execution-step-status';
        status.textContent = historyStepStatusLabel(step.status);
        const duration = document.createElement('span');
        duration.className = 'muted pipeline-execution-step-duration';
        duration.textContent = formatDuration(step.durationMs);
        summary.append(icon, name, status, duration);

        const details = document.createElement('div');
        details.className = 'accordion__content pipeline-execution-step-details';
        appendPipelineStepDetail(details, 'Estado', historyStepStatusLabel(step.status));
        appendPipelineStepDetail(
          details,
          'Política de fallo',
          historyFailurePolicyLabel(step.failurePolicy)
        );
        appendPipelineStepDetail(details, 'Comando', step.command, true);
        appendPipelineStepDetail(details, 'Mensaje', step.message);
        appendPipelineStepDetail(details, 'Inicio', formatHistoryDate(step.startedAt));
        if (step.completedAt) {
          appendPipelineStepDetail(details, 'Fin', formatHistoryDate(step.completedAt));
        }

        item.append(summary, details);
        container.appendChild(item);
      }
    }

    function renderPipelineHistoryLog(container, lines) {
      const visibleLineCount = renderTerminalLog(container, lines, '');
      elements.historyLogCount.textContent = visibleLineCount + ' ' +
        translateLocalizationValue(visibleLineCount === 1 ? 'línea' : 'líneas');
    }

    function renderHistoryStatusIcon(status) {
      const container = elements.historyEntryStatusIcon;
      if (!container || container.dataset.status === status) return;
      container.dataset.status = status || 'failed';
      container.replaceChildren();
      const icon = createAnalysisStepStatusIcon(status);
      if (icon) container.appendChild(icon);
    }

    function renderPipelineExecutionDetail(entry) {
      elements.historyList.dataset.historyEntryId = entry.id || '';
      elements.historyList.className = 'pipeline-execution-detail pipeline-execution-detail--' +
        (entry.status || 'failed');
      renderHistoryStatusIcon(entry.status);

      elements.historyEntryStatus.textContent = historyStatusLabel(entry.status);
      elements.historyEntryStatus.className = 'pipeline-history-status pipeline-history-status--' +
        (entry.status || 'failed');
      elements.historyEntryTitle.textContent =
        entry.projectName || entry.projectKey || translateLocalizationValue('Detalle de la ejecución del pipeline');
      elements.historyEntryMessage.textContent =
        entry.message || historyStatusLabel(entry.status);
      elements.historyEntryProject.textContent =
        entry.projectName || entry.projectKey || '—';
      elements.historyEntryScanner.textContent = entry.scanner || '—';
      elements.historyEntryBranch.textContent =
        entry.branch || translateLocalizationValue('Rama principal');
      elements.historyEntryStarted.textContent = formatHistoryDate(entry.startedAt);
      elements.historyEntryDuration.textContent = formatDuration(entry.durationMs);
      renderBaselineComparison(elements.historyComparison, entry.comparison);
      elements.historyStepsCount.textContent = String(
        Array.isArray(entry.steps) ? entry.steps.length : 0
      );

      renderPipelineHistorySteps(elements.historySteps, entry.steps);
      renderPipelineHistoryLog(elements.historyLog, entry.log);
    }

    function renderPipelineHistory(entries, selectedEntryId) {
      const history = Array.isArray(entries) ? entries : [];
      currentHistoryEntryId = selectedEntryId || currentHistoryEntryId || '';
      let entry = currentHistoryEntryId
        ? history.find(item => item.id === currentHistoryEntryId)
        : null;

      if (!entry && history.length > 0) {
        entry = history[0];
        currentHistoryEntryId = entry.id || '';
      }

      elements.historyLoading.hidden = true;
      elements.historyEmpty.hidden = Boolean(entry);
      elements.historyList.hidden = !entry;

      if (!entry) {
        elements.historyEmpty.textContent = translateLocalizationValue(
          'Selecciona una ejecución en «Ejecuciones del pipeline».'
        );
        return;
      }

      renderPipelineExecutionDetail(entry);
    }

    function analysisHistoryStatus(state) {
      if (state?.running) return 'running';
      if (state?.phase === 'success') return 'success';
      if (state?.phase === 'cancelled') return 'cancelled';
      if (state?.steps?.some(step => step.status === 'warning')) return 'warning';
      return 'failed';
    }

    function updateLivePipelineHistoryItem(entry) {
      if (
        currentHistoryEntryId !== 'running-analysis' ||
        elements.historyList.dataset.historyEntryId !== 'running-analysis'
      ) {
        return false;
      }
      renderPipelineExecutionDetail(entry);
      return true;
    }

    function renderLivePipelineHistory(state) {
      if (currentPage !== 'history' || currentHistoryEntryId !== 'running-analysis') return;

      const startedAt = state.startedAt || new Date().toISOString();
      const completedAt = state.completedAt || '';
      const active = {
        id: 'running-analysis',
        projectKey: currentConfig.projectKey || '',
        projectName: currentConfig.projectName || currentConfig.projectKey || 'SonarQube',
        branch: currentConfig.branch || '',
        scanner: state.scanner || '',
        status: analysisHistoryStatus(state),
        message: state.message || '',
        startedAt,
        completedAt,
        durationMs: Math.max(
          0,
          new Date(completedAt || Date.now()).getTime() - new Date(startedAt).getTime()
        ),
        steps: Array.isArray(state.steps) ? state.steps : [],
        log: Array.isArray(state.log) ? state.log : [],
        comparison: state.comparison
      };

      if (!updateLivePipelineHistoryItem(active)) {
        elements.historyLoading.hidden = true;
        elements.historyEmpty.hidden = true;
        elements.historyList.hidden = false;
        renderPipelineExecutionDetail(active);
      }
    }
`;
