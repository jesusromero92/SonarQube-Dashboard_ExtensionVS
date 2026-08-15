import { CONFIGURATION_EVENTS_SCRIPT } from './configuration';
import { DASHBOARD_EVENTS_SCRIPT } from './dashboard';
import { DIALOG_EVENTS_SCRIPT } from './dialogs';
import { LAYOUT_EVENTS_SCRIPT } from './layout';
import { MESSAGE_EVENTS_SCRIPT } from './messages';

export const EVENTS_SCRIPT = [
  LAYOUT_EVENTS_SCRIPT,
  CONFIGURATION_EVENTS_SCRIPT,
  DASHBOARD_EVENTS_SCRIPT,
  DIALOG_EVENTS_SCRIPT,
  MESSAGE_EVENTS_SCRIPT,
  `
    runDashboardModuleHooks('bindEvents');
    navigate(currentPage);
    vscode.postMessage({ type: 'ready' });
  `
].join('');
