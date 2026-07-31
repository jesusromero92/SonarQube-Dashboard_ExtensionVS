import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  getRuntimeLocalizationScript,
  getWebviewLocalizationBundle
} from '../src/i18n/runtimeWebview';
import { MESSAGE_EVENTS_SCRIPT } from '../src/dashboard/webview/scripts/events/messages';
import { getDashboardScript } from '../src/dashboard/webview/scripts';

test('el cambio de idioma se aplica en el DOM sin reconstruir el webview', () => {
  const panelSource = readFileSync(
    'src/dashboardPanel.ts',
    'utf8'
  );
  const languageBlock = panelSource.match(
    /private async changeLanguage[\s\S]*?getLanguage\(\): DashboardLanguage/
  )?.[0] ?? '';

  assert.match(languageBlock, /postLanguageChanged\(\)/);
  assert.doesNotMatch(languageBlock, /webview\.html\s*=/);
  assert.match(MESSAGE_EVENTS_SCRIPT, /case 'languageChanged'/);
  assert.match(
    MESSAGE_EVENTS_SCRIPT,
    /applyDashboardLocalization\(message\.localization\)/
  );
});

test('el localizador mantiene ambos idiomas y observa contenido dinámico', () => {
  const english = getWebviewLocalizationBundle('en');
  const spanish = getWebviewLocalizationBundle('es');
  const englishTranslations = new Map(english.translations);
  const spanishTranslations = new Map(spanish.translations);

  assert.equal(englishTranslations.get('Configuración'), 'Configuration');
  assert.equal(spanishTranslations.get('Configuration'), 'Configuración');
  assert.equal(english.locale, 'en-US');
  assert.equal(spanish.locale, 'es-ES');

  const runtime = getRuntimeLocalizationScript(english);
  assert.match(runtime, /MutationObserver/);
  assert.match(runtime, /document\.documentElement\.lang/);
  assert.match(runtime, /translateLocalizationTree\(document\.documentElement\)/);
  assert.match(runtime, /dashboardMessages = bundle\.messages/);
});

test('el panel lateral actualiza idioma y estado sin recargar su HTML', () => {
  const providerSource = readFileSync(
    'src/dashboardLauncherViewProvider.ts',
    'utf8'
  );

  assert.match(providerSource, /onDidChangeLanguage\(\(\) => \{/);
  assert.match(providerSource, /this\.postLanguage\(\)/);
  assert.match(providerSource, /this\.postState\(\)/);
  assert.doesNotMatch(providerSource, /reloadWebview/);
});


test('el JavaScript completo del dashboard mantiene una sintaxis válida', () => {
  assert.doesNotThrow(() => new Function(getDashboardScript('en')));
  assert.doesNotThrow(() => new Function(getDashboardScript('es')));
});

test('los textos dinámicos del pipeline están disponibles en ambos idiomas', () => {
  const english = new Map(getWebviewLocalizationBundle('en').translations);
  const spanish = new Map(getWebviewLocalizationBundle('es').translations);

  assert.equal(english.get('Scanner configurado'), 'Configured scanner');
  assert.equal(english.get('Paso previo '), 'Pre-analysis step ');
  assert.equal(english.get('Paso posterior '), 'Post-analysis step ');
  assert.equal(spanish.get('Configured scanner'), 'Scanner configurado');
  assert.equal(spanish.get('Pre-analysis step '), 'Paso previo ');
  assert.equal(spanish.get('Post-analysis step '), 'Paso posterior ');
  assert.equal(english.get('Selecciona un paso'), 'Select a step');
  assert.equal(spanish.get('Select a step'), 'Selecciona un paso');
});
