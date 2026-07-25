
export const RENDER_SCRIPT = `    function renderDataView() {
      const showIssues = currentDataView === 'issues';
      elements.issuesView.hidden = !showIssues;
      elements.hotspotsView.hidden = showIssues;
      elements.issuesViewTab.classList.toggle('active', showIssues);
      elements.hotspotsViewTab.classList.toggle('active', !showIssues);
    }

    function applyScope() {
      const scoped = scopeData(currentSummary);
      currentIssues = scoped.issues || [];
      currentHotspots = scoped.hotspots || [];
      elements.overallScope.classList.toggle('active', currentScope === 'overall');
      elements.newCodeScope.classList.toggle('active', currentScope === 'newCode');
      elements.hotspotsTabCount.textContent = String(currentHotspots.length);
      renderMetricsSummary(currentSummary);
      renderIssues();
      renderTopFiles();
      renderTopRules();
      renderHotspots();
      renderEvolutionCharts();
      renderQualityGateButton();
      renderDataView();
    }

    function renderSummary(summary, visible) {
      currentSummary = summary || { published: 0, issues: [], severity: [], evolution: [] };
      summaryVisible = Boolean(visible);
      applyScope();
      renderEmptyState();
    }

    function requestRefresh() {
      if (!isConfigured()) {
        navigate('configuration');
        setStatus('error', 'Configura primero la conexión y el proyecto.');
        return;
      }
      setStatus('loading', 'Actualizando issues…');
      vscode.postMessage({ type: 'refresh' });
    }

`;
