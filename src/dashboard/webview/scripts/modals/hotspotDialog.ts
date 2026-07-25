export const HOTSPOT_DIALOG_SCRIPT = `    function showHotspotDialog(hotspot) {
      selectedHotspot = hotspot;
      elements.hotspotDialogTitle.textContent = hotspot.message || hotspot.ruleKey || 'Security Hotspot';
      elements.hotspotDialogLoading.textContent = 'Cargando detalle…';
      elements.hotspotDialogLoading.hidden = false;
      elements.hotspotDialogContent.hidden = true;
      elements.openHotspotFile.disabled = false;
      if (!elements.hotspotDialog.open) {
        elements.hotspotDialog.showModal();
      }
      vscode.postMessage({
        type: 'loadHotspotDetail',
        hotspotKey: hotspot.key,
        folderUri: hotspot.folderUri
      });
    }

    function renderHotspotDetail(detail) {
      const plainText = value => {
        if (!value) return '';
        return new DOMParser()
          .parseFromString(String(value), 'text/html')
          .body.textContent
          ?.trim() || '';
      };
      elements.hotspotDialogLoading.hidden = true;
      elements.hotspotDialogContent.hidden = false;
      elements.hotspotDialogTitle.textContent = detail.ruleName || detail.ruleKey || 'Security Hotspot';
      elements.hotspotDialogMeta.textContent = '';
      for (const text of [
        'Prioridad: ' + (detail.priority || selectedHotspot?.priority || 'No disponible'),
        'Estado: ' + hotspotDisplayStatus(detail),
        detail.ruleKey ? 'Regla: ' + detail.ruleKey : ''
      ].filter(Boolean)) {
        const item = document.createElement('span');
        item.textContent = text;
        elements.hotspotDialogMeta.appendChild(item);
      }
      elements.hotspotDialogMessage.textContent =
        plainText(detail.message || selectedHotspot?.message) || 'No hay descripción disponible.';
      elements.hotspotRisk.textContent =
        plainText(detail.riskDescription) || 'SonarQube no ha proporcionado la descripción del riesgo.';
      elements.hotspotVulnerability.textContent =
        plainText(detail.vulnerabilityDescription) || 'SonarQube no ha proporcionado información adicional.';
      elements.hotspotRecommendations.textContent =
        plainText(detail.fixRecommendations) || 'SonarQube no ha proporcionado recomendaciones.';
    }

`;
