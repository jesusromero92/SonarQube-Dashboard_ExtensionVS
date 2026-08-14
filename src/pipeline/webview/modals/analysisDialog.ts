export const ANALYSIS_DIALOG_MARKUP = `  <dialog id="analysisDialog" class="rule-dialog wide-dialog analysis-dialog">
    <div class="rule-dialog-header">
      <div>
        <h2>Análisis del repositorio</h2>
        <span id="analysisDialogScanner" class="muted"></span>
      </div>
      <button id="analysisDialogClose" class="rule-dialog-close secondary" type="button" aria-label="Cerrar">×</button>
    </div>
    <ol id="analysisStepper" class="analysis-stepper" aria-label="Progreso del pipeline"></ol>
    <div class="analysis-dialog-status">
      <div id="analysisDialogIndicator" class="analysis-status-indicator idle" aria-hidden="true"></div>
      <div>
        <strong id="analysisDialogMessage">Listo para analizar.</strong>
        <div id="analysisDialogTime" class="muted"></div>
      </div>
    </div>
    <div class="analysis-log-wrap">
      <pre id="analysisLog" class="analysis-log">Todavía no se ha ejecutado ningún análisis.</pre>
    </div>
    <div class="dialog-actions">
      <button id="analysisDialogCancel" class="secondary" type="button" hidden>Cancelar análisis</button>
      <button id="analysisDialogFooterClose" type="button">Cerrar</button>
    </div>
  </dialog>
`;
