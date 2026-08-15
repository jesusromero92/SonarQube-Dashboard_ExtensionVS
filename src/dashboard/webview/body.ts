import { getDashboardModalsMarkup } from './modals';
import { CONFIGURATION_PAGE_MARKUP } from './pages/configurationPage';
import { getDataPageMarkup } from './pages/dataPage';
import { DIAGNOSTICS_PAGE_MARKUP } from './pages/diagnosticsPage';
import { MODULE_PAGES_MARKUP } from '../../modules/webview';

export function getDashboardBody(): string {
  return [
    '\n  <div class="shell">\n    <main class="content">\n',
    getDataPageMarkup(),
    CONFIGURATION_PAGE_MARKUP,
    MODULE_PAGES_MARKUP,
    DIAGNOSTICS_PAGE_MARKUP,
    '\n    </main>\n  </div>\n\n',
    getDashboardModalsMarkup()
  ].join('');
}
