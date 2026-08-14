import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (relativePath: string): string =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

test('v2.0.0 añade módulos independientes para Pipeline y Live Remediation', () => {
  const manifest = JSON.parse(read('package.json')) as {
    version?: string;
    contributes?: {
      configuration?: { properties?: Record<string, { default?: unknown }> };
      views?: Record<string, Array<{ id?: string; when?: string }>>;
    };
  };

  assert.equal(manifest.version, '2.0.0');
  assert.equal(
    manifest.contributes?.configuration?.properties?.[
      'sonarQubeDashboard.modules.pipeline.enabled'
    ]?.default,
    true
  );
  assert.equal(
    manifest.contributes?.configuration?.properties?.[
      'sonarQubeDashboard.modules.liveRemediation.enabled'
    ]?.default,
    true
  );

  const views =
    manifest.contributes?.views?.sonarQubeDashboardContainer ?? [];
  const pipelineView = views.find(
    view => view.id === 'sonarQubeDashboard.pipelineExecutions'
  );
  const liveView = views.find(
    view => view.id === 'sonarQubeDashboard.locallyModifiedIssues'
  );

  assert.match(pipelineView?.when ?? '', /module\.pipeline\.enabled/);
  assert.match(liveView?.when ?? '', /module\.liveRemediation\.enabled/);
});

test('la configuración muestra Módulos siempre y pestañas de módulo solo cuando están activos', () => {
  const page = read('src/dashboard/webview/pages/configurationPage.ts');
  const events = read('src/dashboard/webview/scripts/events/configuration.ts');
  const core = read('src/dashboard/webview/scripts/core/configuration.ts');

  assert.match(page, /id="configurationModulesTab"/);
  assert.match(page, /id="pipelineModuleEnabled"/);
  assert.match(page, /id="liveRemediationModuleEnabled"/);
  assert.match(page, /id="configurationPipelineTab"[^>]*hidden/);
  assert.match(page, /id="configurationLiveRemediationTab"[^>]*hidden/);
  assert.match(page, /id="configurationLiveRemediationPanel"/);
  assert.match(events, /updateModuleConfigurationVisibility/);
  assert.match(events, /moduleId: 'pipeline'/);
  assert.match(events, /moduleId: 'liveRemediation'/);
  assert.match(core, /currentConfig\.pipelineModuleEnabled/);
  assert.match(core, /currentConfig\.liveRemediationModuleEnabled/);
});

test('los módulos desactivados reducen trabajo, liberan runtime y bloquean sus superficies de ejecución', () => {
  const panel = read('src/dashboardPanel.ts');
  const extension = read('src/extension.ts');
  const live = read('src/liveRemediation/manager.ts');
  const navigation = read('src/dashboard/webview/scripts/core/navigation.ts');

  assert.match(panel, /moduleState\.pipeline[\s\S]*detectProjectActions/);
  assert.match(panel, /isDashboardModuleEnabled\('pipeline'\)/);
  assert.match(panel, /pipelineRuntime/);
  assert.match(panel, /deactivatePipelineRuntime/);
  assert.match(panel, /isPipelineMessage/);
  assert.match(panel, /isActivePipelineService/);
  for (const type of [
    'savePipeline',
    'savePipelineTemplate',
    'deletePipelineTemplate',
    'exportPipelineTemplate',
    'importPipelineTemplate',
    'loadPipelineHistory',
    'clearPipelineHistory',
    'analyze',
    'cancelAnalysis'
  ]) {
    assert.match(panel, new RegExp(`'${type}'`), type);
  }

  assert.match(extension, /updateDashboardModuleContexts/);
  assert.match(extension, /syncOptionalModules/);
  assert.match(extension, /activateLiveRemediationModule/);
  assert.match(extension, /deactivateLiveRemediationModule/);
  assert.match(extension, /activatePipelineModule/);
  assert.match(extension, /deactivatePipelineModule/);
  assert.doesNotMatch(live, /MODULE_CONFIGURATION_KEYS\.liveRemediation/);
  assert.match(navigation, /pipelineModuleEnabled !== false/);
});


test('desactivar un módulo requiere confirmación modal y avisa si Pipeline está ejecutándose', () => {
  const panel = read('src/dashboardPanel.ts');
  const sourceMessages = read('src/i18n/source.ts');
  const englishMessages = read('src/i18n/en.ts');

  assert.match(panel, /confirmModuleDisable/);
  assert.match(panel, /currentlyEnabled[\s\S]*!requestedEnabled[\s\S]*confirmModuleDisable/);
  assert.match(panel, /showWarningMessage\([\s\S]*modal: true/);
  assert.match(panel, /analysisService\.isRunning\(\)/);
  assert.match(panel, /el análisis se cancelará/);
  assert.match(panel, /selected === confirmLabel/);
  assert.match(sourceMessages, /disableRunningPipelineModuleConfirm/);
  assert.match(englishMessages, /analysis will be cancelled/);
});

test('la arquitectura modular común queda centralizada fuera de Pipeline y Live Remediation', () => {
  const index = read('src/modules/index.ts');
  const manager = read('src/modules/manager.ts');
  const constants = read('src/modules/constants.ts');

  assert.match(index, /getDashboardModuleState/);
  assert.match(manager, /setContext/);
  assert.match(manager, /ConfigurationTarget\.Global/);
  assert.match(constants, /modules\.pipeline\.enabled/);
  assert.match(constants, /modules\.liveRemediation\.enabled/);
});


test('el core conserva Problems aunque Live Remediation esté completamente desactivado', () => {
  const extension = read('src/extension.ts');
  const diagnostics = read('src/issueDiagnostics.ts');
  const decorations = read('src/issueDecorations.ts');
  const live = read('src/liveRemediation/manager.ts');

  assert.match(diagnostics, /class IssueDiagnosticManager/);
  assert.match(diagnostics, /replaceServerSnapshot/);
  assert.match(diagnostics, /restoreServerSnapshot/);
  assert.match(extension, /issueDiagnostics\.replaceServerSnapshot\(operation\.pendingDiagnostics\)/);
  assert.match(extension, /liveRemediation\?\.applyServerSnapshot/);
  assert.doesNotMatch(decorations, /from '\.\/liveRemediation'/);
  assert.match(live, /IssueDiagnosticPresentation/);
  assert.doesNotMatch(live, /createDiagnosticCollection/);
});

test('Live Remediation no depende de Pipeline para confirmar el estado del servidor', () => {
  const extension = read('src/extension.ts');
  const live = read('src/liveRemediation/manager.ts');

  assert.match(live, /statusBar\.command = DASHBOARD_COMMANDS\.refresh/);
  assert.doesNotMatch(live, /statusBar\.command = DASHBOARD_COMMANDS\.analyze/);
  assert.match(
    extension,
    /liveRemediation\?\.applyServerSnapshot\([\s\S]*issueDiagnostics\.getServerSnapshot\(\),[\s\S]*true/
  );
});

test('los comandos propios de Pipeline quedan deshabilitados desde el manifest cuando el módulo está OFF', () => {
  const manifest = JSON.parse(read('package.json')) as {
    contributes?: { commands?: Array<{ command?: string; enablement?: string }> };
  };
  const commands = manifest.contributes?.commands ?? [];
  for (const commandId of [
    'sonarQubeDashboard.analyze',
    'sonarQubeDashboard.cancelAnalysis'
  ]) {
    const command = commands.find(item => item.command === commandId);
    assert.equal(
      command?.enablement,
      'sonarQubeDashboard.module.pipeline.enabled',
      commandId
    );
  }
});
