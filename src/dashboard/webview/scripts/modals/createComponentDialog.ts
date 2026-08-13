export const CREATE_COMPONENT_DIALOG_SCRIPT = `
    function componentKeyFromName(value) {
      const normalized = value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/[^A-Za-z0-9_.:-]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (!normalized) {
        return '';
      }
      if (/^\\d+$/.test(normalized)) {
        return 'project-' + normalized;
      }
      return normalized;
    }

    function showCreateComponentError(message) {
      elements.createComponentError.textContent = message ?? '';
      elements.createComponentError.hidden = !message;
    }

    function setCreateComponentBusy(busy) {
      const isBusy = Boolean(busy);
      elements.createComponentSubmit.disabled = isBusy;
      elements.createComponentCancel.disabled = isBusy;
      elements.createComponentClose.disabled = isBusy;
      elements.createComponentType.disabled = isBusy;
      elements.createComponentName.disabled = isBusy;
      elements.createComponentKey.disabled = isBusy;
      elements.createComponentDescription.disabled = isBusy;
      elements.createComponentVisibility.disabled = isBusy;
      elements.createComponentSubmit.textContent = isBusy
        ? 'Creando…'
        : 'Crear';
      refreshSelectDropdown(elements.createComponentType);
      refreshSelectDropdown(elements.createComponentVisibility);
    }

    function configureCreatableTypes(preferredKind) {
      const types = [];
      if (creationCapabilities.canCreateProjects) {
        types.push({ value: 'project', label: 'Proyecto' });
      }
      if (creationCapabilities.canCreateApplications) {
        types.push({ value: 'application', label: 'Aplicación' });
      }

      elements.createComponentType.textContent = '';
      for (const type of types) {
        const option = document.createElement('option');
        option.value = type.value;
        option.textContent = type.label;
        elements.createComponentType.appendChild(option);
      }
      createComponentKind = types.some(type => type.value === preferredKind)
        ? preferredKind
        : types[0]?.value ?? 'project';
      elements.createComponentType.value = createComponentKind;
      elements.createComponentTypeField.hidden = types.length <= 1;
      refreshSelectDropdown(elements.createComponentType, true);
    }

    function openCreateComponentDialog(kind) {
      configureCreatableTypes(kind);
      componentKeyEdited = false;
      elements.createComponentName.value = '';
      elements.createComponentKey.value = '';
      elements.createComponentDescription.value = '';
      elements.createComponentVisibility.value = 'private';
      elements.createComponentTitle.textContent = createComponentKind === 'application'
        ? 'Crear aplicación'
        : 'Crear proyecto';
      showCreateComponentError('');
      setCreateComponentBusy(false);
      refreshSelectDropdown(elements.createComponentVisibility);
      if (!elements.createComponentDialog.open) {
        elements.createComponentDialog.showModal();
      }
      elements.createComponentName.focus();
    }

    elements.createComponentType.addEventListener('change', () => {
      createComponentKind = elements.createComponentType.value;
      elements.createComponentTitle.textContent = createComponentKind === 'application'
        ? 'Crear aplicación'
        : 'Crear proyecto';
    });

    elements.createComponentName.addEventListener('input', () => {
      if (!componentKeyEdited) {
        elements.createComponentKey.value = componentKeyFromName(
          elements.createComponentName.value
        );
      }
    });

    elements.createComponentKey.addEventListener('input', () => {
      componentKeyEdited = true;
    });

    elements.createComponentForm.addEventListener('submit', event => {
      event.preventDefault();
      const name = elements.createComponentName.value.trim();
      const key = elements.createComponentKey.value.trim();
      if (!name) {
        showCreateComponentError('Introduce el nombre del componente.');
        return;
      }
      if (!key || /^d+$/.test(key) || !/^[A-Za-z0-9_.:-]+$/.test(key)) {
        showCreateComponentError('Introduce una clave válida que contenga al menos una letra.');
        return;
      }

      showCreateComponentError('');
      setCreateComponentBusy(true);
      vscode.postMessage({
        type: 'createComponent',
        ...values(),
        componentKind: elements.createComponentType.value,
        componentKey: key,
        componentName: name,
        componentDescription: elements.createComponentDescription.value.trim(),
        componentVisibility: elements.createComponentVisibility.value
      });
    });
`;
