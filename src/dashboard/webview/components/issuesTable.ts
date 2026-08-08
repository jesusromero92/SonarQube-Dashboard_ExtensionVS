export const ISSUES_TABLE_MARKUP = `          <section class="panel issues-panel">
            <div class="table-toolbar issues-toolbar">
              <h2>Defectos</h2>
              <span id="tableCount" class="muted">0</span>
              <button
                id="issueFiltersToggle"
                class="secondary toolbar-filter-button issue-filter-toggle"
                type="button"
                title="Filtros"
                aria-label="Filtros"
                aria-haspopup="dialog"
                aria-controls="issueFiltersDialog"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M1.5 3a.5.5 0 0 1 .5-.5h12a.5.5 0 0 1 .38.825L9.5 9.017V13a.5.5 0 0 1-.276.447l-2 1A.5.5 0 0 1 6.5 14V9.017L1.62 3.325A.5.5 0 0 1 1.5 3Zm1.587.5L7.38 8.508a.5.5 0 0 1 .12.325v4.358l1-.5V8.833a.5.5 0 0 1 .12-.325L12.913 3.5H3.087Z"/>
                </svg>
                <span>Filtros</span>
                <span id="issueFiltersCount" class="toolbar-filter-count" hidden>0</span>
              </button>
              <input id="filter" type="search" placeholder="Filtrar por archivo, regla o descripción">
              <button
                id="copyIssues"
                class="icon-button toolbar-icon-button"
                type="button"
                title="Copiar todos los issues"
                aria-label="Copiar todos los issues"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M5 1.5A1.5 1.5 0 0 0 3.5 3v1H3A1.5 1.5 0 0 0 1.5 5.5v8A1.5 1.5 0 0 0 3 15h6.5a1.5 1.5 0 0 0 1.5-1.5V13h1A1.5 1.5 0 0 0 13.5 11.5V3A1.5 1.5 0 0 0 12 1.5H5Zm-.5 2.5V3A.5.5 0 0 1 5 2.5h7a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-.5.5h-1V5.5A1.5 1.5 0 0 0 9.5 4h-5Zm-2 1.5A.5.5 0 0 1 3 5h6.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5v-8Z"/>
                </svg>
              </button>
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
