import { getNewCodeEvolutionUnavailableMarkup } from './ui/scopeUnavailableNotice';
import { getSelectDropdownMarkup } from './ui/selectDropdown';

const COVERAGE_GRANULARITY_OPTIONS = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' }
] as const;

function granularityDropdown(id: string): string {
  return getSelectDropdownMarkup({
    ariaLabel: 'Agrupar por',
    className: 'chart-granularity',
    id,
    options: COVERAGE_GRANULARITY_OPTIONS,
    selectedValue: 'day'
  });
}

export const COVERAGE_VIEW_MARKUP = `          <section id="coverageView" hidden>
            <div id="coverageSummary" class="metrics-summary coverage-summary" aria-label="Resumen de cobertura"></div>

            <div class="rank-grid coverage-rank-grid">
              <section class="panel compact-table">
                <div class="panel-header">
                  <h2>Archivos con menor cobertura</h2>
                  <span id="coverageFilesCount" class="muted">0 archivos</span>
                </div>
                <div class="table-wrap body-scroll-table">
                  <table aria-label="Archivos con menor cobertura">
                    <thead>
                      <tr>
                        <th>Archivo</th>
                        <th class="count-cell">Cobertura</th>
                        <th class="count-cell">Líneas sin cubrir</th>
                      </tr>
                    </thead>
                    <tbody id="coverageFilesBody"></tbody>
                  </table>
                  <div id="noCoverageFiles" class="no-results">No hay datos de cobertura por archivo.</div>
                </div>
              </section>

              <section class="panel compact-table">
                <div class="panel-header">
                  <h2>Archivos con más duplicación</h2>
                  <span id="duplicationFilesCount" class="muted">0 archivos</span>
                </div>
                <div class="table-wrap body-scroll-table">
                  <table aria-label="Archivos con más duplicación">
                    <thead>
                      <tr>
                        <th>Archivo</th>
                        <th class="count-cell">Duplicación</th>
                        <th class="count-cell">Bloques</th>
                      </tr>
                    </thead>
                    <tbody id="duplicationFilesBody"></tbody>
                  </table>
                  <div id="noDuplicationFiles" class="no-results">No hay datos de duplicación por archivo.</div>
                </div>
              </section>
            </div>

            <section id="coverageEvolutionSection" class="evolution-section">
              <div class="evolution-heading">
                <h2>Evolución de cobertura y duplicación</h2>
              </div>
${getNewCodeEvolutionUnavailableMarkup({ id: 'coverageEvolutionUnavailable' })}
              <div id="coverageEvolutionGrid" class="evolution-grid">
                <section class="panel chart-card">
                  <div class="chart-card-header">
                    <h3>Cobertura</h3>
${granularityDropdown('coverageEvolutionGranularity')}
                    <p>Evolución histórica del porcentaje de cobertura.</p>
                  </div>
                  <div id="coverageChart" class="chart-stage"></div>
                  <div id="coverageLegend" class="chart-legend"></div>
                </section>
                <section class="panel chart-card">
                  <div class="chart-card-header">
                    <h3>Duplicación</h3>
${granularityDropdown('duplicationEvolutionGranularity')}
                    <p>Evolución histórica del porcentaje de líneas duplicadas.</p>
                  </div>
                  <div id="duplicationChart" class="chart-stage"></div>
                  <div id="duplicationLegend" class="chart-legend"></div>
                </section>
              </div>
            </section>
          </section>

`;
