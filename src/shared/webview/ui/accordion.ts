export interface AccordionMarkupOptions {
  contentClassName?: string;
  contentId?: string;
  contentMarkup?: string;
  countId?: string;
  countValue?: string;
  label: string;
  name?: string;
  open?: boolean;
}

export function getAccordionMarkup({
  contentClassName = '',
  contentId,
  contentMarkup = '',
  countId,
  countValue = '0',
  label,
  name,
  open = false
}: AccordionMarkupOptions): string {
  const nameAttribute = name ? ` name="${name}"` : '';
  const openAttribute = open ? ' open' : '';
  const countMarkup = countId
    ? ` <span id="${countId}" class="muted">${countValue}</span>`
    : '';
  const contentIdAttribute = contentId ? ` id="${contentId}"` : '';
  const contentClasses = ['accordion__content', contentClassName]
    .filter(Boolean)
    .join(' ');

  return `            <details class="accordion"${nameAttribute}${openAttribute}>
              <summary>${label}${countMarkup}</summary>
              <div${contentIdAttribute} class="${contentClasses}">
${contentMarkup}
              </div>
            </details>`;
}
