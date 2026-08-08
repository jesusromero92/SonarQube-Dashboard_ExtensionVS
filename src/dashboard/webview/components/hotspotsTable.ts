
export const HOTSPOTS_TABLE_MARKUP = `          <section id="hotspotsView" hidden>
            <section
              id="hotspotsScopeEmpty"
              class="issues-scope-empty panel"
              role="status"
              aria-live="polite"
              hidden
            >
              <div class="issues-scope-empty-content">
                <div class="issues-scope-empty-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </div>
                <p id="hotspotsScopeEmptyMessage">No se han encontrado Security Hotspots en este ámbito.</p>
              </div>
            </section>

            <section id="hotspotsContent" class="panel">
              <div class="table-toolbar">
                <h2>Security Hotspots</h2>
                <span id="hotspotsCount" class="muted">0</span>
                <label class="pending-filter">
                  <input id="pendingHotspotsOnly" type="checkbox">
                  Solo pendientes
                </label>
                <input id="hotspotFilter" type="search" placeholder="Filtrar por archivo, regla o descripción">
              </div>
              <div class="table-wrap body-scroll-table">
                <table class="issues-table hotspots-table" aria-label="Security Hotspots">
                  <thead>
                    <tr>
                      <th style="width:90px">Prioridad</th>
                      <th style="width:120px">Estado</th>
                      <th class="col-file">Archivo</th>
                      <th>Regla o descripción</th>
                    </tr>
                  </thead>
                  <tbody id="hotspotsBody"></tbody>
                </table>
                <div id="noHotspots" class="no-results">No hay Security Hotspots que coincidan con el filtro.</div>
              </div>
            </section>
          </section>
        </section>
      </section>

`;
