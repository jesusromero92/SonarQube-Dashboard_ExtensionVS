import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (relativePath: string): string =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const exists = (relativePath: string): boolean =>
  existsSync(path.resolve(process.cwd(), relativePath));

test('v2.0.0 mantiene Pipeline y Live Remediation como módulos opcionales', () => {
  const manifest = JSON.parse(read('package.json')) as {
    version?: string;
    contributes?: {
      configuration?: { properties?: Record<string, { default?: unknown }> };
      views?: Record<string, Array<{ id?: string; when?: string }>>;
    };
  };
  const properties = manifest.contributes?.configuration?.properties ?? {};
  assert.equal(manifest.version, '2.0.0');
  assert.equal(properties['sonarQubeDashboard.modules.pipeline.enabled']?.default, true);
  assert.equal(properties['sonarQubeDashboard.modules.liveRemediation.enabled']?.default, true);
  assert.equal(properties['sonarQubeDashboard.liveRemediation.enabled'], undefined);

  const views = manifest.contributes?.views?.sonarQubeDashboardContainer ?? [];
  assert.match(views.find(v => v.id === 'sonarQubeDashboard.pipelineExecutions')?.when ?? '', /module\.pipeline\.enabled/);
  assert.match(views.find(v => v.id === 'sonarQubeDashboard.locallyModifiedIssues')?.when ?? '', /module\.liveRemediation\.enabled/);
});

test('las implementaciones viven dentro de src/modules y no quedan carpetas legacy', () => {
  for (const required of [
    'src/modules/pipeline/module.ts',
    'src/modules/pipeline/controller.ts',
    'src/modules/pipeline/scanner/detector.ts',
    'src/modules/pipeline/webview/integration.ts',
    'src/modules/liveRemediation/module.ts',
    'src/modules/liveRemediation/manager.ts',
    'src/modules/liveRemediation/webview/integration.ts',
    'src/modules/runtime.ts',
    'src/modules/registry.ts',
    'src/modules/webview.ts',
    'src/shared/webview/ui/accordion.ts',
    'src/shared/webview/ui/selectDropdown.ts'
  ]) assert.equal(exists(required), true, required);

  for (const legacy of ['src/pipeline', 'src/liveRemediation', 'src/scanner']) {
    assert.equal(exists(legacy), false, legacy);
  }
});

test('DashboardPanel y extension no importan implementaciones concretas de módulos', () => {
  const panel = read('src/dashboardPanel.ts');
  const extension = read('src/extension.ts');
  const contracts = read('src/dashboard/contracts.ts');
  const diagnostics = read('src/dashboard/diagnostics.ts');

  assert.doesNotMatch(panel, /modules\/pipeline|modules\/liveRemediation|AnalysisService|PipelineTemplateStore|LiveRemediationManager/);
  assert.match(panel, /DashboardModulesRuntime/);
  assert.doesNotMatch(extension, /modules\/pipeline|modules\/liveRemediation|PipelineExecutionTreeProvider|LiveRemediationManager/);
  assert.match(extension, /DashboardModuleRuntime/);
  assert.doesNotMatch(contracts, /pipeline\/|liveRemediation\//);
  assert.doesNotMatch(diagnostics, /pipeline\/|liveRemediation\/|scanner\/detector/);
});

test('Pipeline y Live Remediation no se importan entre sí', () => {
  const pipelineFiles = [
    'src/modules/pipeline/module.ts',
    'src/modules/pipeline/controller.ts',
    'src/modules/pipeline/configuration.ts'
  ].map(read).join('\n');
  const liveFiles = [
    'src/modules/liveRemediation/module.ts',
    'src/modules/liveRemediation/manager.ts',
    'src/modules/liveRemediation/treeView.ts'
  ].map(read).join('\n');
  assert.doesNotMatch(pipelineFiles, /liveRemediation/);
  assert.doesNotMatch(liveFiles, /modules\/pipeline|\.\.\/pipeline|DASHBOARD_COMMANDS/);
  assert.match(liveFiles, /moduleCapability\.analyzeRepository|analyzeCommand/);
  assert.match(liveFiles, /REFRESH_LIVE_REMEDIATION_COMMAND|refreshFromModule/);
});

test('cada módulo posee su runtime, comandos, vista y configuración', () => {
  const pipeline = read('src/modules/pipeline/module.ts');
  const live = read('src/modules/liveRemediation/module.ts');
  const pipelineConfig = read('src/modules/pipeline/configuration.ts');
  const coreConfig = read('src/configuration.ts');
  const coreTypes = read('src/types.ts');

  assert.match(pipeline, /registerTreeDataProvider/);
  assert.match(pipeline, /PIPELINE_COMMANDS\.analyze/);
  assert.match(pipeline, /PIPELINE_COMMANDS\.cancelAnalysis/);
  assert.match(live, /registerTreeDataProvider/);
  assert.match(live, /OPEN_LOCALLY_MODIFIED_ISSUE_COMMAND/);
  assert.match(pipelineConfig, /scannerMode/);
  assert.match(pipelineConfig, /analysisInclusions/);
  assert.doesNotMatch(coreConfig, /scannerMode|analysisInclusions|buildCommand|testCommand/);
  assert.doesNotMatch(coreTypes, /scannerMode|analysisInclusions|buildCommand|testCommand|ScannerMode/);
});

test('el webview core consume una fachada genérica y no conoce Pipeline/Live Remediation', () => {
  const dashboardWebview = [
    'src/dashboard/webview/body.ts',
    'src/dashboard/webview/pages/configurationPage.ts',
    'src/dashboard/webview/pages/dataPage.ts',
    'src/dashboard/webview/scripts/core/configuration.ts',
    'src/dashboard/webview/scripts/core/navigation.ts',
    'src/dashboard/webview/scripts/events/configuration.ts',
    'src/dashboard/webview/scripts/events/messages.ts'
  ].map(read).join('\n');
  const facade = read('src/modules/webview.ts');

  assert.doesNotMatch(dashboardWebview, /pipeline|liveRemediation|scannerMode|analysisInclusions|sonarIde/i);
  assert.match(dashboardWebview, /modules\/webview|dashboardModuleHooks|data-module/);
  assert.match(facade, /pipeline\/webview/);
  assert.match(facade, /liveRemediation\/webview/);
});

test('desactivar Live Remediation descarga runtime pero conserva la sesión persistida', () => {
  const runtime = read('src/modules/runtime.ts');
  const live = read('src/modules/liveRemediation/module.ts');
  const manager = read('src/modules/liveRemediation/manager.ts');

  assert.match(runtime, /else module\.deactivate\(\)/);
  const deactivateBody = live.match(/deactivate\(\): void \{[\s\S]*?\n  \}/)?.[0] ?? '';
  assert.doesNotMatch(deactivateBody, /\.clear\(/);
  assert.match(manager, /persistSessionState/);
  assert.match(live, /clearWorkspaceState/);
  assert.match(live, /clearPersistedRemediationState/);
});


test('el runtime de módulos usa un registro genérico y no conoce APIs internas de Pipeline/Live', () => {
  const runtime = read('src/modules/runtime.ts');
  const contracts = read('src/modules/contracts.ts');
  const registry = read('src/modules/registry.ts');

  assert.match(contracts, /interface DashboardModule extends vscode\.Disposable/);
  assert.match(contracts, /readonly id: DashboardModuleId/);
  assert.match(contracts, /DashboardModuleCapability/);
  assert.match(runtime, /moduleList: readonly DashboardModule\[\]/);
  assert.match(runtime, /constructor\(\s*modules: readonly DashboardModule\[\]/);
  assert.match(runtime, /for \(const module of this\.moduleList\)/);
  assert.doesNotMatch(runtime, /PipelineModule|LiveRemediationModule|this\.pipeline|this\.liveRemediation|\.controller\./);
  assert.match(runtime, /executeCapability\('analyzeRepository'\)/);
  assert.match(registry, /new PipelineModule\(context\)/);
  assert.match(registry, /new LiveRemediationModule/);
});

test('Pipeline tiene namespace de configuración propio fuera de sonar.*', () => {
  const manifest = JSON.parse(read('package.json')) as {
    contributes?: { configuration?: { properties?: Record<string, unknown> } };
  };
  const properties = manifest.contributes?.configuration?.properties ?? {};
  const pipelineConfiguration = read('src/modules/pipeline/configuration.ts');

  assert.ok(properties['sonarQubeDashboard.pipeline.scannerMode']);
  assert.ok(properties['sonarQubeDashboard.pipeline.analysisInclusions']);
  assert.ok(properties['sonarQubeDashboard.pipeline.analysisExclusions']);
  assert.equal(properties['sonarQubeDashboard.sonar.scannerMode'], undefined);
  assert.equal(properties['sonarQubeDashboard.sonar.analysisInclusions'], undefined);
  assert.match(pipelineConfiguration, /PIPELINE_CONFIGURATION_SECTION = 'sonarQubeDashboard\.pipeline'/);
  assert.doesNotMatch(pipelineConfiguration, /SONAR_CONFIGURATION_SECTION|migrateLegacy|sonarQubeDashboard\.sonar\.testCommand/);
});

test('Problems pertenece al core y Live Remediation solo aporta overlay', () => {
  const extension = read('src/extension.ts');
  const diagnostics = read('src/issueDiagnostics.ts');
  const decorations = read('src/issueDecorations.ts');
  const runtime = read('src/modules/runtime.ts');

  assert.match(diagnostics, /class IssueDiagnosticManager/);
  assert.match(extension, /issueDiagnostics\.replaceServerSnapshot/);
  assert.match(runtime, /getIssueOverlay/);
  assert.doesNotMatch(decorations, /modules\/liveRemediation/);
});


test('las pestañas de configuración reflejan módulos ya activados al restaurar estado', () => {
  const configurationEvents = read('src/dashboard/webview/scripts/events/configuration.ts');
  const coreConfiguration = read('src/dashboard/webview/scripts/core/configuration.ts');

  assert.match(configurationEvents, /function syncModuleConfigurationState\(config = currentConfig\)/);
  assert.match(configurationEvents, /config\?\.\[moduleId \+ 'ModuleEnabled'\]/);
  assert.match(configurationEvents, /toggle\.checked = enabled/);
  assert.match(configurationEvents, /updateModuleConfigurationVisibility\(\)/);
  assert.match(coreConfiguration, /syncModuleConfigurationState\(currentConfig\)/);
  assert.match(coreConfiguration, /syncModuleConfigurationState\(config\)/);
});
