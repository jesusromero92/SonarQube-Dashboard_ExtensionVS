import { ANALYSIS_DIALOG_MARKUP } from './analysisDialog';
import { COVERAGE_DIALOG_MARKUP } from './coverageDialog';
import { HOTSPOT_DIALOG_MARKUP } from './hotspotDialog';
import { ISSUE_DIALOG_MARKUP } from './issueDialog';
import { QUALITY_GATE_DIALOG_MARKUP } from './qualityGateDialog';
import { RULE_DIALOG_MARKUP } from './ruleDialog';

export function getDashboardModalsMarkup(): string {
  return [
    RULE_DIALOG_MARKUP,
    QUALITY_GATE_DIALOG_MARKUP,
    HOTSPOT_DIALOG_MARKUP,
    ISSUE_DIALOG_MARKUP,
    COVERAGE_DIALOG_MARKUP,
    ANALYSIS_DIALOG_MARKUP
  ].join('');
}
