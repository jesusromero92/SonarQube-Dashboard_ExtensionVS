import type {
  DashboardModuleDefinition,
  ModuleWebviewContribution
} from './contracts';

const join = (values: Array<string | undefined>): string =>
  values.filter((value): value is string => Boolean(value)).join('\n');

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function composeModuleWebviewContributions(
  definitions: readonly DashboardModuleDefinition[],
  contributions: readonly ModuleWebviewContribution[]
): ModuleWebviewContribution {
  const moduleSettings = definitions.map(definition => `
                      <div class="field full-width-field checkbox-field module-setting">
                        <label><input id="${escapeHtml(definition.id)}ModuleEnabled" data-module-toggle="${escapeHtml(definition.id)}" type="checkbox" checked> ${escapeHtml(definition.displayName)}</label>
                        <div class="hint">${escapeHtml(definition.description)}</div>
                      </div>`).join('');

  const localizationBundles = [
    ...definitions.map(item => item.localization),
    ...contributions.map(item => item.localization)
  ]
    .filter(item => item !== undefined);
  return {
    configurationTab: join(contributions.map(item => item.configurationTab)),
    configurationPanel: join(contributions.map(item => item.configurationPanel)),
    styles: join(contributions.map(item => item.styles)),
    scripts: join(contributions.map(item => item.scripts)),
    modals: join(contributions.map(item => item.modals)),
    pages: join(contributions.map(item => item.pages)),
    dataControls: join(contributions.map(item => item.dataControls)),
    emptyActions: join(contributions.map(item => item.emptyActions)),
    localization: localizationBundles.length === 0 ? undefined : {
      source: Object.assign({}, ...localizationBundles.map(item => item.source)),
      en: Object.assign({}, ...localizationBundles.map(item => item.en)),
      es: Object.assign({}, ...localizationBundles.map(item => item.es))
    },
    moduleSettings
  };
}

export function getModulesConfigurationPanelMarkup(
  contribution: ModuleWebviewContribution,
  selected = false
): string {
  const settings = contribution.moduleSettings ?? '';
  return `              <section id="configurationModulesPanel" class="configuration-tab-panel" role="tabpanel" aria-labelledby="configurationModulesTab"${selected ? '' : ' hidden'}>
                <details class="configuration-disclosure" open>
                  <summary>Módulos</summary>
                  <div class="configuration-disclosure-content">
                    <div class="configuration-section-intro">
                      <strong>Activa solo las funciones que necesitas</strong>
                      <p class="hint">Cada módulo habilita su lógica, su vista lateral y su pestaña de configuración. Los cambios se aplican inmediatamente.</p>
                    </div>
                    <div class="form-grid advanced-grid module-settings-grid">${settings}
                    </div>
                  </div>
                </details>
              </section>`;
}
