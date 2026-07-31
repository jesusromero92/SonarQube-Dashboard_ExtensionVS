export const PIPELINE_EDITOR_SCRIPT = `    let pipelineStepCounter = 0;
    let analysisStepTemplates = new Map();

    function nextPipelineStepId(prefix = 'step') {
      pipelineStepCounter += 1;
      return prefix + '-' + Date.now().toString(36) + '-' + pipelineStepCounter;
    }

    function parsePipelineField(value, idPrefix = 'custom') {
      return String(value || '')
        .split(/\\r?\\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map((line, index) => {
          const parts = line.split('::').map(part => part.trim());
          const last = parts[parts.length - 1];
          const failurePolicy = last === 'continue' ? 'continue' : 'stop';
          if (last === 'continue' || last === 'stop') parts.pop();
          const defaultName = translateLocalizationValue('Nuevo paso') + ' ' + String(index + 1);
          let name = defaultName;
          let command = parts.join('::').trim();
          if (parts.length > 1) {
            name = parts.shift() || name;
            command = parts.join('::').trim();
          }
          return {
            id: nextPipelineStepId(idPrefix),
            name,
            command,
            kind: 'custom',
            failurePolicy,
            enabled: true
          };
        });
    }

    function serializePipelineSteps(steps) {
      return steps
        .filter(step => step.command.trim())
        .map(step => [
          step.name.trim() || translateLocalizationValue('Nuevo paso'),
          step.command.trim(),
          step.failurePolicy === 'continue' ? 'continue' : 'stop'
        ].join(' :: '))
        .join('\\n');
    }

    function configuredPipelineSteps() {
      return [
        ...parsePipelineField(elements.preAnalysisCommands.value, 'custom'),
        ...parsePipelineField(elements.postAnalysisCommands.value, 'legacy')
      ];
    }

    function pipelineSelect(className, ariaLabel, options, value, disabled = false) {
      const control = createSelectDropdownControl({
        ariaLabel,
        className: 'select-dropdown--fluid ' + className + '-dropdown',
        disabled,
        options: options.map(([optionValue, label, optionDisabled = false]) => ({
          value: optionValue,
          label,
          disabled: optionDisabled
        })),
        selectedValue: value
      });
      control.select.classList.add(className);
      return control;
    }

    function dragHandle(disabled = false) {
      const handle = document.createElement('span');
      handle.className = 'pipeline-step-drag';
      handle.textContent = '⋮⋮';
      handle.title = translateLocalizationValue('Arrastrar para ordenar');
      handle.setAttribute('aria-hidden', 'true');
      handle.draggable = !disabled;
      if (disabled) handle.classList.add('is-disabled');
      return handle;
    }

    function enablePipelineDrag(container, onChange) {
      let dragged = null;
      container.addEventListener('dragstart', event => {
        const handle = event.target.closest('.pipeline-step-drag');
        if (!handle || handle.draggable === false) {
          event.preventDefault();
          return;
        }
        const row = handle.closest('.pipeline-step-row');
        if (!row) {
          event.preventDefault();
          return;
        }
        dragged = row;
        row.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', row.dataset.stepId || 'pipeline-step');
      });
      container.addEventListener('dragover', event => {
        if (!dragged) return;
        event.preventDefault();
        const target = event.target.closest('.pipeline-step-row');
        if (!target || target === dragged) return;
        const rectangle = target.getBoundingClientRect();
        const after = event.clientY > rectangle.top + rectangle.height / 2;
        container.insertBefore(dragged, after ? target.nextSibling : target);
      });
      container.addEventListener('drop', event => {
        if (!dragged) return;
        event.preventDefault();
        onChange();
      });
      container.addEventListener('dragend', () => {
        dragged?.classList.remove('dragging');
        dragged = null;
        onChange();
      });
    }

    function readConfigurationPipelineRows() {
      return [...elements.pipelineStepsEditor.querySelectorAll('.pipeline-config-step')]
        .map(row => ({
          id: row.dataset.stepId,
          name: row.querySelector('.pipeline-step-name').value.trim(),
          command: row.querySelector('.pipeline-step-command').value.trim(),
          failurePolicy: row.querySelector('.pipeline-step-policy').value,
          kind: 'custom',
          enabled: true
        }));
    }

    function syncConfigurationPipelineFields() {
      const steps = readConfigurationPipelineRows();
      elements.preAnalysisCommands.value = serializePipelineSteps(steps);
      elements.postAnalysisCommands.value = '';
    }

    function createConfigurationPipelineRow(step) {
      const row = document.createElement('article');
      row.className = 'pipeline-step-row pipeline-config-step';
      row.draggable = false;
      row.dataset.stepId = step.id;

      const name = document.createElement('input');
      name.className = 'pipeline-step-name';
      name.type = 'text';
      name.value = step.name;
      name.placeholder = translateLocalizationValue('Nombre del paso');

      const command = document.createElement('input');
      command.className = 'pipeline-step-command';
      command.type = 'text';
      command.value = step.command;
      command.placeholder = translateLocalizationValue('Comando');
      command.spellcheck = false;

      const policy = pipelineSelect(
        'pipeline-step-policy',
        translateLocalizationValue('Condición de fallo'),
        [
          ['stop', translateLocalizationValue('Detener si falla')],
          ['continue', translateLocalizationValue('Continuar si falla')]
        ],
        step.failurePolicy
      );

      const remove = document.createElement('button');
      remove.className = 'pipeline-step-remove secondary';
      remove.type = 'button';
      remove.textContent = '×';
      remove.title = translateLocalizationValue('Eliminar paso');
      remove.addEventListener('click', () => {
        row.remove();
        syncConfigurationPipelineFields();
        elements.pipelineStepsEditor.classList.toggle(
          'is-empty',
          !elements.pipelineStepsEditor.querySelector('.pipeline-config-step')
        );
      });

      for (const control of [name, command, policy.select]) {
        control.addEventListener('input', syncConfigurationPipelineFields);
        control.addEventListener('change', syncConfigurationPipelineFields);
      }

      row.append(
        dragHandle(),
        name,
        command,
        policy.root,
        remove
      );
      return row;
    }

    function renderPipelineConfigurationFromFields() {
      elements.pipelineStepsEditor.textContent = '';
      const steps = configuredPipelineSteps();
      for (const step of steps) {
        elements.pipelineStepsEditor.appendChild(createConfigurationPipelineRow(step));
      }
      elements.pipelineStepsEditor.classList.toggle('is-empty', steps.length === 0);
      syncConfigurationPipelineFields();
    }

    function addConfigurationPipelineStep() {
      elements.pipelineStepsEditor.classList.remove('is-empty');
      const row = createConfigurationPipelineRow({
        id: nextPipelineStepId('custom'),
        name: translateLocalizationValue('Nuevo paso'),
        command: '',
        kind: 'custom',
        failurePolicy: 'stop',
        enabled: true
      });
      elements.pipelineStepsEditor.appendChild(row);
      row.querySelector('.pipeline-step-name').focus();
      syncConfigurationPipelineFields();
    }

    function sonarAnalysisRunStep() {
      return {
        id: 'sonarqube-analysis',
        templateId: 'sonarqube-analysis',
        name: translateLocalizationValue('Análisis SonarQube'),
        kind: 'sonar',
        command: '',
        failurePolicy: 'stop',
        enabled: true
      };
    }

    function availableAnalysisStepTemplates() {
      const buildCommand = effectiveProjectCommand(
        elements.buildCommand.value,
        currentConfig.detectedBuildCommand
      );
      const testCommand = effectiveProjectCommand(
        elements.testCommand.value,
        currentConfig.detectedTestCommand
      );
      const configured = configuredPipelineSteps();
      return [
        {
          id: 'build',
          templateId: 'build',
          name: translateLocalizationValue('Compilar el proyecto'),
          kind: 'build',
          command: buildCommand,
          failurePolicy: 'stop',
          enabled: true,
          unavailable: false
        },
        {
          id: 'tests',
          templateId: 'tests',
          name: translateLocalizationValue('Ejecutar tests'),
          kind: 'test',
          command: testCommand,
          failurePolicy: 'stop',
          enabled: true,
          unavailable: false
        },
        ...configured.map((step, index) => ({
          ...step,
          templateId: 'custom-' + index
        }))
      ];
    }

    function analysisTemplateOptions() {
      return [
        ['', translateLocalizationValue('Selecciona un paso')],
        ...[...analysisStepTemplates.entries()].map(([templateId, step]) => [
          templateId,
          step.name,
          Boolean(step.unavailable)
        ])
      ];
    }

    function analysisRunStepIsIncomplete(row) {
      if (row.dataset.stepKind === 'sonar') return false;
      const template = row.querySelector('.pipeline-step-template');
      const command = row.querySelector('.pipeline-step-command');
      return !template?.value || !command?.value.trim();
    }

    function updateAnalysisConfirmAvailability() {
      const rows = [...elements.analysisRunSteps.querySelectorAll('.analysis-run-step')];
      const incompleteRows = rows.filter(analysisRunStepIsIncomplete);
      for (const row of rows) {
        row.classList.toggle('is-incomplete', incompleteRows.includes(row));
      }
      elements.analysisConfirmationConfirm.disabled = incompleteRows.length > 0;
    }

    function applyAnalysisStepTemplate(row, templateId, policy) {
      const template = analysisStepTemplates.get(templateId);
      const command = row.querySelector('.pipeline-step-command');
      row.dataset.templateId = templateId || '';
      row.dataset.stepKind = template?.kind || 'custom';
      row.dataset.stepName = template?.name || '';
      command.value = template?.command || '';
      policy.select.value = template?.failurePolicy || 'stop';
      refreshSelectDropdown(policy.select);
      updateAnalysisConfirmAvailability();
    }

    function createAnalysisRunStepRow(step) {
      const row = document.createElement('article');
      row.className = 'pipeline-step-row analysis-run-step';
      row.draggable = false;
      row.dataset.stepId = step.id;
      row.dataset.stepKind = step.kind;
      row.dataset.templateId = step.templateId || '';
      row.dataset.stepName = step.name || '';

      const content = document.createElement('div');
      content.className = 'pipeline-step-content';
      const command = document.createElement('input');
      command.className = 'pipeline-step-command';
      command.type = 'text';
      command.value = step.command || '';
      command.placeholder = step.kind === 'sonar'
        ? translateLocalizationValue('Scanner configurado')
        : translateLocalizationValue('Comando');
      command.readOnly = step.kind === 'sonar';
      command.spellcheck = false;

      let templateControl = null;
      if (step.kind === 'sonar') {
        const name = document.createElement('input');
        name.className = 'pipeline-step-name';
        name.type = 'text';
        name.value = step.name;
        name.readOnly = true;
        content.append(name, command);
      } else {
        templateControl = pipelineSelect(
          'pipeline-step-template',
          translateLocalizationValue('Selecciona un paso'),
          analysisTemplateOptions(),
          step.templateId || ''
        );
        templateControl.root.classList.add('pipeline-step-name-dropdown');
        content.append(templateControl.root, command);
      }

      const policy = pipelineSelect(
        'pipeline-step-policy',
        translateLocalizationValue('Condición de fallo'),
        [
          ['stop', translateLocalizationValue('Detener si falla')],
          ['continue', translateLocalizationValue('Continuar si falla')]
        ],
        step.kind === 'sonar' ? 'stop' : step.failurePolicy,
        step.kind === 'sonar'
      );

      const remove = document.createElement('button');
      remove.className = 'pipeline-step-remove secondary';
      remove.type = 'button';
      remove.textContent = '×';
      remove.title = translateLocalizationValue('Eliminar paso de esta ejecución');
      remove.disabled = step.kind === 'sonar';
      remove.addEventListener('click', () => {
        row.remove();
        updateAnalysisConfirmAvailability();
      });

      row.append(
        dragHandle(step.kind === 'sonar'),
        content,
        policy.root,
        remove
      );

      if (templateControl) {
        templateControl.select.addEventListener('change', () => {
          applyAnalysisStepTemplate(row, templateControl.select.value, policy);
        });
        command.addEventListener('input', updateAnalysisConfirmAvailability);
        command.addEventListener('change', updateAnalysisConfirmAvailability);
        applyAnalysisStepTemplate(row, step.templateId || '', policy);
      }

      return row;
    }

    function renderAnalysisRunSteps() {
      elements.analysisRunSteps.textContent = '';
      analysisStepTemplates = new Map(
        availableAnalysisStepTemplates().map(step => [step.templateId, step])
      );
      elements.analysisRunSteps.appendChild(
        createAnalysisRunStepRow(sonarAnalysisRunStep())
      );
      elements.analysisAddStep.disabled = false;
      updateAnalysisConfirmAvailability();
    }

    function addSelectedAnalysisStep(event) {
      event?.preventDefault();
      event?.stopPropagation();

      analysisStepTemplates = new Map(
        availableAnalysisStepTemplates().map(step => [step.templateId, step])
      );

      const row = createAnalysisRunStepRow({
        id: nextPipelineStepId('run'),
        templateId: '',
        name: '',
        kind: 'custom',
        command: '',
        failurePolicy: 'stop',
        enabled: true
      });
      const sonar = elements.analysisRunSteps.querySelector('[data-step-kind="sonar"]');
      elements.analysisRunSteps.insertBefore(row, sonar || null);
      updateAnalysisConfirmAvailability();
      row.scrollIntoView({ block: 'nearest' });
      row.querySelector('.pipeline-step-name-dropdown .select-dropdown__trigger')?.focus();
    }

    function collectAnalysisRunSteps() {
      return [...elements.analysisRunSteps.querySelectorAll('.analysis-run-step')]
        .map(row => ({
          id: row.dataset.stepId,
          name: row.dataset.stepName || row.querySelector('.pipeline-step-name')?.value.trim() || '',
          kind: row.dataset.stepKind,
          command: row.querySelector('.pipeline-step-command').value.trim() || undefined,
          failurePolicy: row.dataset.stepKind === 'sonar'
            ? 'stop'
            : row.querySelector('.pipeline-step-policy').value,
          enabled: true
        }));
    }

    function createAnalysisStepStatusIcon(status) {
      const iconPaths = {
        success: {
          name: 'check',
          path: 'M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z'
        },
        failed: {
          name: 'close',
          path: 'M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 0 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z'
        },
        warning: {
          name: 'warning',
          path: 'M7.25 2.5h1.5v7h-1.5v-7Zm0 9h1.5V13h-1.5v-1.5Z'
        },
        skipped: {
          name: 'dash',
          path: 'M3 7.25h10v1.5H3v-1.5Z'
        }
      };
      const definition = iconPaths[status];
      if (!definition) return null;

      // Inline SVGs use the VS Code Codicons 16 × 16 icon convention without
      // requiring the Codicon font to be bundled inside the webview.
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('analysis-step-status-icon');
      svg.setAttribute('viewBox', '0 0 16 16');
      svg.setAttribute('focusable', 'false');
      svg.setAttribute('aria-hidden', 'true');
      svg.dataset.codicon = definition.name;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', definition.path);
      svg.appendChild(path);
      return svg;
    }

    function renderAnalysisStepStatusIcon(container, status) {
      if (!container || container.dataset.status === status) return;
      container.dataset.status = status;
      container.replaceChildren();
      const icon = createAnalysisStepStatusIcon(status);
      if (icon) container.appendChild(icon);
    }

    function renderAnalysisStepper(steps) {
      const nextSteps = Array.isArray(steps) ? steps : [];
      elements.analysisStepper.hidden = nextSteps.length <= 1;

      const existingItems = new Map(
        [...elements.analysisStepper.children].map(item => [
          item.dataset.stepId,
          item
        ])
      );

      for (const [index, step] of nextSteps.entries()) {
        const stepId = String(step.id || 'step-' + (index + 1));
        let item = existingItems.get(stepId);
        if (!item) {
          item = document.createElement('li');
          item.dataset.stepId = stepId;

          const icon = document.createElement('span');
          icon.className = 'analysis-step-icon';
          icon.setAttribute('aria-hidden', 'true');

          const label = document.createElement('span');
          label.className = 'analysis-step-label';
          item.append(icon, label);
        }

        const status = step.status || 'pending';
        const nextClassName = 'analysis-step analysis-step--' + status;
        if (item.className !== nextClassName) {
          item.className = nextClassName;
        }
        renderAnalysisStepStatusIcon(
          item.querySelector('.analysis-step-icon'),
          status
        );

        const nextTitle = step.message || step.name || '';
        if (item.title !== nextTitle) {
          item.title = nextTitle;
        }

        const label = item.querySelector('.analysis-step-label');
        const nextLabel = step.name || '';
        if (label && label.textContent !== nextLabel) {
          label.textContent = nextLabel;
        }

        const itemAtIndex = elements.analysisStepper.children[index];
        if (itemAtIndex !== item) {
          elements.analysisStepper.insertBefore(item, itemAtIndex || null);
        }
        existingItems.delete(stepId);
      }

      for (const obsoleteItem of existingItems.values()) {
        obsoleteItem.remove();
      }
    }

    enablePipelineDrag(elements.pipelineStepsEditor, syncConfigurationPipelineFields);
    enablePipelineDrag(elements.analysisRunSteps, () => undefined);
`;
