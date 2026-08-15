import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const source = (relativePath: string): string =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const exists = (relativePath: string): boolean =>
  existsSync(path.resolve(process.cwd(), relativePath));

test('Pipeline queda autocontenido en src/modules/pipeline', () => {
  for (const file of [
    'src/modules/pipeline/index.ts',
    'src/modules/pipeline/constants.ts',
    'src/modules/pipeline/configuration.ts',
    'src/modules/pipeline/controller.ts',
    'src/modules/pipeline/module.ts',
    'src/modules/pipeline/models.ts',
    'src/modules/pipeline/parser.ts',
    'src/modules/pipeline/requests.ts',
    'src/modules/pipeline/templates.ts',
    'src/modules/pipeline/projectActions.ts',
    'src/modules/pipeline/baseline.ts',
    'src/modules/pipeline/history.ts',
    'src/modules/pipeline/executionService.ts',
    'src/modules/pipeline/executionTreeView.ts',
    'src/modules/pipeline/scanner/analysisScope.ts',
    'src/modules/pipeline/scanner/detector.ts',
    'src/modules/pipeline/scanner/processRunner.ts',
    'src/modules/pipeline/webview/integration.ts',
    'src/modules/pipeline/webview/configuration.ts'
  ]) assert.equal(exists(file), true, file);

  assert.equal(exists('src/pipeline'), false);
  assert.equal(exists('src/scanner'), false);
});

test('Pipeline posee sus comandos y el core no los registra', () => {
  const module = source('src/modules/pipeline/module.ts');
  const constants = source('src/modules/pipeline/constants.ts');
  const extension = source('src/extension.ts');

  assert.match(constants, /sonarQubeDashboard\.analyze/);
  assert.match(constants, /sonarQubeDashboard\.cancelAnalysis/);
  assert.match(module, /registerCommand\([\s\S]*PIPELINE_COMMANDS\.analyze/);
  assert.match(module, /registerCommand\([\s\S]*PIPELINE_COMMANDS\.cancelAnalysis/);
  assert.doesNotMatch(extension, /DASHBOARD_COMMANDS\.analyze|PIPELINE_COMMANDS/);
});

test('scanner y configuración de análisis son propiedad de Pipeline', () => {
  const scannerTypes = source('src/modules/pipeline/scanner/types.ts');
  const config = source('src/modules/pipeline/configuration.ts');
  const coreConfig = source('src/configuration.ts');
  assert.match(scannerTypes, /ScannerMode/);
  assert.match(config, /PIPELINE_CONFIGURATION_KEYS/);
  assert.doesNotMatch(config, /legacyTestCommandKey|migrateLegacy|sonarQubeDashboard\.sonar\.testCommand/);
  assert.doesNotMatch(coreConfig, /scannerMode|analysisExclusions|customScannerCommand/);
});

test('Pipeline consume UI compartida sin importar Dashboard UI', () => {
  const history = source('src/modules/pipeline/webview/pages/historyPage.ts');
  const confirmation = source('src/modules/pipeline/webview/modals/analysisConfirmationDialog.ts');
  assert.match(history, /shared\/webview\/ui\/accordion/);
  assert.match(confirmation, /shared\/webview\/ui\/selectDropdown/);
  assert.doesNotMatch(history + confirmation, /dashboard\/webview\/components\/ui/);
});
