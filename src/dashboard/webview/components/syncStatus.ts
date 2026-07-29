export const SYNC_STATUS_MARKUP = `        <section id="dataUnavailable" class="empty-state sync-unavailable" hidden>
          <div class="empty-state-inner">
            <div class="empty-icon sync-unavailable-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M11 5a1 1 0 1 1 2 0v8a1 1 0 1 1-2 0V5Zm1 14a1.25 1.25 0 1 0 0-2.5A1.25 1.25 0 0 0 12 19Zm0-17a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z"/>
              </svg>
            </div>
            <div id="unavailableProject" class="project-summary" hidden></div>
            <h2>SonarQube no está disponible</h2>
            <p>No se pudieron cargar los datos del proyecto. Comprueba que el servidor esté disponible y vuelve a intentarlo.</p>
            <div id="unavailableError" class="sync-error-detail"></div>
            <div class="empty-actions">
              <button id="retryUnavailable" type="button">Reintentar</button>
              <button id="reviewUnavailableConfiguration" class="secondary" type="button">Revisar configuración</button>
            </div>
          </div>
        </section>

        <div id="dataStaleWarning" class="sync-stale-warning" hidden>
          <div>
            <strong>No se pudo actualizar SonarQube.</strong>
            <span>Se muestran los últimos datos sincronizados.</span>
            <span id="staleSyncTime" class="muted"></span>
            <div id="staleSyncError" class="sync-error-detail"></div>
          </div>
          <button id="retryStaleSync" class="secondary" type="button">Reintentar</button>
        </div>
`;
