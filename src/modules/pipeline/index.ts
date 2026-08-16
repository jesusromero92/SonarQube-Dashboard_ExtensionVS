import type { ModuleWebviewContribution } from '../contracts';
import { ANALYSIS_SCRIPT } from './webview/analysis';
import { BASELINE_SCRIPT } from './webview/baseline';
import { PIPELINE_CONFIGURATION_PANEL_MARKUP, PIPELINE_CONFIGURATION_TAB_MARKUP } from './webview/configuration';
import { PIPELINE_EDITOR_SCRIPT } from './webview/editor';
import { HISTORY_SCRIPT } from './webview/history';
import { PIPELINE_HISTORY_STYLES } from './webview/historyStyles';
import { PIPELINE_INTEGRATION_SCRIPT } from './webview/integration';
import { PIPELINE_VARIABLES_SCRIPT } from './webview/variables';
import { ANALYSIS_CONFIRMATION_DIALOG_MARKUP } from './webview/modals/analysisConfirmationDialog';
import { ANALYSIS_DIALOG_MARKUP } from './webview/modals/analysisDialog';
import { HISTORY_PAGE_MARKUP } from './webview/pages/historyPage';
import { ANALYSIS_CONTROL_MARKUP, PIPELINE_EMPTY_ACTION_MARKUP } from './webview/components/analysisControl';
import { PIPELINE_STYLES } from './webview/styles';
import { PIPELINE_LOCALIZATION } from './i18n';

export const PIPELINE_WEBVIEW_CONTRIBUTION: ModuleWebviewContribution = {
  configurationTab: PIPELINE_CONFIGURATION_TAB_MARKUP,
  configurationPanel: PIPELINE_CONFIGURATION_PANEL_MARKUP,
  modals: `${ANALYSIS_DIALOG_MARKUP}\n${ANALYSIS_CONFIRMATION_DIALOG_MARKUP}`,
  scripts: [PIPELINE_EDITOR_SCRIPT, PIPELINE_VARIABLES_SCRIPT, ANALYSIS_SCRIPT, HISTORY_SCRIPT, BASELINE_SCRIPT, PIPELINE_INTEGRATION_SCRIPT].join('\n'),
  styles: `${PIPELINE_STYLES}\n${PIPELINE_HISTORY_STYLES}`,
  pages: HISTORY_PAGE_MARKUP,
  dataControls: ANALYSIS_CONTROL_MARKUP,
  emptyActions: PIPELINE_EMPTY_ACTION_MARKUP,
  localization: PIPELINE_LOCALIZATION
};
