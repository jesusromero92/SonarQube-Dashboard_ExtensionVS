import assert from 'node:assert/strict';
import test from 'node:test';
import { COVERAGE_VIEW_MARKUP } from '../src/dashboard/webview/components/coverageView';
import { EVOLUTION_CHARTS_MARKUP } from '../src/dashboard/webview/components/evolutionCharts';
import { CHARTS_SCRIPT } from '../src/dashboard/webview/scripts/charts';
import { DASHBOARD_EVENTS_SCRIPT } from '../src/dashboard/webview/scripts/events/dashboard';
import { SELECT_DROPDOWN_SCRIPT } from '../src/dashboard/webview/scripts/ui/selectDropdown';
import { SELECT_DROPDOWN_STYLES } from '../src/dashboard/webview/design/components/selectDropdown';
import { ISSUES_TABLE_SCRIPT } from '../src/dashboard/webview/scripts/tables/issuesTable';
import { DASHBOARD_STATE_SCRIPT } from '../src/dashboard/webview/scripts/core/state';
import { buildEvolution } from '../src/sonarClient';

test('conserva todos los análisis para poder comparar con el inmediatamente anterior', () => {
  const evolution = buildEvolution([{
    metric: 'bugs',
    history: [
      { date: '2026-07-28T09:00:00+0000', value: '3' },
      { date: '2026-07-28T18:00:00+0000', value: '5' },
      { date: '2026-07-29T12:00:00+0000', value: '7' }
    ]
  }]);

  assert.deepEqual(
    evolution.map(point => ({ date: point.date, label: point.label, bugs: point.bugs })),
    [
      {
        date: '2026-07-28T09:00:00+0000',
        label: '2026-07-28',
        bugs: 3
      },
      {
        date: '2026-07-28T18:00:00+0000',
        label: '2026-07-28',
        bugs: 5
      },
      {
        date: '2026-07-29T12:00:00+0000',
        label: '2026-07-29',
        bugs: 7
      }
    ]
  );
});

test('cada gráfica ofrece su propio selector de día, semana y mes', () => {
  for (const value of ['day', 'week', 'month']) {
    assert.match(EVOLUTION_CHARTS_MARKUP, new RegExp(`value="${value}"`));
    assert.match(COVERAGE_VIEW_MARKUP, new RegExp(`value="${value}"`));
  }
  for (const id of [
    'typeEvolutionGranularity',
    'severityEvolutionGranularity',
    'coverageEvolutionGranularity',
    'duplicationEvolutionGranularity'
  ]) {
    assert.match(
      EVOLUTION_CHARTS_MARKUP + COVERAGE_VIEW_MARKUP,
      new RegExp(`id="${id}"`)
    );
  }
  assert.doesNotMatch(EVOLUTION_CHARTS_MARKUP, />Agrupar por</);
  assert.equal(
    (EVOLUTION_CHARTS_MARKUP + COVERAGE_VIEW_MARKUP).match(/data-select-dropdown/g)?.length,
    4
  );
  assert.match(SELECT_DROPDOWN_SCRIPT, /dispatchEvent\(new Event\('change'/);
  assert.match(SELECT_DROPDOWN_STYLES, /position: fixed/);
  assert.match(SELECT_DROPDOWN_STYLES, /width: 100%/);
  assert.match(SELECT_DROPDOWN_SCRIPT, /MutationObserver/);
  assert.match(SELECT_DROPDOWN_SCRIPT, /function refreshSelectDropdown/);
  assert.match(CHARTS_SCRIPT, /byBucket\.set\(bucket, \{ \.\.\.point, label: bucket \}\)/);
  assert.match(CHARTS_SCRIPT, /slice\(-dashboardConstants\.evolutionLimit\)/);
  assert.match(DASHBOARD_EVENTS_SCRIPT, /bindEvolutionGranularity/);
  assert.equal(
    (EVOLUTION_CHARTS_MARKUP + COVERAGE_VIEW_MARKUP).match(/value="day" selected/g)?.length,
    4
  );
  assert.match(DASHBOARD_STATE_SCRIPT, /types: 'day'/);
  assert.match(DASHBOARD_STATE_SCRIPT, /severity: 'day'/);
  assert.match(DASHBOARD_STATE_SCRIPT, /coverage: 'day'/);
  assert.match(DASHBOARD_STATE_SCRIPT, /duplication: 'day'/);
  assert.match(EVOLUTION_CHARTS_MARKUP, /Evolución diaria de bugs/);
  assert.match(EVOLUTION_CHARTS_MARKUP, /Evolución diaria de issues/);
});

test('las tarjetas comparan siempre con el análisis inmediatamente anterior', () => {
  assert.match(ISSUES_TABLE_SCRIPT, /summary\.latestAnalysis/);
  assert.match(ISSUES_TABLE_SCRIPT, /\? summary\.previousAnalysis/);
  assert.doesNotMatch(
    ISSUES_TABLE_SCRIPT,
    /function previousAnalysis\(summary\)[\s\S]*?groupedEvolution/
  );
});


test('deshabilita la evolución histórica en el ámbito New Code', () => {
  assert.match(EVOLUTION_CHARTS_MARKUP, /id="issuesEvolutionUnavailable"/);
  assert.match(EVOLUTION_CHARTS_MARKUP, /id="issuesEvolutionGrid"/);
  assert.match(COVERAGE_VIEW_MARKUP, /id="coverageEvolutionUnavailable"/);
  assert.match(COVERAGE_VIEW_MARKUP, /id="coverageEvolutionGrid"/);
  assert.match(CHARTS_SCRIPT, /currentScope === 'overall'/);
  assert.match(CHARTS_SCRIPT, /issuesEvolutionGrid\.hidden = !available/);
  assert.match(CHARTS_SCRIPT, /coverageEvolutionGrid\.hidden = !available/);
  assert.doesNotMatch(CHARTS_SCRIPT, /point\.newBugs/);
});

test('oculta por completo la evolución cuando todavía no existe un análisis anterior', () => {
  assert.match(CHARTS_SCRIPT, /function historicalEvolutionAvailable\(\)/);
  assert.match(CHARTS_SCRIPT, /currentSummary\.analysisComparisonAvailable !== false/);
  assert.match(CHARTS_SCRIPT, /currentSummary\.latestAnalysis && currentSummary\.previousAnalysis/);
  assert.match(CHARTS_SCRIPT, /issuesEvolutionSection\.hidden = !hasHistoricalEvolution/);
  assert.match(CHARTS_SCRIPT, /coverageEvolutionSection\.hidden = !hasHistoricalEvolution/);
  assert.match(CHARTS_SCRIPT, /if \(!hasHistoricalEvolution\)/);
});

