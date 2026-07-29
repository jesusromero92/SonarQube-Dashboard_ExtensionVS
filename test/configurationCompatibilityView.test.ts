import assert from 'node:assert/strict';
import test from 'node:test';
import { CONFIGURATION_PAGE_MARKUP } from '../src/dashboard/webview/pages/configurationPage';
import { CONFIGURATION_CORE_SCRIPT } from '../src/dashboard/webview/scripts/core/configuration';
import { ELEMENT_REGISTRY_SCRIPT } from '../src/dashboard/webview/scripts/core/elements';
import { CONFIGURATION_EVENTS_SCRIPT } from '../src/dashboard/webview/scripts/events/configuration';
import { MESSAGE_EVENTS_SCRIPT } from '../src/dashboard/webview/scripts/events/messages';
import { EN_MESSAGES } from '../src/i18n/en';
import { ES_MESSAGES } from '../src/i18n/es';
import { SOURCE_MESSAGES } from '../src/i18n/source';

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
  assert.match(CONFIGURATION_EVENTS_SCRIPT, /renderSonarCompatibility\(undefined, true\)/);
  assert.match(MESSAGE_EVENTS_SCRIPT, /case 'sonarCompatibility'/);
  assert.match(MESSAGE_EVENTS_SCRIPT, /message\.sonarCompatibility/);
  assert.match(MESSAGE_EVENTS_SCRIPT, /message\.tokenStored/);
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
    /elements\.projectKey\.disabled = true/
  );
  assert.match(
    MESSAGE_EVENTS_SCRIPT,
    /setProjectOptions\(message\.projects \|\| \[\], '', false\)/
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
