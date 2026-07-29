export const SELECT_DROPDOWN_SCRIPT = `
    function initializeSelectDropdowns() {
      const roots = Array.from(document.querySelectorAll('[data-select-dropdown]'));

      const closeDropdown = root => {
        const trigger = root.querySelector('.select-dropdown__trigger');
        const menu = root.querySelector('.select-dropdown__menu');
        root.dataset.open = 'false';
        trigger?.setAttribute('aria-expanded', 'false');
        if (menu) menu.hidden = true;
      };

      const closeAllDropdowns = except => {
        for (const root of roots) {
          if (root !== except) closeDropdown(root);
        }
      };

      const focusOption = (options, index) => {
        const target = options[index];
        if (!target) return;
        for (const option of options) option.tabIndex = option === target ? 0 : -1;
        target.focus();
      };

      for (const root of roots) {
        const select = root.querySelector('.select-dropdown__native');
        const trigger = root.querySelector('.select-dropdown__trigger');
        const value = root.querySelector('.select-dropdown__value');
        const menu = root.querySelector('.select-dropdown__menu');
        const options = Array.from(root.querySelectorAll('.select-dropdown__option'));
        if (!select || !trigger || !value || !menu || options.length === 0) continue;

        const syncFromSelect = () => {
          const selected = options.find(option => option.dataset.dropdownOption === select.value)
            || options[0];
          value.textContent = selected.textContent || '';
          const dropdownLabel = root.dataset.dropdownLabel || '';
          trigger.setAttribute(
            'aria-label',
            dropdownLabel ? dropdownLabel + ': ' + value.textContent : value.textContent
          );
          for (const option of options) {
            const isSelected = option === selected;
            option.setAttribute('aria-selected', String(isSelected));
            option.tabIndex = isSelected ? 0 : -1;
          }
        };

        const openDropdown = focusSelected => {
          closeAllDropdowns(root);
          root.dataset.open = 'true';
          trigger.setAttribute('aria-expanded', 'true');
          menu.hidden = false;
          if (focusSelected) {
            const selectedIndex = Math.max(
              0,
              options.findIndex(option => option.dataset.dropdownOption === select.value)
            );
            focusOption(options, selectedIndex);
          }
        };

        const selectOption = option => {
          const nextValue = option.dataset.dropdownOption;
          if (typeof nextValue !== 'string') return;
          const changed = select.value !== nextValue;
          select.value = nextValue;
          syncFromSelect();
          closeDropdown(root);
          trigger.focus();
          if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
        };

        trigger.addEventListener('click', event => {
          event.stopPropagation();
          if (root.dataset.open === 'true') {
            closeDropdown(root);
          } else {
            openDropdown(false);
          }
        });

        trigger.addEventListener('keydown', event => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          openDropdown(true);
        });

        menu.addEventListener('keydown', event => {
          const currentIndex = Math.max(0, options.indexOf(document.activeElement));
          let nextIndex = currentIndex;
          if (event.key === 'ArrowDown') nextIndex = Math.min(options.length - 1, currentIndex + 1);
          else if (event.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 1);
          else if (event.key === 'Home') nextIndex = 0;
          else if (event.key === 'End') nextIndex = options.length - 1;
          else if (event.key === 'Escape') {
            event.preventDefault();
            closeDropdown(root);
            trigger.focus();
            return;
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const active = options.find(option => option === document.activeElement);
            if (active) selectOption(active);
            return;
          } else {
            return;
          }
          event.preventDefault();
          focusOption(options, nextIndex);
        });

        for (const option of options) {
          option.addEventListener('click', event => {
            event.stopPropagation();
            selectOption(option);
          });
        }

        select.addEventListener('change', syncFromSelect);
        syncFromSelect();
        closeDropdown(root);
      }

      document.addEventListener('click', () => closeAllDropdowns());
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeAllDropdowns();
      });
    }

    initializeSelectDropdowns();
`;
