import { DashboardLanguage } from '../../../i18n';
import { getBootstrapScript } from './bootstrap';
import { CHARTS_SCRIPT } from './charts';
import { EVENTS_SCRIPT } from './events/index';
import { RENDER_SCRIPT } from './render';
import { HOTSPOT_DIALOG_SCRIPT } from './modals/hotspotDialog';
import { QUALITY_GATE_DIALOG_SCRIPT } from './modals/qualityGateDialog';
import { RULE_DIALOG_SCRIPT } from './modals/ruleDialog';
import { HOTSPOTS_TABLE_SCRIPT } from './tables/hotspotsTable';
import { ISSUES_TABLE_SCRIPT } from './tables/issuesTable';
import { RANKING_TABLES_SCRIPT } from './tables/rankingTables';
import { ANALYSIS_SCRIPT } from './analysis';
import { ISSUE_MANAGEMENT_SCRIPT } from './features/issues';
import { COVERAGE_SCRIPT } from './coverage';
import { SELECT_DROPDOWN_SCRIPT } from './ui/selectDropdown';

export function getDashboardScript(language: DashboardLanguage, locale: string): string {
  return [
    getBootstrapScript(language, locale),
    SELECT_DROPDOWN_SCRIPT,
    ISSUES_TABLE_SCRIPT,
    RULE_DIALOG_SCRIPT,
    HOTSPOTS_TABLE_SCRIPT,
    HOTSPOT_DIALOG_SCRIPT,
    QUALITY_GATE_DIALOG_SCRIPT,
    ISSUE_MANAGEMENT_SCRIPT,
    RANKING_TABLES_SCRIPT,
    CHARTS_SCRIPT,
    COVERAGE_SCRIPT,
    ANALYSIS_SCRIPT,
    RENDER_SCRIPT,
    EVENTS_SCRIPT
  ].join('');
}
