import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function source(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

test('pipeline queda centralizado en src/pipeline sin fachadas legacy', () => {
  const required = [
    'src/pipeline/index.ts',
    'src/pipeline/constants.ts',
    'src/pipeline/models.ts',
    'src/pipeline/parser.ts',
    'src/pipeline/requests.ts',
    'src/pipeline/templates.ts',
    'src/pipeline/projectActions.ts',
    'src/pipeline/baseline.ts',
    'src/pipeline/history.ts',
    'src/pipeline/executionService.ts',
    'src/pipeline/executionTreeView.ts',
    'src/pipeline/webview/editor.ts',
    'src/pipeline/webview/analysis.ts',
    'src/pipeline/webview/history.ts',
    'src/pipeline/webview/baseline.ts',
    'src/pipeline/webview/styles.ts',
    'src/pipeline/webview/components/baselineComparison.ts',
    'src/pipeline/webview/pages/historyPage.ts',
    'src/pipeline/webview/modals/analysisDialog.ts',
    'src/pipeline/webview/modals/analysisConfirmationDialog.ts'
  ];

  for (const file of required) {
    assert.equal(existsSync(path.resolve(process.cwd(), file)), true, file);
  }

  const removed = [
    'src/pipelineExecutionTreeView.ts',
    'src/scanner/analysisService.ts',
    'src/scanner/baseline.ts',
    'src/scanner/history.ts',
    'src/scanner/pipeline.ts',
    'src/scanner/pipelineTemplates.ts',
    'src/scanner/projectActions.ts',
    'src/dashboard/webview/scripts/pipelineEditor.ts',
    'src/dashboard/webview/scripts/analysis.ts',
    'src/dashboard/webview/scripts/history.ts',
    'src/dashboard/webview/scripts/baseline.ts',
    'src/dashboard/webview/components/baselineComparison.ts',
    'src/dashboard/webview/pages/historyPage.ts',
    'src/dashboard/webview/modals/analysisDialog.ts',
    'src/dashboard/webview/modals/analysisConfirmationDialog.ts'
  ];

  for (const file of removed) {
    assert.equal(existsSync(path.resolve(process.cwd(), file)), false, file);
  }
});

test('consumidores principales usan el módulo pipeline', () => {
  const dashboard = source('src/dashboardPanel.ts');
  const extension = source('src/extension.ts');
  const contracts = source('src/dashboard/contracts.ts');
  const diagnostics = source('src/dashboard/diagnostics.ts');

  assert.match(dashboard, /from '\.\/pipeline'/);
  assert.match(extension, /from '\.\/pipeline'/);
  assert.match(contracts, /from '\.\.\/pipeline'/);
  assert.match(diagnostics, /from '\.\.\/pipeline'/);

  for (const text of [dashboard, extension, contracts, diagnostics]) {
    assert.doesNotMatch(
      text,
      /scanner\/(analysisService|baseline|history|pipeline|pipelineTemplates|projectActions)/
    );
  }
});

test('scanner conserva solo responsabilidades propias del scanner', () => {
  const scannerTypes = source('src/scanner/types.ts');
  assert.doesNotMatch(scannerTypes, /PipelineRunHistory/);
  assert.doesNotMatch(scannerTypes, /AnalysisExecutionStep/);
  assert.doesNotMatch(scannerTypes, /AnalysisBaselineSnapshot/);
  assert.match(scannerTypes, /DetectedScanner/);
  assert.match(scannerTypes, /ProcessSpec/);
});


test('la modularización no reemplaza las constantes globales por constantes de un módulo', () => {
  const rootConstants = source('src/constants.ts');
  const pipelineConstants = source('src/pipeline/constants.ts');
  const liveConstants = source('src/liveRemediation/constants.ts');

  for (const exportedName of [
    'DASHBOARD_COMMANDS',
    'DASHBOARD_CONFIGURATION_KEYS',
    'DASHBOARD_CONFIGURATION_SECTION',
    'DASHBOARD_PANEL_VIEW_TYPE',
    'DASHBOARD_COLORS',
    'DASHBOARD_WEBVIEW_CONSTANTS',
    'SONAR_CONFIGURATION_KEYS',
    'SONAR_CONFIGURATION_SECTION',
    'SONAR_PAGE_SIZE',
    'SONAR_SUMMARY_METRICS',
    'ISSUE_TREE_GROUPS',
    'ISSUE_TREE_VIEW_ID'
  ]) {
    assert.match(rootConstants, new RegExp(`export const ${exportedName}`), exportedName);
  }

  assert.doesNotMatch(rootConstants, /PIPELINE_EXECUTION_TREE_VIEW_ID/);
  assert.doesNotMatch(rootConstants, /LIVE_REMEDIATION_STORAGE_KEY/);
  assert.match(pipelineConstants, /PIPELINE_EXECUTION_TREE_VIEW_ID/);
  assert.match(liveConstants, /LIVE_REMEDIATION_STORAGE_KEY/);
});
