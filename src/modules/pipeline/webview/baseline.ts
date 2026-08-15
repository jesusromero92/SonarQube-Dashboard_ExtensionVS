export const BASELINE_SCRIPT = `    function baselineNumber(value) {
      if (value === null || value === undefined || value === '') return null;
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    }

    function baselineLocalizedNumber(value, decimals) {
      return Number(value).toLocaleString(dashboardLocale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }

    function baselinePercent(value) {
      const numeric = baselineNumber(value);
      return numeric === null ? '—' : baselineLocalizedNumber(numeric, 1) + '%';
    }

    function baselineInteger(value) {
      const numeric = baselineNumber(value);
      return numeric === null
        ? '—'
        : Math.round(numeric).toLocaleString(dashboardLocale, { maximumFractionDigits: 0 });
    }

    function baselineSigned(value, suffix) {
      const numeric = baselineNumber(value);
      if (numeric === null) return '—';
      const rounded = Math.abs(numeric) < 0.05 ? 0 : numeric;
      const sign = rounded > 0 ? '+' : rounded < 0 ? '-' : '';
      const decimals = Number.isInteger(rounded) ? 0 : 1;
      return sign + baselineLocalizedNumber(Math.abs(rounded), decimals) + (suffix || '');
    }

    function baselineDifference(afterValue, beforeValue) {
      const after = baselineNumber(afterValue);
      const before = baselineNumber(beforeValue);
      return after === null || before === null ? null : after - before;
    }

    function baselineDeltaLabel(delta, suffix) {
      const numeric = baselineNumber(delta);
      if (numeric === null) return '';
      return Math.abs(numeric) < 0.0001 ? '' : baselineSigned(numeric, suffix);
    }

    function baselineQualityGateLabel(status) {
      const value = String(status || 'NONE').toUpperCase();
      const labels = {
        OK: 'Aprobado',
        WARN: 'Aviso',
        ERROR: 'Fallido',
        NONE: 'No disponible'
      };
      return translateLocalizationValue(labels[value] || value);
    }

    function baselineQualityGateRank(status) {
      return ({ ERROR: 0, WARN: 1, NONE: 1, OK: 2 })[
        String(status || 'NONE').toUpperCase()
      ] ?? 1;
    }

    function baselineTrendClass(delta, lowerIsBetter) {
      const numeric = baselineNumber(delta);
      if (numeric === null || Math.abs(numeric) < 0.0001) return 'neutral';
      const improved = lowerIsBetter ? numeric < 0 : numeric > 0;
      return improved ? 'improved' : 'worsened';
    }

    function baselineSnapshotForScope(snapshot, scope) {
      if (!snapshot) return {};
      if (scope === 'newCode') {
        return {
          issues: snapshot.newIssues,
          securityHotspots: snapshot.newSecurityHotspots,
          coverage: snapshot.newCoverage,
          duplication: snapshot.newDuplication,
          qualityGate: snapshot.qualityGate
        };
      }
      return {
        issues: snapshot.issues,
        securityHotspots: snapshot.securityHotspots,
        coverage: snapshot.coverage,
        duplication: snapshot.duplication,
        qualityGate: snapshot.qualityGate
      };
    }

    function setBaselineMetric(root, metric, beforeText, afterText, deltaText, trend) {
      const value = root.querySelector('[data-baseline-value="' + metric + '"]');
      const delta = root.querySelector('[data-baseline-delta="' + metric + '"]');
      const card = root.querySelector('[data-baseline-card="' + metric + '"]');
      if (value) value.textContent = beforeText + ' → ' + afterText;
      if (delta) {
        delta.textContent = deltaText;
        delta.hidden = deltaText === '';
        delta.className = 'analysis-baseline-delta analysis-baseline-delta--' + trend;
      }
      if (card) card.dataset.trend = trend;
    }

    function renderBaselineComparison(root, comparison, scope = 'overall') {
      if (!root) return;
      if (!comparison?.before || !comparison?.after) {
        root.hidden = true;
        return;
      }

      root.hidden = false;
      const before = comparison.before;
      const after = comparison.after;
      const beforeScoped = baselineSnapshotForScope(before, scope);
      const afterScoped = baselineSnapshotForScope(after, scope);
      const hasBefore = before.hasAnalysis !== false;
      const firstMeasurement = translateLocalizationValue('Primera medición');
      const note = root.querySelector('[data-baseline-note]');
      const captured = root.querySelector('[data-baseline-captured]');
      const scopeLabel = root.querySelector('[data-baseline-scope]');

      if (note) {
        note.textContent = translateLocalizationValue(
          hasBefore
            ? 'Cambios publicados por el último pipeline.'
            : 'No había un análisis previo; estos valores quedan como nueva línea base.'
        );
      }
      if (scopeLabel) {
        scopeLabel.textContent = translateLocalizationValue(
          scope === 'newCode' ? 'Nuevo código' : 'Overall'
        );
      }
      if (captured) {
        const date = new Date(comparison.capturedAt || after.capturedAt || Date.now());
        captured.textContent = Number.isFinite(date.getTime())
          ? translateLocalizationValue('Actualizado: ') + date.toLocaleString(dashboardLocale)
          : '';
      }

      const beforeIssues = hasBefore ? baselineInteger(beforeScoped.issues) : '—';
      const afterIssues = baselineInteger(afterScoped.issues);
      const issuesDelta = hasBefore ? baselineDifference(afterScoped.issues, beforeScoped.issues) : null;
      setBaselineMetric(
        root,
        'issues',
        beforeIssues,
        afterIssues,
        hasBefore ? baselineDeltaLabel(issuesDelta, '') : firstMeasurement,
        hasBefore ? baselineTrendClass(issuesDelta, true) : 'neutral'
      );

      const beforeHotspots = hasBefore ? baselineInteger(beforeScoped.securityHotspots) : '—';
      const afterHotspots = baselineInteger(afterScoped.securityHotspots);
      const hotspotsDelta = hasBefore
        ? baselineDifference(afterScoped.securityHotspots, beforeScoped.securityHotspots)
        : null;
      setBaselineMetric(
        root,
        'hotspots',
        beforeHotspots,
        afterHotspots,
        hasBefore ? baselineDeltaLabel(hotspotsDelta, '') : firstMeasurement,
        hasBefore ? baselineTrendClass(hotspotsDelta, true) : 'neutral'
      );

      const coverageDelta = hasBefore
        ? baselineDifference(afterScoped.coverage, beforeScoped.coverage)
        : null;
      setBaselineMetric(
        root,
        'coverage',
        hasBefore ? baselinePercent(beforeScoped.coverage) : '—',
        baselinePercent(afterScoped.coverage),
        hasBefore
          ? baselineDeltaLabel(coverageDelta, ' pp')
          : firstMeasurement,
        hasBefore ? baselineTrendClass(coverageDelta, false) : 'neutral'
      );

      const duplicationDelta = hasBefore
        ? baselineDifference(afterScoped.duplication, beforeScoped.duplication)
        : null;
      setBaselineMetric(
        root,
        'duplication',
        hasBefore ? baselinePercent(beforeScoped.duplication) : '—',
        baselinePercent(afterScoped.duplication),
        hasBefore
          ? baselineDeltaLabel(duplicationDelta, ' pp')
          : firstMeasurement,
        hasBefore ? baselineTrendClass(duplicationDelta, true) : 'neutral'
      );

      const beforeGate = hasBefore ? baselineQualityGateLabel(beforeScoped.qualityGate) : '—';
      const afterGate = baselineQualityGateLabel(afterScoped.qualityGate);
      let gateTrend = 'neutral';
      let gateDelta = firstMeasurement;
      if (hasBefore) {
        const rankDelta = baselineQualityGateRank(afterScoped.qualityGate) -
          baselineQualityGateRank(beforeScoped.qualityGate);
        gateTrend = rankDelta > 0 ? 'improved' : rankDelta < 0 ? 'worsened' : 'neutral';
        gateDelta = rankDelta === 0
          ? ''
          : translateLocalizationValue(rankDelta > 0 ? 'Mejora' : 'Empeora');
      }
      setBaselineMetric(root, 'qualityGate', beforeGate, afterGate, gateDelta, gateTrend);
    }
`;
