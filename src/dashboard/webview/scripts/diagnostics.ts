export const DIAGNOSTICS_SCRIPT = `
    let currentDiagnosticsModuleTab = 'diagnosticsModulesPanel';
    let diagnosticsTabsInitialized = false;

    function appendDiagnosticPair(list, label, value) {
      const term = document.createElement('dt');
      term.textContent = translateLocalizationValue(label);
      const description = document.createElement('dd');
      description.textContent = value === undefined || value === null || value === ''
        ? '—'
        : String(value);
      list.append(term, description);
    }

    function diagnosticIconPath(kind) {
      const paths = {
        build: 'M2 2h5v2H4v8h8V9h2v5H2V2Zm7 0h5v5h-2V5.41L7.7 9.7 6.3 8.3 10.59 4H9V2Z',
        test: 'M5 1h6v2h-1v3.17l3.85 6.16A1.75 1.75 0 0 1 12.37 15H3.63a1.75 1.75 0 0 1-1.48-2.67L6 6.17V3H5V1Zm3 2v3.74L4.06 13h7.88L8 6.74V3Z',
        security: 'M8 1 14 3v4.5c0 3.62-2.22 6.37-6 7.5-3.78-1.13-6-3.88-6-7.5V3l6-2Zm0 2.12L4 4.45V7.5c0 2.57 1.43 4.56 4 5.46 2.57-.9 4-2.89 4-5.46V4.45L8 3.12Zm-.75 2.13h1.5v3.5h-1.5v-3.5Zm0 4.5h1.5v1.5h-1.5v-1.5Z',
        dependencies: 'M8 1 14 4v8l-6 3-6-3V4l6-3Zm0 1.68L4.13 4.61 8 6.55l3.87-1.94L8 2.68ZM3.5 5.82v5.25l3.75 1.88V7.7L3.5 5.82Zm5.25 7.13 3.75-1.88V5.82L8.75 7.7v5.25Z',
        testing: 'M5 1h6v2h-1v3.17l3.85 6.16A1.75 1.75 0 0 1 12.37 15H3.63a1.75 1.75 0 0 1-1.48-2.67L6 6.17V3H5V1Z',
        quality: 'm6.6 11.2-3.1-3.1 1.4-1.4 1.7 1.7 4.5-4.5 1.4 1.4-5.9 5.9ZM8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Z',
        terminal: 'M1 2h14v12H1V2Zm2 2v8h10V4H3Zm1.3 1.3 1.4-1.4L9.8 8l-4.1 4.1-1.4-1.4L7 8 4.3 5.3ZM9 10h3v1.5H9V10Z'
      };
      return paths[kind] || paths.terminal;
    }

    function createDiagnosticIcon(kind, status) {
      const icon = document.createElement('span');
      const safeStatus = status || 'neutral';
      icon.className = 'diagnostics-card-icon diagnostics-card-icon--' + kind + ' diagnostics-card-icon--status-' + safeStatus;
      icon.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 16 16');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', diagnosticIconPath(kind));
      svg.appendChild(path);
      icon.appendChild(svg);
      return icon;
    }

    function activateDiagnosticsModuleTab(targetId) {
      const buttons = [elements.diagnosticsModulesTab, elements.diagnosticsModuleHealthTab].filter(Boolean);
      const panels = [elements.diagnosticsModulesPanel, elements.diagnosticsModuleHealthPanel].filter(Boolean);
      currentDiagnosticsModuleTab = targetId;
      for (const button of buttons) {
        const active = button.dataset.target === targetId;
        button.classList.toggle('diagnostics-tab--active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      }
      for (const panel of panels) {
        panel.hidden = panel.id !== targetId;
      }
    }

    function ensureDiagnosticsTabs() {
      if (diagnosticsTabsInitialized) return;
      const buttons = [elements.diagnosticsModulesTab, elements.diagnosticsModuleHealthTab].filter(Boolean);
      for (const button of buttons) {
        button.addEventListener('click', function () {
          activateDiagnosticsModuleTab(String(button.dataset.target || 'diagnosticsModulesPanel'));
        });
      }
      diagnosticsTabsInitialized = true;
      activateDiagnosticsModuleTab(currentDiagnosticsModuleTab);
    }

    function renderDiagnosticsList(container, items, formatter) {
      container.textContent = '';
      const values = Array.isArray(items) ? items : [];
      if (values.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'diagnostics-list-empty';
        empty.textContent = translateLocalizationValue('No disponible');
        container.appendChild(empty);
        return;
      }
      for (const item of values) {
        const metadata = formatter(item);
        const kind = metadata.kind || 'terminal';
        const status = metadata.status || 'neutral';
        const row = document.createElement('article');
        row.className = 'diagnostics-list-item diagnostics-list-item--' + kind + ' diagnostics-list-item--status-' + status;

        const body = document.createElement('div');
        body.className = 'diagnostics-card-body';
        const header = document.createElement('div');
        header.className = 'diagnostics-card-header';
        const title = document.createElement('strong');
        title.textContent = metadata.title;
        header.appendChild(title);

        if (metadata.badge) {
          const badge = document.createElement('span');
          badge.className = 'diagnostics-card-badge';
          badge.textContent = metadata.badge;
          header.appendChild(badge);
        }

        const detail = document.createElement('code');
        detail.className = 'diagnostics-card-command';
        detail.textContent = metadata.detail;
        body.append(header, detail);

        if (metadata.hint) {
          const hint = document.createElement('small');
          hint.className = 'diagnostics-card-hint';
          hint.textContent = metadata.hint;
          body.appendChild(hint);
        }

        row.append(createDiagnosticIcon(kind, status), body);
        container.appendChild(row);
      }
    }

    function diagnosticCategoryLabel(category) {
      const labels = {
        security: 'Seguridad',
        'security-sast': 'Seguridad / SAST',
        quality: 'Calidad',
        dependencies: 'Dependencias',
        'dependencies-sca': 'Dependencias / SCA',
        'formatting-lint': 'Formato / Lint',
        testing: 'Tests',
        tests: 'Tests',
        iac: 'Infraestructura / IaC',
        containers: 'Containers',
        sonarqube: 'SonarQube'
      };
      return translateLocalizationValue(labels[category] || category || '');
    }

    function diagnosticCategoryKind(category) {
      if (category === 'security-sast' || category === 'containers' || category === 'iac') return 'security';
      if (category === 'dependencies-sca') return 'dependencies';
      if (category === 'tests') return 'testing';
      if (category === 'quality' || category === 'formatting-lint' || category === 'sonarqube') return 'quality';
      return category || 'terminal';
    }

    function diagnosticHealthLabel(health) {
      if (health === 'healthy') return translateLocalizationValue('Operativa');
      if (health === 'warning') return translateLocalizationValue('Requiere revisión');
      return translateLocalizationValue('Estado no verificado');
    }

    function normalizeDiagnosticStatus(status) {
      if (status === 'healthy') return 'healthy';
      if (status === 'warning') return 'warning';
      if (status === 'error') return 'error';
      if (status === 'unknown') return 'error';
      return 'neutral';
    }

    function moduleRuntimeStatus(item) {
      if (item.enabled && item.loaded) return 'healthy';
      if (item.enabled && !item.loaded) return 'error';
      return 'warning';
    }

    function renderDiagnostics(snapshot) {
      currentDiagnostics = snapshot || null;
      elements.diagnosticsLoading.hidden = true;
      elements.diagnosticsContent.hidden = !currentDiagnostics;
      elements.copyDiagnostics.disabled = !currentDiagnostics;
      if (!currentDiagnostics) return;

      ensureDiagnosticsTabs();

      elements.diagnosticsGeneratedAt.textContent = currentDiagnostics.generatedAt
        ? new Date(currentDiagnostics.generatedAt).toLocaleString(dashboardLocale)
        : '';
      for (const list of [
        elements.diagnosticsEnvironment,
        elements.diagnosticsSonar,
        elements.diagnosticsScanner
      ]) list.textContent = '';

      appendDiagnosticPair(elements.diagnosticsEnvironment, 'Versión de la extensión', currentDiagnostics.extensionVersion);
      appendDiagnosticPair(elements.diagnosticsEnvironment, 'Versión de VS Code', currentDiagnostics.vscodeVersion);
      appendDiagnosticPair(elements.diagnosticsEnvironment, 'Versión de Node.js', currentDiagnostics.nodeVersion);
      appendDiagnosticPair(elements.diagnosticsEnvironment, 'Plataforma', [currentDiagnostics.platform, currentDiagnostics.architecture].filter(Boolean).join(' '));
      appendDiagnosticPair(elements.diagnosticsEnvironment, 'Workspace confiable', currentDiagnostics.workspaceTrusted ? 'Sí' : 'No');
      appendDiagnosticPair(elements.diagnosticsEnvironment, 'Carpeta', currentDiagnostics.workspaceFolder);

      renderDiagnosticsList(
        elements.diagnosticsModules,
        currentDiagnostics.modules,
        item => ({
          title: item.displayName || item.id || '',
          detail: item.enabled
            ? (item.loaded ? translateLocalizationValue('Runtime cargado') : translateLocalizationValue('Runtime no cargado'))
            : translateLocalizationValue('Módulo desactivado'),
          badge: item.enabled ? translateLocalizationValue('Activo') : translateLocalizationValue('Desactivado'),
          kind: 'quality',
          status: moduleRuntimeStatus(item)
        })
      );
      const moduleHealthItems = [];
      for (const section of Array.isArray(currentDiagnostics.moduleDiagnostics) ? currentDiagnostics.moduleDiagnostics : []) {
        for (const item of Array.isArray(section.items) ? section.items : []) {
          moduleHealthItems.push({ section: section.title, ...item });
        }
      }
      renderDiagnosticsList(
        elements.diagnosticsModuleHealth,
        moduleHealthItems,
        item => ({
          title: [item.section, item.label]
            .filter(Boolean)
            .map(value => translateLocalizationValue(value))
            .join(' · '),
          detail: translateLocalizationValue(item.value || '—'),
          badge: item.status ? diagnosticHealthLabel(item.status) : '',
          kind: 'quality',
          status: normalizeDiagnosticStatus(item.status)
        })
      );

      appendDiagnosticPair(elements.diagnosticsSonar, 'Servidor', currentDiagnostics.sonarServer);
      appendDiagnosticPair(elements.diagnosticsSonar, 'Proyecto', currentDiagnostics.projectKey);
      appendDiagnosticPair(elements.diagnosticsSonar, 'Rama', currentDiagnostics.branch || translateLocalizationValue('Rama principal'));
      appendDiagnosticPair(elements.diagnosticsSonar, 'SonarQube detectado', currentDiagnostics.sonarVersion);
      appendDiagnosticPair(elements.diagnosticsSonar, 'Estado del servidor', currentDiagnostics.sonarStatus);
      appendDiagnosticPair(elements.diagnosticsSonar, 'Perfil de compatibilidad', (currentDiagnostics.compatibilityProfiles || []).join(' / ') || currentDiagnostics.compatibilityProfile);
      appendDiagnosticPair(elements.diagnosticsSonar, 'Tiempo de respuesta', currentDiagnostics.responseTimeMs === undefined ? '—' : currentDiagnostics.responseTimeMs + ' ms');

      appendDiagnosticPair(elements.diagnosticsScanner, 'Scanner encontrado', currentDiagnostics.scanner);
      appendDiagnosticPair(elements.diagnosticsScanner, 'Tipo de scanner', currentDiagnostics.scannerKind);
      appendDiagnosticPair(elements.diagnosticsScanner, 'Evidencia', currentDiagnostics.scannerEvidence);

      renderDiagnosticsList(
        elements.diagnosticsCommands,
        currentDiagnostics.commands,
        item => ({
          title: item.name,
          detail: item.command || '',
          badge: translateLocalizationValue(item.source || ''),
          kind: String(item.name || '').toLowerCase().includes('test') ? 'test' : 'build'
        })
      );
      renderDiagnosticsList(
        elements.diagnosticsTools,
        currentDiagnostics.tools,
        item => ({
          title: item.name,
          detail: item.command || '',
          badge: diagnosticCategoryLabel(item.category),
          hint: [
            item.version ? translateLocalizationValue('Versión') + ': ' + item.version : '',
            item.health ? translateLocalizationValue('Estado') + ': ' + diagnosticHealthLabel(item.health) : '',
            item.configurationStatus ? translateLocalizationValue('Configuración') + ': ' + item.configurationStatus : '',
            item.evidence ? translateLocalizationValue('Evidencia') + ': ' + item.evidence : ''
          ].filter(Boolean).join(' · '),
          kind: diagnosticCategoryKind(item.category)
        })
      );

      const failure = currentDiagnostics.lastFailedRequest;
      elements.diagnosticsLastFailure.textContent = '';
      if (!failure) {
        elements.diagnosticsLastFailure.textContent = translateLocalizationValue('No hay peticiones fallidas registradas.');
      } else {
        const title = document.createElement('strong');
        title.textContent = [failure.method, failure.endpoint, failure.status || ''].filter(Boolean).join(' ');
        const message = document.createElement('span');
        message.textContent = failure.message || '';
        const date = document.createElement('span');
        date.className = 'muted';
        date.textContent = failure.occurredAt
          ? new Date(failure.occurredAt).toLocaleString(dashboardLocale)
          : '';
        elements.diagnosticsLastFailure.append(title, message, date);
      }

      const errors = Array.isArray(currentDiagnostics.errors) ? currentDiagnostics.errors : [];
      elements.diagnosticsErrorsSection.hidden = errors.length === 0;
      renderDiagnosticsList(
        elements.diagnosticsErrors,
        errors,
        item => ({ title: translateLocalizationValue('Error'), detail: String(item), status: 'error' })
      );
    }
`;
