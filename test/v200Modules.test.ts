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

test('los módulos desactivados reducen trabajo y bloquean sus superficies de ejecución', () => {
  const panel = read('src/dashboardPanel.ts');
  const extension = read('src/extension.ts');
  const live = read('src/liveRemediation/manager.ts');
  const navigation = read('src/dashboard/webview/scripts/core/navigation.ts');

  assert.match(panel, /moduleState\.pipeline[\s\S]*detectProjectActions/);
  assert.match(panel, /isDashboardModuleEnabled\('pipeline'\)/);
  assert.match(panel, /setDashboardModuleEnabled/);
  assert.match(extension, /updateDashboardModuleContexts/);
  assert.match(live, /MODULE_CONFIGURATION_KEYS\.liveRemediation/);
  assert.match(navigation, /pipelineModuleEnabled !== false/);
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
