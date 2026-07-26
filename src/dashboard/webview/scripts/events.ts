
export const EVENTS_SCRIPT = `    elements.goConfiguration.addEventListener('click', () => {
      vscode.postMessage({ type: 'navigate', page: 'configuration' });
    });
    const syncTableScrollbarGutters = () => {
      for (const table of document.querySelectorAll('.body-scroll-table table')) {
        const body = table.tBodies[0];
        if (!body) continue;
        const scrollbarWidth = Math.max(0, body.offsetWidth - body.clientWidth);
        table.style.setProperty('--table-scrollbar-width', scrollbarWidth + 'px');
      }
    };
    const tableScrollbarObserver = new ResizeObserver(syncTableScrollbarGutters);
    for (const body of document.querySelectorAll('.body-scroll-table tbody')) {
      tableScrollbarObserver.observe(body);
    }
    window.addEventListener('resize', syncTableScrollbarGutters);
    requestAnimationFrame(syncTableScrollbarGutters);
    const preventBackgroundScroll = event => {
      const openDialog = Array.from(document.querySelectorAll('dialog[open]')).pop();
      const target = event.target instanceof Element ? event.target : null;
      const modalScrollBody = target?.closest(
        '.dialog-scroll-body, .rule-dialog-body, .analysis-log'
      );
      if (openDialog && (!modalScrollBody || !openDialog.contains(modalScrollBody))) {
        event.preventDefault();
      }
    };
    document.addEventListener('wheel', preventBackgroundScroll, {
      capture: true,
      passive: false
    });
    document.addEventListener('touchmove', preventBackgroundScroll, {
      capture: true,
      passive: false
    });
    let modalScrollLocked = false;
    const updateModalScrollLock = () => {
      const hasOpenDialog = Boolean(document.querySelector('dialog[open]'));
      if (hasOpenDialog && !modalScrollLocked) {
        document.documentElement.classList.add('modal-scroll-locked');
        modalScrollLocked = true;
      } else if (!hasOpenDialog && modalScrollLocked) {
        document.documentElement.classList.remove('modal-scroll-locked');
        modalScrollLocked = false;
      }
    };
    const modalObserver = new MutationObserver(updateModalScrollLock);
    for (const dialog of document.querySelectorAll('dialog')) {
      modalObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    }
    elements.analyzeEmpty.addEventListener('click', requestAnalysis);
    elements.syncEmpty.addEventListener('click', requestRefresh);

    elements.language.addEventListener('change', () => {
      vscode.postMessage({ type: 'setLanguage', language: elements.language.value });
    });

    elements.folder.addEventListener('change', () => {
      currentFolderUri = elements.folder.value;
      loadedProjects = [];
      selectedProjectKey = '';
      summaryVisible = false;
      renderEmptyState();
      vscode.postMessage({ type: 'selectFolder', folderUri: elements.folder.value });
    });

    elements.scannerMode.addEventListener('change', () => {
      elements.customScannerField.hidden = elements.scannerMode.value !== 'custom';
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
    elements.analyzeRepository.addEventListener('click', requestAnalysis);
    elements.showAnalysisLog.addEventListener('click', () => elements.analysisDialog.showModal());
    elements.cancelAnalysis.addEventListener('click', cancelRepositoryAnalysis);
    elements.clear.addEventListener('click', () => vscode.postMessage({ type: 'clear' }));
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
      vscode.postMessage({ type: 'scopeChanged', scope: currentScope });
    });
    elements.newCodeScope.addEventListener('click', () => {
      currentScope = 'newCode';
      applyScope();
      vscode.postMessage({ type: 'scopeChanged', scope: currentScope });
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

    const closeIssueDialog = () => {
      if (elements.issueDialog.open) elements.issueDialog.close();
    };
    elements.issueDialogClose.addEventListener('click', closeIssueDialog);
    elements.closeIssueDialog.addEventListener('click', closeIssueDialog);
    elements.issueDialog.addEventListener('click', event => {
      if (event.target === elements.issueDialog) closeIssueDialog();
    });
    elements.issueAssign.addEventListener('click', () => {
      if (!selectedManagedIssue) return;
      vscode.postMessage({
        type: 'mutateIssue',
        mutationKind: 'assign',
        issueKey: selectedManagedIssue.key,
        folderUri: selectedManagedIssue.folderUri,
        assignee: elements.issueAssignee.value
      });
    });
    elements.issueAddComment.addEventListener('click', () => {
      if (!selectedManagedIssue || !elements.issueComment.value.trim()) return;
      vscode.postMessage({
        type: 'mutateIssue',
        mutationKind: 'comment',
        issueKey: selectedManagedIssue.key,
        folderUri: selectedManagedIssue.folderUri,
        comment: elements.issueComment.value.trim()
      });
    });
    elements.issueFlowSelect.addEventListener('change', () => {
      selectedFlowIndex = Number(elements.issueFlowSelect.value) || 0;
      selectedFlowLocationIndex = 0;
      if (selectedManagedIssue) renderIssueFlows(selectedManagedIssue);
    });
    const moveFlow = direction => {
      if (!selectedManagedIssue) return;
      const flows = selectedManagedIssue.flows?.length
        ? selectedManagedIssue.flows
        : [{ index: 0, locations: selectedManagedIssue.secondaryLocations || [] }];
      const locations = flows[selectedFlowIndex]?.locations || [];
      if (!locations.length) return;
      selectedFlowLocationIndex = (selectedFlowLocationIndex + direction + locations.length) % locations.length;
      renderIssueFlows(selectedManagedIssue);
      vscode.postMessage({
        type: 'selectFlowLocation',
        issueKey: selectedManagedIssue.key,
        flowIndex: selectedFlowIndex,
        locationIndex: selectedFlowLocationIndex
      });
    };
    elements.issueFlowPrevious.addEventListener('click', () => moveFlow(-1));
    elements.issueFlowNext.addEventListener('click', () => moveFlow(1));
    elements.openManagedIssueFile.addEventListener('click', () => {
      if (!selectedManagedIssue) return;
      vscode.postMessage({ type: 'openIssue', fileUri: selectedManagedIssue.fileUri, line: selectedManagedIssue.line });
    });

    const closeCoverageDialog = () => {
      if (elements.coverageDialog.open) elements.coverageDialog.close();
    };
    elements.coverageDialogClose.addEventListener('click', closeCoverageDialog);
    elements.closeCoverageDialog.addEventListener('click', closeCoverageDialog);
    elements.coverageDialog.addEventListener('click', event => {
      if (event.target === elements.coverageDialog) closeCoverageDialog();
    });
    elements.openCoverageFile.addEventListener('click', () => {
      if (!selectedCoverageFile) return;
      vscode.postMessage({ type: 'openIssue', fileUri: selectedCoverageFile.fileUri, line: 1 });
    });

    const closeAnalysisDialog = () => {
      if (elements.analysisDialog.open) {
        elements.analysisDialog.close();
      }
    };
    elements.analysisDialogClose.addEventListener('click', closeAnalysisDialog);
    elements.analysisDialogFooterClose.addEventListener('click', closeAnalysisDialog);
    elements.analysisDialogCancel.addEventListener('click', cancelRepositoryAnalysis);
    elements.analysisDialog.addEventListener('click', event => {
      if (event.target === elements.analysisDialog) {
        closeAnalysisDialog();
      }
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
        case 'showIssueDetail':
          if (message.issue) showIssueLifecycleDialog(message.issue);
          break;
        case 'showCoverageView':
          currentDataView = 'coverage';
          renderCoverageView();
          renderDataView();
          if (message.fileUri) {
            const file = currentSummary.coverage?.files?.find(item => item.fileUri === message.fileUri);
            if (file) openCoverageDetail(file);
          }
          break;
        case 'issueLifecycleLoading':
          elements.issueDialogLoading.textContent = 'Cargando gestión del defecto…';
          elements.issueDialogLoading.hidden = false;
          elements.issueDialogContent.hidden = true;
          break;
        case 'issueLifecycle':
          renderIssueLifecycle(message.detail || {});
          break;
        case 'issueMutationLoading':
          elements.issueDialogLoading.textContent = 'Actualizando defecto en SonarQube…';
          elements.issueDialogLoading.hidden = false;
          elements.issueDialogContent.hidden = true;
          break;
        case 'issueLifecycleError':
          setIssueLifecycleError(message.message);
          break;
        case 'coverageDetailLoading':
          elements.coverageDialogLoading.textContent = 'Cargando cobertura y duplicaciones…';
          elements.coverageDialogLoading.hidden = false;
          elements.coverageDialogContent.hidden = true;
          break;
        case 'coverageDetail':
          renderCoverageDetail(message.detail || {});
          break;
        case 'coverageDetailError':
          elements.coverageDialogLoading.textContent = message.message || 'No se pudo cargar la cobertura y duplicaciones.';
          elements.coverageDialogLoading.hidden = false;
          elements.coverageDialogContent.hidden = true;
          break;
        case 'showHotspotDetail':
          if (message.hotspot) showHotspotDialog(message.hotspot);
          break;
        case 'analysisState':
          renderAnalysisState(message.state || {});
          break;
        case 'showAnalysisDialog':
          if (!elements.analysisDialog.open) elements.analysisDialog.showModal();
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
