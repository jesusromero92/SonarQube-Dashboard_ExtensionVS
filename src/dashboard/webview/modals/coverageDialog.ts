import { getDetailDialogMarkup } from '../components/ui/detailDialog';

const bodyMarkup = `        <div id="coverageDialogLoading" class="dialog-loading">Cargando cobertura y duplicaciones…</div>
        <div id="coverageDialogContent" hidden>
          <section class="detail-section">
            <h3>Resumen de líneas</h3>
            <div id="coverageLineSummary" class="metrics-summary compact-metrics"></div>
          </section>
          <section class="detail-section">
            <h3>Bloques duplicados</h3>
            <div id="duplicationGroups" class="duplication-groups"></div>
            <div id="noDuplicationGroups" class="no-results">No se han encontrado bloques duplicados para este archivo.</div>
          </section>
        </div>`;

const footerMarkup = `        <button id="openCoverageFile" class="secondary" type="button">Abrir archivo</button>
        <button id="closeCoverageDialog" type="button">Cerrar</button>`;

export const COVERAGE_DIALOG_MARKUP = getDetailDialogMarkup({
  bodyMarkup,
  closeButtonId: 'coverageDialogClose',
  closeLabel: 'Cerrar',
  dialogClass: 'coverage-dialog',
  dialogId: 'coverageDialog',
  footerMarkup,
  headerExtraMarkup: '          <div id="coverageDialogPath" class="muted"></div>',
  title: 'Cobertura y duplicaciones',
  titleId: 'coverageDialogTitle'
});
