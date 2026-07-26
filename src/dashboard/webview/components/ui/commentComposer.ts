export interface CommentComposerMarkupOptions {
  buttonId: string;
  buttonLabel: string;
  formId: string;
  placeholder: string;
  textareaId: string;
  textareaLabel: string;
}

export function getCommentComposerMarkup({
  buttonId,
  buttonLabel,
  formId,
  placeholder,
  textareaId,
  textareaLabel
}: CommentComposerMarkupOptions): string {
  return `                <div id="${formId}" class="comment-composer" hidden>
                  <textarea
                    id="${textareaId}"
                    rows="3"
                    aria-label="${textareaLabel}"
                    placeholder="${placeholder}"
                  ></textarea>
                  <div class="comment-composer__actions">
                    <button id="${buttonId}" type="button">${buttonLabel}</button>
                  </div>
                </div>`;
}
