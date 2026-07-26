export interface DetailDialogMarkupOptions {
  bodyMarkup: string;
  closeButtonId: string;
  closeLabel: string;
  dialogClass?: string;
  dialogId: string;
  footerMarkup: string;
  headerExtraMarkup?: string;
  title: string;
  titleId: string;
}

export function getDetailDialogMarkup({
  bodyMarkup,
  closeButtonId,
  closeLabel,
  dialogClass = '',
  dialogId,
  footerMarkup,
  headerExtraMarkup = '',
  title,
  titleId
}: DetailDialogMarkupOptions): string {
  const className = ['detail-dialog', dialogClass].filter(Boolean).join(' ');

  return `  <dialog id="${dialogId}" class="${className}">
    <div class="detail-dialog-shell">
      <header class="detail-dialog-header">
        <div>
          <h2 id="${titleId}">${title}</h2>
${headerExtraMarkup}
        </div>
        <button id="${closeButtonId}" class="rule-dialog-close secondary" type="button" aria-label="${closeLabel}">×</button>
      </header>
      <div class="detail-dialog-body">
${bodyMarkup}
      </div>
      <footer class="detail-dialog-footer">
${footerMarkup}
      </footer>
    </div>
  </dialog>

`;
}
