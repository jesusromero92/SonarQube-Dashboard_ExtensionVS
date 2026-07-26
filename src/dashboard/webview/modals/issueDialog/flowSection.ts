export const ISSUE_FLOW_SECTION_MARKUP = `          <section id="issueFlowSection" class="detail-section" hidden>
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
          </section>`;
