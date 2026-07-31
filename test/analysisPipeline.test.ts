import assert from 'node:assert/strict';
import test from 'node:test';
import { Script } from 'node:vm';
import {
  expandAnalysisPipelineCommand,
  parseAnalysisPipeline,
  serializeAnalysisPipeline
} from '../src/scanner/pipeline';
import { PIPELINE_EDITOR_SCRIPT } from '../src/dashboard/webview/scripts/pipelineEditor';

test('parseAnalysisPipeline crea etapas nombradas, condiciones y omite comentarios', () => {
  const stages = parseAnalysisPipeline(
    [
      '# preparación',
      'Compilar :: npm run build :: stop',
      '',
      'Auditoría :: npm audit --audit-level=high :: continue'
    ].join('\n'),
    'Acción previa'
  );

  assert.deepEqual(stages, [
    {
      id: 'custom-1-compilar',
      name: 'Compilar',
      command: 'npm run build',
      failurePolicy: 'stop'
    },
    {
      id: 'custom-2-auditoria',
      name: 'Auditoría',
      command: 'npm audit --audit-level=high',
      failurePolicy: 'continue'
    }
  ]);
});

test('serializeAnalysisPipeline conserva el orden y la condición de fallo', () => {
  assert.equal(
    serializeAnalysisPipeline([
      {
        id: 'lint',
        name: 'Lint',
        command: 'npm run lint',
        failurePolicy: 'continue'
      },
      {
        id: 'test',
        name: 'Tests',
        command: 'npm test',
        failurePolicy: 'stop'
      }
    ]),
    'Lint :: npm run lint :: continue\nTests :: npm test :: stop'
  );
});

test('expandAnalysisPipelineCommand sustituye las variables admitidas', () => {
  const command = expandAnalysisPipelineCommand(
    'tool --root "${workspaceFolder}" --project "${projectKey}" --name "${projectName}" --server "${serverUrl}" --branch "${branch}"',
    {
      workspaceFolder: '/repo',
      projectKey: 'sample',
      projectName: 'Sample project',
      serverUrl: 'https://sonar.example.test',
      branch: 'main'
    }
  );

  assert.equal(
    command,
    'tool --root "/repo" --project "sample" --name "Sample project" --server "https://sonar.example.test" --branch "main"'
  );
});


test('el script del editor de pipeline genera JavaScript válido', () => {
  assert.doesNotThrow(() => new Script(PIPELINE_EDITOR_SCRIPT));
});

test('el paso nuevo se monta antes de aplicar la plantilla seleccionada', () => {
  const appendIndex = PIPELINE_EDITOR_SCRIPT.indexOf("row.append(\n        dragHandle(step.kind === 'sonar')");
  const applyIndex = PIPELINE_EDITOR_SCRIPT.indexOf(
    "applyAnalysisStepTemplate(row, step.templateId || '', policy);"
  );

  assert.notEqual(appendIndex, -1);
  assert.notEqual(applyIndex, -1);
  assert.ok(
    appendIndex < applyIndex,
    'La fila debe contener el campo de comando antes de aplicar la plantilla.'
  );
});


test('el stepper conserva sus nodos mientras avanza la consola', () => {
  const start = PIPELINE_EDITOR_SCRIPT.indexOf(
    'function renderAnalysisStepper(steps)'
  );
  const end = PIPELINE_EDITOR_SCRIPT.indexOf(
    'enablePipelineDrag(elements.pipelineStepsEditor',
    start
  );
  const renderer = PIPELINE_EDITOR_SCRIPT.slice(start, end);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.doesNotMatch(renderer, /analysisStepper\.textContent\s*=\s*''/);
  assert.match(renderer, /item\.dataset\.stepId\s*=\s*stepId/);
  assert.match(renderer, /existingItems\.get\(stepId\)/);
  assert.match(renderer, /item\.className\s*!==\s*nextClassName/);
});


test('el botón Analizar se deshabilita mientras haya un paso incompleto', () => {
  assert.match(
    PIPELINE_EDITOR_SCRIPT,
    /function updateAnalysisConfirmAvailability\(\)/
  );
  assert.match(
    PIPELINE_EDITOR_SCRIPT,
    /analysisConfirmationConfirm\.disabled\s*=\s*incompleteRows\.length\s*>\s*0/
  );
  assert.match(
    PIPELINE_EDITOR_SCRIPT,
    /return !template\?\.value \|\| !command\?\.value\.trim\(\)/
  );
  assert.match(
    PIPELINE_EDITOR_SCRIPT,
    /command\.addEventListener\('input', updateAnalysisConfirmAvailability\)/
  );
});
