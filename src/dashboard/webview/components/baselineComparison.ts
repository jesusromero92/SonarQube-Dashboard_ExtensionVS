export function getBaselineComparisonMarkup(
  id: string,
  className = ''
): string {
  return `          <section id="${id}" class="analysis-baseline-comparison ${className}" hidden>
            <div class="analysis-baseline-header">
              <div>
                <strong>Comparación antes/después</strong>
                <span data-baseline-note class="muted">Cambios publicados por el último pipeline.</span>
              </div>
              <div class="analysis-baseline-meta">
                <span data-baseline-scope class="analysis-baseline-scope">Overall</span>
                <span data-baseline-captured class="muted"></span>
              </div>
            </div>
            <div class="analysis-baseline-grid">
              <article class="analysis-baseline-card" data-baseline-card="issues">
                <span>Issues</span>
                <strong data-baseline-value="issues">—</strong>
                <span data-baseline-delta="issues" class="analysis-baseline-delta">—</span>
              </article>
              <article class="analysis-baseline-card" data-baseline-card="hotspots">
                <span>Security Hotspots</span>
                <strong data-baseline-value="hotspots">—</strong>
                <span data-baseline-delta="hotspots" class="analysis-baseline-delta">—</span>
              </article>
              <article class="analysis-baseline-card" data-baseline-card="coverage">
                <span>Cobertura</span>
                <strong data-baseline-value="coverage">—</strong>
                <span data-baseline-delta="coverage" class="analysis-baseline-delta">—</span>
              </article>
              <article class="analysis-baseline-card" data-baseline-card="duplication">
                <span>Duplicación</span>
                <strong data-baseline-value="duplication">—</strong>
                <span data-baseline-delta="duplication" class="analysis-baseline-delta">—</span>
              </article>
              <article class="analysis-baseline-card" data-baseline-card="qualityGate">
                <span>Quality Gate</span>
                <strong data-baseline-value="qualityGate">—</strong>
                <span data-baseline-delta="qualityGate" class="analysis-baseline-delta">—</span>
              </article>
            </div>
          </section>`;
}
