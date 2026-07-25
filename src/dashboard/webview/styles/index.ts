import { DashboardWebviewAssets } from '../assets';
import { getBaseStyles } from './base';
import { getTableStyles } from './tables';
import { MODAL_STYLES } from './modals';
import { CHART_STYLES } from './charts';
import { RESPONSIVE_STYLES } from './responsive';

export function getDashboardStyles(assets: DashboardWebviewAssets): string {
  return [
    getBaseStyles(assets),
    getTableStyles(assets),
    MODAL_STYLES,
    CHART_STYLES,
    RESPONSIVE_STYLES
  ].join('');
}
