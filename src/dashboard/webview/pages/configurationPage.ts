
export const CONFIGURATION_PAGE_MARKUP = `      <section id="configurationPage" class="page" hidden>
        <section class="panel">
          <div class="panel-header">
            <h2>Conexión con SonarQube</h2>
            <span class="muted">La configuración se guarda por carpeta del workspace</span>
          </div>

          <div id="emptyWorkspace" class="panel-body" hidden>
            <strong>No hay ninguna carpeta abierta.</strong>
            <p class="muted">Abre el proyecto local que corresponde al proyecto de SonarQube.</p>
          </div>

          <div id="configurationContent">
            <div class="panel-body">
              <div id="folderField" class="workspace-row" hidden>
                <label for="folder">Carpeta del workspace</label>
                <select id="folder"></select>
              </div>

              <div class="form-grid connection-row">
                <div class="field">
                  <label for="serverUrl"><span class="required">*</span> Servidor SonarQube</label>
                  <input id="serverUrl" type="url" placeholder="https://sonarqube.example.com" spellcheck="false">
                </div>
                <div class="field">
                  <label for="token"><span class="required">*</span> Token</label>
                  <input id="token" type="password" placeholder="Introduce el token" autocomplete="off">
                  <div id="tokenHint" class="hint">El token se guarda de forma segura para esta carpeta.</div>
                </div>
                <div class="field action-field">
                  <label aria-hidden="true">&nbsp;</label>
                  <button id="loadProjects" type="button">Conectar</button>
                </div>
              </div>

              <div class="form-grid project-row">
                <div class="field">
                  <label for="projectKey"><span class="required">*</span> Proyecto o aplicación visible</label>
                  <select id="projectKey" disabled>
                    <option value="">Introduce servidor y token para cargar la lista</option>
                  </select>
                  <div class="hint">El desplegable incluye únicamente los componentes visibles para el token.</div>
                </div>
                <div class="field action-field">
                  <label aria-hidden="true">&nbsp;</label>
                  <button id="save" type="button">Sincronizar</button>
                </div>
              </div>

              <details>
                <summary>Configuración avanzada</summary>
                <div class="form-grid advanced-grid">
                  <div class="field">
                    <label for="branch">Rama</label>
                    <input id="branch" type="text" placeholder="main" spellcheck="false">
                    <div class="hint">Déjala vacía para consultar la rama principal.</div>
                  </div>
                  <div class="field">
                    <label for="baseDir">Subcarpeta local</label>
                    <input id="baseDir" type="text" placeholder="packages/backend" spellcheck="false">
                    <div class="hint">Solo es necesaria cuando la raíz analizada está dentro de una subcarpeta.</div>
                  </div>
                </div>
              </details>
            </div>

            <div class="form-footer">
              <button id="refresh" class="secondary" type="button">Actualizar issues</button>
              <button id="clear" class="secondary" type="button">Limpiar Problems</button>
              <div class="spacer"></div>
              <span id="configState" class="muted">Sin configurar</span>
            </div>
          </div>
        </section>
      </section>`;
