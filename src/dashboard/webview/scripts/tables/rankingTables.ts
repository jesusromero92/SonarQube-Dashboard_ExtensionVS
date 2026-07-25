
export const RANKING_TABLES_SCRIPT = `    function aggregateBy(keyName) {
      const groups = new Map();
      for (const issue of currentIssues) {
        const key = issue[keyName] || 'UNKNOWN';
        let group = groups.get(key);
        if (!group) {
          group = {
            key,
            count: 0,
            severity: issue.severity,
            severityRank: issue.severityRank || 0,
            issue
          };
          groups.set(key, group);
        }
        group.count += 1;
        if ((issue.severityRank || 0) > group.severityRank) {
          group.severity = issue.severity;
          group.severityRank = issue.severityRank || 0;
          group.issue = issue;
        }
      }
      return Array.from(groups.values()).sort((left, right) =>
        right.count - left.count ||
        right.severityRank - left.severityRank ||
        String(left.key).localeCompare(String(right.key), 'es', { sensitivity: 'base' })
      );
    }

    function sortTopRows(rows, sort) {
      const direction = sort.direction === 'asc' ? 1 : -1;
      return [...rows].sort((left, right) => {
        let comparison;
        if (sort.key === 'key') {
          comparison = String(left.key).localeCompare(
            String(right.key),
            'es',
            { sensitivity: 'base' }
          );
        } else {
          comparison = Number(left[sort.key] || 0) - Number(right[sort.key] || 0);
        }
        return comparison * direction ||
          right.count - left.count ||
          right.severityRank - left.severityRank ||
          String(left.key).localeCompare(String(right.key), 'es', { sensitivity: 'base' });
      });
    }

    function updateTopSortHeaders(tableName) {
      const sort = topSort[tableName];
      for (const header of document.querySelectorAll('[data-sort-header="' + tableName + '"]')) {
        const active = header.dataset.sortKey === sort.key;
        header.setAttribute(
          'aria-sort',
          active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
        );
        const indicator = header.querySelector('.sort-indicator');
        if (indicator) {
          indicator.textContent = active ? (sort.direction === 'asc' ? '▲' : '▼') : '';
        }
      }
    }

    function renderTopFiles() {
      const allRows = sortTopRows(aggregateBy('relativePath'), topSort.files);
      const rows = allRows.slice(0, 15);
      updateTopSortHeaders('files');
      elements.filesBody.textContent = '';
      elements.filesCount.textContent = allRows.length > rows.length
        ? String(rows.length) + ' de ' + String(allRows.length) + ' archivos'
        : String(rows.length) + (rows.length === 1 ? ' archivo' : ' archivos');
      elements.noFiles.hidden = rows.length > 0;

      for (const item of rows) {
        const row = document.createElement('tr');
        bindOpen(row, item.issue);
        row.appendChild(fileCellUtils.create(item.key));
        const severityCell = document.createElement('td');
        severityCell.appendChild(createBadge(item.severity));
        row.appendChild(severityCell);
        row.appendChild(createCell(String(item.count), 'count-cell'));
        elements.filesBody.appendChild(row);
      }
    }

    function renderTopRules() {
      const allRows = sortTopRows(aggregateBy('rule'), topSort.rules);
      const rows = allRows.slice(0, 15);
      updateTopSortHeaders('rules');
      elements.rulesBody.textContent = '';
      elements.rulesCount.textContent = allRows.length > rows.length
        ? String(rows.length) + ' de ' + String(allRows.length) + ' reglas'
        : String(rows.length) + (rows.length === 1 ? ' regla' : ' reglas');
      elements.noRules.hidden = rows.length > 0;

      for (const item of rows) {
        const row = document.createElement('tr');
        bindOpen(row, item.issue);
        row.appendChild(createRuleCell(item.issue));
        const severityCell = document.createElement('td');
        severityCell.appendChild(createBadge(item.severity));
        row.appendChild(severityCell);
        row.appendChild(createCell(String(item.count), 'count-cell'));
        elements.rulesBody.appendChild(row);
      }
    }

`;
