import { CREATE_COMPONENT_DIALOG_MARKUP } from './createComponentDialog';
import { MODULE_MODALS_MARKUP } from '../../../modules/webview';
import { COVERAGE_DIALOG_MARKUP } from './coverageDialog';
import { HOTSPOT_DIALOG_MARKUP } from './hotspotDialog';
import { ISSUE_DIALOG_MARKUP } from './issueDialog';
import { ISSUE_FILTERS_DIALOG_MARKUP } from './issueFiltersDialog';
import { QUALITY_GATE_DIALOG_MARKUP } from './qualityGateDialog';
import { RULE_DIALOG_MARKUP } from './ruleDialog';

export function getDashboardModalsMarkup(): string {
  return [
    RULE_DIALOG_MARKUP,
    QUALITY_GATE_DIALOG_MARKUP,
    HOTSPOT_DIALOG_MARKUP,
    ISSUE_DIALOG_MARKUP,
    ISSUE_FILTERS_DIALOG_MARKUP,
    COVERAGE_DIALOG_MARKUP,
    MODULE_MODALS_MARKUP,
    CREATE_COMPONENT_DIALOG_MARKUP
  ].join('');
}
