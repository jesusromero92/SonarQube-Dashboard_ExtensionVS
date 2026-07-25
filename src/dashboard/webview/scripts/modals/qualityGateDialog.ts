
export const QUALITY_GATE_DIALOG_SCRIPT = `    const qualityMetricNames = dashboardConstants.qualityMetricNames;

    function conditionLimit(condition) {
      const comparator =
        dashboardConstants.comparatorSymbols[condition.comparator] ||
        condition.comparator ||
        '';
      return (comparator + ' ' + (condition.errorThreshold || '—')).trim();
    }

    function renderQualityGateButton() {
      const gate = currentSummary.qualityGate || {};
      const status = String(gate.status || 'NONE').toUpperCase();
      const labels = dashboardConstants.qualityGateLabels;
      elements.qualityGateButton.className =
        'quality-gate-button ' + (status === 'NONE' ? 'secondary' : status.toLowerCase());
      elements.qualityGateButton.textContent = 'Quality Gate · ' + labels[status];
    }

    function appendRatingComparison(label, overall, newCode, useRatingBadge = true) {
      const name = document.createElement('span');
      name.textContent = label;
      const createValue = value => {
        const normalized = dashboardConstants.ratingGrades.includes(value) ? value : 'NONE';
        const element = document.createElement('strong');
        element.textContent = normalized === 'NONE' && useRatingBadge ? '—' : value;
        if (useRatingBadge) {
          element.className = 'rating-badge ' + normalized.toLowerCase();
          element.title = normalized === 'NONE' ? 'Rating no disponible' : 'Rating ' + normalized;
        }
        return element;
      };
      const overallValue = createValue(overall);
      const newCodeValue = createValue(newCode);
      elements.qualityGateRatings.append(name, overallValue, newCodeValue);
    }

    function showQualityGateDialog() {
      const gate = currentSummary.qualityGate || {};
      const conditions = [...(gate.conditions || [])].sort((left, right) => {
        const rank = dashboardConstants.qualityGateStatusRanks;
        return (rank[right.status] || 0) - (rank[left.status] || 0);
      });
      const failedConditions = conditions.filter(condition => condition.status === 'ERROR').length;
      elements.qualityGateDialogStatus.textContent = gate.status || 'NO DISPONIBLE';
      elements.qualityGateConditionCount.textContent =
        String(failedConditions) +
        (failedConditions === 1 ? ' condición fallida' : ' condiciones fallidas') +
        ' · ' +
        String(conditions.length) +
        (conditions.length === 1 ? ' configurada' : ' configuradas');
      elements.qualityGateConditions.textContent = '';
      elements.noQualityGateConditions.hidden = conditions.length > 0;

      for (const condition of conditions) {
        const row = document.createElement('tr');
        row.appendChild(createCell(
          qualityMetricNames[condition.metricKey] || condition.metricKey || 'Métrica'
        ));
        row.appendChild(createCell(condition.actualValue || '—'));
        row.appendChild(createCell(conditionLimit(condition)));
        row.appendChild(createCell(condition.scope === 'newCode' ? 'New Code' : 'Overall'));
        const statusCell = document.createElement('td');
        const state = document.createElement('span');
        state.className = 'condition-state ' + String(condition.status || 'NONE').toLowerCase();
        state.textContent = condition.status || 'NONE';
        statusCell.appendChild(state);
        row.appendChild(statusCell);
        elements.qualityGateConditions.appendChild(row);
      }

      const ratings = currentSummary.ratings || {};
      const overall = ratings.overall || {};
      const newCode = ratings.newCode || {};
      elements.qualityGateRatings.textContent = '';
      const blank = document.createElement('span');
      const overallHeading = document.createElement('strong');
      overallHeading.textContent = 'Overall';
      const newCodeHeading = document.createElement('strong');
      newCodeHeading.textContent = 'New Code';
      elements.qualityGateRatings.append(blank, overallHeading, newCodeHeading);
      appendRatingComparison('Maintainability', overall.maintainability, newCode.maintainability);
      appendRatingComparison('Reliability', overall.reliability, newCode.reliability);
      appendRatingComparison('Security', overall.security, newCode.security);
      appendRatingComparison('Security Review', overall.securityReview, newCode.securityReview);
      appendRatingComparison(
        'Security Hotspots',
        String((currentSummary.types || {}).securityHotspots || 0),
        String((currentSummary.newTypes || {}).securityHotspots || 0),
        false
      );
      if (!elements.qualityGateDialog.open) {
        elements.qualityGateDialog.showModal();
      }
    }

`;
