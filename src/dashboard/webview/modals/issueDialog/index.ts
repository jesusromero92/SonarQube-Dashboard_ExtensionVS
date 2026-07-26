import { getDetailDialogMarkup } from '../../components/ui/detailDialog';
import { ISSUE_ACTIONS_SECTION_MARKUP } from './actionsSection';
import { ISSUE_ACTIVITY_SECTION_MARKUP } from './activitySection';
import { ISSUE_FLOW_SECTION_MARKUP } from './flowSection';
import { ISSUE_OVERVIEW_SECTION_MARKUP } from './overviewSection';

const bodyMarkup = `        <div id="issueDialogLoading" class="dialog-loading">Cargando gestión del defecto…</div>
        <div id="issueDialogContent" hidden>
${ISSUE_OVERVIEW_SECTION_MARKUP}

${ISSUE_ACTIONS_SECTION_MARKUP}

${ISSUE_FLOW_SECTION_MARKUP}

${ISSUE_ACTIVITY_SECTION_MARKUP}
        </div>`;

const footerMarkup = `        <button id="openManagedIssueFile" class="secondary" type="button">Abrir archivo</button>
        <button id="closeIssueDialog" type="button">Cerrar</button>`;

export const ISSUE_DIALOG_MARKUP = getDetailDialogMarkup({
  bodyMarkup,
  closeButtonId: 'issueDialogClose',
  closeLabel: 'Cerrar',
  dialogClass: 'lifecycle-dialog',
  dialogId: 'issueDialog',
  footerMarkup,
  headerExtraMarkup: '          <div id="issueDialogBadges" class="dialog-badges"></div>',
  title: 'Gestión del defecto',
  titleId: 'issueDialogTitle'
});
