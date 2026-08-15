import { getNewCodeEvolutionUnavailableMarkup } from './ui/scopeUnavailableNotice';
import { getSelectDropdownMarkup } from '../../../shared/webview/ui/selectDropdown';

const EVOLUTION_GRANULARITY_OPTIONS = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' }
] as const;

function granularityDropdown(id: string): string {
  return getSelectDropdownMarkup({
    ariaLabel: 'Agrupar por',
    className: 'chart-granularity',
    id,
    options: EVOLUTION_GRANULARITY_OPTIONS,
    selectedValue: 'day'
  });
}

export const EVOLUTION_CHARTS_MARKUP = `          </div>

          <section id="issuesEvolutionSection" class="evolution-section">
            <div class="evolution-heading">
              <h2>Evolución respecto a análisis anteriores</h2>
            </div>
${getNewCodeEvolutionUnavailableMarkup({ id: 'issuesEvolutionUnavailable' })}
            <div id="issuesEvolutionGrid" class="evolution-grid">
              <section class="panel chart-card">
                <div class="chart-card-header">
                  <h3>Issues por tipo</h3>
${granularityDropdown('typeEvolutionGranularity')}
                  <p id="typeEvolutionHelp">Evolución diaria de bugs, code smells, vulnerabilidades y security hotspots.</p>
                </div>
                <div id="typeChart" class="chart-stage"></div>
                <div id="typeLegend" class="chart-legend"></div>
              </section>
              <section class="panel chart-card">
                <div class="chart-card-header">
                  <h3>Issues por criticidad</h3>
${granularityDropdown('severityEvolutionGranularity')}
                  <p id="severityEvolutionHelp">Evolución diaria de issues por nivel de criticidad.</p>
                </div>
                <div id="severityChart" class="chart-stage"></div>
                <div id="severityLegend" class="chart-legend"></div>
              </section>
            </div>
          </section>
          </div>

`;
