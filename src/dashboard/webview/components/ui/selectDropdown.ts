export interface SelectDropdownOption {
  label: string;
  value: string;
}

export interface SelectDropdownMarkupOptions {
  ariaLabel: string;
  className?: string;
  id: string;
  options: readonly SelectDropdownOption[];
  selectedValue?: string;
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function getSelectDropdownMarkup({
  ariaLabel,
  className = '',
  id,
  options,
  selectedValue
}: SelectDropdownMarkupOptions): string {
  const selectedOption = options.find(option => option.value === selectedValue)
    ?? options[0];
  const rootClasses = ['select-dropdown', className].filter(Boolean).join(' ');
  const accessibleLabel = `${ariaLabel}: ${selectedOption?.label ?? ''}`;
  const listboxId = `${id}Listbox`;
  const buttonId = `${id}Trigger`;

  const nativeOptions = options
    .map(option => {
      const selected = option.value === selectedOption?.value ? ' selected' : '';
      return `                  <option value="${escapeAttribute(option.value)}"${selected}>${escapeText(option.label)}</option>`;
    })
    .join('\n');

  const customOptions = options
    .map(option => {
      const selected = option.value === selectedOption?.value;
      return `                <button
                  class="select-dropdown__option"
                  type="button"
                  role="option"
                  data-dropdown-option="${escapeAttribute(option.value)}"
                  aria-selected="${selected ? 'true' : 'false'}"
                  tabindex="${selected ? '0' : '-1'}"
                >${escapeText(option.label)}</button>`;
    })
    .join('\n');

  return `              <div
                class="${rootClasses}"
                data-select-dropdown
                data-dropdown-label="${escapeAttribute(ariaLabel)}"
              >
                <select
                  id="${escapeAttribute(id)}"
                  class="select-dropdown__native"
                  aria-label="${escapeAttribute(ariaLabel)}"
                  tabindex="-1"
                >
${nativeOptions}
                </select>
                <button
                  id="${escapeAttribute(buttonId)}"
                  class="select-dropdown__trigger"
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded="false"
                  aria-controls="${escapeAttribute(listboxId)}"
                  aria-label="${escapeAttribute(accessibleLabel)}"
                >
                  <span class="select-dropdown__value">${escapeText(selectedOption?.label ?? '')}</span>
                  <span class="select-dropdown__chevron" aria-hidden="true"></span>
                </button>
                <div
                  id="${escapeAttribute(listboxId)}"
                  class="select-dropdown__menu"
                  role="listbox"
                  aria-labelledby="${escapeAttribute(buttonId)}"
                  hidden
                >
${customOptions}
                </div>
              </div>`;
}
