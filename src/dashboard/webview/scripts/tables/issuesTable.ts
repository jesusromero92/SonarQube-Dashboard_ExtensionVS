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
      const evolution = summary.evolution || [];
      if (evolution.length <= 1) return null;

      const latest = evolution[evolution.length - 1];
      const localTotal = Number(scopeData(summary).published || 0);
      const latestProjectTotal = previousIssueTotal(latest);

      // El histórico de SonarQube pertenece al proyecto completo. Solo es
      // comparable con el resumen cuando todos sus issues tienen archivo local.
      return latestProjectTotal === localTotal
        ? evolution[evolution.length - 2]
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
      button.title = 'Ver descripción' +
        (issue.ruleName && issue.ruleName !== issue.rule ? ' · ' + issue.rule : '');
      button.setAttribute('aria-haspopup', 'dialog');

      button.addEventListener('click', event => {
        event.stopPropagation();
        showRuleDialog(issue);
      });

      cell.appendChild(button);
      return cell;
    }

    function bindOpen(row, issue) {
      if (!issue) {
        return;
      }
      row.tabIndex = 0;
      row.title = 'Abrir ' + issue.relativePath + ':' + issue.line;
      const open = () => vscode.postMessage({
        type: 'openIssue',
        fileUri: issue.fileUri,
        line: issue.line
      });
      row.addEventListener('click', open);
      row.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
    }

    function renderIssues() {
      const query = elements.filter.value.trim().toLowerCase();
      const filtered = currentIssues.filter(issue => {
        if (!query) {
          return true;
        }
        return [
          issue.relativePath,
          issue.ruleName,
          issue.rule,
          issue.message,
          issue.type,
          issue.severity
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);
      });
      elements.issuesBody.textContent = '';
      elements.tableCount.textContent = String(filtered.length) + ' issues';
      elements.noResults.hidden = filtered.length > 0;

      if (!filtered.length) {
        elements.noResults.textContent = currentIssues.length
          ? 'No hay defectos que coincidan con el filtro.'
          : 'No se han encontrado defectos para el proyecto seleccionado.';
        return;
      }

      for (const issue of filtered) {
        const row = document.createElement('tr');
        bindOpen(row, issue);

        const severityCell = document.createElement('td');
        severityCell.appendChild(createBadge(issue.severity));
        row.appendChild(severityCell);
        row.appendChild(createTypeCell(issue.type));
        row.appendChild(fileCellUtils.create(issue.relativePath, issue.line));
        row.appendChild(createRuleCell(issue));
        elements.issuesBody.appendChild(row);
      }
    }

`;
