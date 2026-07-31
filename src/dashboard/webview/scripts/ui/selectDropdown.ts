export const SELECT_DROPDOWN_SCRIPT = `
    const selectDropdownControllers = new Map();

    function initializeSelectDropdown(root) {
      if (!root || root.dataset.dropdownInitialized === 'true') return;

      const select = root.querySelector('.select-dropdown__native');
      const trigger = root.querySelector('.select-dropdown__trigger');
      const value = root.querySelector('.select-dropdown__value');
      const menu = root.querySelector('.select-dropdown__menu');
      if (!select || !trigger || !value || !menu) return;

      root.dataset.dropdownInitialized = 'true';

      const supportsPopover = typeof menu.showPopover === 'function'
        && typeof menu.hidePopover === 'function';
      const menuGap = 7;
      const viewportMargin = 8;

      if (!supportsPopover) menu.hidden = true;

      const isMenuOpen = () => supportsPopover
        ? menu.matches(':popover-open')
        : !menu.hidden;

      const closeDropdown = () => {
        root.dataset.open = 'false';
        trigger.setAttribute('aria-expanded', 'false');
        if (supportsPopover) {
          if (isMenuOpen()) menu.hidePopover();
        } else {
          menu.hidden = true;
        }
      };

      const positionMenu = () => {
        if (!isMenuOpen()) return;

        const triggerRect = trigger.getBoundingClientRect();
        const availableBelow = window.innerHeight - triggerRect.bottom - menuGap - viewportMargin;
        const availableAbove = triggerRect.top - menuGap - viewportMargin;
        const openAbove = availableBelow < 120 && availableAbove > availableBelow;
        const availableHeight = Math.max(72, openAbove ? availableAbove : availableBelow);
        const maxHeight = Math.min(220, availableHeight);
        const width = triggerRect.width;
        const left = Math.min(
          Math.max(viewportMargin, triggerRect.left),
          Math.max(viewportMargin, window.innerWidth - width - viewportMargin)
        );

        menu.style.width = width + 'px';
        menu.style.minWidth = width + 'px';
        menu.style.maxHeight = maxHeight + 'px';
        menu.style.left = left + 'px';
        menu.style.right = 'auto';

        if (openAbove) {
          const menuHeight = Math.min(menu.scrollHeight, maxHeight);
          menu.style.top = Math.max(viewportMargin, triggerRect.top - menuGap - menuHeight) + 'px';
        } else {
          menu.style.top = Math.min(
            window.innerHeight - viewportMargin - Math.min(menu.scrollHeight, maxHeight),
            triggerRect.bottom + menuGap
          ) + 'px';
        }
      };

      const availableOptions = () =>
        Array.from(menu.querySelectorAll('.select-dropdown__option:not(:disabled)'));

      const focusOption = (options, index) => {
        const target = options[index];
        if (!target) return;
        for (const option of options) option.tabIndex = option === target ? 0 : -1;
        target.focus();
      };

      const syncFromSelect = () => {
        const selectedNative = select.selectedOptions[0] || select.options[0];
        value.textContent = selectedNative?.textContent || '';
        const dropdownLabel = root.dataset.dropdownLabel || '';
        trigger.setAttribute(
          'aria-label',
          dropdownLabel ? dropdownLabel + ': ' + value.textContent : value.textContent
        );
        trigger.disabled = select.disabled;
        root.dataset.disabled = String(select.disabled);

        for (const option of menu.querySelectorAll('.select-dropdown__option')) {
          const isSelected = option.dataset.dropdownOption === select.value;
          option.setAttribute('aria-selected', String(isSelected));
          option.tabIndex = isSelected && !option.disabled ? 0 : -1;
        }

        if (select.disabled) closeDropdown();
      };

      const rebuildOptions = () => {
        menu.textContent = '';
        for (const nativeOption of Array.from(select.options)) {
          const option = document.createElement('button');
          option.className = 'select-dropdown__option';
          option.type = 'button';
          option.role = 'option';
          option.dataset.dropdownOption = nativeOption.value;
          option.textContent = nativeOption.textContent || '';
          option.title = nativeOption.textContent || '';
          option.disabled = nativeOption.disabled;
          menu.appendChild(option);
        }
        syncFromSelect();
      };

      const openDropdown = focusSelected => {
        if (select.disabled) return;
        closeAllSelectDropdowns(root);
        root.dataset.open = 'true';
        trigger.setAttribute('aria-expanded', 'true');
        if (supportsPopover) menu.showPopover();
        else menu.hidden = false;
        positionMenu();
        if (focusSelected) {
          const options = availableOptions();
          const selectedIndex = Math.max(
            0,
            options.findIndex(option => option.dataset.dropdownOption === select.value)
          );
          focusOption(options, selectedIndex);
        }
      };

      const selectOption = option => {
        const nextValue = option.dataset.dropdownOption;
        if (typeof nextValue !== 'string' || option.disabled) return;
        const changed = select.value !== nextValue;
        select.value = nextValue;
        syncFromSelect();
        closeDropdown();
        trigger.focus();
        if (changed) select.dispatchEvent(new Event('change', { bubbles: true }));
      };

      trigger.addEventListener('click', event => {
        event.stopPropagation();
        if (root.dataset.open === 'true') closeDropdown();
        else openDropdown(false);
      });

      trigger.addEventListener('keydown', event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        openDropdown(true);
      });

      menu.addEventListener('click', event => {
        const option = event.target.closest('.select-dropdown__option');
        if (!option) return;
        event.stopPropagation();
        selectOption(option);
      });

      menu.addEventListener('keydown', event => {
        const options = availableOptions();
        const currentIndex = Math.max(0, options.indexOf(document.activeElement));
        let nextIndex = currentIndex;
        if (event.key === 'ArrowDown') nextIndex = Math.min(options.length - 1, currentIndex + 1);
        else if (event.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 1);
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = options.length - 1;
        else if (event.key === 'Escape') {
          event.preventDefault();
          closeDropdown();
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

      select.addEventListener('change', syncFromSelect);
      window.addEventListener('resize', positionMenu);
      document.addEventListener('scroll', positionMenu, true);

      const observer = new MutationObserver(rebuildOptions);
      observer.observe(select, {
        attributes: true,
        attributeFilter: ['disabled'],
        childList: true,
        subtree: true
      });

      selectDropdownControllers.set(select, {
        close: closeDropdown,
        rebuild: rebuildOptions,
        reposition: positionMenu,
        sync: syncFromSelect
      });

      rebuildOptions();
      closeDropdown();
    }

    let generatedSelectDropdownId = 0;

    function createSelectDropdownControl({
      ariaLabel,
      className = '',
      disabled = false,
      id,
      options = [],
      selectedValue = ''
    }) {
      generatedSelectDropdownId += 1;
      const controlId = id || 'dynamicSelectDropdown' + generatedSelectDropdownId;
      const root = document.createElement('div');
      root.className = ['select-dropdown', className].filter(Boolean).join(' ');
      root.dataset.selectDropdown = '';
      root.dataset.dropdownLabel = ariaLabel;

      const select = document.createElement('select');
      select.id = controlId;
      select.className = 'select-dropdown__native';
      select.setAttribute('aria-label', ariaLabel);
      select.tabIndex = -1;
      select.disabled = disabled;

      for (const item of options) {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.label;
        option.disabled = Boolean(item.disabled);
        option.selected = item.value === selectedValue;
        select.appendChild(option);
      }

      if (!select.selectedOptions.length && select.options.length) {
        select.options[0].selected = true;
      }

      const trigger = document.createElement('button');
      trigger.id = controlId + 'Trigger';
      trigger.className = 'select-dropdown__trigger';
      trigger.type = 'button';
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-controls', controlId + 'Listbox');

      const value = document.createElement('span');
      value.className = 'select-dropdown__value';
      const chevron = document.createElement('span');
      chevron.className = 'select-dropdown__chevron';
      chevron.setAttribute('aria-hidden', 'true');
      trigger.append(value, chevron);

      const menu = document.createElement('div');
      menu.id = controlId + 'Listbox';
      menu.className = 'select-dropdown__menu';
      menu.role = 'listbox';
      menu.setAttribute('aria-labelledby', trigger.id);
      menu.setAttribute('popover', 'manual');

      root.append(select, trigger, menu);
      initializeSelectDropdown(root);
      return { root, select };
    }

    function closeAllSelectDropdowns(except) {
      for (const [select, controller] of selectDropdownControllers) {
        const root = select.closest('[data-select-dropdown]');
        if (root !== except) controller.close();
      }
    }

    function refreshSelectDropdown(target, rebuild = false) {
      const select = typeof target === 'string'
        ? document.getElementById(target)
        : target;
      const controller = selectDropdownControllers.get(select);
      if (!controller) return;
      if (rebuild) controller.rebuild();
      else controller.sync();
    }

    function refreshSelectDropdowns() {
      for (const controller of selectDropdownControllers.values()) controller.sync();
    }

    for (const root of document.querySelectorAll('[data-select-dropdown]')) {
      initializeSelectDropdown(root);
    }

    document.addEventListener('click', () => closeAllSelectDropdowns());
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeAllSelectDropdowns();
    });
`;
