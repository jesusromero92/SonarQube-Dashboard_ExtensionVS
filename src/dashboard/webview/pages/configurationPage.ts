import { SCANNER_MODES } from '../../../constants';
import { getSelectDropdownMarkup } from '../components/ui/selectDropdown';

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

export const CONFIGURATION_PAGE_MARKUP = `      <section id="configurationPage" class="page" hidden>
        <section class="panel">
          <div class="panel-header">
            <h2>Conexión con SonarQube</h2>
            <span class="muted">La configuración se guarda por carpeta del workspace</span>
          </div>

          <div id="emptyWorkspace" class="panel-body" hidden>
            <strong>No hay ninguna carpeta abierta.</strong>
            <p class="muted">Abre el proyecto local que corresponde al proyecto de SonarQube.</p>
          </div>

          <div id="configurationContent">
            <div class="panel-body">
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

              <details class="configuration-disclosure">
                <summary>Configuración avanzada del proyecto y del scanner</summary>
                <div class="form-grid advanced-grid">
                  <div class="field">
                    <label for="branch">Rama</label>
                    <input id="branch" type="text" placeholder="main" spellcheck="false">
                    <div class="hint">Déjala vacía para consultar y analizar la rama principal.</div>
                  </div>
                  <div class="field">
                    <label for="baseDir">Subcarpeta local</label>
                    <input id="baseDir" type="text" placeholder="packages/backend" spellcheck="false">
                    <div class="hint">La detección y el análisis se ejecutarán desde esta subcarpeta.</div>
                  </div>
                  <div class="field">
                    <label for="scannerMode">Método de análisis</label>
${configurationDropdown('scannerMode', 'Método de análisis', SCANNER_MODES, 'auto')}
                    <div class="hint">Automático detecta Maven, Gradle y .NET; usa NPM si existe package.json o Docker para proyectos genéricos como Python.</div>
                  </div>
                  <div id="customScannerField" class="field full-width-field" hidden>
                    <label for="customScannerCommand">Comando personalizado</label>
                    <input id="customScannerCommand" type="text" placeholder="sonar-scanner -Dsonar.projectKey=\${projectKey}" spellcheck="false">
                    <div class="hint">Variables disponibles: <code>\${workspaceFolder}</code>, <code>\${projectKey}</code>, <code>\${projectName}</code>, <code>\${serverUrl}</code> y <code>\${branch}</code>. El token se entrega mediante <code>SONAR_TOKEN</code>.</div>
                  </div>
                </div>
              </details>

              <details class="configuration-disclosure">
                <summary>Pipeline de análisis</summary>
                <div class="form-grid advanced-grid">
                  <div class="field">
                    <label for="buildCommand">Comando de compilación</label>
                    <input id="buildCommand" type="text" placeholder="npm run build" spellcheck="false">
                    <div id="detectedBuildCommandHint" class="hint">Se detecta automáticamente según el proyecto. Déjalo vacío para usar el comando detectado.</div>
                  </div>
                  <div class="field">
                    <label for="testCommand">Comando de tests</label>
                    <input id="testCommand" type="text" placeholder="npm test" spellcheck="false">
                    <div id="detectedTestCommandHint" class="hint">Se detecta automáticamente según el proyecto. Déjalo vacío para usar el comando detectado.</div>
                  </div>
                  <div class="field full-width-field">
                    <div class="pipeline-editor-heading">
                      <div>
                        <label>Pasos personalizados</label>
                        <div class="hint">Arrastra los pasos para cambiar su orden y elige qué ocurre si fallan.</div>
                      </div>
                      <button id="addPipelineStep" class="secondary" type="button">+ Añadir paso</button>
                    </div>
                    <div id="pipelineStepsEditor" class="pipeline-step-list" aria-label="Pasos configurados del pipeline"></div>
                    <textarea id="preAnalysisCommands" hidden aria-hidden="true"></textarea>
                    <textarea id="postAnalysisCommands" hidden aria-hidden="true"></textarea>
                    <div class="hint">Variables disponibles: <code>\${workspaceFolder}</code>, <code>\${projectKey}</code>, <code>\${projectName}</code>, <code>\${serverUrl}</code> y <code>\${branch}</code>.</div>
                  </div>
                  <div class="field full-width-field">
                    <div class="detected-integrations-heading">
                      <div>
                        <label>Integraciones predefinidas detectadas</label>
                        <div class="hint">Añade al pipeline herramientas compatibles detectadas en el proyecto.</div>
                      </div>
                    </div>
                    <div id="detectedIntegrations" class="detected-integrations" aria-label="Integraciones predefinidas detectadas"></div>
                  </div>
                </div>
                <div class="pipeline-save-row">
                  <span id="pipelineSaveStatus" class="pipeline-save-status" role="status" aria-live="polite" hidden></span>
                  <button id="savePipeline" type="button">Guardar pipeline</button>
                </div>
              </details>

              <details class="configuration-disclosure">
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
