import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { detectProjectActions } from '../src/scanner/projectActions';
import { ANALYSIS_CONFIRMATION_DIALOG_MARKUP } from '../src/dashboard/webview/modals/analysisConfirmationDialog';
import { ANALYSIS_SCRIPT } from '../src/dashboard/webview/scripts/analysis';
import { PIPELINE_EDITOR_SCRIPT } from '../src/dashboard/webview/scripts/pipelineEditor';
import { ANALYSIS_DIALOG_MARKUP } from '../src/dashboard/webview/modals/analysisDialog';
import { CONFIGURATION_PAGE_MARKUP } from '../src/dashboard/webview/pages/configurationPage';
import { CONFIGURATION_CORE_SCRIPT } from '../src/dashboard/webview/scripts/core/configuration';

test('detecta compilación y tests desde los scripts de package.json', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sonar-actions-'));
  try {
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        scripts: {
          compile: 'tsc -p ./',
          test: 'node --test'
        }
      })
    );

    const actions = await detectProjectActions(root);
    assert.equal(actions.buildCommand, 'npm run compile');
    assert.equal(actions.testCommand, 'npm test');
    assert.equal(actions.evidence, 'package.json');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('la configuración permite ordenar pasos y elegir la condición de fallo al analizar', () => {
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="buildCommand"/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="testCommand"/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="pipelineStepsEditor"/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="addPipelineStep"/);
  assert.match(CONFIGURATION_CORE_SCRIPT, /detectedBuildCommand/);
  assert.match(CONFIGURATION_CORE_SCRIPT, /detectedTestCommand/);

  assert.match(ANALYSIS_CONFIRMATION_DIALOG_MARKUP, /id="analysisRunSteps"/);
  assert.doesNotMatch(ANALYSIS_CONFIRMATION_DIALOG_MARKUP, /id="analysisStepTemplate"/);
  assert.match(ANALYSIS_CONFIRMATION_DIALOG_MARKUP, /id="analysisAddStep"/);
  assert.match(ANALYSIS_DIALOG_MARKUP, /id="analysisStepper"/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /handle\.draggable = !disabled/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /event\.target\.closest\('\.pipeline-step-drag'\)/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /row\.draggable = false/);
  assert.doesNotMatch(PIPELINE_EDITOR_SCRIPT, /configurationSonarStepRow/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /function renderAnalysisRunSteps\(\)[\s\S]*sonarAnalysisRunStep/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /availableAnalysisStepTemplates/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /pipeline-step-name-dropdown/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /elements\.analysisAddStep\.disabled = false/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /function addSelectedAnalysisStep\(event\)/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /command\.readOnly = step\.kind === 'sonar'/);
  assert.doesNotMatch(PIPELINE_EDITOR_SCRIPT, /pipeline-step-timing/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /failurePolicy/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /Detener si falla/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /Continuar si falla/);
  assert.match(ANALYSIS_SCRIPT, /analysisSteps: steps/);
  assert.match(ANALYSIS_SCRIPT, /renderAnalysisStepper/);
});
