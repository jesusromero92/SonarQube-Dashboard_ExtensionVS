import { getDashboardModalsMarkup } from './modals';
import { getConfigurationPageMarkup } from './pages/configurationPage';
import { getDataPageMarkup } from './pages/dataPage';
import { DIAGNOSTICS_PAGE_MARKUP } from './pages/diagnosticsPage';
import type { ModuleWebviewContribution } from '../../modules';
import type { DashboardPage } from '../contracts';

export function getDashboardBody(
  modules: ModuleWebviewContribution,
  initialPage: DashboardPage = 'data',
  configurationTab = 'configurationSonarPanel'
): string {
  return [
    '\n  <div class="shell">\n    <main class="content">\n',
    getDataPageMarkup(modules, initialPage !== 'data'),
    getConfigurationPageMarkup(modules, initialPage === 'configuration', configurationTab),
    modules.pages ?? '',
    DIAGNOSTICS_PAGE_MARKUP,
    '\n    </main>\n  </div>\n\n',
    getDashboardModalsMarkup(modules)
  ].join('');
}
