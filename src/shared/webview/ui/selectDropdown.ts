export interface SelectDropdownOption {
  disabled?: boolean;
  label: string;
  value: string;
}

export interface SelectDropdownMarkupOptions {
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
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
  disabled = false,
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
  const disabledAttribute = disabled ? ' disabled' : '';

  const nativeOptions = options
    .map(option => {
      const selected = option.value === selectedOption?.value ? ' selected' : '';
      const optionDisabled = option.disabled ? ' disabled' : '';
      return `                  <option value="${escapeAttribute(option.value)}"${selected}${optionDisabled}>${escapeText(option.label)}</option>`;
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
                  tabindex="-1"${disabledAttribute}
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
                  aria-label="${escapeAttribute(accessibleLabel)}"${disabledAttribute}
                >
                  <span class="select-dropdown__value">${escapeText(selectedOption?.label ?? '')}</span>
                  <span class="select-dropdown__chevron" aria-hidden="true"></span>
                </button>
                <div
                  id="${escapeAttribute(listboxId)}"
                  class="select-dropdown__menu"
                  role="listbox"
                  aria-labelledby="${escapeAttribute(buttonId)}"
                  popover="manual"
                ></div>
              </div>`;
}
