
export const CHARTS_SCRIPT = `    const evolutionSeries = Object.fromEntries(
      Object.entries(dashboardConstants.evolutionSeries).map(([group, series]) => [
        group,
        series.map(item => ({
          key: item.key,
          name: item.name,
          color: dashboardColors[item.colorGroup][item.colorKey]
        }))
      ])
    );

    function createSvgElement(name, attributes) {
      const element = document.createElementNS('http://www.w3.org/2000/svg', name);
      for (const [key, value] of Object.entries(attributes || {})) {
        element.setAttribute(key, String(value));
      }
      return element;
    }

    function formatEvolutionDate(value) {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) {
        return String(value || '');
      }
      return new Intl.DateTimeFormat(dashboardLocale, {
        day: '2-digit',
        month: 'short',
        year: '2-digit'
      }).format(date);
    }

    function formatChartValue(value) {
      return new Intl.NumberFormat(dashboardLocale, {
        maximumFractionDigits: 1
      }).format(Number(value) || 0);
    }

    function renderChartLegend(chartKey, legendElement, data) {
      legendElement.textContent = '';
      for (const series of evolutionSeries[chartKey]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.classList.toggle('hidden-series', hiddenChartSeries[chartKey].has(series.key));
        button.disabled = data.length === 0;

        const dot = createSvgElement('svg', {
          class: 'chart-legend-dot',
          viewBox: '0 0 8 8',
          width: 8,
          height: 8,
          'aria-hidden': 'true'
        });
        dot.appendChild(createSvgElement('circle', {
          cx: 4,
          cy: 4,
          r: 4,
          fill: series.color
        }));
        button.appendChild(dot);
        button.appendChild(document.createTextNode(series.name));
        button.addEventListener('click', () => {
          const hidden = hiddenChartSeries[chartKey];
          if (hidden.has(series.key)) {
            hidden.delete(series.key);
          } else {
            hidden.add(series.key);
          }
          renderEvolutionCharts();
        });
        legendElement.appendChild(button);
      }
    }

    function clamp(value, minimum, maximum) {
      return Math.max(minimum, Math.min(maximum, value));
    }

    function positionChartTooltip(tooltip, mouseX, mouseY) {
      const gap = 12;
      const padding = 8;
      const rect = tooltip.getBoundingClientRect();
      const openRight = mouseX + gap + rect.width + padding <= window.innerWidth;
      const openBottom = mouseY + gap + rect.height + padding <= window.innerHeight;
      const left = openRight ? mouseX + gap : mouseX - gap - rect.width;
      const top = openBottom ? mouseY + gap : mouseY - gap - rect.height;
      tooltip.style.left = clamp(left, padding, window.innerWidth - rect.width - padding) + 'px';
      tooltip.style.top = clamp(top, padding, window.innerHeight - rect.height - padding) + 'px';
    }

    function showChartTooltip(point, series, mouseX, mouseY) {
      const tooltipKey = String(point.date || point.label) + ':' +
        series.map(item => item.key).join(',');
      const currentTooltip = document.querySelector('.chart-tooltip');
      if (currentTooltip?.dataset.tooltipKey === tooltipKey) {
        positionChartTooltip(currentTooltip, mouseX, mouseY);
        return;
      }
      currentTooltip?.remove();
      const tooltip = document.createElement('div');
      tooltip.className = 'chart-tooltip';
      tooltip.dataset.tooltipKey = tooltipKey;

      const title = document.createElement('div');
      title.className = 'chart-tooltip-title';
      title.textContent = formatEvolutionDate(point.date || point.label);
      tooltip.appendChild(title);

      const subtitle = document.createElement('div');
      subtitle.className = 'chart-tooltip-subtitle';
      subtitle.textContent = 'Último análisis: ' + formatEvolutionDate(point.date || point.label);
      tooltip.appendChild(subtitle);

      for (const item of series) {
        const row = document.createElement('div');
        row.className = 'chart-tooltip-row';
        const bar = document.createElement('span');
        bar.className = 'chart-tooltip-bar';
        bar.style.backgroundColor = item.color;
        row.appendChild(bar);
        const name = document.createElement('span');
        name.className = 'chart-tooltip-name';
        name.textContent = item.name;
        row.appendChild(name);
        const value = document.createElement('strong');
        value.className = 'chart-tooltip-value';
        value.textContent = formatChartValue(point[item.key]);
        row.appendChild(value);
        tooltip.appendChild(row);
      }
      document.body.appendChild(tooltip);
      positionChartTooltip(tooltip, mouseX, mouseY);
    }

    function renderLineChart(chartKey, container, legendElement, data) {
      container.textContent = '';
      const series = evolutionSeries[chartKey].filter(
        item => !hiddenChartSeries[chartKey].has(item.key)
      );
      renderChartLegend(chartKey, legendElement, data);

      if (!data.length) {
        const empty = document.createElement('div');
        empty.className = 'chart-empty';
        empty.textContent = 'No hay análisis históricos disponibles.';
        container.appendChild(empty);
        return;
      }
      if (!series.length) {
        const empty = document.createElement('div');
        empty.className = 'chart-empty';
        empty.textContent = 'Todas las líneas están ocultas.';
        container.appendChild(empty);
        return;
      }

      const width = 640;
      const height = 280;
      const margin = { top: 18, right: 18, bottom: 42, left: 48 };
      const plotWidth = width - margin.left - margin.right;
      const plotHeight = height - margin.top - margin.bottom;
      const values = data.flatMap(point => series.map(item => Number(point[item.key]) || 0));
      const maximum = Math.max(1, ...values);
      const svg = createSvgElement('svg', {
        class: 'chart-svg',
        viewBox: '0 0 ' + width + ' ' + height,
        preserveAspectRatio: 'none',
        'aria-label': chartKey === 'types'
          ? 'Evolución de issues por tipo'
          : 'Evolución de issues por criticidad'
      });

      for (let index = 0; index <= 4; index += 1) {
        const y = margin.top + (plotHeight * index / 4);
        const value = maximum * (1 - index / 4);
        svg.appendChild(createSvgElement('line', {
          x1: margin.left,
          y1: y,
          x2: width - margin.right,
          y2: y,
          stroke: 'var(--vscode-panel-border)',
          'stroke-dasharray': '3 3'
        }));
        const label = createSvgElement('text', {
          x: margin.left - 8,
          y: y + 4,
          fill: 'var(--vscode-descriptionForeground)',
          'font-size': 10,
          'text-anchor': 'end'
        });
        label.textContent = formatChartValue(value);
        svg.appendChild(label);
      }

      const xFor = index => margin.left +
        (data.length === 1 ? plotWidth / 2 : plotWidth * index / (data.length - 1));
      const yFor = value => margin.top + plotHeight -
        ((Number(value) || 0) / maximum) * plotHeight;
      const labelStep = Math.max(1, Math.ceil(data.length / 5));

      data.forEach((point, index) => {
        if (index % labelStep !== 0 && index !== data.length - 1) {
          return;
        }
        const label = createSvgElement('text', {
          x: xFor(index),
          y: height - 15,
          fill: 'var(--vscode-descriptionForeground)',
          'font-size': 10,
          'text-anchor': 'middle'
        });
        label.textContent = formatEvolutionDate(point.label);
        svg.appendChild(label);
      });

      for (const item of series) {
        const points = data.map((point, index) =>
          xFor(index) + ',' + yFor(point[item.key])
        ).join(' ');
        svg.appendChild(createSvgElement('polyline', {
          points,
          fill: 'none',
          stroke: item.color,
          'stroke-width': 2,
          'vector-effect': 'non-scaling-stroke'
        }));
        data.forEach((point, index) => {
          svg.appendChild(createSvgElement('circle', {
            cx: xFor(index),
            cy: yFor(point[item.key]),
            r: 3,
            fill: item.color,
            stroke: item.color,
            'vector-effect': 'non-scaling-stroke'
          }));
        });
      }

      svg.addEventListener('mousemove', event => {
        const rect = svg.getBoundingClientRect();
        const viewX = ((event.clientX - rect.left) / rect.width) * width;
        const ratio = clamp((viewX - margin.left) / plotWidth, 0, 1);
        const pointIndex = Math.round(ratio * Math.max(0, data.length - 1));
        showChartTooltip(
          data[pointIndex],
          series,
          event.clientX,
          event.clientY
        );
      });

      svg.addEventListener('mouseleave', () =>
        document.querySelector('.chart-tooltip')?.remove()
      );
      container.appendChild(svg);
    }

    function renderEvolutionCharts() {
      document.querySelector('.chart-tooltip')?.remove();
      const source = currentSummary.evolution || [];
      const data = currentScope === 'newCode'
        ? source.map(point => ({
            ...point,
            bugs: point.newBugs || 0,
            codeSmells: point.newCodeSmells || 0,
            vulnerabilities: point.newVulnerabilities || 0,
            securityHotspots: point.newSecurityHotspots || 0,
            blockerViolations: point.newBlockerViolations || 0,
            criticalViolations: point.newCriticalViolations || 0,
            majorViolations: point.newMajorViolations || 0,
            minorViolations: point.newMinorViolations || 0,
            infoViolations: point.newInfoViolations || 0
          }))
        : source;
      elements.evolutionCount.textContent = String(data.length) +
        (data.length === 1 ? ' análisis' : ' análisis');
      renderLineChart('types', elements.typeChart, elements.typeLegend, data);
      renderLineChart('severity', elements.severityChart, elements.severityLegend, data);
    }

`;
