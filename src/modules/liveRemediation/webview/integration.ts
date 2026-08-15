export const LIVE_REMEDIATION_INTEGRATION_SCRIPT = `
    function renderSonarIdeIntegrationStatus(status) {
      const installed = Boolean(status?.installed);
      const active = Boolean(status?.active);
      elements.sonarIdeStatus.classList.toggle('live-remediation-analyzer-status--active', active);
      elements.sonarIdeStatus.classList.toggle('live-remediation-analyzer-status--inactive', installed && !active);
      elements.sonarIdeStatus.classList.toggle('live-remediation-analyzer-status--missing', !installed);

      if (active) {
        elements.sonarIdeStatusIcon.textContent = '✓';
        elements.sonarIdeStatusTitle.textContent = 'SonarQube for IDE detectado y activo';
        elements.sonarIdeStatusHint.textContent = 'Sus diagnósticos locales pueden confirmar de forma independiente que un defecto modificado ya no se reproduce antes del siguiente análisis del servidor.';
        return;
      }

      if (installed) {
        elements.sonarIdeStatusIcon.textContent = '○';
        elements.sonarIdeStatusTitle.textContent = 'SonarQube for IDE instalado, todavía no activo';
        elements.sonarIdeStatusHint.textContent = 'Abre o guarda un archivo compatible para activar su análisis local. Hasta entonces, los cambios permanecerán pendientes de validación.';
        return;
      }

      elements.sonarIdeStatusIcon.textContent = '—';
      elements.sonarIdeStatusTitle.textContent = 'SonarQube for IDE no detectado';
      elements.sonarIdeStatusHint.textContent = 'No es obligatorio. Los defectos modificados permanecerán pendientes de validación hasta el siguiente análisis del repositorio.';
    }


    registerDashboardModuleHooks({
      renderState: config => renderSonarIdeIntegrationStatus(config.sonarIdeIntegration),
      renderConfigurationSaved: config => renderSonarIdeIntegrationStatus(config.sonarIdeIntegration)
    });
`;
