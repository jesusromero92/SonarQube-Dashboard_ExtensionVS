import {
  DASHBOARD_COLORS,
  DASHBOARD_WEBVIEW_CONSTANTS
} from '../../../constants';
import { DashboardLanguage } from '../../../i18n';
import {
  getRuntimeLocalizationScript,
  getWebviewLocalizationBundle
} from '../../../i18n/runtimeWebview';
import { CONFIGURATION_CORE_SCRIPT } from './core/configuration';
import { ELEMENT_REGISTRY_SCRIPT } from './core/elements';
import { EMPTY_STATE_SCRIPT } from './core/emptyState';
import { NAVIGATION_CORE_SCRIPT } from './core/navigation';
import { DASHBOARD_STATE_SCRIPT } from './core/state';
import type { DashboardPage } from '../../contracts';

export function getBootstrapScript(
  language: DashboardLanguage,
  initialPage: DashboardPage = 'data'
): string {
  const environmentScript = `
    const vscode = acquireVsCodeApi();
    const initialDashboardPage = ${JSON.stringify(initialPage)};
    const dashboardColors = ${JSON.stringify(DASHBOARD_COLORS)};
    const dashboardConstants = ${JSON.stringify(DASHBOARD_WEBVIEW_CONSTANTS)};
    const typeIconClasses = dashboardConstants.typeIconClasses;
    const dashboardModuleHooks = {
      values: [],
      renderState: [],
      renderConfigurationSaved: [],
      resetConnectionScopedFields: [],
      updateSaveAvailability: [],
      refreshConfigurationDropdowns: [],
      message: [],
      bindEvents: [],
      page: new Map(),
      capability: new Map()
    };
    function registerDashboardModuleHooks(hooks) {
      for (const name of ['values', 'renderState', 'renderConfigurationSaved', 'resetConnectionScopedFields', 'updateSaveAvailability', 'refreshConfigurationDropdowns', 'message', 'bindEvents']) {
        if (typeof hooks?.[name] === 'function') dashboardModuleHooks[name].push(hooks[name]);
      }
      if (hooks?.pages) {
        for (const [page, handler] of Object.entries(hooks.pages)) dashboardModuleHooks.page.set(page, handler);
      }
      if (hooks?.capabilities) {
        for (const [name, handler] of Object.entries(hooks.capabilities)) dashboardModuleHooks.capability.set(name, handler);
      }
    }
    function runDashboardModuleHooks(name, ...args) {
      for (const hook of dashboardModuleHooks[name] || []) hook(...args);
    }
    function collectDashboardModuleValues() {
      const result = {};
      for (const hook of dashboardModuleHooks.values) Object.assign(result, hook() || {});
      return result;
    }
    function dispatchDashboardModuleMessage(message) {
      return dashboardModuleHooks.message.some(hook => hook(message) === true);
    }
    function moduleCapabilityAvailable(name) {
      const handler = dashboardModuleHooks.capability.get(name);
      return typeof handler === 'function' ? Boolean(handler()) : false;
    }
`;

  const localizationScript = getRuntimeLocalizationScript(
    getWebviewLocalizationBundle(language)
  );

  return [
    environmentScript,
    localizationScript,
    ELEMENT_REGISTRY_SCRIPT,
    DASHBOARD_STATE_SCRIPT,
    NAVIGATION_CORE_SCRIPT,
    CONFIGURATION_CORE_SCRIPT,
    EMPTY_STATE_SCRIPT
  ].join('');
}
