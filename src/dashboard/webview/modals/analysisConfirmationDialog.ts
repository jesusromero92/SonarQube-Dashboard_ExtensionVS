import { getSelectDropdownMarkup } from '../components/ui/selectDropdown';

const TEMPLATE_OPTIONS = [
  { value: '', label: 'Sin plantilla' }
] as const;

export const ANALYSIS_CONFIRMATION_DIALOG_MARKUP = `  <dialog id="analysisConfirmationDialog" class="rule-dialog confirmation-dialog pipeline-confirmation-dialog">
    <div class="rule-dialog-header">
      <div>
        <h2>Confirmar análisis del repositorio</h2>
        <span class="muted">Ordena y selecciona los pasos de esta ejecución.</span>
      </div>
      <button id="analysisConfirmationClose" class="rule-dialog-close secondary" type="button" aria-label="Cerrar">×</button>
    </div>
    <div class="rule-dialog-body confirmation-dialog-body">
      <p class="confirmation-warning">El análisis puede ejecutar compilaciones, tests, herramientas de seguridad y otros comandos dentro de la carpeta abierta.</p>
      <dl class="confirmation-details">
        <div><dt>Proyecto</dt><dd id="analysisConfirmationProject">—</dd></div>
        <div><dt>Carpeta</dt><dd id="analysisConfirmationFolder">—</dd></div>
        <div><dt>Método</dt><dd id="analysisConfirmationScanner">—</dd></div>
      </dl>
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
        <button id="applyAnalysisPipelineTemplate" class="secondary" type="button" disabled>Aplicar plantilla</button>
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
    </div>
    <div class="dialog-actions">
      <button id="analysisConfirmationCancel" class="secondary" type="button">Cancelar</button>
      <button id="analysisConfirmationConfirm" type="button">Analizar</button>
    </div>
  </dialog>
`;
