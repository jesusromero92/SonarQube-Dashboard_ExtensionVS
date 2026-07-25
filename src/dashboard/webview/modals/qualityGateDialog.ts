
export const QUALITY_GATE_DIALOG_MARKUP = `  <dialog id="qualityGateDialog" class="rule-dialog wide-dialog" aria-labelledby="qualityGateDialogTitle">
    <div class="rule-dialog-header">
      <h2 id="qualityGateDialogTitle">Detalle del Quality Gate</h2>
      <button id="qualityGateDialogClose" class="rule-dialog-close secondary" type="button" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-scroll-body">
      <div class="dialog-section">
        <div class="dialog-meta">
          <strong>Estado: <span id="qualityGateDialogStatus">NO DISPONIBLE</span></strong>
          <span id="qualityGateConditionCount">0 condiciones</span>
        </div>
      </div>
      <div class="dialog-section">
        <h3>Condiciones</h3>
        <div class="table-wrap">
          <table class="gate-condition-table" aria-label="Condiciones del Quality Gate">
            <thead>
              <tr>
                <th class="condition-metric">Métrica</th>
                <th>Valor actual</th>
                <th>Límite</th>
                <th class="condition-scope">Ámbito</th>
                <th class="condition-status">Estado</th>
              </tr>
            </thead>
            <tbody id="qualityGateConditions"></tbody>
          </table>
          <div id="noQualityGateConditions" class="no-results">No hay condiciones disponibles.</div>
        </div>
      </div>
      <div class="dialog-section">
        <h3>Ratings y Security Hotspots</h3>
        <div id="qualityGateRatings" class="ratings-comparison"></div>
      </div>
    </div>
    <div class="dialog-actions">
      <button id="qualityGateDialogFooterClose" type="button">Cerrar</button>
    </div>
  </dialog>

`;
