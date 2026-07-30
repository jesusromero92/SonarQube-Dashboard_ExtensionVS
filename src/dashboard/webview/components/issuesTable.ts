
export const ISSUES_TABLE_MARKUP = `          <section class="panel">
            <div class="table-toolbar">
              <h2>Defectos</h2>
              <span id="tableCount" class="muted">0</span>
              <input id="filter" type="search" placeholder="Filtrar por archivo, regla o descripción">
            </div>
            <div class="table-wrap body-scroll-table">
              <table class="issues-table defects-table" aria-label="Defectos">
                <thead>
                  <tr>
                    <th class="col-severity" data-sort-header="issues" data-sort-key="severityRank">
                      <button class="sort-button" type="button">
                        Severidad <span class="sort-indicator" aria-hidden="true"></span>
                      </button>
                    </th>
                    <th class="col-type" data-sort-header="issues" data-sort-key="type">
                      <button class="sort-button" type="button">
                        Tipo <span class="sort-indicator" aria-hidden="true"></span>
                      </button>
                    </th>
                    <th class="col-file" data-sort-header="issues" data-sort-key="relativePath">
                      <button class="sort-button" type="button">
                        Archivo <span class="sort-indicator" aria-hidden="true"></span>
                      </button>
                    </th>
                    <th class="col-status" data-sort-header="issues" data-sort-key="status">
                      <button class="sort-button" type="button">
                        Estado <span class="sort-indicator" aria-hidden="true"></span>
                      </button>
                    </th>
                    <th class="col-rule" data-sort-header="issues" data-sort-key="ruleName">
                      <button class="sort-button" type="button">
                        Regla <span class="sort-indicator" aria-hidden="true"></span>
                      </button>
                    </th>
                    <th class="col-actions">Acciones</th>
                  </tr>
                </thead>
                <tbody id="issuesBody"></tbody>
              </table>
              <div id="noResults" class="no-results">No se han encontrado defectos para el proyecto seleccionado.</div>
            </div>
          </section>

`;
