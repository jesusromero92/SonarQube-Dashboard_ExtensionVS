import { getBaselineComparisonMarkup } from '../components/baselineComparison';
import { getAccordionMarkup } from '../../../dashboard/webview/components/ui/accordion';

const STEPS_ACCORDION_MARKUP = getAccordionMarkup({
  label: 'Pasos de la ejecución',
  countId: 'historyStepsCount',
  countValue: '0',
  contentId: 'historySteps',
  contentClassName: 'pipeline-execution-steps',
  open: true
});

const LOG_ACCORDION_MARKUP = getAccordionMarkup({
  label: 'Consola',
  countId: 'historyLogCount',
  countValue: '0 líneas',
  contentClassName: 'pipeline-execution-log-content',
  contentMarkup: '                <pre id="historyLog" class="pipeline-history-log"></pre>',
  open: true
});

export const HISTORY_PAGE_MARKUP = `      <section id="historyPage" class="page" hidden>
        <section class="panel pipeline-execution-panel">
          <div class="panel-header pipeline-execution-page-header">
            <div>
              <h2>Detalle de la ejecución del pipeline</h2>
              <span class="muted">Selecciona una ejecución desde la vista lateral para consultar su resultado.</span>
            </div>
            <button id="refreshHistory" class="secondary" type="button">Actualizar</button>
          </div>
          <div id="historyLoading" class="diagnostics-loading" hidden>Consultando ejecución…</div>
          <div id="historyEmpty" class="page-empty-state">
            Selecciona una ejecución en «Ejecuciones del pipeline».
          </div>
          <article id="historyList" class="pipeline-execution-detail" hidden>
            <header class="pipeline-execution-hero">
              <div id="historyEntryStatusIcon" class="pipeline-execution-status-icon" aria-hidden="true"></div>
              <div class="pipeline-execution-hero-copy">
                <span class="pipeline-execution-eyebrow">Resultado del pipeline</span>
                <h3 id="historyEntryTitle">—</h3>
                <p id="historyEntryMessage" class="muted"></p>
              </div>
              <span id="historyEntryStatus" class="pipeline-history-status">—</span>
            </header>

            <div class="pipeline-execution-summary-grid">
              <section class="pipeline-execution-summary-card">
                <span>Proyecto</span>
                <strong id="historyEntryProject">—</strong>
              </section>
              <section class="pipeline-execution-summary-card">
                <span>Scanner</span>
                <strong id="historyEntryScanner">—</strong>
              </section>
              <section class="pipeline-execution-summary-card">
                <span>Rama</span>
                <strong id="historyEntryBranch">—</strong>
              </section>
              <section class="pipeline-execution-summary-card">
                <span>Inicio</span>
                <strong id="historyEntryStarted">—</strong>
              </section>
              <section class="pipeline-execution-summary-card">
                <span>Duración</span>
                <strong id="historyEntryDuration">—</strong>
              </section>
            </div>

${getBaselineComparisonMarkup('historyComparison', 'analysis-baseline-comparison--history')}

            <div class="accordion-group pipeline-execution-accordions">
${STEPS_ACCORDION_MARKUP}
${LOG_ACCORDION_MARKUP}
            </div>
          </article>
        </section>
      </section>`;
