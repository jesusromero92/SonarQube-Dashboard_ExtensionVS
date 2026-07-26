export const ANALYSIS_CONTROL_MARKUP = `        <section id="analysisPanel" class="analysis-panel" hidden>
          <div class="analysis-summary">
            <div class="analysis-icon" aria-hidden="true">▶</div>
            <div>
              <strong id="analysisTitle">Análisis del repositorio</strong>
              <p id="analysisMessage">Ejecuta el scanner adecuado para el proyecto abierto.</p>
              <span id="analysisScanner" class="muted"></span>
            </div>
          </div>
          <div class="analysis-actions">
            <button id="analyzeRepository" type="button">Analizar repositorio</button>
            <button id="showAnalysisLog" class="secondary" type="button">Ver registro</button>
            <button id="cancelAnalysis" class="secondary" type="button" hidden>Cancelar</button>
          </div>
        </section>

`;
