export const ISSUE_DIALOG_MARKUP = `  <dialog id="issueDialog" class="detail-dialog lifecycle-dialog">
    <div class="detail-dialog-shell">
      <header class="detail-dialog-header">
        <div>
          <h2 id="issueDialogTitle">Gestión del defecto</h2>
          <div id="issueDialogBadges" class="dialog-badges"></div>
        </div>
        <button id="issueDialogClose" class="icon-button" type="button" aria-label="Cerrar">×</button>
      </header>
      <div class="detail-dialog-body">
        <div id="issueDialogLoading" class="dialog-loading">Cargando gestión del defecto…</div>
        <div id="issueDialogContent" hidden>
          <section class="detail-section">
            <h3>Defecto</h3>
            <p id="issueDialogMessage"></p>
            <dl id="issueDialogMeta" class="detail-meta"></dl>
          </section>

          <section id="issueActionsSection" class="detail-section">
            <h3>Acciones disponibles</h3>
            <p class="muted">Solo se muestran las acciones permitidas para el token actual.</p>
            <div id="issueTransitionActions" class="action-grid"></div>
            <div id="issueAssignment" class="inline-form" hidden>
              <label for="issueAssignee">Responsable</label>
              <input id="issueAssigneeSearch" type="search" placeholder="Buscar usuario por nombre o login" autocomplete="off">
              <select id="issueAssignee"></select>
              <button id="issueAssign" type="button">Asignar</button>
            </div>
            <div id="issueCommentForm" class="comment-form" hidden>
              <label for="issueComment">Comentario</label>
              <textarea id="issueComment" rows="3" placeholder="Añade un comentario a SonarQube"></textarea>
              <button id="issueAddComment" type="button">Añadir comentario</button>
            </div>
          </section>

          <section id="issueFlowSection" class="detail-section" hidden>
            <div class="section-heading-row">
              <div>
                <h3>Flujo de ejecución y ubicaciones secundarias</h3>
                <p class="muted">Recorre el origen, los pasos intermedios y el sink.</p>
              </div>
              <div class="dialog-nav-actions">
                <button id="issueFlowPrevious" class="secondary" type="button">Anterior</button>
                <button id="issueFlowNext" class="secondary" type="button">Siguiente</button>
              </div>
            </div>
            <label for="issueFlowSelect">Flujo</label>
            <select id="issueFlowSelect"></select>
            <ol id="issueFlowLocations" class="flow-list"></ol>
          </section>

          <section class="detail-section activity-accordions">
            <details class="activity-accordion" name="issueActivity">
              <summary>Comentarios <span id="issueCommentsCount" class="muted">0</span></summary>
              <div id="issueComments" class="activity-list"></div>
            </details>
            <details class="activity-accordion" name="issueActivity">
              <summary>Historial <span id="issueHistoryCount" class="muted">0</span></summary>
              <div id="issueHistory" class="activity-list"></div>
            </details>
          </section>
        </div>
      </div>
      <footer class="detail-dialog-footer">
        <button id="openManagedIssueFile" class="secondary" type="button">Abrir archivo</button>
        <button id="closeIssueDialog" type="button">Cerrar</button>
      </footer>
    </div>
  </dialog>

`;
