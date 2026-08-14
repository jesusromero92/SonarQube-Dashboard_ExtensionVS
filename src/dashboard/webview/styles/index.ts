import { DashboardWebviewAssets } from '../assets';
import { getDashboardDesignStyles } from '../design';
import { PIPELINE_STYLES } from '../../../pipeline/webview/styles';
import { ANALYSIS_STYLES } from './analysis';
import { getBaseStyles } from './base';
import { CHART_STYLES } from './charts';
import { RESPONSIVE_STYLES } from './responsive';
import { getTableStyles } from './tables';
import { HISTORY_DIAGNOSTICS_STYLES } from './historyDiagnostics';

export function getDashboardStyles(assets: DashboardWebviewAssets): string {
  return [
    getBaseStyles(assets),
    getTableStyles(assets),
    CHART_STYLES,
    PIPELINE_STYLES,
    ANALYSIS_STYLES,
    HISTORY_DIAGNOSTICS_STYLES,
    getDashboardDesignStyles(),
    RESPONSIVE_STYLES
  ].join('');
}
