import { getSelectDropdownMarkup } from '../../../shared/webview/ui/selectDropdown';
import type { ModuleWebviewContribution } from '../../../modules';
import { getModulesConfigurationPanelMarkup } from '../../../modules/webview';

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' }
] as const;

const EMPTY_FOLDER_OPTIONS = [
  { value: '', label: 'No hay carpetas disponibles' }
] as const;

const DISCONNECTED_PROJECT_OPTIONS = [
  { value: '', label: 'Introduce servidor y token para cargar la lista' }
] as const;

function configurationDropdown(
  id: string,
  ariaLabel: string,
  options: readonly { label: string; value: string }[],
  selectedValue?: string,
  disabled = false
): string {
  return getSelectDropdownMarkup({
    ariaLabel,
    className: 'select-dropdown--fluid configuration-select',
    disabled,
    id,
    options,
    selectedValue
  });
}

export function getConfigurationPageMarkup(
  modules: ModuleWebviewContribution,
  visible = false,
  selectedTab = 'configurationSonarPanel'
): string {
const modulesSelected = selectedTab === 'configurationModulesPanel';
return `      <section id="configurationPage" class="page"${visible ? '' : ' hidden'}>
        <section class="panel">
          <div class="panel-header">
            <h2>Configuración</h2>
            <span class="muted">La configuración se guarda por carpeta del workspace</span>
          </div>

          <div id="emptyWorkspace" class="panel-body" hidden>
            <strong>No hay ninguna carpeta abierta.</strong>
            <p class="muted">Abre el proyecto local que corresponde al proyecto de SonarQube.</p>
          </div>

          <div id="configurationContent">
            <div class="panel-body configuration-panel-body">
              <nav class="configuration-tabs" role="tablist" aria-label="Secciones de configuración">
                <button id="configurationSonarTab"${modulesSelected ? '' : ' class="active"'} type="button" role="tab" aria-selected="${modulesSelected ? 'false' : 'true'}" aria-controls="configurationSonarPanel" tabindex="${modulesSelected ? '-1' : '0'}">SonarQube</button>
                <button id="configurationModulesTab"${modulesSelected ? ' class="active"' : ''} type="button" role="tab" aria-selected="${modulesSelected ? 'true' : 'false'}" aria-controls="configurationModulesPanel" tabindex="${modulesSelected ? '0' : '-1'}">Módulos</button>
${modules.configurationTab ?? ''}
                <button id="configurationNotificationsTab" type="button" role="tab" aria-selected="false" aria-controls="configurationNotificationsPanel" tabindex="-1">Notificaciones</button>
              </nav>

              <section id="configurationSonarPanel" class="configuration-tab-panel" role="tabpanel" aria-labelledby="configurationSonarTab"${modulesSelected ? ' hidden' : ''}>
                <details class="configuration-disclosure" open>
                  <summary>Conexión con SonarQube</summary>
                  <div class="configuration-disclosure-content">
              <div class="form-grid language-row">
                <div class="field">
                  <label for="language">Idioma</label>
${configurationDropdown('language', 'Idioma', LANGUAGE_OPTIONS, 'en')}
                  <div class="hint">Cambia inmediatamente el idioma del dashboard y los mensajes de la extensión.</div>
                </div>
              </div>

              <div id="folderField" class="workspace-row" hidden>
                <label for="folder">Carpeta del workspace</label>
${configurationDropdown('folder', 'Carpeta del workspace', EMPTY_FOLDER_OPTIONS, '', true)}
              </div>

              <div class="form-grid connection-row">
                <div class="field">
                  <label for="serverUrl"><span class="required">*</span> Servidor SonarQube</label>
                  <input id="serverUrl" type="url" placeholder="https://sonarqube.example.com" spellcheck="false">
                </div>
                <div class="field">
                  <label for="token"><span class="required">*</span> Token</label>
                  <input id="token" type="password" placeholder="Introduce el token" autocomplete="off">
                  <div id="tokenHint" class="hint">El token se guarda de forma segura para esta carpeta.</div>
                </div>
                <div class="field action-field">
                  <label aria-hidden="true">&nbsp;</label>
                  <button id="loadProjects" type="button">Conectar</button>
                </div>
              </div>

              <div id="connectionStatus" class="connection-status" role="status" aria-live="polite" hidden></div>

              <div id="sonarCompatibility" class="compatibility-summary" hidden>
                <span class="compatibility-title">Compatibilidad de la API</span>
                <span class="compatibility-item">
                  Versión detectada:
                  <strong id="sonarVersion">—</strong>
                </span>
                <span class="compatibility-item">
                  Perfil aplicado:
                  <code id="sonarProfile">—</code>
                </span>
                <span id="sonarProfileProvisional" class="compatibility-badge" hidden>Provisional</span>
                <span id="sonarProfileFallback" class="compatibility-badge fallback-badge" hidden>Fallback activo</span>
                <span id="sonarCompatibilityHint" class="muted"></span>
              </div>

              <div class="form-grid project-row">
                <div class="field">
                  <label for="projectKey"><span class="required">*</span> Proyecto o aplicación visible</label>
${configurationDropdown('projectKey', 'Proyecto o aplicación visible', DISCONNECTED_PROJECT_OPTIONS, '', true)}
                  <div class="hint">El desplegable incluye únicamente los componentes visibles para el token.</div>
                </div>
                <div class="field action-field">
                  <label aria-hidden="true">&nbsp;</label>
                  <button id="save" type="button" disabled>Sincronizar</button>
                </div>
              </div>

                  </div>
                </details>

              <details class="configuration-disclosure">
                <summary>Configuración avanzada del proyecto</summary>
                <div class="form-grid advanced-grid">
                  <div class="field">
                    <label for="branch">Rama</label>
                    <input id="branch" type="text" placeholder="main" spellcheck="false">
                    <div class="hint">Déjala vacía para consultar la rama principal.</div>
                  </div>
                  <div class="field">
                    <label for="baseDir">Subcarpeta local</label>
                    <input id="baseDir" type="text" placeholder="packages/backend" spellcheck="false">
                    <div class="hint">Ruta local base usada para resolver archivos del proyecto.</div>
                  </div>
                </div>
              </details>

              </section>

${getModulesConfigurationPanelMarkup(modules, modulesSelected)}

${modules.configurationPanel ?? ''}

              <section id="configurationNotificationsPanel" class="configuration-tab-panel" role="tabpanel" aria-labelledby="configurationNotificationsTab" hidden>
              <details class="configuration-disclosure" open>
                <summary>Notificaciones automáticas</summary>
                <div class="form-grid advanced-grid notification-settings">
                  <div class="field full-width-field checkbox-field">
                    <label>
                      <input id="notificationsEnabled" type="checkbox" checked>
                      Avisar de regresiones y análisis completados
                    </label>
                  </div>
                  <div class="field">
                    <label for="significantIncreasePercent">Porcentaje de aumento significativo</label>
                    <input id="significantIncreasePercent" type="number" min="1" max="1000" value="20">
                  </div>
                  <div class="field">
                    <label for="significantIncreaseMinimum">Mínimo de nuevos defectos para avisar</label>
                    <input id="significantIncreaseMinimum" type="number" min="1" value="5">
                  </div>
                </div>
              </details>
              </section>
            </div>

            <div class="form-footer">
              <button id="refresh" class="secondary" type="button">Actualizar issues</button>
              <button id="clear" class="secondary" type="button">Limpiar Problems</button>
              <div class="spacer"></div>
              <span id="configState" class="muted">Sin configurar</span>
            </div>
          </div>
        </section>
      </section>`;
}

/** Core-only markup retained for consumers that do not install module contributions. */
export const CONFIGURATION_PAGE_MARKUP = getConfigurationPageMarkup({});
