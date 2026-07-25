
export const RANKING_TABLES_MARKUP = `          <div class="rank-grid">
            <section class="panel compact-table">
              <div class="panel-header">
                <h2>Top Archivos</h2>
                <span id="filesCount" class="muted">0 archivos</span>
              </div>
              <div class="table-wrap body-scroll-table">
                <table aria-label="Top Archivos">
                  <thead>
                    <tr>
                      <th data-sort-header="files" data-sort-key="key">
                        <button class="sort-button" type="button">
                          Archivo <span class="sort-indicator" aria-hidden="true"></span>
                        </button>
                      </th>
                      <th class="severity-cell" data-sort-header="files" data-sort-key="severityRank">
                        <button class="sort-button" type="button">
                          Severidad <span class="sort-indicator" aria-hidden="true"></span>
                        </button>
                      </th>
                      <th class="count-cell" data-sort-header="files" data-sort-key="count">
                        <button class="sort-button" type="button">
                          Defectos <span class="sort-indicator" aria-hidden="true"></span>
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody id="filesBody"></tbody>
                </table>
                <div id="noFiles" class="no-results">No hay archivos con defectos.</div>
              </div>
            </section>

            <section class="panel compact-table">
              <div class="panel-header">
                <h2>Top Reglas</h2>
                <span id="rulesCount" class="muted">0 reglas</span>
              </div>
              <div class="table-wrap body-scroll-table">
                <table aria-label="Top Reglas">
                  <thead>
                    <tr>
                      <th data-sort-header="rules" data-sort-key="key">
                        <button class="sort-button" type="button">
                          Regla <span class="sort-indicator" aria-hidden="true"></span>
                        </button>
                      </th>
                      <th class="severity-cell" data-sort-header="rules" data-sort-key="severityRank">
                        <button class="sort-button" type="button">
                          Severidad <span class="sort-indicator" aria-hidden="true"></span>
                        </button>
                      </th>
                      <th class="count-cell" data-sort-header="rules" data-sort-key="count">
                        <button class="sort-button" type="button">
                          Defectos <span class="sort-indicator" aria-hidden="true"></span>
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody id="rulesBody"></tbody>
                </table>
                <div id="noRules" class="no-results">No hay reglas con defectos.</div>
              </div>
            </section>
          </div>

`;
