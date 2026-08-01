import { getDashboardModalsMarkup } from './modals';
import { CONFIGURATION_PAGE_MARKUP } from './pages/configurationPage';
import { getDataPageMarkup } from './pages/dataPage';
import { DIAGNOSTICS_PAGE_MARKUP } from './pages/diagnosticsPage';
import { HISTORY_PAGE_MARKUP } from './pages/historyPage';

export function getDashboardBody(): string {
  return [
    '\n  <div class="shell">\n    <main class="content">\n',
    getDataPageMarkup(),
    CONFIGURATION_PAGE_MARKUP,
    HISTORY_PAGE_MARKUP,
    DIAGNOSTICS_PAGE_MARKUP,
    '\n    </main>\n  </div>\n\n',
    getDashboardModalsMarkup()
  ].join('');
}
