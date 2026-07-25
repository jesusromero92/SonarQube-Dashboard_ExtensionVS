export const HOTSPOTS_TABLE_SCRIPT = `    function hotspotDisplayStatus(hotspot) {
      const resolution = String(hotspot.resolution || '').toUpperCase();
      if (resolution) return resolution.replace(/_/g, ' ');
      const status = String(hotspot.status || 'TO_REVIEW').toUpperCase();
      return status.replace(/_/g, ' ');
    }

    function isPendingHotspot(hotspot) {
      const status = String(hotspot.status || '').toUpperCase();
      const resolution = String(hotspot.resolution || '').toUpperCase();
      return status === 'TO_REVIEW' ||
        resolution === 'ACKNOWLEDGED' ||
        (!resolution && status !== 'REVIEWED');
    }

    function renderHotspots() {
      const query = elements.hotspotFilter.value.trim().toLowerCase();
      const pendingOnly = elements.pendingHotspotsOnly.checked;
      const filtered = currentHotspots.filter(hotspot => {
        if (pendingOnly && !isPendingHotspot(hotspot)) return false;
        if (!query) return true;
        return [
          hotspot.relativePath,
          hotspot.ruleKey,
          hotspot.message,
          hotspot.priority,
          hotspot.status,
          hotspot.resolution
        ].join(' ').toLowerCase().includes(query);
      });

      elements.hotspotsBody.textContent = '';
      elements.hotspotsCount.textContent = String(filtered.length) +
        (filtered.length === 1 ? ' hotspot' : ' hotspots');
      elements.noHotspots.hidden = filtered.length > 0;
      elements.noHotspots.textContent = currentHotspots.length
        ? 'No hay Security Hotspots que coincidan con el filtro.'
        : 'No se han encontrado Security Hotspots en este ámbito.';

      for (const hotspot of filtered) {
        const row = document.createElement('tr');
        row.tabIndex = 0;
        row.title = 'Ver detalle del Security Hotspot';
        const open = () => showHotspotDialog(hotspot);
        row.addEventListener('click', open);
        row.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            open();
          }
        });

        const priorityCell = document.createElement('td');
        const priority = document.createElement('span');
        const priorityName = String(hotspot.priority || 'UNKNOWN').toUpperCase();
        priority.className = 'hotspot-priority ' + priorityName.toLowerCase();
        priority.textContent = priorityName;
        priorityCell.appendChild(priority);
        row.appendChild(priorityCell);
        row.appendChild(createCell(hotspotDisplayStatus(hotspot), 'hotspot-status'));
        row.appendChild(fileCellUtils.create(hotspot.relativePath, hotspot.line));
        row.appendChild(createCell(hotspot.message || hotspot.ruleKey || 'Security Hotspot'));
        elements.hotspotsBody.appendChild(row);
      }
    }

`;
