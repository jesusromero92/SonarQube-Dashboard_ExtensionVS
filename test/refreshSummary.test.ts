import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyRefreshSummary,
  preserveRefreshSummaryAfterErrors
} from '../src/dashboard/summary';

test('conserva la carpeta configurada cuando falla la primera sincronización', () => {
  const previous = createEmptyRefreshSummary();
  const attempted = createEmptyRefreshSummary();
  attempted.configuredFolders = 1;
  attempted.errors.push('workspace: token rejected');

  const preserved = preserveRefreshSummaryAfterErrors(previous, attempted);

  assert.equal(preserved.configuredFolders, 1);
  assert.deepEqual(preserved.errors, ['workspace: token rejected']);
  assert.equal(previous.configuredFolders, 0);
});

test('preserva los datos anteriores al actualizar el estado de configuración', () => {
  const previous = createEmptyRefreshSummary();
  previous.configuredFolders = 1;
  previous.published = 4;
  const attempted = createEmptyRefreshSummary();
  attempted.configuredFolders = 1;
  attempted.errors.push('temporary error');

  const preserved = preserveRefreshSummaryAfterErrors(previous, attempted);

  assert.equal(preserved.published, 4);
  assert.deepEqual(preserved.errors, ['temporary error']);
});
