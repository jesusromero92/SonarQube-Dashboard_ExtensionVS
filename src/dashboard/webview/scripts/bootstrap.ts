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

export function getBootstrapScript(
  language: DashboardLanguage
): string {
  const environmentScript = `
    const vscode = acquireVsCodeApi();
    const dashboardColors = ${JSON.stringify(DASHBOARD_COLORS)};
    const dashboardConstants = ${JSON.stringify(DASHBOARD_WEBVIEW_CONSTANTS)};
    const typeIconClasses = dashboardConstants.typeIconClasses;
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
