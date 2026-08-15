import {
  PIPELINE_CONFIGURATION_PANEL_MARKUP,
  PIPELINE_CONFIGURATION_TAB_MARKUP
} from './pipeline/webview/configuration';

import { ANALYSIS_DIALOG_MARKUP } from './pipeline/webview/modals/analysisDialog';
import { ANALYSIS_CONFIRMATION_DIALOG_MARKUP } from './pipeline/webview/modals/analysisConfirmationDialog';
import { PIPELINE_EDITOR_SCRIPT } from './pipeline/webview/editor';

import { PIPELINE_INTEGRATION_SCRIPT } from './pipeline/webview/integration';
import { ANALYSIS_SCRIPT } from './pipeline/webview/analysis';
import { HISTORY_SCRIPT } from './pipeline/webview/history';
import { BASELINE_SCRIPT } from './pipeline/webview/baseline';
import { PIPELINE_STYLES } from './pipeline/webview/styles';
import { PIPELINE_HISTORY_STYLES } from './pipeline/webview/historyStyles';
import { LIVE_REMEDIATION_STYLES } from './liveRemediation/webview/styles';
import {
  LIVE_REMEDIATION_CONFIGURATION_PANEL_MARKUP,
  LIVE_REMEDIATION_CONFIGURATION_TAB_MARKUP
} from './liveRemediation/webview/configuration';
import { LIVE_REMEDIATION_INTEGRATION_SCRIPT } from './liveRemediation/webview/integration';

export const MODULE_CONFIGURATION_TABS_MARKUP = [
  PIPELINE_CONFIGURATION_TAB_MARKUP,
  LIVE_REMEDIATION_CONFIGURATION_TAB_MARKUP
].join('\n');

export const MODULE_CONFIGURATION_PANELS_MARKUP = [
  PIPELINE_CONFIGURATION_PANEL_MARKUP,
  LIVE_REMEDIATION_CONFIGURATION_PANEL_MARKUP
].join('\n');

export const MODULES_CONFIGURATION_PANEL_MARKUP = `              <section id="configurationModulesPanel" class="configuration-tab-panel" role="tabpanel" aria-labelledby="configurationModulesTab" hidden>
                <details class="configuration-disclosure" open>
                  <summary>Módulos</summary>
                  <div class="configuration-disclosure-content">
                    <div class="configuration-section-intro">
                      <strong>Activa solo las funciones que necesitas</strong>
                      <p class="hint">Cada módulo carga su runtime, comandos, vistas y configuración de forma independiente. Desactivarlo no borra su estado persistido.</p>
                    </div>
                    <div class="form-grid advanced-grid module-settings-grid">
                      <div class="field full-width-field checkbox-field module-setting">
                        <label><input id="pipelineModuleEnabled" data-module-toggle="pipeline" type="checkbox" checked> Pipeline</label>
                        <div class="hint">Scanner, análisis, pasos, plantillas, integraciones, historial y comparación antes/después.</div>
                      </div>
                      <div class="field full-width-field checkbox-field module-setting">
                        <label><input id="liveRemediationModuleEnabled" data-module-toggle="liveRemediation" type="checkbox" checked> Live Remediation</label>
                        <div class="hint">Seguimiento local, baseline, diff/revert, sesión persistente y validación contra nuevos análisis del servidor.</div>
                      </div>
                    </div>
                  </div>
                </details>
              </section>`;


export const MODULE_MODALS_MARKUP = `${ANALYSIS_DIALOG_MARKUP}\n${ANALYSIS_CONFIRMATION_DIALOG_MARKUP}`;
export const MODULE_SCRIPTS = `${PIPELINE_EDITOR_SCRIPT}\n${ANALYSIS_SCRIPT}\n${HISTORY_SCRIPT}\n${BASELINE_SCRIPT}\n${PIPELINE_INTEGRATION_SCRIPT}\n${LIVE_REMEDIATION_INTEGRATION_SCRIPT}`;
export const MODULE_STYLES = `${PIPELINE_STYLES}\n${PIPELINE_HISTORY_STYLES}\n${LIVE_REMEDIATION_STYLES}`;




export {HISTORY_PAGE_MARKUP as MODULE_PAGES_MARKUP} from './pipeline/webview/pages/historyPage';
export {ANALYSIS_CONTROL_MARKUP as MODULE_DATA_CONTROLS_MARKUP, PIPELINE_EMPTY_ACTION_MARKUP as MODULE_EMPTY_ACTIONS_MARKUP} from './pipeline/webview/components/analysisControl';