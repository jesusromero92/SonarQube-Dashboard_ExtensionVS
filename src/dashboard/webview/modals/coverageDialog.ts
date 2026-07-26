export const COVERAGE_DIALOG_MARKUP = `  <dialog id="coverageDialog" class="detail-dialog coverage-dialog">
    <div class="detail-dialog-shell">
      <header class="detail-dialog-header">
        <div>
          <h2 id="coverageDialogTitle">Cobertura y duplicaciones</h2>
          <div id="coverageDialogPath" class="muted"></div>
        </div>
        <button id="coverageDialogClose" class="icon-button" type="button" aria-label="Cerrar">×</button>
      </header>
      <div class="detail-dialog-body">
        <div id="coverageDialogLoading" class="dialog-loading">Cargando cobertura y duplicaciones…</div>
        <div id="coverageDialogContent" hidden>
          <section class="detail-section">
            <h3>Resumen de líneas</h3>
            <div id="coverageLineSummary" class="metrics-summary compact-metrics"></div>
          </section>
          <section class="detail-section">
            <h3>Bloques duplicados</h3>
            <div id="duplicationGroups" class="duplication-groups"></div>
            <div id="noDuplicationGroups" class="no-results">No se han encontrado bloques duplicados para este archivo.</div>
          </section>
        </div>
      </div>
      <footer class="detail-dialog-footer">
        <button id="openCoverageFile" class="secondary" type="button">Abrir archivo</button>
        <button id="closeCoverageDialog" type="button">Cerrar</button>
      </footer>
    </div>
  </dialog>

`;
