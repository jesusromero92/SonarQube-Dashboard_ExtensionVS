import { SCANNER_MODES } from '../constants';
import { getSelectDropdownMarkup } from '../../../shared/webview/ui/selectDropdown';

function configurationDropdown(
  id: string,
  ariaLabel: string,
  options: readonly { label: string; value: string }[],
  selectedValue?: string
): string {
  return getSelectDropdownMarkup({
    ariaLabel,
    className: 'select-dropdown--fluid configuration-select',
    id,
    options,
    selectedValue
  });
}

export const PIPELINE_CONFIGURATION_TAB_MARKUP = `                <button id="configurationPipelineTab" data-module-tab="pipeline" type="button" role="tab" aria-selected="false" aria-controls="configurationPipelinePanel" tabindex="-1" hidden>Pipeline</button>
                <button id="configurationIntegrationsTab" data-module-tab="pipeline" type="button" role="tab" aria-selected="false" aria-controls="configurationIntegrationsPanel" tabindex="-1" hidden>Integraciones</button>`;

export const PIPELINE_CONFIGURATION_PANEL_MARKUP = `              <section id="configurationPipelinePanel" class="configuration-tab-panel" role="tabpanel" aria-labelledby="configurationPipelineTab" hidden>
              <details class="configuration-disclosure" open>
                <summary>Scanner y alcance del análisis</summary>
                <div class="configuration-disclosure-content">
                  <div class="form-grid advanced-grid">
                    <div class="field">
                      <label for="scannerMode">Método de análisis</label>
${configurationDropdown('scannerMode', 'Método de análisis', SCANNER_MODES, 'auto')}
                      <div class="hint">Automático detecta Maven, Gradle y .NET; usa NPM si existe package.json o Docker para proyectos genéricos como Python.</div>
                    </div>
                    <div id="customScannerField" class="field full-width-field" hidden>
                      <label for="customScannerCommand">Comando personalizado</label>
                      <input id="customScannerCommand" type="text" placeholder="sonar-scanner -Dsonar.projectKey=\${projectKey}" spellcheck="false">
                      <div class="hint">Variables disponibles: <code>\${workspaceFolder}</code>, <code>\${projectKey}</code>, <code>\${projectName}</code>, <code>\${serverUrl}</code>, <code>\${branch}</code>, <code>\${analysisInclusions}</code>, <code>\${analysisExclusions}</code>. El token se entrega mediante <code>SONAR_TOKEN</code>.</div>
                    </div>
                  </div>
                  <div class="configuration-section-intro">
                    <strong>Inclusiones y exclusiones</strong>
                    <p class="hint">Usa patrones comodín compatibles con SonarQube. Puedes escribir un patrón por línea o separarlos por comas.</p>
                  </div>
                  <div class="form-grid advanced-grid analysis-scope-grid">
                    <div class="field">
                      <label for="analysisInclusions">Inclusiones <code>sonar.inclusions</code></label>
                      <textarea id="analysisInclusions" rows="4" placeholder="src/**&#10;packages/*/src/**" spellcheck="false"></textarea>
                    </div>
                    <div class="field">
                      <label for="analysisExclusions">Exclusiones <code>sonar.exclusions</code></label>
                      <textarea id="analysisExclusions" rows="4" placeholder="**/generated/**&#10;**/*.min.js" spellcheck="false"></textarea>
                    </div>
                  </div>
                  <div class="pipeline-save-row analysis-scope-save-row">
                    <span id="analysisScopeSaveStatus" class="pipeline-save-status" role="status" aria-live="polite" hidden></span>
                    <button id="saveAnalysisScope" type="button" disabled>Guardar inclusiones y exclusiones</button>
                  </div>
                </div>
              </details>
                <details class="configuration-disclosure" open>
                  <summary>Pasos del pipeline</summary>
                  <div class="configuration-disclosure-content">
                    <div class="configuration-section-intro">
                      <strong>Configura los pasos disponibles</strong>
                      <p class="hint">Define los comandos reutilizables del proyecto. Después podrás elegirlos al crear plantillas o iniciar un análisis.</p>
                    </div>

                    <div class="form-grid advanced-grid pipeline-commands-grid">
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
                    </div>

                    <section class="pipeline-subsection" aria-labelledby="customPipelineStepsTitle">
                      <div class="pipeline-editor-heading">
                        <div>
                          <h3 id="customPipelineStepsTitle">Pasos personalizados</h3>
                          <div class="hint">Crea aquí los pasos reutilizables y arrástralos para cambiar su orden.</div>
                        </div>
                        <button id="addPipelineStep" class="secondary" type="button">+ Añadir paso</button>
                      </div>
                      <div id="pipelineStepsEditor" class="pipeline-step-list" aria-label="Pasos configurados del pipeline"></div>
                      <textarea id="preAnalysisCommands" hidden aria-hidden="true"></textarea>
                      <textarea id="postAnalysisCommands" hidden aria-hidden="true"></textarea>
                      <div class="pipeline-steps-footer">
                        <div class="hint pipeline-variables-hint">Variables disponibles: <code>\${workspaceFolder}</code>, <code>\${projectKey}</code>, <code>\${projectName}</code>, <code>\${serverUrl}</code> y <code>\${branch}</code>.</div>
                        <div class="pipeline-save-controls">
                          <span id="pipelineSaveStatus" class="pipeline-save-status" role="status" aria-live="polite" hidden></span>
                          <button id="savePipeline" type="button">Guardar pasos</button>
                        </div>
                      </div>
                    </section>
                  </div>
                </details>

                <details class="configuration-disclosure" open>
                  <summary>Plantillas de pipeline</summary>
                  <div class="configuration-disclosure-content">
                    <div class="configuration-section-intro">
                      <strong>Organiza los pasos de cada plantilla</strong>
                      <p class="hint">Selecciona una plantilla para ver sus pasos. Puedes ordenarlos, añadir otros pasos disponibles o eliminarlos sin modificar la lista de pasos del proyecto.</p>
                    </div>

                    <div class="pipeline-template-manager">
                      <div class="field pipeline-template-selector-field">
                        <label for="pipelineTemplate">Plantilla</label>
${configurationDropdown('pipelineTemplate', 'Plantilla de pipeline', [{ value: '', label: 'Selecciona una plantilla' }], '')}
                        <div id="pipelineTemplateDescription" class="hint">Selecciona una plantilla o crea una nueva.</div>
                      </div>
                      <div class="field pipeline-template-toolbar-field">
                        <label aria-hidden="true">&nbsp;</label>
                        <div class="pipeline-template-toolbar">
                          <button id="newPipelineTemplate" class="secondary" type="button">Nueva plantilla</button>
                          <button id="importPipelineTemplate" class="secondary" type="button">Importar YAML</button>
                        </div>
                      </div>
                    </div>

                    <div id="pipelineTemplateEditor" class="pipeline-template-editor" hidden>
                      <div class="form-grid advanced-grid pipeline-template-metadata">
                        <div class="field">
                          <label for="pipelineTemplateName">Nombre de la plantilla</label>
                          <input id="pipelineTemplateName" type="text" placeholder="Nombre de la plantilla" spellcheck="false">
                        </div>
                        <div class="field">
                          <label for="pipelineTemplateDescriptionInput">Descripción</label>
                          <input id="pipelineTemplateDescriptionInput" type="text" placeholder="Describe cuándo usar esta plantilla" spellcheck="false">
                        </div>
                      </div>

                      <section class="pipeline-subsection pipeline-template-steps-section" aria-labelledby="pipelineTemplateStepsTitle">
                        <div class="pipeline-editor-heading">
                          <div>
                            <h3 id="pipelineTemplateStepsTitle">Pasos de la plantilla</h3>
                            <div class="hint">Los comandos proceden de los pasos configurados arriba. Arrastra para cambiar el orden.</div>
                          </div>
                          <button id="addPipelineTemplateStep" class="secondary" type="button">+ Añadir paso</button>
                        </div>
                        <div id="pipelineTemplateStepsEditor" class="pipeline-step-list pipeline-template-step-list" aria-label="Pasos de la plantilla"></div>
                      </section>

                      <div class="pipeline-template-actions">
                        <span id="pipelineTemplateStatus" class="pipeline-save-status pipeline-template-status" role="status" aria-live="polite" hidden></span>
                        <div class="spacer"></div>
                        <button id="exportPipelineTemplate" class="secondary" type="button">Exportar YAML</button>
                        <button id="deletePipelineTemplate" class="secondary" type="button">Eliminar</button>
                        <button id="savePipelineTemplate" type="button">Guardar plantilla</button>
                      </div>
                    </div>
                  </div>
                </details>
              </section>

              <section id="configurationIntegrationsPanel" class="configuration-tab-panel" role="tabpanel" aria-labelledby="configurationIntegrationsTab" hidden>
                <div class="configuration-section-intro integrations-section-intro">
                  <strong>Integraciones compatibles</strong>
                  <p class="hint">Las herramientas detectadas aparecen como disponibles y pueden añadirse a los pasos reutilizables de Pipeline. Las no detectadas se muestran aparte con una indicación orientativa para habilitar su integración. Esta vista no instala, configura ni ejecuta herramientas automáticamente.</p>
                  <p id="detectedPackageManagerHint" class="hint">No se detectó un gestor de paquetes Node en este proyecto.</p>
                  <span id="integrationStepStatus" class="pipeline-save-status integration-step-status" role="status" aria-live="polite" hidden></span>
                </div>
                <div class="accordion-group integration-availability-groups">
                  <details id="availableIntegrationsDisclosure" class="accordion" open>
                    <summary>Disponibles <span id="availableIntegrationsCount" class="muted"></span></summary>
                    <div class="accordion__content integration-availability-content">
                      <p class="hint">Integraciones detectadas en el proyecto a partir de su configuración, dependencias, scripts o archivos compatibles.</p>
                      <div id="detectedIntegrations" class="detected-integrations" aria-label="Integraciones disponibles"></div>
                    </div>
                  </details>
                  <details id="unavailableIntegrationsDisclosure" class="accordion">
                    <summary>No disponibles <span id="unavailableIntegrationsCount" class="muted"></span></summary>
                    <div class="accordion__content integration-availability-content">
                      <p class="hint">Integraciones compatibles que no se han detectado. Las instrucciones mostradas son orientativas y no se ejecutan automáticamente.</p>
                      <div id="unavailableIntegrations" class="detected-integrations" aria-label="Integraciones no disponibles"></div>
                    </div>
                  </details>
                </div>
              </section>`;
