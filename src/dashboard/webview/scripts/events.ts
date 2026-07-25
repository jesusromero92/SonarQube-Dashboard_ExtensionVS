
export const EVENTS_SCRIPT = `    elements.goConfiguration.addEventListener('click', () => {
      vscode.postMessage({ type: 'navigate', page: 'configuration' });
    });
    elements.syncEmpty.addEventListener('click', requestRefresh);

    elements.folder.addEventListener('change', () => {
      currentFolderUri = elements.folder.value;
      loadedProjects = [];
      selectedProjectKey = '';
      summaryVisible = false;
      renderEmptyState();
      vscode.postMessage({ type: 'selectFolder', folderUri: elements.folder.value });
    });

    elements.projectKey.addEventListener('change', () => {
      selectedProjectKey = elements.projectKey.value;
    });

    elements.loadProjects.addEventListener('click', () => {
      selectedProjectKey = elements.projectKey.value || selectedProjectKey;
      setStatus('loading', 'Consultando proyectos y aplicaciones visibles…');
      vscode.postMessage({ type: 'loadProjects', ...values() });
    });

    elements.save.addEventListener('click', () => {
      selectedProjectKey = elements.projectKey.value;
      setStatus('loading', 'Guardando configuración…');
      vscode.postMessage({ type: 'save', ...values() });
    });

    elements.refresh.addEventListener('click', requestRefresh);
    elements.clear.addEventListener('click', () => vscode.postMessage({ type: 'clear' }));
    elements.issuesViewTab.addEventListener('click', () => {
      currentDataView = 'issues';
      renderDataView();
    });
    elements.hotspotsViewTab.addEventListener('click', () => {
      currentDataView = 'hotspots';
      renderDataView();
    });
    elements.overallScope.addEventListener('click', () => {
      currentScope = 'overall';
      applyScope();
    });
    elements.newCodeScope.addEventListener('click', () => {
      currentScope = 'newCode';
      applyScope();
    });
    elements.qualityGateButton.addEventListener('click', showQualityGateDialog);
    elements.filter.addEventListener('input', renderIssues);
    elements.hotspotFilter.addEventListener('input', renderHotspots);
    elements.pendingHotspotsOnly.addEventListener('change', renderHotspots);
    for (const header of document.querySelectorAll('[data-sort-header]')) {
      header.querySelector('button')?.addEventListener('click', () => {
        const tableName = header.dataset.sortHeader;
        const key = header.dataset.sortKey;
        const sort = topSort[tableName];
        if (sort.key === key) {
          sort.direction = sort.direction === 'asc' ? 'desc' : 'asc';
        } else {
          sort.key = key;
          sort.direction = key === 'key' ? 'asc' : 'desc';
        }
        if (tableName === 'files') {
          renderTopFiles();
        } else {
          renderTopRules();
        }
      });
    }
    elements.ruleDialogClose.addEventListener('click', () => elements.ruleDialog.close());
    elements.ruleDialog.addEventListener('click', event => {
      if (event.target === elements.ruleDialog) {
        elements.ruleDialog.close();
      }
    });
    const closeQualityGateDialog = () => elements.qualityGateDialog.close();
    elements.qualityGateDialogClose.addEventListener('click', closeQualityGateDialog);
    elements.qualityGateDialogFooterClose.addEventListener('click', closeQualityGateDialog);
    elements.qualityGateDialog.addEventListener('click', event => {
      if (event.target === elements.qualityGateDialog) {
        elements.qualityGateDialog.close();
      }
    });
    const closeHotspotDialog = () => elements.hotspotDialog.close();
    elements.hotspotDialogClose.addEventListener('click', closeHotspotDialog);
    elements.closeHotspotDialog.addEventListener('click', closeHotspotDialog);
    elements.hotspotDialog.addEventListener('click', event => {
      if (event.target === elements.hotspotDialog) closeHotspotDialog();
    });
    elements.openHotspotFile.addEventListener('click', () => {
      if (!selectedHotspot) return;
      vscode.postMessage({
        type: 'openIssue',
        fileUri: selectedHotspot.fileUri,
        line: selectedHotspot.line
      });
    });

    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'navigate':
          navigate(message.page);
          break;
        case 'state':
          renderState(message);
          break;
        case 'configurationSaved':
          renderConfigurationSaved(message.config || {});
          break;
        case 'projectsLoading':
          setStatus('loading', 'Consultando proyectos y aplicaciones visibles…');
          break;
        case 'projectsLoaded':
          setProjectOptions(
            message.projects || [],
            selectedProjectKey || currentConfig.projectKey
          );
          setBusy(false);
          break;
        case 'status':
          setStatus(message.kind, message.message);
          if (message.kind !== 'loading') {
            setBusy(false);
          }
          break;
        case 'summary':
          renderSummary(message.summary || {}, Boolean(message.visible));
          break;
        case 'loading':
          setDashboardLoading(message.loading);
          break;
        case 'showQualityGate':
          showQualityGateDialog();
          break;
        case 'hotspotDetailLoading':
          elements.hotspotDialogLoading.textContent = 'Cargando detalle…';
          elements.hotspotDialogLoading.hidden = false;
          elements.hotspotDialogContent.hidden = true;
          break;
        case 'hotspotDetail':
          renderHotspotDetail(message.detail || {});
          break;
        case 'hotspotDetailError':
          elements.hotspotDialogLoading.textContent = message.message || 'No se pudo cargar el detalle.';
          elements.hotspotDialogLoading.hidden = false;
          elements.hotspotDialogContent.hidden = true;
          break;
      }
    });

    navigate('data');
    vscode.postMessage({ type: 'ready' });
  `;
