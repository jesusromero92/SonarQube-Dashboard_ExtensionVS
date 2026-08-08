export const ISSUES_TABLE_SCRIPT = `    function severityClass(severity) {
      return String(severity || 'UNKNOWN').toLowerCase();
    }

    function createBadge(severity) {
      const badge = document.createElement('span');
      badge.className = 'badge ' + severityClass(severity);
      badge.textContent = severity || 'UNKNOWN';
      return badge;
    }

    function createMetricSummary(value, label, delta, className) {
      const item = document.createElement('div');
      item.className = 'metric-summary' + (className ? ' ' + className : '');

      const number = document.createElement('strong');
      number.textContent = String(value);
      item.appendChild(number);

      const caption = document.createElement('span');
      caption.className = 'metric-label';
      caption.textContent = label;
      item.appendChild(caption);

      const change = document.createElement('span');
      change.className = 'metric-delta';
      if (delta === null) {
        change.textContent = 'Sin histórico anterior';
      } else if (delta > 0) {
        change.classList.add('increase');
        change.textContent = '▲ +' + delta;
      } else if (delta < 0) {
        change.classList.add('decrease');
        change.textContent = '▼ ' + Math.abs(delta);
      } else {
        change.textContent = 'Sin cambios';
      }
      item.appendChild(change);
      return item;
    }

    function previousAnalysis(summary) {
      if (!summary.analysisComparisonAvailable ||
          !summary.latestAnalysis ||
          !summary.previousAnalysis) {
        return null;
      }
      const localTotal = Number(scopeData(summary).published || 0);
      const latestProjectTotal = previousIssueTotal(summary.latestAnalysis);

      // SonarQube history belongs to the complete project. It is comparable
      // with the local summary only when every issue resolves to a local file.
      return latestProjectTotal === localTotal
        ? summary.previousAnalysis
        : null;
    }

    function scopeData(summary) {
      const isNewCode = currentScope === 'newCode';
      return {
        published: isNewCode ? summary.newPublished : summary.published,
        issues: isNewCode ? summary.newIssues : summary.issues,
        hotspots: isNewCode ? summary.newHotspots : summary.hotspots,
        severity: isNewCode ? summary.newSeverity : summary.severity,
        types: isNewCode ? summary.newTypes : summary.types
      };
    }

    function previousIssueTotal(point) {
      if (!point) return null;
      if (currentScope === 'newCode') {
        return (point.newBugs || 0) +
          (point.newCodeSmells || 0) +
          (point.newVulnerabilities || 0);
      }
      return (point.bugs || 0) +
        (point.codeSmells || 0) +
        (point.vulnerabilities || 0);
    }

    function previousSeverityValue(point, severity) {
      if (!point) return null;
      const keys = currentScope === 'newCode'
        ? dashboardConstants.severityEvolutionKeys.newCode
        : dashboardConstants.severityEvolutionKeys.overall;
      const key = keys[String(severity || '').toUpperCase()];
      return key ? Number(point[key] || 0) : null;
    }

    function renderMetricsSummary(summary) {
      const scoped = scopeData(summary);
      const previous = previousAnalysis(summary);
      const total = Number(scoped.published || 0);
      const previousTotal = previousIssueTotal(previous);
      elements.metricsSummary.textContent = '';
      elements.metricsSummary.appendChild(
        createMetricSummary(
          total,
          'Issues encontrados',
          previousTotal === null ? null : total - previousTotal,
          ''
        )
      );

      for (const severity of scoped.severity || []) {
        const count = Number(severity.count || 0);
        const previousCount = previousSeverityValue(previous, severity.name);
        elements.metricsSummary.appendChild(
          createMetricSummary(
            count,
            severity.name || 'UNKNOWN',
            previousCount === null ? null : count - previousCount,
            severityClass(severity.name)
          )
        );
      }
    }

    function createCell(text, className) {
      const cell = document.createElement('td');
      cell.textContent = text;
      if (className) {
        cell.className = className;
      }
      return cell;
    }

    function createTypeCell(type) {
      const normalizedType = String(type || 'ISSUE').toUpperCase();
      const cell = document.createElement('td');
      cell.className = 'type-icon-cell';
      cell.title = normalizedType;

      const iconClass = typeIconClasses[normalizedType];
      if (iconClass) {
        const icon = document.createElement('span');
        icon.className = 'type-icon ' + iconClass;
        icon.setAttribute('role', 'img');
        icon.setAttribute('aria-label', normalizedType);
        cell.appendChild(icon);
      } else {
        cell.textContent = normalizedType;
      }
      return cell;
    }

    const fileCellUtils = {
      fileName(relativePath) {
        const normalizedPath = String(relativePath || '').replace(/\\\\/g, '/');
        const pathParts = normalizedPath.split('/');
        return pathParts[pathParts.length - 1] || normalizedPath;
      },

      create(relativePath, lineNumber) {
        const cell = document.createElement('td');
        cell.className = 'path';
        cell.title = relativePath;

        const name = document.createElement('span');
        name.className = 'file-name';
        name.textContent = this.fileName(relativePath);
        cell.appendChild(name);

        if (lineNumber !== undefined && lineNumber !== null) {
          const line = document.createElement('span');
          line.className = 'file-line';
          line.textContent = 'Línea ' + String(lineNumber);
          cell.appendChild(line);
        }
        return cell;
      }
    };

    function createRuleCell(issue) {
      const cell = document.createElement('td');
      const button = document.createElement('button');
      button.className = 'rule-button';
      button.type = 'button';
      button.textContent = issue.ruleName || issue.rule;
      button.title = 'Ver detalle de la regla' +
        (issue.ruleName && issue.ruleName !== issue.rule ? ' · ' + issue.rule : '');
      button.setAttribute('aria-haspopup', 'dialog');

      button.addEventListener('click', event => {
        event.stopPropagation();
        showRuleDialog(issue);
      });

      cell.appendChild(button);
      return cell;
    }

    function createIssueStatusCell(issue) {
      const cell = document.createElement('td');
      cell.className = 'issue-status-cell';
      const status = document.createElement('span');
      const value = String(issue.status || 'OPEN').toUpperCase();
      status.className = 'status-chip issue-status ' + value.toLowerCase().replace(/_/g, '-');
      status.textContent = value.replace(/_/g, ' ');
      cell.appendChild(status);
      return cell;
    }

    function createIssueActionsCell(issue) {
      const cell = document.createElement('td');
      cell.className = 'issue-actions-cell';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'icon-button manage-issue-button';
      button.textContent = '⋯';
      button.title = 'Gestionar defecto';
      button.setAttribute('aria-label', 'Gestionar defecto');
      button.addEventListener('click', event => {
        event.stopPropagation();
        showIssueLifecycleDialog(issue);
      });
      cell.appendChild(button);
      return cell;
    }

    function bindRowAction(row, title, action) {
      row.tabIndex = 0;
      row.title = title;
      row.addEventListener('click', action);
      row.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          action();
        }
      });
    }

    function bindOpen(row, issue) {
      if (!issue) {
        return;
      }
      bindRowAction(
        row,
        'Abrir ' + issue.relativePath + ':' + issue.line,
        () => vscode.postMessage({
          type: 'openIssue',
          fileUri: issue.fileUri,
          line: issue.line
        })
      );
    }

    function issueSortValue(issue, key) {
      if (key === 'severityRank') {
        return Number(issue.severityRank || 0);
      }
      if (key === 'ruleName') {
        return issue.ruleName || issue.rule || '';
      }
      return issue[key] || '';
    }

    function compareIssueValues(left, right, key) {
      if (key === 'severityRank') {
        return Number(issueSortValue(left, key)) - Number(issueSortValue(right, key));
      }

      const comparison = String(issueSortValue(left, key)).localeCompare(
        String(issueSortValue(right, key)),
        dashboardLanguage,
        { sensitivity: 'base', numeric: true }
      );
      if (comparison || key !== 'relativePath') {
        return comparison;
      }
      return Number(left.line || 0) - Number(right.line || 0);
    }

    function sortIssues(issues) {
      const direction = issueSort.direction === 'asc' ? 1 : -1;
      return issues
        .map((issue, index) => ({ issue, index }))
        .sort((left, right) =>
          compareIssueValues(left.issue, right.issue, issueSort.key) * direction ||
          left.index - right.index
        )
        .map(item => item.issue);
    }

    function updateIssueSortHeaders() {
      for (const header of document.querySelectorAll('[data-sort-header="issues"]')) {
        const active = header.dataset.sortKey === issueSort.key;
        header.setAttribute(
          'aria-sort',
          active ? (issueSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
        );
        const indicator = header.querySelector('.sort-indicator');
        if (indicator) {
          indicator.textContent = active ? (issueSort.direction === 'asc' ? '▲' : '▼') : '';
        }
      }
    }

    function normalizeIssueFilterValue(value) {
      return String(value || '').trim().toLowerCase();
    }

    function issueFilterDraftValues() {
      return {
        severity: elements.issueSeverityFilter.value,
        type: elements.issueTypeFilter.value,
        status: elements.issueStatusFilter.value,
        file: normalizeIssueFilterValue(elements.issueFileFilter.value),
        rule: normalizeIssueFilterValue(elements.issueRuleFilter.value)
      };
    }

    function syncIssueFilterDialogFromActive() {
      elements.issueSeverityFilter.value = activeIssueFilters.severity;
      elements.issueTypeFilter.value = activeIssueFilters.type;
      elements.issueStatusFilter.value = activeIssueFilters.status;
      elements.issueFileFilter.value = activeIssueFilters.file;
      elements.issueRuleFilter.value = activeIssueFilters.rule;
      refreshSelectDropdown(elements.issueSeverityFilter);
      refreshSelectDropdown(elements.issueTypeFilter);
      refreshSelectDropdown(elements.issueStatusFilter);
    }

    function applyIssueFieldFilters() {
      activeIssueFilters = issueFilterDraftValues();
      if (elements.issueFiltersDialog.open) {
        elements.issueFiltersDialog.close();
      }
      renderIssues();
    }

    function uniqueIssueValues(key) {
      const values = new Set();
      for (const issue of currentIssues) {
        const value = String(issue[key] || '').trim();
        if (value) values.add(value);
      }
      return [...values].sort((left, right) => left.localeCompare(
        right,
        dashboardLanguage,
        { sensitivity: 'base', numeric: true }
      ));
    }

    function updateIssueFilterSelect(select, values, allLabel) {
      const selected = select.value;
      select.textContent = '';
      const all = document.createElement('option');
      all.value = '';
      all.textContent = translateLocalizationValue(allLabel);
      select.appendChild(all);
      for (const value of values) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value.replace(/_/g, ' ');
        select.appendChild(option);
      }
      select.value = values.includes(selected) ? selected : '';
      refreshSelectDropdown(select, true);
    }

    function renderIssueFilterOptions() {
      updateIssueFilterSelect(
        elements.issueSeverityFilter,
        uniqueIssueValues('severity'),
        'Todas'
      );
      updateIssueFilterSelect(
        elements.issueTypeFilter,
        uniqueIssueValues('type'),
        'Todos'
      );
      updateIssueFilterSelect(
        elements.issueStatusFilter,
        uniqueIssueValues('status'),
        'Todos'
      );
    }

    function updateIssueFilterIndicator(filters) {
      const count = [
        filters.severity,
        filters.type,
        filters.status,
        filters.file,
        filters.rule
      ].filter(Boolean).length;
      elements.issueFiltersCount.textContent = String(count);
      elements.issueFiltersCount.hidden = count === 0;
      elements.issueFiltersToggle.classList.toggle('active', count > 0);
    }

    function issueMatchesFieldFilters(issue, filters) {
      if (filters.severity && issue.severity !== filters.severity) return false;
      if (filters.type && issue.type !== filters.type) return false;
      if (filters.status && issue.status !== filters.status) return false;
      if (
        filters.file &&
        !normalizeIssueFilterValue(issue.relativePath).includes(filters.file)
      ) return false;
      if (filters.rule) {
        const ruleText = normalizeIssueFilterValue(
          [issue.ruleName, issue.rule].filter(Boolean).join(' ')
        );
        if (!ruleText.includes(filters.rule)) return false;
      }
      return true;
    }

    function issueMatchesSearch(issue, query) {
      if (!query) return true;
      return [
        issue.relativePath,
        issue.ruleName,
        issue.rule,
        issue.message,
        issue.type,
        issue.severity,
        issue.status
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    }

    function clearIssueFieldFilters() {
      elements.issueSeverityFilter.value = '';
      elements.issueTypeFilter.value = '';
      elements.issueStatusFilter.value = '';
      elements.issueFileFilter.value = '';
      elements.issueRuleFilter.value = '';
      refreshSelectDropdown(elements.issueSeverityFilter);
      refreshSelectDropdown(elements.issueTypeFilter);
      refreshSelectDropdown(elements.issueStatusFilter);
    }

    function issueClipboardPayload() {
      const issues = currentIssues.map(issue => ({
        ruleName: issue.ruleName ?? issue.rule ?? '',
        archivo: issue.relativePath ?? '',
        linea: issue.line ?? null,
        severidad: issue.severity ?? '',
        tipoDefecto: issue.type ?? ''
      }));
      return JSON.stringify(issues, null, 2);
    }

    function renderIssues() {
      renderIssueFilterOptions();
      const query = elements.filter.value.trim().toLowerCase();
      const filters = activeIssueFilters;
      updateIssueFilterIndicator(filters);
      const filtered = currentIssues.filter(issue =>
        issueMatchesSearch(issue, query) &&
        issueMatchesFieldFilters(issue, filters)
      );
      const sorted = sortIssues(filtered);
      updateIssueSortHeaders();
      elements.issuesBody.textContent = '';
      elements.tableCount.textContent = String(sorted.length) +
        (sorted.length === 1 ? dashboardMessages.issueSingular : dashboardMessages.issuePlural);
      elements.noResults.hidden = sorted.length > 0;
      elements.copyIssues.disabled = currentIssues.length === 0;

      if (!sorted.length) {
        elements.noResults.textContent = currentIssues.length
          ? 'No hay defectos que coincidan con el filtro.'
          : 'No se han encontrado defectos para el proyecto seleccionado.';
        return;
      }

      for (const issue of sorted) {
        const row = document.createElement('tr');
        bindOpen(row, issue);

        const severityCell = document.createElement('td');
        severityCell.appendChild(createBadge(issue.severity));
        row.appendChild(severityCell);
        row.appendChild(createTypeCell(issue.type));
        row.appendChild(fileCellUtils.create(issue.relativePath, issue.line));
        row.appendChild(createIssueStatusCell(issue));
        row.appendChild(createRuleCell(issue));
        row.appendChild(createIssueActionsCell(issue));
        elements.issuesBody.appendChild(row);
      }
    }

`;
