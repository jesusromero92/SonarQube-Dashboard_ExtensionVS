import assert from 'node:assert/strict';
import test from 'node:test';
import { ISSUES_TABLE_MARKUP } from '../src/dashboard/webview/components/issuesTable';
import { DASHBOARD_STATE_SCRIPT } from '../src/dashboard/webview/scripts/core/state';
import { DASHBOARD_EVENTS_SCRIPT } from '../src/dashboard/webview/scripts/events/dashboard';
import { ISSUES_TABLE_SCRIPT } from '../src/dashboard/webview/scripts/tables/issuesTable';

test('la tabla de Issues permite ordenar sus columnas de datos', () => {
  for (const key of [
    'severityRank',
    'type',
    'relativePath',
    'status',
    'ruleName'
  ]) {
    assert.match(
      ISSUES_TABLE_MARKUP,
      new RegExp(`data-sort-header="issues" data-sort-key="${key}"`)
    );
  }
  assert.doesNotMatch(ISSUES_TABLE_MARKUP, /col-actions" data-sort-header/);
  assert.match(DASHBOARD_STATE_SCRIPT, /const issueSort/);
  assert.match(DASHBOARD_STATE_SCRIPT, /key: 'severityRank'/);
  assert.match(ISSUES_TABLE_SCRIPT, /function sortIssues/);
  assert.match(ISSUES_TABLE_SCRIPT, /function updateIssueSortHeaders/);
  assert.match(ISSUES_TABLE_SCRIPT, /localeCompare/);
  assert.match(DASHBOARD_EVENTS_SCRIPT, /tableName === 'issues'/);
  assert.match(DASHBOARD_EVENTS_SCRIPT, /renderIssues\(\)/);
});
