
export const ISSUES_TABLE_MARKUP = `          <section class="panel">
            <div class="table-toolbar">
              <h2>Defectos</h2>
              <span id="tableCount" class="muted">0 issues</span>
              <input id="filter" type="search" placeholder="Filtrar por archivo, regla o descripción">
            </div>
            <div class="table-wrap body-scroll-table">
              <table class="issues-table" aria-label="Defectos">
                <thead>
                  <tr>
                    <th class="col-severity">Severidad</th>
                    <th class="col-type">Tipo</th>
                    <th class="col-file">Archivo</th>
                    <th class="col-rule">Regla</th>
                  </tr>
                </thead>
                <tbody id="issuesBody"></tbody>
              </table>
              <div id="noResults" class="no-results">No se han encontrado defectos para el proyecto seleccionado.</div>
            </div>
          </section>

`;
