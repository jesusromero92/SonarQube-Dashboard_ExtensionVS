import assert from 'node:assert/strict';
import test from 'node:test';
import { ISSUES_TABLE_MARKUP } from '../src/dashboard/webview/components/issuesTable';
import { RANKING_TABLES_MARKUP } from '../src/dashboard/webview/components/rankingTables';
import { COVERAGE_VIEW_MARKUP } from '../src/dashboard/webview/components/coverageView';
import { COVERAGE_SCRIPT } from '../src/dashboard/webview/scripts/coverage';
import { ISSUES_TABLE_SCRIPT } from '../src/dashboard/webview/scripts/tables/issuesTable';
import { LAYOUT_EVENTS_SCRIPT } from '../src/dashboard/webview/scripts/events/layout';
import { getTableStyles } from '../src/dashboard/webview/styles/tables';

test('las tablas Top, Cobertura y Duplicación usan el mismo scroll nativo y foco por fila que Issues', () => {
  assert.match(ISSUES_TABLE_MARKUP, /<tbody id="issuesBody"><\/tbody>/);
  assert.match(RANKING_TABLES_MARKUP, /<tbody id="filesBody"><\/tbody>/);
  assert.match(RANKING_TABLES_MARKUP, /<tbody id="rulesBody"><\/tbody>/);
  assert.match(COVERAGE_VIEW_MARKUP, /<tbody id="coverageFilesBody"><\/tbody>/);
  assert.match(COVERAGE_VIEW_MARKUP, /<tbody id="duplicationFilesBody"><\/tbody>/);
  assert.doesNotMatch(RANKING_TABLES_MARKUP, /ranking-scroll-body/);
  assert.doesNotMatch(RANKING_TABLES_MARKUP, /tabindex="0"/);

  assert.doesNotMatch(LAYOUT_EVENTS_SCRIPT, /rankingScrollStates/);
  assert.doesNotMatch(LAYOUT_EVENTS_SCRIPT, /animateRankingScroll/);
  assert.doesNotMatch(LAYOUT_EVENTS_SCRIPT, /scrollBody\.addEventListener\('wheel'/);
  assert.match(ISSUES_TABLE_SCRIPT, /function bindRowAction/);
  assert.match(COVERAGE_SCRIPT, /bindRowAction\(/);
  assert.doesNotMatch(COVERAGE_SCRIPT, /row\.addEventListener\('wheel'/);

  const styles = getTableStyles({
    bugIconUri: 'bug.svg' as never,
    codeSmellIconUri: 'code-smell.svg' as never,
    vulnerabilityIconUri: 'vulnerability.svg' as never
  });
  assert.match(styles, /\.body-scroll-table tbody \{/);
  assert.match(styles, /overflow-y: auto/);
  assert.doesNotMatch(styles, /\.ranking-scroll-body/);
});
