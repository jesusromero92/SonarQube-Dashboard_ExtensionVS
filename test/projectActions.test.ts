import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { detectProjectActions } from '../src/pipeline/projectActions';
import { ANALYSIS_CONFIRMATION_DIALOG_MARKUP } from '../src/pipeline/webview/modals/analysisConfirmationDialog';
import { ANALYSIS_SCRIPT } from '../src/pipeline/webview/analysis';
import { PIPELINE_EDITOR_SCRIPT } from '../src/pipeline/webview/editor';
import { CONFIGURATION_EVENTS_SCRIPT } from '../src/dashboard/webview/scripts/events/configuration';
import { ANALYSIS_DIALOG_MARKUP } from '../src/pipeline/webview/modals/analysisDialog';
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


test('separa los pasos disponibles del editor de plantillas', () => {
  const stepsIndex = CONFIGURATION_PAGE_MARKUP.indexOf('id="pipelineStepsEditor"');
  const templatesIndex = CONFIGURATION_PAGE_MARKUP.indexOf('id="pipelineTemplate"');

  assert.ok(stepsIndex >= 0);
  assert.ok(templatesIndex > stepsIndex);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="pipelineTemplateEditor"/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="pipelineTemplateStepsEditor"/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="newPipelineTemplate"/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="addPipelineTemplateStep"/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /function renderPipelineTemplateEditor/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /function readPipelineTemplateRows/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /enablePipelineDrag\(elements\.pipelineTemplateStepsEditor/);
});

test('detecta integraciones predefinidas de seguridad y calidad en proyectos Node', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sonar-integrations-'));
  try {
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        scripts: {
          lint: 'eslint .'
        },
        devDependencies: {
          eslint: '^9.0.0'
        }
      })
    );
    await fs.writeFile(path.join(root, 'package-lock.json'), '{}');
    await fs.writeFile(path.join(root, 'Dockerfile'), 'FROM node:20');

    const actions = await detectProjectActions(root);
    assert.deepEqual(
      actions.integrations.map(integration => integration.id).sort(),
      ['dependency-audit', 'eslint', 'trivy']
    );
    assert.equal(
      actions.integrations.find(integration => integration.id === 'eslint')?.command,
      'npm run lint'
    );
    assert.equal(
      actions.integrations.find(integration => integration.id === 'dependency-audit')?.command,
      'npm audit --audit-level=high'
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('muestra cada integración detectada una sola vez y la mueve al pipeline', () => {
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="detectedIntegrations"/);
  assert.ok(
    CONFIGURATION_PAGE_MARKUP.indexOf('id="pipelineTemplateStepsEditor"') <
      CONFIGURATION_PAGE_MARKUP.indexOf('id="detectedIntegrations"')
  );
  assert.match(CONFIGURATION_CORE_SCRIPT, /availableDetectedIntegrations\(integrations\)/);
  assert.match(CONFIGURATION_CORE_SCRIPT, /addDetectedIntegrationToPipeline/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /function normalizedPipelineCommand/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /function configuredPipelineCommandKeys/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /function availableDetectedIntegrations/);
  assert.match(
    PIPELINE_EDITOR_SCRIPT,
    /syncConfigurationPipelineFields[\s\S]*renderDetectedIntegrations\(currentConfig\.detectedIntegrations\)/
  );
  assert.match(
    PIPELINE_EDITOR_SCRIPT,
    /availableDetectedIntegrations\(currentConfig\.detectedIntegrations\)[\s\S]*integration-.*integration\.id/
  );
});


test('las acciones y mensajes de plantillas permanecen dentro de su acordeón', () => {
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="pipelineTemplateStatus"/);
  assert.doesNotMatch(CONFIGURATION_PAGE_MARKUP, /id="applyPipelineTemplate"/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="deletePipelineTemplate"/);
  assert.doesNotMatch(CONFIGURATION_EVENTS_SCRIPT, /window\.confirm/);
  assert.match(CONFIGURATION_EVENTS_SCRIPT, /type: 'deletePipelineTemplate'/);
  assert.match(CONFIGURATION_EVENTS_SCRIPT, /Restableciendo plantilla…/);
  assert.match(CONFIGURATION_EVENTS_SCRIPT, /Eliminando plantilla…/);
});
