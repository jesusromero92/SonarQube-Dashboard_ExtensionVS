import { getDataPageMarkup } from './pages/dataPage';
import { CONFIGURATION_PAGE_MARKUP } from './pages/configurationPage';
import { RULE_DIALOG_MARKUP } from './modals/ruleDialog';
import { QUALITY_GATE_DIALOG_MARKUP } from './modals/qualityGateDialog';
import { HOTSPOT_DIALOG_MARKUP } from './modals/hotspotDialog';
import { ANALYSIS_DIALOG_MARKUP } from './modals/analysisDialog';

export function getDashboardBody(): string {
  return [
    '\n  <div class="shell">\n    <main class="content">\n',
    getDataPageMarkup(),
    CONFIGURATION_PAGE_MARKUP,
    '\n    </main>\n  </div>\n\n',
    RULE_DIALOG_MARKUP,
    QUALITY_GATE_DIALOG_MARKUP,
    HOTSPOT_DIALOG_MARKUP,
    ANALYSIS_DIALOG_MARKUP
  ].join('');
}
