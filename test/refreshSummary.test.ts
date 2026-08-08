import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyRefreshSummary,
  preserveRefreshSummaryAfterErrors
} from '../src/dashboard/summary';
import { MESSAGE_EVENTS_SCRIPT } from '../src/dashboard/webview/scripts/events/messages';
import { EMPTY_STATE_SCRIPT } from '../src/dashboard/webview/scripts/core/emptyState';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('conserva la carpeta configurada cuando falla la primera sincronización', () => {
  const previous = createEmptyRefreshSummary();
  const attempted = createEmptyRefreshSummary();
  attempted.configuredFolders = 1;
  attempted.errors.push('workspace: token rejected');

  const preserved = preserveRefreshSummaryAfterErrors(previous, attempted);

  assert.equal(preserved.configuredFolders, 1);
  assert.equal(preserved.syncStatus, 'error');
  assert.equal(preserved.hasSuccessfulSync, false);
  assert.deepEqual(preserved.errors, ['workspace: token rejected']);
  assert.equal(previous.configuredFolders, 0);
});

test('preserva los datos anteriores al actualizar el estado de configuración', () => {
  const previous = createEmptyRefreshSummary();
  previous.configuredFolders = 1;
  previous.published = 4;
  previous.syncStatus = 'success';
  previous.hasSuccessfulSync = true;
  previous.lastSuccessfulAt = '2026-07-29T10:00:00.000Z';
  const attempted = createEmptyRefreshSummary();
  attempted.configuredFolders = 1;
  attempted.errors.push('temporary error');

  const preserved = preserveRefreshSummaryAfterErrors(previous, attempted);

  assert.equal(preserved.published, 4);
  assert.equal(preserved.syncStatus, 'error');
  assert.equal(preserved.hasSuccessfulSync, true);
  assert.equal(preserved.lastSuccessfulAt, '2026-07-29T10:00:00.000Z');
  assert.deepEqual(preserved.errors, ['temporary error']);
});


test('un error inicial detiene el loading del dashboard aunque los mensajes lleguen desordenados', () => {
  assert.match(
    MESSAGE_EVENTS_SCRIPT,
    /case 'summary':[\s\S]*summary\.syncStatus === 'error'[\s\S]*setDashboardLoading\(false\)/
  );
  assert.match(
    MESSAGE_EVENTS_SCRIPT,
    /case 'loading':[\s\S]*currentSummary\.syncStatus === 'error'[\s\S]*initialSyncFailed \? false : message\.loading/
  );
});

test('el panel lateral no duplica el error de servidor caído en un aviso rojo', () => {
  const launcherSource = readFileSync(
    join(process.cwd(), 'src/dashboard/launcherWebview.ts'),
    'utf8'
  );

  assert.match(launcherSource, /syncNotice\.hidden = !stale/);
  assert.doesNotMatch(
    launcherSource,
    /syncNotice\.textContent = 'SonarQube no está disponible\./
  );
  assert.match(
    launcherSource,
    /Comprueba que el servidor esté disponible y vuelve a intentarlo\./
  );
});


test('el estado de sincronización usa el locale definido por el dashboard', () => {
  assert.match(
    EMPTY_STATE_SCRIPT,
    /toLocaleString\(dashboardLocale\)/
  );
  assert.doesNotMatch(
    EMPTY_STATE_SCRIPT,
    /toLocaleString\(locale\)/
  );
  assert.match(
    EMPTY_STATE_SCRIPT,
    /stale\s*\?\s*formatSuccessfulSyncTime\(currentSummary\.lastSuccessfulAt\)/
  );
});

test('el resumen vacío distingue explícitamente un proyecto sin análisis', () => {
  const summary = createEmptyRefreshSummary();

  assert.equal(summary.hasAnalysis, false);
});
