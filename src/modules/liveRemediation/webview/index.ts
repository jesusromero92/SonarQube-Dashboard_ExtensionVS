import type { ModuleWebviewContribution } from '../../contracts';
import {
  LIVE_REMEDIATION_CONFIGURATION_PANEL_MARKUP,
  LIVE_REMEDIATION_CONFIGURATION_TAB_MARKUP
} from './configuration';
import { LIVE_REMEDIATION_INTEGRATION_SCRIPT } from './integration';
import { LIVE_REMEDIATION_STYLES } from './styles';
import { LIVE_REMEDIATION_LOCALIZATION } from '../i18n';

export const LIVE_REMEDIATION_WEBVIEW_CONTRIBUTION: ModuleWebviewContribution = {
  configurationTab: LIVE_REMEDIATION_CONFIGURATION_TAB_MARKUP,
  configurationPanel: LIVE_REMEDIATION_CONFIGURATION_PANEL_MARKUP,
  scripts: LIVE_REMEDIATION_INTEGRATION_SCRIPT,
  styles: LIVE_REMEDIATION_STYLES,
  localization: LIVE_REMEDIATION_LOCALIZATION
};
