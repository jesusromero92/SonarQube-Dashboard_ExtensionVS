export const ANALYSIS_CONFIRMATION_DIALOG_MARKUP = `  <dialog id="analysisConfirmationDialog" class="rule-dialog confirmation-dialog">
    <div class="rule-dialog-header">
      <div>
        <h2>Confirmar análisis del repositorio</h2>
        <span class="muted">Esta acción puede ejecutar herramientas del proyecto.</span>
      </div>
      <button id="analysisConfirmationClose" class="rule-dialog-close secondary" type="button" aria-label="Cerrar">×</button>
    </div>
    <div class="rule-dialog-body confirmation-dialog-body">
      <p class="confirmation-warning">El análisis puede ejecutar compilaciones, wrappers, scripts de NPM, Docker y scanners dentro de la carpeta abierta.</p>
      <dl class="confirmation-details">
        <div><dt>Proyecto</dt><dd id="analysisConfirmationProject">—</dd></div>
        <div><dt>Carpeta</dt><dd id="analysisConfirmationFolder">—</dd></div>
        <div><dt>Método</dt><dd id="analysisConfirmationScanner">—</dd></div>
      </dl>
      <p class="muted confirmation-note">Revisa la configuración antes de continuar. El token no se mostrará en el registro.</p>
    </div>
    <div class="dialog-actions">
      <button id="analysisConfirmationCancel" class="secondary" type="button">Cancelar</button>
      <button id="analysisConfirmationConfirm" type="button">Analizar</button>
    </div>
  </dialog>
`;
