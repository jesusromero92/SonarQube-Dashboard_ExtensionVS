export const DASHBOARD_EVENTS_SCRIPT = `
    elements.refresh.addEventListener('click', requestRefresh);
    elements.retryUnavailable.addEventListener('click', requestRefresh);
    elements.retryStaleSync.addEventListener('click', requestRefresh);
    elements.reviewUnavailableConfiguration.addEventListener('click', () => {
      navigate('configuration');
    });
    elements.analyzeRepository.addEventListener(
      'click',
      requestAnalysis
    );
    elements.showAnalysisLog.addEventListener('click', () => {
      elements.analysisDialog.showModal();
    });
    elements.cancelAnalysis.addEventListener(
      'click',
      cancelRepositoryAnalysis
    );
    elements.clear.addEventListener('click', () => {
      vscode.postMessage({ type: 'clear' });
    });
    const bindEvolutionGranularity = (element, chart, render) => {
      element.addEventListener('change', () => {
        evolutionGranularities[chart] = element.value;
        render();
      });
    };
    bindEvolutionGranularity(
      elements.typeEvolutionGranularity,
      'types',
      renderEvolutionCharts
    );
    bindEvolutionGranularity(
      elements.severityEvolutionGranularity,
      'severity',
      renderEvolutionCharts
    );
    bindEvolutionGranularity(
      elements.coverageEvolutionGranularity,
      'coverage',
      renderCoverageEvolution
    );
    bindEvolutionGranularity(
      elements.duplicationEvolutionGranularity,
      'duplication',
      renderCoverageEvolution
    );

    elements.issuesViewTab.addEventListener('click', () => {
      currentDataView = 'issues';
      renderDataView();
    });
    elements.hotspotsViewTab.addEventListener('click', () => {
      currentDataView = 'hotspots';
      renderDataView();
    });
    elements.coverageViewTab.addEventListener('click', () => {
      currentDataView = 'coverage';
      renderCoverageView();
      renderDataView();
    });

    elements.overallScope.addEventListener('click', () => {
      currentScope = 'overall';
      applyScope();
      vscode.postMessage({
        type: 'scopeChanged',
        scope: currentScope
      });
    });
    elements.newCodeScope.addEventListener('click', () => {
      currentScope = 'newCode';
      applyScope();
      vscode.postMessage({
        type: 'scopeChanged',
        scope: currentScope
      });
    });

    elements.qualityGateButton.addEventListener(
      'click',
      showQualityGateDialog
    );
    elements.filter.addEventListener('input', renderIssues);
    elements.hotspotFilter.addEventListener(
      'input',
      renderHotspots
    );
    elements.pendingHotspotsOnly.addEventListener(
      'change',
      renderHotspots
    );

    for (const header of document.querySelectorAll('[data-sort-header]')) {
      header.querySelector('button')?.addEventListener('click', () => {
        const tableName = header.dataset.sortHeader;
        const key = header.dataset.sortKey;
        const sort = tableName === 'issues'
          ? issueSort
          : topSort[tableName];
        if (!sort || !key) return;

        if (sort.key === key) {
          sort.direction =
            sort.direction === 'asc'
              ? 'desc'
              : 'asc';
        } else {
          sort.key = key;
          sort.direction =
            key === 'severityRank' || key === 'count'
              ? 'desc'
              : 'asc';
        }

        if (tableName === 'issues') {
          renderIssues();
        } else if (tableName === 'files') {
          renderTopFiles();
        } else if (tableName === 'rules') {
          renderTopRules();
        }
      });
    }
`;
