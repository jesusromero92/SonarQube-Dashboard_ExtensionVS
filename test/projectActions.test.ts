import assert from 'node:assert/strict';
import { promises as fs, readFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { detectProjectActions } from '../src/modules/pipeline/projectActions';
import { calculatePipelineStepTimingStatistics } from '../src/modules/pipeline/history';
import { ANALYSIS_CONFIRMATION_DIALOG_MARKUP } from '../src/modules/pipeline/webview/modals/analysisConfirmationDialog';
import { ANALYSIS_SCRIPT } from '../src/modules/pipeline/webview/analysis';
import { PIPELINE_EDITOR_SCRIPT } from '../src/modules/pipeline/webview/editor';
import { PIPELINE_INTEGRATION_SCRIPT } from '../src/modules/pipeline/webview/integration';
import { CONFIGURATION_EVENTS_SCRIPT } from '../src/dashboard/webview/scripts/events/configuration';
import { ANALYSIS_DIALOG_MARKUP } from '../src/modules/pipeline/webview/modals/analysisDialog';
import { getConfigurationPageMarkup } from '../src/dashboard/webview/pages/configurationPage';
import { PIPELINE_WEBVIEW_CONTRIBUTION } from '../src/modules/pipeline/webview';
import { CONFIGURATION_CORE_SCRIPT } from '../src/dashboard/webview/scripts/core/configuration';

const CONFIGURATION_PAGE_MARKUP = getConfigurationPageMarkup(PIPELINE_WEBVIEW_CONTRIBUTION);

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
    assert.equal(actions.packageManager, 'npm');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('la configuración permite ordenar pasos y elegir la condición de fallo al analizar', () => {
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="buildCommand"/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="testCommand"/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="pipelineStepsEditor"/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="addPipelineStep"/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /detectedBuildCommand/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /detectedTestCommand/);

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

test('prioriza packageManager de package.json y adapta comandos Node al gestor declarado', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sonar-pnpm-actions-'));
  try {
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        packageManager: 'pnpm@10.15.0',
        devDependencies: { eslint: '^9.0.0' }
      })
    );
    await fs.writeFile(path.join(root, 'package-lock.json'), '{}');
    await fs.writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9');

    const actions = await detectProjectActions(root);
    assert.equal(actions.packageManager, 'pnpm');
    assert.equal(
      actions.integrations.find(integration => integration.id === 'eslint')?.command,
      'pnpm exec eslint . --format json'
    );
    assert.equal(
      actions.integrations.find(integration => integration.id === 'dependency-audit')?.command,
      'pnpm audit --audit-level=high --json'
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('no habilita la auditoría de otro gestor por un lockfile residual', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sonar-pnpm-stale-lock-'));
  try {
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ packageManager: 'pnpm@10.15.0' })
    );
    await fs.writeFile(path.join(root, 'package-lock.json'), '{}');

    const actions = await detectProjectActions(root);
    assert.equal(actions.packageManager, 'pnpm');
    assert.equal(
      actions.integrations.some(integration => integration.id === 'dependency-audit'),
      false
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('detecta Bun por lockfile y usa sus comandos de scripts y auditoría', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sonar-bun-actions-'));
  try {
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ scripts: { build: 'tsc -p ./' } })
    );
    await fs.writeFile(path.join(root, 'bun.lock'), '');

    const actions = await detectProjectActions(root);
    assert.equal(actions.packageManager, 'bun');
    assert.equal(actions.buildCommand, 'bun run build');
    assert.equal(
      actions.integrations.find(integration => integration.id === 'dependency-audit')?.command,
      'bun audit --audit-level=high'
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
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
      'npm audit --audit-level=high --json'
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('muestra integraciones disponibles y recomendaciones del stack desde el catálogo del host', () => {
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="configurationIntegrationsTab"/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="configurationIntegrationsPanel"/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="availableIntegrationsDisclosure"[^>]*open/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="unavailableIntegrationsDisclosure" class="accordion">/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /config\?\.recommendedIntegrations/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /function detectedProjectTools/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /id: 'sonarqube'/);
  assert.doesNotMatch(PIPELINE_INTEGRATION_SCRIPT, /nodeDevInstallCommand/);
  assert.doesNotMatch(PIPELINE_INTEGRATION_SCRIPT, /npm install -D/);
  assert.doesNotMatch(PIPELINE_INTEGRATION_SCRIPT, /pip install ruff/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /integrationCategoryLabel/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /integrationHealthLabel/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /Versión instalada:/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /Configuración:/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /Origen:/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /Comando de ejecución:/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /Cómo habilitarlo:/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /Por qué se recomienda:/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /detectedProjectStack/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /integrationCategoryFilter/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /Recomendadas para este proyecto/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /Comando sugerido:/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /addIntegrationToPipelineSteps/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /Añadir a pasos disponibles/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /function normalizedPipelineCommand/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /function configuredPipelineCommandKeys/);
  assert.doesNotMatch(PIPELINE_EDITOR_SCRIPT, /function availableDetectedIntegrations/);
});

test('detecta React Doctor, Biome, Stylelint y Prettier cuando están configurados en Node', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sonar-node-tools-'));
  try {
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        scripts: {
          doctor: 'react-doctor .'
        },
        devDependencies: {
          'react-doctor': '^0.0.1',
          '@biomejs/biome': '^2.0.0',
          stylelint: '^16.0.0',
          prettier: '^3.0.0'
        }
      })
    );

    const actions = await detectProjectActions(root);
    const ids = actions.integrations.map(integration => integration.id);
    assert.ok(ids.includes('react-doctor'));
    assert.ok(ids.includes('biome'));
    assert.ok(ids.includes('stylelint'));
    assert.ok(ids.includes('prettier'));
    assert.equal(
      actions.integrations.find(integration => integration.id === 'react-doctor')?.command,
      'npm run doctor'
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('detecta herramientas de Python, Go e infraestructura por sus archivos de configuración', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sonar-multi-tools-'));
  try {
    await fs.writeFile(
      path.join(root, 'pyproject.toml'),
      '[tool.ruff]\nline-length = 100\n\n[tool.bandit]\nskips = []\n'
    );
    await fs.writeFile(path.join(root, '.checkov.yml'), 'quiet: true\n');
    await fs.writeFile(path.join(root, '.golangci.yml'), 'run:\n  timeout: 5m\n');

    const actions = await detectProjectActions(root);
    const ids = actions.integrations.map(integration => integration.id);
    assert.ok(ids.includes('ruff'));
    assert.ok(ids.includes('bandit'));
    assert.ok(ids.includes('checkov'));
    assert.ok(ids.includes('golangci-lint'));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('las acciones y mensajes de plantillas permanecen dentro de su acordeón', () => {
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="pipelineTemplateStatus"/);
  assert.doesNotMatch(CONFIGURATION_PAGE_MARKUP, /id="applyPipelineTemplate"/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="deletePipelineTemplate"/);
  assert.doesNotMatch(CONFIGURATION_EVENTS_SCRIPT, /window\.confirm/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /type: 'deletePipelineTemplate'/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /Restableciendo plantilla…/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /Eliminando plantilla…/);
});

test('la detección refleja instalaciones y desinstalaciones al cambiar package.json', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sonar-live-integrations-'));
  try {
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ devDependencies: {} })
    );

    let actions = await detectProjectActions(root);
    assert.equal(actions.integrations.some(item => item.id === 'react-doctor'), false);

    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ devDependencies: { 'react-doctor': '^1.0.0' } })
    );
    actions = await detectProjectActions(root);
    assert.equal(actions.integrations.some(item => item.id === 'react-doctor'), true);

    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ devDependencies: {} })
    );
    actions = await detectProjectActions(root);
    assert.equal(actions.integrations.some(item => item.id === 'react-doctor'), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('Integraciones prepara pruebas e instalaciones en el terminal sin ejecutarlas automáticamente', () => {
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /Probar integración/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /testPipelineIntegration/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /Copiar comando/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /Abrir en terminal/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /preparePipelineIntegrationInstall/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /integrationSetupAction: 'terminal'/);
});


test('el refresco de integraciones queda aislado por carpeta en workspaces multi-root', () => {
  const controller = readFileSync(path.join(process.cwd(), 'src/modules/pipeline/controller.ts'), 'utf8');
  assert.match(controller, /const key = `\$\{folderUri\}\\u0000\$\{rootPath\}`/);
  assert.match(controller, /this\.stopWatchingProjectActions\(\);[\s\S]*this\.watchedProjectActions = \{ key, folderUri, rootPath \}/);
  assert.match(controller, /getSelectedFolderUri\(\) !== watched\.folderUri/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /message\.folderUri !== currentFolderUri/);
});

test('Probar integración reutiliza un terminal abierto o crea uno nuevo y no ejecuta automáticamente', () => {
  const controller = readFileSync(path.join(process.cwd(), 'src/modules/pipeline/controller.ts'), 'utf8');
  assert.match(controller, /vscode\.window\.activeTerminal[\s\S]*vscode\.window\.terminals\[0\][\s\S]*vscode\.window\.createTerminal/);
  assert.match(controller, /terminal\.sendText\(command, false\)/);
  assert.match(controller, /type: 'pipelineIntegrationTestPrepared'/);
  assert.doesNotMatch(controller, /runner\.run\(provider\.getProbe/);
});

test('calcula histórico por paso y lo usa en la previsualización del pipeline', () => {
  const entries = [
    {
      status: 'success',
      steps: [
        { id: 'lint', name: 'ESLint', kind: 'custom', command: 'npm exec -- eslint .', durationMs: 2000 },
        { id: 'sonar', name: 'SonarQube', kind: 'sonar', durationMs: 10000 }
      ]
    },
    {
      status: 'success',
      steps: [
        { id: 'lint-old', name: 'ESLint', kind: 'custom', command: 'npm   exec -- eslint .', durationMs: 4000 },
        { id: 'sonar-old', name: 'SonarQube', kind: 'sonar', durationMs: 14000 }
      ]
    }
  ] as any;
  const stats = calculatePipelineStepTimingStatistics(entries);
  const eslint = stats.find(item => item.command?.includes('eslint'));
  const sonar = stats.find(item => item.kind === 'sonar');
  assert.equal(eslint?.samples, 2);
  assert.equal(eslint?.averageDurationMs, 3000);
  assert.equal(eslint?.medianDurationMs, 3000);
  assert.equal(eslint?.lastDurationMs, 2000);
  assert.equal(sonar?.averageDurationMs, 12000);
  assert.match(ANALYSIS_SCRIPT, /pipelineStepTimingStatistics/);
  assert.match(ANALYSIS_SCRIPT, /Media histórica:/);
  assert.match(ANALYSIS_SCRIPT, /Duración estimada:/);
  assert.match(ANALYSIS_CONFIRMATION_DIALOG_MARKUP, /analysisConfirmationEstimatedDuration/);
});
