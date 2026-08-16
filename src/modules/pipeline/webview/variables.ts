export const PIPELINE_VARIABLES_SCRIPT = `    let pipelineVariablesSaving = false;

    function pipelineVariableNameIsValid(value) {
      return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(value || '').trim());
    }

    function setPipelineVariablesStatus(kind, message = '') {
      if (!elements.pipelineVariablesStatus) return;
      if (!message) {
        elements.pipelineVariablesStatus.hidden = true;
        elements.pipelineVariablesStatus.textContent = '';
        elements.pipelineVariablesStatus.className = 'pipeline-save-status';
        return;
      }
      elements.pipelineVariablesStatus.hidden = false;
      elements.pipelineVariablesStatus.textContent = translateLocalizationValue(message);
      elements.pipelineVariablesStatus.className = 'pipeline-save-status pipeline-save-status--' + kind;
    }

    function readPipelineVariables() {
      return [...elements.pipelineVariablesEditor.querySelectorAll('.pipeline-variable-row')]
        .map(row => ({
          name: row.querySelector('.pipeline-variable-name').value.trim(),
          value: row.querySelector('.pipeline-variable-value').value
        }))
        .filter(item => item.name || item.value);
    }

    function pipelineVariablesAreValid() {
      const variables = readPipelineVariables();
      const names = new Set();
      for (const variable of variables) {
        if (!pipelineVariableNameIsValid(variable.name) || names.has(variable.name)) return false;
        names.add(variable.name);
      }
      return true;
    }

    function updatePipelineVariableSaveAvailability() {
      if (!elements.savePipelineVariables) return;
      elements.savePipelineVariables.disabled = pipelineVariablesSaving || !hasWorkspace || !pipelineVariablesAreValid();
    }

    function createPipelineVariableRow(variable = { name: '', value: '' }) {
      const row = document.createElement('article');
      row.className = 'pipeline-variable-row';

      const name = document.createElement('input');
      name.className = 'pipeline-variable-name';
      name.type = 'text';
      name.value = String(variable.name || '');
      name.placeholder = 'ENVIRONMENT';
      name.spellcheck = false;
      name.setAttribute('aria-label', translateLocalizationValue('Nombre de variable'));

      const value = document.createElement('input');
      value.className = 'pipeline-variable-value';
      value.type = 'text';
      value.value = String(variable.value ?? '');
      value.placeholder = translateLocalizationValue('Valor');
      value.spellcheck = false;
      value.setAttribute('aria-label', translateLocalizationValue('Valor de variable'));

      const syntax = document.createElement('code');
      syntax.className = 'pipeline-variable-syntax';
      const refreshSyntax = () => {
        const variableName = name.value.trim() || 'NOMBRE';
        syntax.textContent = '\${variable.' + variableName + '}';
        row.classList.toggle('is-invalid', Boolean(name.value.trim()) && !pipelineVariableNameIsValid(name.value));
        updatePipelineVariableSaveAvailability();
      };

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'secondary pipeline-variable-remove';
      remove.textContent = '×';
      remove.title = translateLocalizationValue('Eliminar variable');
      remove.addEventListener('click', () => {
        row.remove();
        setPipelineVariablesStatus('idle', '');
        updatePipelineVariableSaveAvailability();
      });

      name.addEventListener('input', refreshSyntax);
      value.addEventListener('input', () => {
        setPipelineVariablesStatus('idle', '');
        updatePipelineVariableSaveAvailability();
      });
      row.append(name, value, syntax, remove);
      refreshSyntax();
      return row;
    }

    function renderPipelineVariables(config = currentConfig) {
      if (!elements.pipelineVariablesEditor) return;
      elements.pipelineVariablesEditor.textContent = '';
      const variables = Array.isArray(config?.pipelineVariables) ? config.pipelineVariables : [];
      for (const variable of variables) {
        elements.pipelineVariablesEditor.appendChild(createPipelineVariableRow(variable));
      }
      elements.pipelineVariablesEditor.classList.toggle('is-empty', variables.length === 0);
      renderPipelineSecrets(config);
      renderPipelineIntegrationVariables(config);
      updatePipelineVariableSaveAvailability();
    }

    function renderPipelineIntegrationVariables(config = currentConfig) {
      if (!elements.pipelineIntegrationVariableList) return;
      elements.pipelineIntegrationVariableList.textContent = '';
      const integrations = Array.isArray(config?.integrationCommandVariables)
        ? config.integrationCommandVariables
        : [];
      if (integrations.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'muted';
        empty.textContent = translateLocalizationValue('No hay comandos de integración disponibles para este proyecto.');
        elements.pipelineIntegrationVariableList.appendChild(empty);
        return;
      }
      for (const integration of integrations) {
        const item = document.createElement('div');
        item.className = 'pipeline-variable-reference-item';
        const label = document.createElement('span');
        label.textContent = String(integration.name || integration.id || 'Integración');
        const token = document.createElement('code');
        token.textContent = String(integration.token || '');
        const command = document.createElement('span');
        command.className = 'muted';
        command.textContent = String(integration.command || '');
        item.append(label, token, command);
        elements.pipelineIntegrationVariableList.appendChild(item);
      }
    }

    function renderPipelineSecrets(config = currentConfig) {
      if (!elements.pipelineSecretsList) return;
      elements.pipelineSecretsList.textContent = '';
      const names = Array.isArray(config?.pipelineSecretNames) ? config.pipelineSecretNames : [];
      if (names.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'hint pipeline-secrets-empty';
        empty.textContent = translateLocalizationValue('No hay secretos configurados para este workspace.');
        elements.pipelineSecretsList.appendChild(empty);
        return;
      }
      for (const name of names) {
        const row = document.createElement('article');
        row.className = 'pipeline-secret-row';
        const copy = document.createElement('div');
        copy.className = 'pipeline-secret-copy';
        const title = document.createElement('strong');
        title.textContent = String(name);
        const syntax = document.createElement('code');
        syntax.textContent = '\${secret.' + String(name) + '}';
        const status = document.createElement('span');
        status.className = 'muted';
        status.textContent = translateLocalizationValue('Guardado en VS Code SecretStorage');
        copy.append(title, syntax, status);

        const actions = document.createElement('div');
        actions.className = 'pipeline-secret-actions';
        const update = document.createElement('button');
        update.type = 'button';
        update.className = 'secondary';
        update.textContent = translateLocalizationValue('Actualizar');
        update.addEventListener('click', () => vscode.postMessage({
          type: 'setPipelineSecret',
          folderUri: elements.folder.value,
          secretName: String(name)
        }));
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'secondary';
        remove.textContent = translateLocalizationValue('Eliminar');
        remove.addEventListener('click', () => vscode.postMessage({
          type: 'deletePipelineSecret',
          folderUri: elements.folder.value,
          secretName: String(name)
        }));
        actions.append(update, remove);
        row.append(copy, actions);
        elements.pipelineSecretsList.appendChild(row);
      }
    }

    function pipelineVariablePreviewValues(config = currentConfig) {
      return config?.pipelineVariableValues && typeof config.pipelineVariableValues === 'object'
        ? config.pipelineVariableValues
        : {};
    }

    function resolvePipelineCommandPreview(command, config = currentConfig) {
      let result = String(command || '');
      const values = pipelineVariablePreviewValues(config);
      for (const [name, value] of Object.entries(values)) {
        if (value !== undefined && value !== null) {
          result = result.split('\${' + name + '}').join(String(value));
        }
      }
      const custom = Object.fromEntries(
        (Array.isArray(config?.pipelineVariables) ? config.pipelineVariables : [])
          .map(item => [String(item?.name || ''), String(item?.value ?? '')])
          .filter(([name]) => name)
      );
      result = result.replace(/\\$\\{variable\\.([A-Za-z_]\\w*)\\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(custom, name) ? custom[name] : match
      );
      const integrations = new Map(
        (Array.isArray(config?.integrationCommandVariables) ? config.integrationCommandVariables : [])
          .map(item => [String(item?.id || ''), String(item?.command || '')])
      );
      result = result.replace(/\\$\\{integration\\.([\\w-]+)\\.command\\}/g, (match, id) =>
        integrations.get(id) || match
      );
      return result.replace(/\\$\\{secret\\.[A-Za-z_]\\w*\\}/g, '********');
    }

    function handlePipelineVariablesMessage(message) {
      switch (message.type) {
        case 'pipelineVariablesUpdated':
          pipelineVariablesSaving = false;
          currentConfig.pipelineVariables = Array.isArray(message.variables) ? message.variables : [];
          currentConfig.pipelineSecretNames = Array.isArray(message.secretNames) ? message.secretNames : currentConfig.pipelineSecretNames || [];
          renderPipelineVariables(currentConfig);
          setPipelineVariablesStatus('success', message.message || 'Variables de Pipeline guardadas.');
          return true;
        case 'pipelineSecretsUpdated':
          currentConfig.pipelineSecretNames = Array.isArray(message.secretNames) ? message.secretNames : [];
          renderPipelineSecrets(currentConfig);
          setPipelineVariablesStatus('success', message.message || 'Secretos de Pipeline actualizados.');
          return true;
        case 'pipelineVariablesError':
          pipelineVariablesSaving = false;
          updatePipelineVariableSaveAvailability();
          setPipelineVariablesStatus('error', message.message || 'No se pudieron actualizar las variables de Pipeline.');
          return true;
        default:
          return false;
      }
    }

    function bindPipelineVariableEvents() {
      elements.addPipelineVariable?.addEventListener('click', () => {
        elements.pipelineVariablesEditor.classList.remove('is-empty');
        const row = createPipelineVariableRow();
        elements.pipelineVariablesEditor.appendChild(row);
        row.querySelector('.pipeline-variable-name')?.focus();
        setPipelineVariablesStatus('idle', '');
        updatePipelineVariableSaveAvailability();
      });
      elements.savePipelineVariables?.addEventListener('click', () => {
        if (!pipelineVariablesAreValid()) {
          setPipelineVariablesStatus('error', 'Revisa los nombres de variables duplicados o no válidos.');
          return;
        }
        pipelineVariablesSaving = true;
        updatePipelineVariableSaveAvailability();
        setPipelineVariablesStatus('loading', 'Guardando variables de Pipeline…');
        vscode.postMessage({
          type: 'savePipelineVariables',
          folderUri: elements.folder.value,
          pipelineVariables: readPipelineVariables()
        });
      });
      elements.addPipelineSecret?.addEventListener('click', () => vscode.postMessage({
        type: 'setPipelineSecret',
        folderUri: elements.folder.value
      }));
    }
`;
