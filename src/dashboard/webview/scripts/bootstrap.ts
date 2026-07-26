import {
  DASHBOARD_COLORS,
  DASHBOARD_WEBVIEW_CONSTANTS
} from '../../../constants';
import { DashboardLanguage } from '../../../i18n';
import { getWebviewMessages } from '../../../i18n/webview';
import { CONFIGURATION_CORE_SCRIPT } from './core/configuration';
import { ELEMENT_REGISTRY_SCRIPT } from './core/elements';
import { EMPTY_STATE_SCRIPT } from './core/emptyState';
import { NAVIGATION_CORE_SCRIPT } from './core/navigation';
import { DASHBOARD_STATE_SCRIPT } from './core/state';

export function getBootstrapScript(
  language: DashboardLanguage,
  locale: string
): string {
  const environmentScript = `
    const vscode = acquireVsCodeApi();
    const dashboardLanguage = ${JSON.stringify(language)};
    const dashboardLocale = ${JSON.stringify(locale)};
    const dashboardMessages = ${JSON.stringify(getWebviewMessages(language))};
    const dashboardColors = ${JSON.stringify(DASHBOARD_COLORS)};
    const dashboardConstants = ${JSON.stringify(DASHBOARD_WEBVIEW_CONSTANTS)};
    const typeIconClasses = dashboardConstants.typeIconClasses;
`;

  return [
    environmentScript,
    ELEMENT_REGISTRY_SCRIPT,
    DASHBOARD_STATE_SCRIPT,
    NAVIGATION_CORE_SCRIPT,
    CONFIGURATION_CORE_SCRIPT,
    EMPTY_STATE_SCRIPT
  ].join('');
}
