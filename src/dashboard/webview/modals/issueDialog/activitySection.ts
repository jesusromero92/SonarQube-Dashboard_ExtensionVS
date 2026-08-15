import { getAccordionMarkup } from '../../../../shared/webview/ui/accordion';
import { getCommentComposerMarkup } from '../../components/ui/commentComposer';

const commentComposer = getCommentComposerMarkup({
  buttonId: 'issueAddComment',
  buttonLabel: 'Añadir comentario',
  formId: 'issueCommentForm',
  placeholder: 'Añade un comentario a SonarQube',
  textareaId: 'issueComment',
  textareaLabel: 'Comentario'
});

const commentsAccordion = getAccordionMarkup({
  contentClassName: 'accordion__content--activity',
  contentMarkup: `${commentComposer}
                <div id="issueComments" class="activity-list"></div>`,
  countId: 'issueCommentsCount',
  label: 'Comentarios',
  name: 'issueActivity'
});

const historyAccordion = getAccordionMarkup({
  contentClassName: 'activity-list',
  contentId: 'issueHistory',
  countId: 'issueHistoryCount',
  label: 'Historial',
  name: 'issueActivity'
});

export const ISSUE_ACTIVITY_SECTION_MARKUP = `          <section class="detail-section accordion-group">
${commentsAccordion}
${historyAccordion}
          </section>`;
