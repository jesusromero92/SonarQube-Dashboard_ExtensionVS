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
import { PIPELINE_EDITOR_SCRIPT } from '../../../pipeline/webview/editor';
import { ANALYSIS_SCRIPT } from '../../../pipeline/webview/analysis';
import { ISSUE_MANAGEMENT_SCRIPT } from './features/issues';
import { COVERAGE_SCRIPT } from './coverage';
import { SELECT_DROPDOWN_SCRIPT } from './ui/selectDropdown';
import { CREATE_COMPONENT_DIALOG_SCRIPT } from './modals/createComponentDialog';
import { DIAGNOSTICS_SCRIPT } from './diagnostics';
import { HISTORY_SCRIPT } from '../../../pipeline/webview/history';
import { BASELINE_SCRIPT } from '../../../pipeline/webview/baseline';
import { TERMINAL_SCRIPT } from './terminal';

export function getDashboardScript(language: DashboardLanguage): string {
  return [
    getBootstrapScript(language),
    SELECT_DROPDOWN_SCRIPT,
    CREATE_COMPONENT_DIALOG_SCRIPT,
    ISSUES_TABLE_SCRIPT,
    RULE_DIALOG_SCRIPT,
    HOTSPOTS_TABLE_SCRIPT,
    HOTSPOT_DIALOG_SCRIPT,
    QUALITY_GATE_DIALOG_SCRIPT,
    ISSUE_MANAGEMENT_SCRIPT,
    RANKING_TABLES_SCRIPT,
    CHARTS_SCRIPT,
    COVERAGE_SCRIPT,
    TERMINAL_SCRIPT,
    BASELINE_SCRIPT,
    HISTORY_SCRIPT,
    DIAGNOSTICS_SCRIPT,
    PIPELINE_EDITOR_SCRIPT,
    ANALYSIS_SCRIPT,
    RENDER_SCRIPT,
    EVENTS_SCRIPT
  ].join('');
}
