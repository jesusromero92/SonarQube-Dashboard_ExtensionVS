import { getDetailDialogMarkup } from '../components/ui/detailDialog';
import { getSelectDropdownMarkup } from '../../../shared/webview/ui/selectDropdown';

const emptySeverityOptions = [{ value: '', label: 'Todas' }] as const;
const emptyMasculineOptions = [{ value: '', label: 'Todos' }] as const;

const severityDropdown = getSelectDropdownMarkup({
  ariaLabel: 'Severidad',
  className: 'select-dropdown--fluid',
  id: 'issueSeverityFilter',
  options: emptySeverityOptions,
  selectedValue: ''
});

const typeDropdown = getSelectDropdownMarkup({
  ariaLabel: 'Tipo',
  className: 'select-dropdown--fluid',
  id: 'issueTypeFilter',
  options: emptyMasculineOptions,
  selectedValue: ''
});

const statusDropdown = getSelectDropdownMarkup({
  ariaLabel: 'Estado',
  className: 'select-dropdown--fluid',
  id: 'issueStatusFilter',
  options: emptyMasculineOptions,
  selectedValue: ''
});

const bodyMarkup = `        <section class="detail-section issue-filters-dialog-fields">
          <label>
            <span>Severidad</span>
${severityDropdown}
          </label>
          <label>
            <span>Tipo</span>
${typeDropdown}
          </label>
          <label>
            <span>Estado</span>
${statusDropdown}
          </label>
          <label>
            <span>Archivo</span>
            <input id="issueFileFilter" type="text" placeholder="Filtrar por archivo">
          </label>
          <label class="issue-filter-dialog-wide">
            <span>Regla</span>
            <input id="issueRuleFilter" type="text" placeholder="Filtrar por regla">
          </label>
        </section>`;

const footerMarkup = `        <button id="clearIssueFilters" class="secondary" type="button">Limpiar filtros</button>
        <button id="applyIssueFilters" type="button">Aplicar</button>`;

export const ISSUE_FILTERS_DIALOG_MARKUP = getDetailDialogMarkup({
  bodyMarkup,
  closeButtonId: 'issueFiltersDialogClose',
  closeLabel: 'Cerrar',
  dialogClass: 'issue-filters-dialog',
  dialogId: 'issueFiltersDialog',
  footerMarkup,
  title: 'Filtros',
  titleId: 'issueFiltersDialogTitle'
});
