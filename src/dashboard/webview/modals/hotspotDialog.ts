
export const HOTSPOT_DIALOG_MARKUP = `  <dialog id="hotspotDialog" class="rule-dialog wide-dialog" aria-labelledby="hotspotDialogTitle">
    <div class="rule-dialog-header">
      <h2 id="hotspotDialogTitle">Security Hotspot</h2>
      <button id="hotspotDialogClose" class="rule-dialog-close secondary" type="button" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-scroll-body">
      <div id="hotspotDialogLoading" class="dialog-section">Cargando detalle…</div>
      <div id="hotspotDialogContent" hidden>
        <div class="dialog-section">
          <div id="hotspotDialogMeta" class="dialog-meta"></div>
        </div>
        <div class="dialog-section">
          <h3>Descripción</h3>
          <p id="hotspotDialogMessage"></p>
        </div>
        <div class="dialog-section">
          <h3>¿Cuál es el riesgo?</h3>
          <p id="hotspotRisk"></p>
        </div>
        <div class="dialog-section">
          <h3>Vulnerabilidad</h3>
          <p id="hotspotVulnerability"></p>
        </div>
        <div class="dialog-section">
          <h3>Recomendaciones</h3>
          <p id="hotspotRecommendations"></p>
        </div>
      </div>
    </div>
    <div class="dialog-actions">
      <button id="openHotspotFile" class="secondary" type="button">Abrir archivo</button>
      <button id="closeHotspotDialog" type="button">Cerrar</button>
    </div>
  </dialog>

  `;
