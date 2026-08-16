import assert from 'node:assert/strict';
import test from 'node:test';
import { PIPELINE_HISTORY_STYLES } from '../src/modules/pipeline/webview/historyStyles';

test('la consola de ejecucion contiene las lineas largas sin ensanchar el dashboard', () => {
  assert.match(PIPELINE_HISTORY_STYLES, /\.pipeline-execution-detail[\s\S]*?min-width: 0;/);
  assert.match(PIPELINE_HISTORY_STYLES, /\.pipeline-execution-log-content[\s\S]*?min-width: 0;/);
  assert.match(
    PIPELINE_HISTORY_STYLES,
    /\.pipeline-history-log[\s\S]*?width: 100%;[\s\S]*?max-width: 100%;[\s\S]*?overflow: auto;/
  );
});
