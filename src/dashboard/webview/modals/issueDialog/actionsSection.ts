import { getSelectDropdownMarkup } from '../../../../shared/webview/ui/selectDropdown';

const assigneeDropdownMarkup = getSelectDropdownMarkup({
  ariaLabel: 'Responsable',
  className: 'select-dropdown--fluid',
  id: 'issueAssignee',
  options: [
    {
      label: 'Sin asignar',
      value: ''
    }
  ],
  selectedValue: ''
});

export const ISSUE_ACTIONS_SECTION_MARKUP = `          <section id="issueActionsSection" class="detail-section">
            <h3>Acciones disponibles</h3>
            <p class="muted">Solo se muestran las acciones permitidas para el token actual.</p>
            <div id="issueTransitionActions" class="action-grid"></div>
            <div id="issueAssignment" class="action-form" hidden>
              <label for="issueAssignee">Responsable</label>
${assigneeDropdownMarkup}
              <button id="issueAssign" type="button">Asignar</button>
            </div>
          </section>`;
