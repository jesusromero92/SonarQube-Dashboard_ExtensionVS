import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import {
  createBuiltinPipelineTemplates,
  mergePipelineTemplates,
  parsePipelineTemplateYaml,
  serializePipelineTemplateYaml
} from '../src/scanner/pipelineTemplates';
import { DIAGNOSTICS_PAGE_MARKUP } from '../src/dashboard/webview/pages/diagnosticsPage';
import { HISTORY_PAGE_MARKUP } from '../src/dashboard/webview/pages/historyPage';
import { CONFIGURATION_PAGE_MARKUP } from '../src/dashboard/webview/pages/configurationPage';
import { DIAGNOSTICS_SCRIPT } from '../src/dashboard/webview/scripts/diagnostics';
import { HISTORY_SCRIPT } from '../src/dashboard/webview/scripts/history';
import { PIPELINE_EDITOR_SCRIPT } from '../src/dashboard/webview/scripts/pipelineEditor';
import { CONFIGURATION_EVENTS_SCRIPT } from '../src/dashboard/webview/scripts/events/configuration';
import { NAVIGATION_CORE_SCRIPT } from '../src/dashboard/webview/scripts/core/navigation';
import { SOURCE_MESSAGES } from '../src/i18n/source';
import { EN_MESSAGES } from '../src/i18n/en';
import { ES_MESSAGES } from '../src/i18n/es';

test('la versión 0.21.0 ofrece las cuatro plantillas integradas', () => {
  const templates = createBuiltinPipelineTemplates(
    {
      buildCommand: 'npm run compile',
      testCommand: 'npm test',
      integrations: [
        {
          id: 'dependency-audit',
          name: 'npm audit',
          description: 'Audit',
          command: 'npm audit --audit-level=high',
          evidence: 'package-lock.json',
          category: 'security',
          failurePolicy: 'continue'
        },
        {
          id: 'semgrep',
          name: 'Semgrep',
          description: 'SAST',
          command: 'semgrep scan --config auto',
          evidence: '.semgrep.yml',
          category: 'security',
          failurePolicy: 'stop'
        }
      ]
    },
    'npm run compile',
    'npm test'
  );

  assert.deepEqual(
    templates.map(template => template.id),
    ['builtin-quick', 'builtin-complete', 'builtin-security', 'builtin-release']
  );
  assert.deepEqual(
    templates.map(template => template.name),
    ['Rápido', 'Completo', 'Seguridad', 'Release']
  );
  assert.ok(templates.every(template => template.steps.some(step => step.kind === 'sonar')));
  assert.ok(
    templates.find(template => template.id === 'builtin-release')?.steps
      .every(step => step.failurePolicy === 'stop')
  );
});

test('una plantilla integrada modificada reemplaza a la predeterminada sin duplicarse', () => {
  const builtins = createBuiltinPipelineTemplates(
    { buildCommand: 'npm run compile', testCommand: 'npm test', integrations: [] },
    'npm run compile',
    'npm test'
  );
  const override = {
    ...builtins[0],
    name: 'Rápido personalizado',
    builtin: true,
    steps: [
      {
        id: 'tests',
        name: 'Ejecutar tests',
        kind: 'test' as const,
        command: 'npm test',
        failurePolicy: 'stop' as const,
        enabled: true
      },
      builtins[0].steps.find(step => step.kind === 'sonar')!
    ]
  };

  const merged = mergePipelineTemplates(builtins, [override]);
  assert.equal(merged.filter(template => template.id === 'builtin-quick').length, 1);
  assert.equal(merged[0]?.name, 'Rápido personalizado');
  assert.equal(merged[0]?.builtin, true);
  assert.equal(merged[0]?.customized, true);
  assert.deepEqual(merged[0]?.steps.map(step => step.kind), ['test', 'sonar']);
});

test('las plantillas YAML conservan el orden, incluido un paso posterior a SonarQube', () => {
  const source = {
    id: 'custom-release',
    name: 'Release local',
    description: 'Pipeline versionado',
    builtin: false,
    steps: [
      {
        id: 'build',
        name: 'Build',
        kind: 'build' as const,
        command: 'npm run compile',
        failurePolicy: 'stop' as const,
        enabled: true
      },
      {
        id: 'sonar',
        name: 'SonarQube',
        kind: 'sonar' as const,
        failurePolicy: 'stop' as const,
        enabled: true
      },
      {
        id: 'report',
        name: 'Report',
        kind: 'custom' as const,
        command: 'npm run report',
        failurePolicy: 'continue' as const,
        enabled: true
      }
    ]
  };

  const yaml = serializePipelineTemplateYaml(source);
  const parsed = parsePipelineTemplateYaml(yaml);
  assert.match(yaml, /^version: 1/m);
  assert.deepEqual(parsed.steps.map(step => step.id), ['build', 'sonar', 'report']);
  assert.equal(parsed.steps[1]?.kind, 'sonar');
  assert.equal(parsed.steps[2]?.failurePolicy, 'continue');
});

test('el diagnóstico muestra solo comandos detectados automáticamente con tarjetas enriquecidas', () => {
  const diagnosticsSource = readFileSync(
    path.resolve(process.cwd(), 'src/dashboard/diagnostics.ts'),
    'utf8'
  );

  assert.match(DIAGNOSTICS_PAGE_MARKUP, /Comandos detectados automáticamente/);
  assert.match(DIAGNOSTICS_SCRIPT, /diagnostics-card-icon/);
  assert.match(DIAGNOSTICS_SCRIPT, /diagnostics-card-badge/);
  assert.match(diagnosticsSource, /actions\.buildCommand/);
  assert.match(diagnosticsSource, /actions\.testCommand/);
  assert.doesNotMatch(diagnosticsSource, /source: 'Pipeline'/);
  assert.doesNotMatch(diagnosticsSource, /parseAnalysisPipeline/);
  assert.doesNotMatch(diagnosticsSource, /Scanner personalizado/);
});

test('el dashboard incorpora historial, diagnóstico y plantillas reutilizables', () => {
  assert.match(HISTORY_PAGE_MARKUP, /historyList/);
  assert.match(HISTORY_PAGE_MARKUP, /historyEntryStatus/);
  assert.match(HISTORY_PAGE_MARKUP, /class="accordion"/);
  assert.match(HISTORY_PAGE_MARKUP, /historySteps/);
  assert.match(HISTORY_PAGE_MARKUP, /historyLog/);
  assert.match(HISTORY_SCRIPT, /renderPipelineHistory/);
  assert.match(HISTORY_SCRIPT, /durationMs/);
  assert.match(DIAGNOSTICS_PAGE_MARKUP, /copyDiagnostics/);
  assert.match(DIAGNOSTICS_PAGE_MARKUP, /diagnosticsLastFailure/);
  assert.match(DIAGNOSTICS_SCRIPT, /responseTimeMs/);
  assert.match(DIAGNOSTICS_SCRIPT, /lastFailedRequest/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /applyTemplateToConfiguration/);
  assert.match(PIPELINE_EDITOR_SCRIPT, /applyTemplateToAnalysis/);
  assert.match(NAVIGATION_CORE_SCRIPT, /loadPipelineHistory/);
  assert.match(NAVIGATION_CORE_SCRIPT, /hasRenderedExecution/);
  assert.match(NAVIGATION_CORE_SCRIPT, /historyLoading\.hidden = hasRenderedExecution/);
  assert.match(NAVIGATION_CORE_SCRIPT, /loadDiagnostics/);
});

test('los textos nuevos están disponibles en español e inglés', () => {
  for (const key of [
    'diagnostics',
    'pipelineRunHistory',
    'pipelineTemplates',
    'quickTemplate',
    'completeTemplate',
    'securityTemplateDescription',
    'copyReport',
    'lastFailedRequest',
    'pipelineStatusRunning',
    'pipelineExecutions',
    'executionInProgress',
    'confirmResetTemplate',
    'pipelineExecutionDetail',
    'executionSteps',
    'console'
  ] as const) {
    assert.ok(SOURCE_MESSAGES[key]);
    assert.ok(EN_MESSAGES[key]);
    assert.ok(ES_MESSAGES[key]);
  }
});


test('los estados y acciones del pipeline quedan alineados con sus controles', () => {
  const variables = CONFIGURATION_PAGE_MARKUP.indexOf('pipeline-variables-hint');
  const saveSteps = CONFIGURATION_PAGE_MARKUP.indexOf('id="savePipeline"');
  const templateActions = CONFIGURATION_PAGE_MARKUP.indexOf('pipeline-template-actions');
  const templateStatus = CONFIGURATION_PAGE_MARKUP.indexOf('id="pipelineTemplateStatus"');
  const exportAction = CONFIGURATION_PAGE_MARKUP.indexOf('id="exportPipelineTemplate"');

  assert.ok(variables >= 0 && saveSteps > variables);
  assert.ok(templateActions >= 0 && templateStatus > templateActions);
  assert.ok(exportAction > templateStatus);
  assert.doesNotMatch(CONFIGURATION_EVENTS_SCRIPT, /window\.confirm/);
});

test('la lista de ejecuciones usa una vista nativa de VS Code', () => {
  const launcherSource = readFileSync(
    path.resolve(process.cwd(), 'src/dashboard/launcherWebview.ts'),
    'utf8'
  );
  const treeSource = readFileSync(
    path.resolve(process.cwd(), 'src/pipelineExecutionTreeView.ts'),
    'utf8'
  );
  const packageManifest = JSON.parse(readFileSync(
    path.resolve(process.cwd(), 'package.json'),
    'utf8'
  )) as {
    contributes?: { views?: Record<string, Array<{ id?: string }>> };
  };

  assert.doesNotMatch(launcherSource, /pipelineExecutionsAccordion/);
  assert.doesNotMatch(launcherSource, /execution-item--running/);
  assert.match(treeSource, /implements\s+vscode\.TreeDataProvider/);
  assert.match(treeSource, /loading~spin/);
  assert.match(treeSource, /RUNNING_EXECUTION_ID/);
  assert.match(treeSource, /openPipelineExecution/);
  assert.ok(
    packageManifest.contributes?.views?.sonarQubeDashboardContainer?.some(
      view => view.id === 'sonarQubeDashboard.pipelineExecutions'
    )
  );
});

test('la página de pipeline muestra solo la ejecución seleccionada y actualiza su consola sin reconstruirla por cada línea', () => {
  assert.match(HISTORY_SCRIPT, /running: 'En curso'/);
  assert.match(HISTORY_SCRIPT, /running-analysis/);
  assert.match(HISTORY_SCRIPT, /state\.log/);
  assert.match(HISTORY_SCRIPT, /selectedEntryId/);
  assert.match(HISTORY_SCRIPT, /updateLivePipelineHistoryItem/);
  assert.match(HISTORY_SCRIPT, /history\.find\(item => item\.id === currentHistoryEntryId\)/);
  assert.doesNotMatch(HISTORY_SCRIPT, /for \(const entry of history\)/);
  assert.match(HISTORY_SCRIPT, /pipeline-execution-step/);
  assert.match(HISTORY_SCRIPT, /renderPipelineHistoryLog\(elements\.historyLog, entry\.log\)/);
  assert.match(readFileSync(path.resolve(process.cwd(), 'src/dashboard/webview/scripts/terminal.ts'), 'utf8'), /distanceFromBottom <= 24/);
});

test('la vista nativa conserva la identidad y no se refresca por cada línea del log', () => {
  const treeSource = readFileSync(
    path.resolve(process.cwd(), 'src/pipelineExecutionTreeView.ts'),
    'utf8'
  );

  assert.match(treeSource, /analysisStateTreeSignature/);
  assert.match(treeSource, /pipeline-execution:\$\{entry\.id\}/);
  assert.match(treeSource, /pipeline-step:\$\{element\.executionId\}:\$\{step\.id\}/);
  const signatureSource = treeSource.slice(
    treeSource.indexOf('function analysisStateTreeSignature'),
    treeSource.indexOf('function executionIcon')
  );
  assert.doesNotMatch(signatureSource, /state\.log/);
  assert.match(treeSource, /new Map<string, PipelineRunHistoryEntry>/);
  assert.match(treeSource, /entry\.id === RUNNING_EXECUTION_ID/);
  assert.doesNotMatch(treeSource, /nodes\.push\(\{[\s\S]*runningHistoryEntry/);
});

test('la ejecución activa abre la misma página de detalle que las ejecuciones terminadas', () => {
  const extensionSource = readFileSync(
    path.resolve(process.cwd(), 'src/extension.ts'),
    'utf8'
  );
  const dashboardSource = readFileSync(
    path.resolve(process.cwd(), 'src/dashboardPanel.ts'),
    'utf8'
  );
  const treeSource = readFileSync(
    path.resolve(process.cwd(), 'src/pipelineExecutionTreeView.ts'),
    'utf8'
  );

  assert.match(
    extensionSource,
    /openPipelineExecution,[\s\S]*await dashboardPanel\.showPipelineExecution\(executionId\)/
  );
  assert.doesNotMatch(extensionSource, /showRunningPipelineExecution/);
  assert.doesNotMatch(dashboardSource, /pendingAnalysisDialog|showRunningPipelineExecution/);
  assert.match(treeSource, /title: spanish \? 'Abrir ejecución' : 'Open execution'/);
  assert.doesNotMatch(treeSource, /Ver registro en directo|View live log/);
});
