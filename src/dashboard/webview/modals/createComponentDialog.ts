import { getSelectDropdownMarkup } from '../../../shared/webview/ui/selectDropdown';

const COMPONENT_TYPE_OPTIONS = [
  { value: 'project', label: 'Proyecto' },
  { value: 'application', label: 'Aplicación' }
] as const;

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Privado' },
  { value: 'public', label: 'Público' }
] as const;

export const CREATE_COMPONENT_DIALOG_MARKUP = `  <dialog id="createComponentDialog" class="rule-dialog create-component-dialog">
    <div class="rule-dialog-header">
      <div>
        <h2 id="createComponentTitle">Crear proyecto o aplicación</h2>
        <span class="muted">El componente se creará directamente en SonarQube.</span>
      </div>
      <button id="createComponentClose" class="rule-dialog-close secondary" type="button" aria-label="Cerrar">×</button>
    </div>
    <form id="createComponentForm" class="rule-dialog-body create-component-form">
      <div id="createComponentError" class="connection-status connection-status--error" role="alert" hidden></div>
      <div class="create-component-grid">
        <div class="field">
          <label for="createComponentName"><span class="required">*</span> Nombre</label>
          <input id="createComponentName" type="text" maxlength="255" autocomplete="off" spellcheck="false">
        </div>
        <div class="field">
          <label for="createComponentKey"><span class="required">*</span> Clave</label>
          <input id="createComponentKey" type="text" maxlength="400" autocomplete="off" spellcheck="false">
          <div class="hint">Usa letras, números, guiones, puntos, guiones bajos o dos puntos. Debe contener al menos una letra.</div>
        </div>
        <div class="field field--wide">
          <label for="createComponentDescription">Descripción opcional</label>
          <textarea id="createComponentDescription" rows="3"></textarea>
        </div>
        <div id="createComponentTypeField" class="field">
          <label for="createComponentType">Tipo</label>
${getSelectDropdownMarkup({
  ariaLabel: 'Tipo de componente',
  className: 'select-dropdown--fluid',
  id: 'createComponentType',
  options: COMPONENT_TYPE_OPTIONS,
  selectedValue: 'project'
})}
        </div>
        <div class="field">
          <label for="createComponentVisibility">Visibilidad</label>
${getSelectDropdownMarkup({
  ariaLabel: 'Visibilidad',
  className: 'select-dropdown--fluid',
  id: 'createComponentVisibility',
  options: VISIBILITY_OPTIONS,
  selectedValue: 'private'
})}
        </div>
      </div>
    </form>
    <div class="dialog-actions">
      <button id="createComponentCancel" class="secondary" type="button">Cancelar</button>
      <button id="createComponentSubmit" type="submit" form="createComponentForm">Crear</button>
    </div>
  </dialog>
`;
