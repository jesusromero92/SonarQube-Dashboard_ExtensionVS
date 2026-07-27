
export const EVOLUTION_CHARTS_MARKUP = `          </div>

          <section class="evolution-section">
            <div class="evolution-heading">
              <h2>Evolución respecto a análisis anteriores</h2>
              <span id="evolutionCount" class="muted">0 análisis</span>
            </div>
            <div class="evolution-grid">
              <section class="panel chart-card">
                <div class="chart-card-header">
                  <h3>Issues por tipo</h3>
                  <p>Evolución semanal de bugs, code smells, vulnerabilidades y security hotspots.</p>
                </div>
                <div id="typeChart" class="chart-stage"></div>
                <div id="typeLegend" class="chart-legend"></div>
              </section>
              <section class="panel chart-card">
                <div class="chart-card-header">
                  <h3>Issues por criticidad</h3>
                  <p>Evolución semanal de issues por nivel de criticidad.</p>
                </div>
                <div id="severityChart" class="chart-stage"></div>
                <div id="severityLegend" class="chart-legend"></div>
              </section>
            </div>
          </section>
          </div>

`;
