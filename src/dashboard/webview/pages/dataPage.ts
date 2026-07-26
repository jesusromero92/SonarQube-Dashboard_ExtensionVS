import { ANALYSIS_CONTROL_MARKUP } from '../components/analysisControl';
import { ISSUES_TABLE_MARKUP } from '../components/issuesTable';
import { RANKING_TABLES_MARKUP } from '../components/rankingTables';
import { EVOLUTION_CHARTS_MARKUP } from '../components/evolutionCharts';
import { HOTSPOTS_TABLE_MARKUP } from '../components/hotspotsTable';
import { COVERAGE_VIEW_MARKUP } from '../components/coverageView';

const DATA_PAGE_PREFIX = `      <section id="dataPage" class="page">
        <section id="dataLoading" class="dashboard-loading">
          <div>
            <div class="dashboard-spinner" aria-hidden="true"></div>
            <strong>Sincronizando datos de SonarQube…</strong>
          </div>
        </section>
        <section id="dataEmpty" class="empty-state" hidden>
          <div class="empty-state-inner">
            <div class="empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9.4 2.2a1 1 0 0 1 1.4.2L12 4l1.2-1.6a1 1 0 1 1 1.6 1.2L13.75 5H15a4 4 0 0 1 4 4v1h2a1 1 0 1 1 0 2h-2v2h2a1 1 0 1 1 0 2h-2v1a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-1H3a1 1 0 1 1 0-2h2v-2H3a1 1 0 1 1 0-2h2V9a4 4 0 0 1 4-4h1.25L9.2 3.6a1 1 0 0 1 .2-1.4ZM7 12v5a2 2 0 0 0 2 2h2v-7H7Zm6 7h2a2 2 0 0 0 2-2v-5h-4v7ZM9 7a2 2 0 0 0-2 2v1h10V9a2 2 0 0 0-2-2H9Z"/>
              </svg>
            </div>
            <div id="emptyProject" class="project-summary" hidden></div>
            <h2 id="emptyTitle">Configura SonarQube Dashboard</h2>
            <p id="emptyText">Vincula la carpeta abierta con un proyecto de SonarQube para consultar sus defectos.</p>
            <div class="empty-actions">
              <button id="goConfiguration" type="button">Ir a configuración</button>
              <button id="analyzeEmpty" type="button" hidden>Analizar repositorio</button>
              <button id="syncEmpty" class="secondary" type="button" hidden>Sincronizar datos</button>
            </div>
          </div>
        </section>

${ANALYSIS_CONTROL_MARKUP}        <section id="results" hidden>
          <div class="dashboard-controls">
            <nav class="segmented" aria-label="Vista de datos">
              <button id="issuesViewTab" class="active" type="button">Defectos</button>
              <button id="hotspotsViewTab" type="button">
                Security Hotspots <span id="hotspotsTabCount">0</span>
              </button>
              <button id="coverageViewTab" type="button">Cobertura y duplicación</button>
            </nav>
            <nav class="segmented scope-control" aria-label="Ámbito del análisis">
              <button id="overallScope" class="active" type="button">Overall</button>
              <button id="newCodeScope" type="button">New Code</button>
            </nav>
            <button id="qualityGateButton" class="quality-gate-button secondary" type="button">
              Quality Gate
            </button>
          </div>

          <div id="issuesView">
          <div id="metricsSummary" class="metrics-summary" aria-label="Resumen de defectos"></div>

`;

export function getDataPageMarkup(): string {
  return [
    DATA_PAGE_PREFIX,
    ISSUES_TABLE_MARKUP,
    RANKING_TABLES_MARKUP,
    EVOLUTION_CHARTS_MARKUP,
    COVERAGE_VIEW_MARKUP,
    HOTSPOTS_TABLE_MARKUP
  ].join('');
}
