export const DIAGNOSTICS_PAGE_MARKUP = `      <section id="diagnosticsPage" class="page" hidden>
        <section class="panel">
          <div class="panel-header">
            <h2>Diagnóstico de la extensión</h2>
            <span id="diagnosticsGeneratedAt" class="muted"></span>
            <button id="refreshDiagnostics" class="secondary" type="button">Actualizar diagnóstico</button>
            <button id="copyDiagnostics" type="button" disabled>Copiar informe</button>
          </div>
          <div id="diagnosticsLoading" class="diagnostics-loading">Recopilando diagnóstico…</div>
          <div id="diagnosticsContent" class="diagnostics-content" hidden>
            <section class="diagnostics-section">
              <h3>Entorno</h3>
              <dl id="diagnosticsEnvironment" class="diagnostics-grid"></dl>
            </section>
            <section class="diagnostics-section diagnostics-columns">
              <div>
                <h3>Módulos</h3>
                <div id="diagnosticsModules" class="diagnostics-list"></div>
              </div>
              <div>
                <h3>Salud de módulos</h3>
                <div id="diagnosticsModuleHealth" class="diagnostics-list"></div>
              </div>
            </section>
            <section class="diagnostics-section">
              <h3>SonarQube y compatibilidad</h3>
              <dl id="diagnosticsSonar" class="diagnostics-grid"></dl>
            </section>
            <section class="diagnostics-section">
              <h3>Scanner</h3>
              <dl id="diagnosticsScanner" class="diagnostics-grid"></dl>
            </section>
            <section class="diagnostics-section diagnostics-columns">
              <div>
                <h3>Comandos detectados automáticamente</h3>
                <div id="diagnosticsCommands" class="diagnostics-list"></div>
              </div>
              <div>
                <h3>Herramientas disponibles</h3>
                <div id="diagnosticsTools" class="diagnostics-list"></div>
              </div>
            </section>
            <section class="diagnostics-section">
              <h3>Última petición fallida</h3>
              <div id="diagnosticsLastFailure" class="diagnostics-failure"></div>
            </section>
            <section id="diagnosticsErrorsSection" class="diagnostics-section" hidden>
              <h3>Incidencias al recopilar el diagnóstico</h3>
              <div id="diagnosticsErrors" class="diagnostics-list"></div>
            </section>
            <p class="muted diagnostics-security-note">El informe no incluye tokens ni secretos.</p>
          </div>
        </section>
      </section>`;
