
export const HOTSPOTS_TABLE_MARKUP = `          <section id="hotspotsView" class="panel" hidden>
            <div class="table-toolbar">
              <h2>Security Hotspots</h2>
              <span id="hotspotsCount" class="muted">0 hotspots</span>
              <label class="pending-filter">
                <input id="pendingHotspotsOnly" type="checkbox">
                Solo pendientes
              </label>
              <input id="hotspotFilter" type="search" placeholder="Filtrar por archivo, regla o descripción">
            </div>
            <div class="table-wrap body-scroll-table">
              <table class="issues-table" aria-label="Security Hotspots">
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
              <div id="noHotspots" class="no-results">No se han encontrado Security Hotspots.</div>
            </div>
          </section>
        </section>
      </section>

`;
