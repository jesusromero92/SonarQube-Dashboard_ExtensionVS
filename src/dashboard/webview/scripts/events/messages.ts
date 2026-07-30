export const MESSAGE_EVENTS_SCRIPT = `
    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.type) {
        case 'languageChanged':
          applyDashboardLocalization(message.localization);
          break;

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
          elements.sonarCompatibility.hidden = true;
          setConnectionBusy(true);
          break;

        case 'projectsLoaded':
          connectionAttemptPending = false;
          if (
            (!message.folderUri ||
              message.folderUri === currentFolderUri) &&
            (!message.serverUrl ||
              message.serverUrl.replace(/\\/+$/, '') ===
                elements.serverUrl.value.trim().replace(/\\/+$/, ''))
          ) {
            connectionDraftDirty = true;
            connectionDraftFolderUri = currentFolderUri;
            connectionValidated = true;
            currentConfig.serverUrl = elements.serverUrl.value.trim();
            currentConfig.hasToken = true;
            currentConfig.projectKey = '';
            currentConfig.projectName = '';
            selectedProjectKey = '';
            elements.configState.textContent = 'Sin configurar';
            setProjectOptions(
              message.projects || [],
              '',
              false,
              message.creationCapabilities
            );
            currentConfig.sonarCompatibility =
              message.sonarCompatibility;
            renderSonarCompatibility(
              message.sonarCompatibility,
              false
            );
            if (message.tokenStored) {
              currentConfig.hasToken = true;
              elements.token.value = '';
              elements.token.placeholder =
                'Token guardado · escribe otro para sustituirlo';
              elements.tokenHint.textContent =
                'Hay un token guardado de forma segura para esta carpeta.';
            }
            renderEmptyState();
          }
          setConnectionBusy(false);
          break;

        case 'connectionValidationFailed':
          if (!message.folderUri || message.folderUri === currentFolderUri) {
            connectionDraftDirty = true;
            connectionDraftFolderUri = currentFolderUri;
            connectionValidated = false;
            currentConfig.hasToken = false;
            currentConfig.sonarCompatibility = undefined;
            elements.configState.textContent = 'Sin configurar';
            resetProjectOptionsForDisconnectedConnection();
            elements.sonarCompatibility.hidden = true;
            renderEmptyState();
          }
          break;

        case 'sonarCompatibilityError':
          if (
            !connectionDraftDirty &&
            (!message.folderUri ||
              message.folderUri === currentFolderUri) &&
            (!message.serverUrl ||
              message.serverUrl.replace(/\\/+$/, '') ===
                elements.serverUrl.value.trim().replace(/\\/+$/, ''))
          ) {
            renderSonarUnavailable(message.message);
          }
          break;

        case 'sonarCompatibility':
          if (
            !connectionDraftDirty &&
            (!message.folderUri ||
              message.folderUri === currentFolderUri) &&
            (!message.serverUrl ||
              message.serverUrl.replace(/\\/+$/, '') ===
                elements.serverUrl.value.trim().replace(/\\/+$/, ''))
          ) {
            currentConfig.sonarCompatibility =
              message.sonarCompatibility;
            renderSonarCompatibility(
              message.sonarCompatibility,
              false
            );
          }
          break;

        case 'componentCreationLoading':
          setCreateComponentBusy(true);
          break;

        case 'componentCreated':
          setCreateComponentBusy(false);
          setProjectOptions(
            message.projects || [],
            message.component?.key || '',
            true,
            message.creationCapabilities
          );
          if (message.component?.key) {
            elements.projectKey.value = message.component.key;
            selectedProjectKey = message.component.key;
            refreshSelectDropdown(elements.projectKey);
            updateSaveAvailability();
          }
          if (elements.createComponentDialog.open) {
            elements.createComponentDialog.close();
          }
          break;

        case 'componentCreationError':
          setCreateComponentBusy(false);
          showCreateComponentError(
            message.message || 'No se pudo crear el componente.'
          );
          break;

        case 'status':
          setStatus(message.kind, message.message);
          if (message.kind === 'error' && connectionAttemptPending) {
            connectionAttemptPending = false;
            connectionValidated = false;
            setConnectionBusy(false);
            elements.sonarCompatibility.hidden = true;
            elements.sonarProfileProvisional.hidden = true;
            elements.sonarProfileFallback.hidden = true;
            elements.sonarProfile.textContent = '—';
          }
          if (message.kind !== 'loading') {
            setBusy(false);
          }
          break;

        case 'summary': {
          const summary = message.summary || {};
          const initialSyncFailed =
            summary.syncStatus === 'error' &&
            summary.hasSuccessfulSync !== true;
          if (initialSyncFailed) {
            setDashboardLoading(false);
          }
          renderSummary(summary, Boolean(message.visible));
          break;
        }

        case 'loading': {
          const initialSyncFailed =
            currentSummary.syncStatus === 'error' &&
            currentSummary.hasSuccessfulSync !== true;
          setDashboardLoading(initialSyncFailed ? false : message.loading);
          break;
        }

        case 'showQualityGate':
          showQualityGateDialog();
          break;

        case 'showIssueDetail':
          if (message.issue) {
            showIssueLifecycleDialog(message.issue);
          }
          break;

        case 'showCoverageView':
          currentDataView = 'coverage';
          renderCoverageView();
          renderDataView();
          if (message.fileUri) {
            const file = currentSummary.coverage?.files?.find(
              item => item.fileUri === message.fileUri
            );
            if (file) {
              openCoverageDetail(file);
            }
          }
          break;

        case 'issueLifecycleLoading':
          elements.issueDialogLoading.textContent =
            'Cargando gestión del defecto…';
          elements.issueDialogLoading.hidden = false;
          elements.issueDialogContent.hidden = true;
          break;

        case 'issueLifecycle':
          renderIssueLifecycle(message.detail || {});
          break;

        case 'issueMutationLoading':
          elements.issueDialogLoading.textContent =
            'Actualizando defecto en SonarQube…';
          elements.issueDialogLoading.hidden = false;
          elements.issueDialogContent.hidden = true;
          break;

        case 'issueLifecycleError':
          setIssueLifecycleError(message.message);
          break;

        case 'coverageDetailLoading':
          elements.coverageDialogLoading.textContent =
            'Cargando cobertura y duplicaciones…';
          elements.coverageDialogLoading.hidden = false;
          elements.coverageDialogContent.hidden = true;
          break;

        case 'coverageDetail':
          renderCoverageDetail(message.detail || {});
          break;

        case 'coverageDetailError':
          elements.coverageDialogLoading.textContent =
            message.message ||
            'No se pudo cargar la cobertura y duplicaciones.';
          elements.coverageDialogLoading.hidden = false;
          elements.coverageDialogContent.hidden = true;
          break;

        case 'ruleDetailLoading':
          elements.ruleDialogLoading.textContent =
            dashboardMessages.ruleDetail.loading;
          elements.ruleDialogLoading.hidden = false;
          elements.ruleDialogContent.hidden = true;
          break;

        case 'ruleDetail':
          renderRuleDetail(message.detail || {});
          break;

        case 'ruleDetailError':
          setRuleDetailError(message.message);
          break;

        case 'showHotspotDetail':
          if (message.hotspot) {
            showHotspotDialog(message.hotspot);
          }
          break;

        case 'analysisState':
          renderAnalysisState(message.state || {});
          break;

        case 'showAnalysisDialog':
          if (!elements.analysisDialog.open) {
            elements.analysisDialog.showModal();
          }
          break;

        case 'hotspotDetailLoading':
          elements.hotspotDialogLoading.textContent =
            'Cargando detalle…';
          elements.hotspotDialogLoading.hidden = false;
          elements.hotspotDialogContent.hidden = true;
          break;

        case 'hotspotDetail':
          renderHotspotDetail(message.detail || {});
          break;

        case 'hotspotDetailError':
          elements.hotspotDialogLoading.textContent =
            message.message ||
            'No se pudo cargar el detalle.';
          elements.hotspotDialogLoading.hidden = false;
          elements.hotspotDialogContent.hidden = true;
          break;
      }
    });
`;
