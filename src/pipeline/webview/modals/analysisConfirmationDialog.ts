import { getSelectDropdownMarkup } from '../../../dashboard/webview/components/ui/selectDropdown';

const TEMPLATE_OPTIONS = [
  { value: '', label: 'Sin plantilla' }
] as const;

export const ANALYSIS_CONFIRMATION_DIALOG_MARKUP = `  <dialog id="analysisConfirmationDialog" class="rule-dialog confirmation-dialog pipeline-confirmation-dialog">
    <div class="rule-dialog-header">
      <div>
        <h2>Confirmar análisis del repositorio</h2>
        <span class="muted">Configura la ejecución y revisa el alcance antes de analizar.</span>
      </div>
      <button id="analysisConfirmationClose" class="rule-dialog-close secondary" type="button" aria-label="Cerrar">×</button>
    </div>
    <ol class="analysis-confirmation-stepper" aria-label="Pasos para iniciar el análisis">
      <li id="analysisConfirmationTemplateStepIndicator" class="analysis-confirmation-stepper-item is-active" aria-current="step">
        <span class="analysis-confirmation-stepper-number">1</span>
        <span>Seleccionar plantilla</span>
      </li>
      <li id="analysisConfirmationReviewStepIndicator" class="analysis-confirmation-stepper-item">
        <span class="analysis-confirmation-stepper-number">2</span>
        <span>Confirmación</span>
      </li>
    </ol>
    <div class="rule-dialog-body confirmation-dialog-body">
      <section id="analysisConfirmationTemplateStep" class="analysis-confirmation-wizard-step">
        <p class="confirmation-warning">El análisis puede ejecutar compilaciones, tests, herramientas de seguridad y otros comandos dentro de la carpeta abierta.</p>
        <div class="analysis-template-toolbar">
          <div class="analysis-template-field">
            <label for="analysisPipelineTemplate">Plantilla para esta ejecución</label>
${getSelectDropdownMarkup({
  ariaLabel: 'Plantilla para esta ejecución',
  className: 'select-dropdown--fluid',
  id: 'analysisPipelineTemplate',
  options: TEMPLATE_OPTIONS,
  selectedValue: ''
})}
          </div>
        </div>
        <div class="analysis-run-heading">
          <div>
            <strong>Pasos de esta ejecución</strong>
            <div class="muted">Añade solo los pasos que quieras ejecutar y arrástralos para cambiar el orden.</div>
          </div>
          <button id="analysisAddStep" class="secondary" type="button">+ Añadir paso</button>
        </div>
        <div id="analysisRunSteps" class="pipeline-step-list analysis-run-steps" aria-label="Pasos del análisis"></div>
        <p class="muted confirmation-note">El paso de SonarQube es obligatorio. El token no se mostrará en el registro.</p>
      </section>

      <section id="analysisConfirmationReviewStep" class="analysis-confirmation-wizard-step" hidden>
        <p class="confirmation-warning">Revisa la plantilla, la carpeta y el alcance efectivo que se enviará al scanner antes de continuar.</p>
        <dl class="confirmation-details analysis-confirmation-review-details">
          <div><dt>Proyecto</dt><dd id="analysisConfirmationProject">—</dd></div>
          <div><dt>Carpeta a analizar</dt><dd id="analysisConfirmationFolder">—</dd></div>
          <div><dt>Rama</dt><dd id="analysisConfirmationBranch">—</dd></div>
          <div><dt>Método</dt><dd id="analysisConfirmationScanner">—</dd></div>
          <div><dt>Plantilla</dt><dd id="analysisConfirmationTemplate">—</dd></div>
          <div><dt>Inclusiones</dt><dd id="analysisConfirmationInclusions" class="analysis-confirmation-scope-value">—</dd></div>
          <div><dt>Exclusiones</dt><dd id="analysisConfirmationExclusions" class="analysis-confirmation-scope-value">—</dd></div>
        </dl>
        <section class="analysis-confirmation-steps-review">
          <div>
            <strong>Pasos que se ejecutarán</strong>
            <span id="analysisConfirmationStepCount" class="muted"></span>
          </div>
          <ol id="analysisConfirmationStepsSummary"></ol>
        </section>
      </section>
    </div>
    <div class="dialog-actions analysis-confirmation-actions">
      <button id="analysisConfirmationCancel" class="secondary" type="button">Cancelar</button>
      <span class="analysis-confirmation-actions-spacer"></span>
      <button id="analysisConfirmationBack" class="secondary" type="button" hidden>Anterior</button>
      <button id="analysisConfirmationNext" type="button">Siguiente</button>
      <button id="analysisConfirmationConfirm" type="button" hidden>Analizar</button>
    </div>
  </dialog>
`;
