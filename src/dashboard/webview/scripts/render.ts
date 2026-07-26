
export const RENDER_SCRIPT = `    function renderDataView() {
      const showIssues = currentDataView === 'issues';
      const showHotspots = currentDataView === 'hotspots';
      const showCoverage = currentDataView === 'coverage';
      elements.issuesView.hidden = !showIssues;
      elements.hotspotsView.hidden = !showHotspots;
      elements.coverageView.hidden = !showCoverage;
      elements.issuesViewTab.classList.toggle('active', showIssues);
      elements.hotspotsViewTab.classList.toggle('active', showHotspots);
      elements.coverageViewTab.classList.toggle('active', showCoverage);
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
      renderCoverageView();
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
