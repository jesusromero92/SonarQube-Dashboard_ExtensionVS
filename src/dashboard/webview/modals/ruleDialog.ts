export const RULE_DIALOG_MARKUP = `  <dialog id="ruleDialog" class="rule-dialog wide-dialog" aria-labelledby="ruleDialogTitle">
    <div class="rule-dialog-header">
      <h2 id="ruleDialogTitle">Detalle de la regla</h2>
      <button id="ruleDialogClose" class="rule-dialog-close secondary" type="button" aria-label="Cerrar">×</button>
    </div>
    <div class="dialog-scroll-body">
      <div id="ruleDialogLoading" class="dialog-loading">Cargando detalle…</div>
      <div id="ruleDialogContent" hidden>
        <section class="dialog-section">
          <h3>Detalles</h3>
          <div id="ruleDialogMeta" class="rule-detail-meta"></div>
        </section>
        <section class="dialog-section">
          <h3>Ubicación</h3>
          <div id="ruleDialogLocationMeta" class="rule-location-meta"></div>
        </section>
        <section class="dialog-section">
          <h3>Descripción</h3>
          <div id="ruleDialogDescription" class="rule-rich-text"></div>
        </section>
        <section id="ruleDialogNoteSection" class="dialog-section" hidden>
          <h3>Nota personalizada</h3>
          <div id="ruleDialogNote" class="rule-rich-text"></div>
        </section>
        <section id="ruleDialogParametersSection" class="dialog-section" hidden>
          <h3>Parámetros</h3>
          <div id="ruleDialogParameters" class="rule-parameter-list"></div>
        </section>
      </div>
    </div>
    <div class="dialog-actions">
      <button id="openRuleFile" class="secondary" type="button">Abrir archivo</button>
      <button id="closeRuleDialog" type="button">Cerrar</button>
    </div>
  </dialog>

`;
