import assert from 'node:assert/strict';
import test from 'node:test';
import { CONFIGURATION_PAGE_MARKUP } from '../src/dashboard/webview/pages/configurationPage';
import { ANALYSIS_CONFIRMATION_DIALOG_MARKUP } from '../src/dashboard/webview/modals/analysisConfirmationDialog';
import { CREATE_COMPONENT_DIALOG_MARKUP } from '../src/dashboard/webview/modals/createComponentDialog';
import { ANALYSIS_STYLES } from '../src/dashboard/webview/styles/analysis';
import { DISCLOSURE_STYLES } from '../src/dashboard/webview/design/components/disclosure';
import { CONFIGURATION_CORE_SCRIPT } from '../src/dashboard/webview/scripts/core/configuration';
import { ELEMENT_REGISTRY_SCRIPT } from '../src/dashboard/webview/scripts/core/elements';
import { CONFIGURATION_EVENTS_SCRIPT } from '../src/dashboard/webview/scripts/events/configuration';
import { MESSAGE_EVENTS_SCRIPT } from '../src/dashboard/webview/scripts/events/messages';
import { SELECT_DROPDOWN_SCRIPT } from '../src/dashboard/webview/scripts/ui/selectDropdown';
import { EN_MESSAGES } from '../src/i18n/en';
import { ES_MESSAGES } from '../src/i18n/es';
import { SOURCE_MESSAGES } from '../src/i18n/source';

test('la configuración se divide en pestañas accesibles por categoría', () => {
  for (const id of [
    'configurationSonarTab',
    'configurationPipelineTab',
    'configurationNotificationsTab',
    'configurationSonarPanel',
    'configurationPipelinePanel',
    'configurationNotificationsPanel'
  ]) {
    assert.match(CONFIGURATION_PAGE_MARKUP, new RegExp(`id="${id}"`));
    assert.match(ELEMENT_REGISTRY_SCRIPT, new RegExp(`"${id}"`));
  }

  assert.match(CONFIGURATION_PAGE_MARKUP, /class="configuration-tabs" role="tablist"/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="configurationSonarTab"[\s\S]*aria-selected="true"/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="configurationPipelinePanel"[\s\S]*hidden/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="configurationNotificationsPanel"[\s\S]*hidden/);
  assert.ok(
    CONFIGURATION_PAGE_MARKUP.indexOf('id="serverUrl"') <
      CONFIGURATION_PAGE_MARKUP.indexOf('id="configurationPipelinePanel"')
  );
  assert.ok(
    CONFIGURATION_PAGE_MARKUP.indexOf('id="scannerMode"') <
      CONFIGURATION_PAGE_MARKUP.indexOf('id="configurationPipelinePanel"')
  );
  assert.ok(
    CONFIGURATION_PAGE_MARKUP.indexOf('id="buildCommand"') <
      CONFIGURATION_PAGE_MARKUP.indexOf('id="configurationNotificationsPanel"')
  );
  assert.match(CONFIGURATION_EVENTS_SCRIPT, /function activateConfigurationTab/);
  assert.match(CONFIGURATION_EVENTS_SCRIPT, /ArrowRight/);
  assert.match(CONFIGURATION_EVENTS_SCRIPT, /ArrowLeft/);
  assert.match(DISCLOSURE_STYLES, /\.configuration-tabs button\.active/);
  assert.match(DISCLOSURE_STYLES, /\.configuration-tab-panel\[hidden\]/);
});

test('las pestañas de configuración están traducidas en español e inglés', () => {
  for (const key of [
    'configurationSections',
    'configurationSonarQubeTab',
    'configurationPipelineTab',
    'configurationNotificationsTab'
  ] as const) {
    assert.ok(SOURCE_MESSAGES[key]);
    assert.ok(EN_MESSAGES[key]);
    assert.ok(ES_MESSAGES[key]);
  }
});

test('la configuración contiene todos los elementos de versión y perfil', () => {
  for (const id of [
    'sonarCompatibility',
    'sonarVersion',
    'sonarProfile',
    'sonarProfileProvisional',
    'sonarProfileFallback',
    'sonarCompatibilityHint'
  ]) {
    assert.match(CONFIGURATION_PAGE_MARKUP, new RegExp(`id="${id}"`));
    assert.match(ELEMENT_REGISTRY_SCRIPT, new RegExp(`"${id}"`));
  }
});

test('el webview actualiza compatibilidad al conectar, guardar y recibir estado', () => {
  assert.match(CONFIGURATION_CORE_SCRIPT, /function renderSonarCompatibility/);
  assert.match(CONFIGURATION_CORE_SCRIPT, /config\.sonarCompatibility/);
  assert.doesNotMatch(CONFIGURATION_EVENTS_SCRIPT, /renderSonarCompatibility\(undefined, true\)/);
  assert.match(
    CONFIGURATION_EVENTS_SCRIPT,
    /elements\.sonarCompatibility\.hidden = true/
  );
  assert.match(MESSAGE_EVENTS_SCRIPT, /case 'sonarCompatibility'/);
  assert.match(MESSAGE_EVENTS_SCRIPT, /case 'sonarCompatibilityError'/);
  assert.match(MESSAGE_EVENTS_SCRIPT, /renderSonarUnavailable\(message\.message\)/);
  assert.match(MESSAGE_EVENTS_SCRIPT, /message\.sonarCompatibility/);
  assert.match(MESSAGE_EVENTS_SCRIPT, /message\.tokenStored/);
  assert.match(
    CONFIGURATION_CORE_SCRIPT,
    /function renderSonarUnavailable[\s\S]*elements\.sonarCompatibility\.hidden = true/
  );
  assert.match(
    CONFIGURATION_CORE_SCRIPT,
    /function renderSonarUnavailable[\s\S]*elements\.sonarProfile\.textContent = '—'/
  );
  assert.match(
    CONFIGURATION_CORE_SCRIPT,
    /function renderSonarUnavailable[\s\S]*elements\.sonarProfileProvisional\.hidden = true/
  );
});

test('editar las credenciales conserva el proyecto vinculado hasta validar la conexión', () => {
  assert.match(CONFIGURATION_EVENTS_SCRIPT, /function markConnectionDraftDirty/);
  assert.match(CONFIGURATION_EVENTS_SCRIPT, /connectionDraftDirty = true/);
  assert.doesNotMatch(CONFIGURATION_EVENTS_SCRIPT, /currentConfig\.hasToken = false/);
  assert.doesNotMatch(CONFIGURATION_EVENTS_SCRIPT, /type: 'connectionDraftChanged'/);
  assert.doesNotMatch(CONFIGURATION_EVENTS_SCRIPT, /renderEmptyState\(\);[\s\S]{0,120}connectionDraftChanged/);
});

test('conectar obliga a seleccionar de nuevo el proyecto antes de sincronizar', () => {
  assert.match(
    CONFIGURATION_EVENTS_SCRIPT,
    /elements\.loadProjects\.addEventListener\('click'/
  );
  assert.match(CONFIGURATION_EVENTS_SCRIPT, /currentConfig\.projectKey = ''/);
  assert.match(CONFIGURATION_EVENTS_SCRIPT, /currentConfig\.projectName = ''/);
  assert.match(CONFIGURATION_EVENTS_SCRIPT, /selectedProjectKey = ''/);
  assert.match(
    CONFIGURATION_EVENTS_SCRIPT,
    /resetProjectOptionsForDisconnectedConnection\(\)/
  );
  assert.match(
    MESSAGE_EVENTS_SCRIPT,
    /setProjectOptions\([\s\S]*message\.projects \|\| \[\],[\s\S]*'',[\s\S]*false,[\s\S]*message\.creationCapabilities[\s\S]*\)/
  );
  assert.match(MESSAGE_EVENTS_SCRIPT, /connectionValidated = true/);
  assert.match(MESSAGE_EVENTS_SCRIPT, /elements\.configState\.textContent = 'Sin configurar'/);
});

test('los textos de compatibilidad están disponibles en inglés y español', () => {
  const keys = [
    'apiCompatibility',
    'detectedVersion',
    'appliedProfile',
    'provisional',
    'activeFallback',
    'detecting',
    'queryingCompatibility',
    'compatibilityUnavailable',
    'fallbackProfileHint',
    'noExactProfile',
    'defaultCompatibilityProfile',
    'parametersVerified',
    'profileFromVersion'
  ] as const;
  const renderedSource = [
    CONFIGURATION_PAGE_MARKUP,
    CONFIGURATION_CORE_SCRIPT
  ].join('\n');

  for (const key of keys) {
    assert.ok(SOURCE_MESSAGES[key]);
    assert.ok(EN_MESSAGES[key]);
    assert.ok(ES_MESSAGES[key]);
    assert.ok(
      renderedSource.includes(SOURCE_MESSAGES[key]),
      `El texto fuente ${key} debe aparecer en el webview`
    );
  }
});


test('sincronizar solo se habilita después de validar la conexión y seleccionar un proyecto', () => {
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="save" type="button" disabled/);
  assert.match(CONFIGURATION_CORE_SCRIPT, /let configurationBusy|configurationBusy/);
  assert.match(CONFIGURATION_CORE_SCRIPT, /function canSynchronizeConfiguration/);
  assert.match(CONFIGURATION_CORE_SCRIPT, /connectionValidated/);
  assert.match(CONFIGURATION_CORE_SCRIPT, /elements\.save\.disabled/);
  assert.match(CONFIGURATION_EVENTS_SCRIPT, /connectionValidated = false/);
  assert.match(MESSAGE_EVENTS_SCRIPT, /connectionValidated = true/);
  assert.match(MESSAGE_EVENTS_SCRIPT, /case 'connectionValidationFailed'[\s\S]*connectionValidated = false/);
});


test('una conexión inválida vacía y deshabilita el selector de proyectos', () => {
  assert.match(
    CONFIGURATION_CORE_SCRIPT,
    /function resetProjectOptionsForDisconnectedConnection/
  );
  assert.match(
    CONFIGURATION_CORE_SCRIPT,
    /elements\.projectKey\.textContent = ''/
  );
  assert.match(
    CONFIGURATION_CORE_SCRIPT,
    /elements\.projectKey\.disabled = true/
  );
  assert.match(
    MESSAGE_EVENTS_SCRIPT,
    /case 'connectionValidationFailed'[\s\S]*resetProjectOptionsForDisconnectedConnection\(\)/
  );
  assert.match(
    MESSAGE_EVENTS_SCRIPT,
    /message\.kind === 'error' && connectionAttemptPending/
  );
  assert.match(
    CONFIGURATION_EVENTS_SCRIPT,
    /connectionAttemptPending = true/
  );
});


test('los errores de conexión se muestran bajo las credenciales y ocultan la compatibilidad', () => {
  assert.match(
    CONFIGURATION_PAGE_MARKUP,
    /id="connectionStatus"[\s\S]*id="sonarCompatibility"/
  );
  assert.match(ELEMENT_REGISTRY_SCRIPT, /"connectionStatus"/);
  assert.match(
    CONFIGURATION_CORE_SCRIPT,
    /function setStatus\(kind, message = ''\)[\s\S]*elements\.connectionStatus\.textContent = message/
  );
  assert.match(
    CONFIGURATION_CORE_SCRIPT,
    /kind === 'error' \? 'alert' : 'status'/
  );
  assert.match(
    MESSAGE_EVENTS_SCRIPT,
    /message\.kind === 'error' && connectionAttemptPending[\s\S]*elements\.sonarCompatibility\.hidden = true/
  );
});

test('los reintentos de conexión no reconstruyen controles ni bloquean acciones ajenas', () => {
  const connectionBusy = CONFIGURATION_CORE_SCRIPT.match(
    /function setConnectionBusy\(busy\) \{[\s\S]*?\n    \}/
  )?.[0] ?? '';
  assert.match(connectionBusy, /elements\.loadProjects\.disabled/);
  assert.doesNotMatch(connectionBusy, /elements\.refresh/);
  assert.doesNotMatch(connectionBusy, /elements\.syncEmpty/);

  assert.match(
    CONFIGURATION_EVENTS_SCRIPT,
    /resetProjectOptionsForDisconnectedConnection\(\);[\s\S]*setConnectionBusy\(true\)/
  );
  assert.doesNotMatch(CONFIGURATION_EVENTS_SCRIPT, /loadingOption/);
  assert.match(
    CONFIGURATION_CORE_SCRIPT,
    /elements\.projectKey\.disabled &&[\s\S]*elements\.projectKey\.options\.length === 1[\s\S]*return/
  );
  assert.doesNotMatch(
    MESSAGE_EVENTS_SCRIPT,
    /message\.kind === 'error' && connectionAttemptPending[\s\S]{0,180}resetProjectOptionsForDisconnectedConnection/
  );
});

test('la configuración reutiliza el componente de desplegable del dashboard', () => {
  for (const id of ['language', 'folder', 'projectKey', 'scannerMode', 'pipelineTemplate']) {
    assert.match(CONFIGURATION_PAGE_MARKUP, new RegExp(`id="${id}"`));
  }
  assert.equal(
    CONFIGURATION_PAGE_MARKUP.match(/data-select-dropdown/g)?.length,
    5
  );
  assert.match(CONFIGURATION_PAGE_MARKUP, /select-dropdown--fluid/);
  assert.match(SELECT_DROPDOWN_SCRIPT, /MutationObserver/);
  assert.match(SELECT_DROPDOWN_SCRIPT, /trigger\.disabled = select\.disabled/);
  assert.match(SELECT_DROPDOWN_SCRIPT, /function createSelectDropdownControl/);
});

test('conserva el borrador de servidor y token al navegar entre páginas', () => {
  assert.match(CONFIGURATION_CORE_SCRIPT, /preserveConnectionDraft/);
  assert.match(CONFIGURATION_CORE_SCRIPT, /draftServerUrl/);
  assert.match(CONFIGURATION_CORE_SCRIPT, /draftToken/);
  assert.match(CONFIGURATION_CORE_SCRIPT, /draftConnectionValidated/);
  assert.match(CONFIGURATION_EVENTS_SCRIPT, /connectionDraftFolderUri = currentFolderUri/);
  assert.match(MESSAGE_EVENTS_SCRIPT, /currentConfig\.serverUrl = elements\.serverUrl\.value\.trim\(\)/);
});


test('los modales de análisis y creación usan una distribución compacta', () => {
  assert.match(
    ANALYSIS_CONFIRMATION_DIALOG_MARKUP,
    /class="confirmation-warning"/
  );
  assert.match(
    ANALYSIS_CONFIRMATION_DIALOG_MARKUP,
    /<dl class="confirmation-details[^"]*">[\s\S]*<div><dt>Proyecto/
  );
  assert.match(CREATE_COMPONENT_DIALOG_MARKUP, /class="create-component-grid"/);
  assert.match(CREATE_COMPONENT_DIALOG_MARKUP, /class="field field--wide"/);
  assert.match(ANALYSIS_STYLES, /\.confirmation-dialog \{/);
  assert.match(
    ANALYSIS_STYLES,
    /\.create-component-grid \{[\s\S]*display: grid;[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/
  );
  assert.match(
    ANALYSIS_STYLES,
    /@media \(max-width: 760px\)[\s\S]*\.create-component-grid \{ grid-template-columns: 1fr; \}/
  );
  assert.match(
    ANALYSIS_STYLES,
    /\.pipeline-step-list \{[\s\S]*display: grid;/
  );
  assert.match(
    ANALYSIS_STYLES,
    /\.analysis-stepper \{[\s\S]*display: flex;/
  );
});

test('las capacidades de creación se restauran al abrir una conexión guardada', () => {
  assert.match(
    CONFIGURATION_CORE_SCRIPT,
    /message\.creationCapabilities/
  );
  assert.match(
    CONFIGURATION_CORE_SCRIPT,
    /restoreProjectOptions\(\)/
  );
  assert.match(
    CONFIGURATION_CORE_SCRIPT,
    /creationCapabilities\.canCreateProjects/
  );
  assert.match(
    CONFIGURATION_CORE_SCRIPT,
    /creationCapabilities\.canCreateApplications/
  );
});


test('el pipeline puede guardarse sin sincronizar la conexión', () => {
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="savePipeline"/);
  assert.match(CONFIGURATION_PAGE_MARKUP, /id="pipelineSaveStatus"/);
  assert.match(ELEMENT_REGISTRY_SCRIPT, /"savePipeline"/);
  assert.match(ELEMENT_REGISTRY_SCRIPT, /"pipelineSaveStatus"/);
  assert.match(
    CONFIGURATION_EVENTS_SCRIPT,
    /elements\.savePipeline\.addEventListener\('click'[\s\S]*type: 'savePipeline'/
  );
  assert.match(MESSAGE_EVENTS_SCRIPT, /case 'pipelineSaved'/);
  assert.match(MESSAGE_EVENTS_SCRIPT, /case 'pipelineSaveError'/);
});
