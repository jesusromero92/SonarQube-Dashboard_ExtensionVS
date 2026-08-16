import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { composeModuleWebviewContributions } from '../src/modules/webview';
import { PIPELINE_WEBVIEW_CONTRIBUTION } from '../src/modules/pipeline/webview';
import { LIVE_REMEDIATION_WEBVIEW_CONTRIBUTION } from '../src/modules/liveRemediation/webview';
import type { DashboardModuleDefinition } from '../src/modules/contracts';
import { PIPELINE_DESCRIPTOR_LOCALIZATION } from '../src/modules/pipeline/i18n/descriptor';
import { LIVE_REMEDIATION_DESCRIPTOR_LOCALIZATION } from '../src/modules/liveRemediation/i18n/descriptor';
import { getDashboardBody } from '../src/dashboard/webview/body';

const read = (relativePath: string): string =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const exists = (relativePath: string): boolean =>
  existsSync(path.resolve(process.cwd(), relativePath));

const TEST_DEFINITIONS: readonly DashboardModuleDefinition[] = [
  {
    id: 'pipeline',
    displayName: 'Pipeline',
    configurationKey: 'modules.pipeline.enabled',
    contextKey: 'sonarQubeDashboard.module.pipeline.enabled',
    defaultEnabled: true,
    description: 'Pipeline',
    localization: PIPELINE_DESCRIPTOR_LOCALIZATION,
    async create() { throw new Error('not used'); }
  },
  {
    id: 'liveRemediation',
    displayName: 'Live Remediation',
    configurationKey: 'modules.liveRemediation.enabled',
    contextKey: 'sonarQubeDashboard.module.liveRemediation.enabled',
    defaultEnabled: true,
    description: 'Live Remediation',
    localization: LIVE_REMEDIATION_DESCRIPTOR_LOCALIZATION,
    async create() { throw new Error('not used'); }
  }
];

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
  assert.doesNotMatch(facade, /pipeline\/webview|liveRemediation\/webview/);
  assert.match(facade, /composeModuleWebviewContributions/);
  assert.match(facade, /contributions\.map/);
});

test('desactivar Live Remediation descarga runtime pero conserva la sesión persistida', () => {
  const runtime = read('src/modules/runtime.ts');
  const live = read('src/modules/liveRemediation/module.ts');
  const manager = read('src/modules/liveRemediation/manager.ts');

  assert.match(runtime, /module\.dispose\(\)/);
  assert.match(runtime, /unloadModule\(definition\.id\)/);
  assert.match(runtime, /loadedModules\.delete\(moduleId\)/);
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
  assert.match(runtime, /loadedModules = new Map<string, DashboardModule>/);
  assert.match(runtime, /definitions: readonly DashboardModuleDefinition\[\]/);
  assert.match(runtime, /for \(const module of this\.loadedModules\.values\(\)\)/);
  assert.doesNotMatch(runtime, /PipelineModule|LiveRemediationModule|this\.pipeline|this\.liveRemediation|\.controller\./);
  assert.match(runtime, /executeCapability\('analyzeRepository'\)/);
  assert.doesNotMatch(registry, /from '.\/pipeline\/module'|from '.\/liveRemediation\/module'/);
  assert.match(read('src/modules/pipeline/definition.ts'), /await import\('.\/module'\)/);
  assert.match(read('src/modules/liveRemediation/definition.ts'), /await import\('.\/module'\)/);
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

test('los toggles esperan confirmación y no aplican estado optimista en el webview', () => {
  const configurationEvents = read('src/dashboard/webview/scripts/events/configuration.ts');
  const coreConfiguration = read('src/dashboard/webview/scripts/core/configuration.ts');
  const panel = read('src/dashboardPanel.ts');
  const runtime = read('src/modules/runtime.ts');
  const contracts = read('src/modules/contracts.ts');

  assert.match(configurationEvents, /const confirmedEnabled = currentConfig\?\.\[moduleId \+ 'ModuleEnabled'\] === true/);
  assert.match(configurationEvents, /const requestedEnabled = toggle\.checked/);
  assert.match(configurationEvents, /toggle\.checked = confirmedEnabled/);
  assert.match(configurationEvents, /pendingModuleChanges\.add\(moduleId\)/);
  assert.match(configurationEvents, /configurationTab: configurationTabs\.find/);
  assert.doesNotMatch(configurationEvents, /currentConfig\[moduleId \+ 'ModuleEnabled'\] = toggle\.checked/);
  assert.match(coreConfiguration, /restoreConfigurationTab\(message\.configurationTab\)/);
  assert.match(panel, /currentConfigurationTab = 'configurationSonarPanel'/);
  assert.match(contracts, /configurationTab\?: string/);
  assert.match(panel, /this\.rememberConfigurationTab\(message\)/);
  assert.match(panel, /this\.currentConfigurationTab = message\.configurationTab/);
  assert.match(panel, /configurationTab: this\.currentConfigurationTab/);

  assert.match(runtime, /confirmModuleChange\(definition, enabled\)/);
  assert.match(runtime, /showWarningMessage\(message, \{ modal: true \}, action\)/);
  assert.match(runtime, /enabled[\s\S]*'Activar'[\s\S]*'Desactivar'/);
});

test('la reconstrucción nace directamente en Configuración > Módulos sin mostrar Datos', () => {
  const body = getDashboardBody(
    composeModuleWebviewContributions(TEST_DEFINITIONS, [PIPELINE_WEBVIEW_CONTRIBUTION]),
    'configuration',
    'configurationModulesPanel'
  );
  const events = read('src/dashboard/webview/scripts/events/index.ts');

  assert.match(body, /id="dataPage" class="page" hidden/);
  assert.match(body, /id="configurationPage" class="page">/);
  assert.match(body, /id="configurationModulesTab" class="active"[\s\S]*aria-selected="true"/);
  assert.match(body, /id="configurationSonarPanel"[\s\S]*hidden>/);
  assert.match(body, /id="configurationModulesPanel"[\s\S]*aria-labelledby="configurationModulesTab">/);
  assert.match(events, /navigate\(currentPage\)/);
  assert.doesNotMatch(events, /navigate\('data'\)/);
});

test('activar es transaccional y la sincronización repara un runtime ausente', () => {
  const runtime = read('src/modules/runtime.ts');
  const createIndex = runtime.indexOf('loadedForTransition = await this.loadAndActivate(definition)');
  const persistIndex = runtime.indexOf('await setDashboardModuleEnabled(moduleId, true)');

  assert.ok(createIndex >= 0);
  assert.ok(persistIndex > createIndex);
  assert.match(runtime, /runtimeMatchesState/);
  assert.match(runtime, /Boolean\(state\[definition\.id\]\) === this\.loadedModules\.has\(definition\.id\)/);
  assert.match(runtime, /if \(signature === this\.lastSyncedSignature && runtimeMatchesState\) return false/);
  assert.match(runtime, /state\[definition\.id\] = false;[\s\S]*setDashboardModuleEnabled\(definition\.id, false\)/);
});

test('el registro carga cada implementación de forma lazy y deriva estado, configuración y contextos', () => {
  const registry = read('src/modules/registry.ts');
  const manager = read('src/modules/manager.ts');
  const pipelineDefinition = read('src/modules/pipeline/definition.ts');
  const liveDefinition = read('src/modules/liveRemediation/definition.ts');

  assert.doesNotMatch(registry, /pipeline\/module|liveRemediation\/module/);
  assert.match(pipelineDefinition, /async create\(\)[\s\S]*await import\('\.\/module'\)/);
  assert.match(liveDefinition, /async create\(\)[\s\S]*await import\('\.\/module'\)/);
  assert.match(manager, /Record<DashboardModuleId, boolean>/);
  assert.match(manager, /registeredDefinitions\.map/);
  assert.doesNotMatch(manager, /pipeline:|liveRemediation:/);
});

test('el manager conserva el descriptor al resolver un módulo registrado', () => {
  const manager = read('src/modules/manager.ts');

  assert.match(manager, /function getRegisteredDefinition[\s\S]*DashboardModuleDefinition \| undefined/);
  assert.match(manager, /if \(definition\.id === moduleId\) return definition/);
  assert.match(manager, /const definition = getRegisteredDefinition\(moduleId\)/);
  assert.doesNotMatch(manager, /const definition = registeredDefinitions\.some/);
  assert.match(manager, /\.update\(definition\.configurationKey, enabled/);
});

test('el webview sólo compone las contribuciones de módulos cargados', () => {
  const facade = read('src/modules/webview.ts');
  const runtime = read('src/modules/runtime.ts');
  const pipelineWebview = read('src/modules/pipeline/webview/index.ts');
  const liveWebview = read('src/modules/liveRemediation/webview/index.ts');

  assert.doesNotMatch(facade, /\.\/pipeline|\.\/liveRemediation/);
  assert.match(runtime, /filter\(module => state\[module\.id\]\)/);
  assert.match(runtime, /map\(module => module\.webview\)/);
  assert.match(pipelineWebview, /PIPELINE_WEBVIEW_CONTRIBUTION/);
  assert.match(liveWebview, /LIVE_REMEDIATION_WEBVIEW_CONTRIBUTION/);
  assert.match(runtime, /rebuildWebview\(\)/);
});

test('el compositor excluye físicamente HTML, CSS y JavaScript desactivados', () => {
  const disabled = composeModuleWebviewContributions(TEST_DEFINITIONS, []);
  assert.equal(disabled.dataControls, '');
  assert.equal(disabled.configurationTab, '');
  assert.equal(disabled.scripts, '');
  assert.equal(disabled.styles, '');
  assert.equal(disabled.localization?.source.pipelineSteps, undefined);
  assert.equal(disabled.localization?.source.liveRemediationIntro, undefined);
  assert.ok(disabled.localization?.source.pipelineModuleHint);
  assert.ok(disabled.localization?.source.liveRemediationModuleHint);
  assert.match(disabled.moduleSettings ?? '', /data-module-toggle="pipeline"/);
  assert.match(disabled.moduleSettings ?? '', /data-module-toggle="liveRemediation"/);

  const pipelineOnly = composeModuleWebviewContributions(
    TEST_DEFINITIONS,
    [PIPELINE_WEBVIEW_CONTRIBUTION]
  );
  assert.match(pipelineOnly.dataControls ?? '', /id="analysisPanel"/);
  assert.match(pipelineOnly.dataControls ?? '', /id="analyzeRepository"/);
  assert.match(pipelineOnly.configurationTab ?? '', /configurationPipelineTab/);
  assert.match(pipelineOnly.configurationTab ?? '', /configurationIntegrationsTab/);
  assert.match(pipelineOnly.configurationPanel ?? '', /configurationIntegrationsPanel/);
  assert.match(pipelineOnly.scripts ?? '', /registerDashboardModuleHooks/);
  assert.doesNotMatch(pipelineOnly.scripts ?? '', /liveRemediation/);
  assert.ok(pipelineOnly.localization?.source.pipelineSteps);
  assert.equal(pipelineOnly.localization?.source.liveRemediationIntro, undefined);

  const liveOnly = composeModuleWebviewContributions(
    TEST_DEFINITIONS,
    [LIVE_REMEDIATION_WEBVIEW_CONTRIBUTION]
  );
  assert.match(liveOnly.configurationTab ?? '', /configurationLiveRemediationTab/);
  assert.doesNotMatch(liveOnly.scripts ?? '', /pipelineTemplate|analysisStepper/);
  assert.ok(liveOnly.localization?.source.liveRemediationIntro);
  assert.equal(liveOnly.localization?.source.pipelineSteps, undefined);
});

test('las traducciones específicas pertenecen a sus módulos y las capacidades usan tokens abiertos', () => {
  const coreSource = read('src/i18n/source.ts');
  const pipelineSource = read('src/modules/pipeline/i18n/source.ts');
  const liveSource = read('src/modules/liveRemediation/i18n/source.ts');
  const contracts = read('src/modules/contracts.ts');

  assert.doesNotMatch(
    coreSource,
    /pipelineSteps|pipelineProgress|pipelineRunHistory|analysisPipeline|liveRemediationIntro|liveRemediationHint|locallyModifiedIssues/
  );
  assert.match(pipelineSource, /pipelineSteps|pipelineProgress|detectedToolsHint/);
  assert.match(liveSource, /liveRemediationIntro|sonarIdeDetectedActive/);
  assert.match(contracts, /DashboardModuleCapability = string/);
});

test('la activación resuelve los módulos antes de registrar comandos o restaurar paneles', () => {
  const extension = read('src/extension.ts');
  const attach = extension.indexOf('modules.attachDashboard(dashboardPanel)');
  const initialSync = extension.indexOf('await modules.syncEnabledModules()', attach);
  const serializer = extension.indexOf('registerWebviewPanelSerializer', attach);
  const openCommand = extension.indexOf('DASHBOARD_COMMANDS.open', attach);

  assert.ok(attach >= 0 && initialSync > attach);
  assert.ok(serializer > initialSync);
  assert.ok(openCommand > initialSync);
});

test('una sincronización repetida no recarga dos veces el webview', () => {
  const runtime = read('src/modules/runtime.ts');
  const extension = read('src/extension.ts');

  assert.match(runtime, /lastSyncedSignature/);
  assert.match(runtime, /signature === this\.lastSyncedSignature && runtimeMatchesState/);
  assert.match(runtime, /if \(repaired\) this\.bridge\?\.rebuildWebview\(\)/);
  assert.match(extension, /if \(changed\) dashboardPanel\?\.rebuildWebview\(\)/);
});

test('los comandos de Live Remediation quedan deshabilitados con su contexto', () => {
  const manifest = JSON.parse(read('package.json')) as {
    contributes?: { commands?: Array<{ command?: string; enablement?: string }> };
  };
  const commands = manifest.contributes?.commands ?? [];
  const liveCommands = commands.filter(command =>
    command.enablement === 'sonarQubeDashboard.module.liveRemediation.enabled'
  );

  assert.ok(liveCommands.length >= 6);
  for (const command of liveCommands) {
    assert.equal(
      command.enablement,
      'sonarQubeDashboard.module.liveRemediation.enabled'
    );
  }
});
