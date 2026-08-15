export const LIVE_REMEDIATION_CONFIGURATION_TAB_MARKUP = `                <button id="configurationLiveRemediationTab" data-module-tab="liveRemediation" type="button" role="tab" aria-selected="false" aria-controls="configurationLiveRemediationPanel" tabindex="-1" hidden>Live Remediation</button>`;

export const LIVE_REMEDIATION_CONFIGURATION_PANEL_MARKUP = `              <section id="configurationLiveRemediationPanel" class="configuration-tab-panel" role="tabpanel" aria-labelledby="configurationLiveRemediationTab" hidden>
                <details class="configuration-disclosure" open>
                  <summary>Integración con el editor</summary>
                  <div class="configuration-disclosure-content">
                    <div class="configuration-section-intro">
                      <strong>Remediación en vivo</strong>
                      <p class="hint">Mantén el estado local de los defectos sincronizado mientras editas el código, sin marcar como corregido en SonarQube nada que el servidor todavía no haya confirmado.</p>
                    </div>
                    <div class="form-grid advanced-grid">
                      <div id="sonarIdeStatus" class="live-remediation-analyzer-status live-remediation-analyzer-status--missing" role="status" aria-live="polite">
                        <span id="sonarIdeStatusIcon" class="live-remediation-analyzer-icon" aria-hidden="true">—</span>
                        <div class="live-remediation-analyzer-copy">
                          <strong id="sonarIdeStatusTitle">SonarQube for IDE no detectado</strong>
                          <div id="sonarIdeStatusHint" class="hint">No es obligatorio. Los defectos modificados permanecerán pendientes de validación hasta el siguiente análisis del repositorio.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              </section>`;
