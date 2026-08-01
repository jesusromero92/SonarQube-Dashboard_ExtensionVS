export const DIAGNOSTICS_SCRIPT = `
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

    function createDiagnosticIcon(kind) {
      const icon = document.createElement('span');
      icon.className = 'diagnostics-card-icon diagnostics-card-icon--' + kind;
      icon.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 16 16');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', diagnosticIconPath(kind));
      svg.appendChild(path);
      icon.appendChild(svg);
      return icon;
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
        const row = document.createElement('article');
        row.className = 'diagnostics-list-item diagnostics-list-item--' + kind;

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

        row.append(createDiagnosticIcon(kind), body);
        container.appendChild(row);
      }
    }

    function diagnosticCategoryLabel(category) {
      const labels = {
        security: 'Seguridad',
        quality: 'Calidad',
        dependencies: 'Dependencias',
        testing: 'Tests'
      };
      return translateLocalizationValue(labels[category] || category || '');
    }

    function renderDiagnostics(snapshot) {
      currentDiagnostics = snapshot || null;
      elements.diagnosticsLoading.hidden = true;
      elements.diagnosticsContent.hidden = !currentDiagnostics;
      elements.copyDiagnostics.disabled = !currentDiagnostics;
      if (!currentDiagnostics) return;

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
          hint: item.evidence
            ? translateLocalizationValue('Evidencia') + ': ' + item.evidence
            : '',
          kind: item.category || 'security'
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
        item => ({ title: translateLocalizationValue('Error'), detail: String(item) })
      );
    }
`;
