
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

    function evolutionBucket(dateValue, granularity) {
      const date = new Date(dateValue);
      if (!Number.isFinite(date.getTime())) {
        const fallback = String(dateValue || '');
        return granularity === 'month' ? fallback.slice(0, 7) : fallback.slice(0, 10);
      }
      if (granularity === 'month') {
        return date.getUTCFullYear() + '-' +
          String(date.getUTCMonth() + 1).padStart(2, '0');
      }
      if (granularity === 'week') {
        const monday = new Date(date);
        const day = monday.getUTCDay() || 7;
        monday.setUTCDate(monday.getUTCDate() - day + 1);
        return monday.toISOString().slice(0, 10);
      }
      return date.toISOString().slice(0, 10);
    }

    function groupedEvolution(points, granularity) {
      const byBucket = new Map();
      const ordered = [...(points || [])].sort(
        (left, right) => Date.parse(left.date) - Date.parse(right.date)
      );
      for (const point of ordered) {
        const bucket = evolutionBucket(point.date || point.label, granularity);
        byBucket.set(bucket, { ...point, label: bucket });
      }
      return [...byBucket.values()].slice(-dashboardConstants.evolutionLimit);
    }

    function updateEvolutionHelp() {
      const typeHelp = {
        day: 'Evolución diaria de bugs, code smells, vulnerabilidades y security hotspots.',
        week: 'Evolución semanal de bugs, code smells, vulnerabilidades y security hotspots.',
        month: 'Evolución mensual de bugs, code smells, vulnerabilidades y security hotspots.'
      };
      const severityHelp = {
        day: 'Evolución diaria de issues por nivel de criticidad.',
        week: 'Evolución semanal de issues por nivel de criticidad.',
        month: 'Evolución mensual de issues por nivel de criticidad.'
      };
      elements.typeEvolutionHelp.textContent = typeHelp[evolutionGranularities.types];
      elements.severityEvolutionHelp.textContent = severityHelp[evolutionGranularities.severity];
    }

    function evolutionAvailableForCurrentScope() {
      return currentScope === 'overall';
    }

    function updateEvolutionScopeAvailability() {
      const available = evolutionAvailableForCurrentScope();
      elements.issuesEvolutionUnavailable.hidden = available;
      elements.issuesEvolutionGrid.hidden = !available;
      elements.coverageEvolutionUnavailable.hidden = available;
      elements.coverageEvolutionGrid.hidden = !available;
      return available;
    }

    function clearEvolutionChart(container, legend) {
      container.textContent = '';
      legend.textContent = '';
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

    function chartViewport(container, fallbackWidth, height) {
      const measuredWidth = Math.round(container.getBoundingClientRect().width);
      return {
        width: Math.max(320, measuredWidth || fallbackWidth),
        height
      };
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

      const viewport = chartViewport(container, 640, 280);
      const width = viewport.width;
      const height = viewport.height;
      const margin = { top: 18, right: 18, bottom: 42, left: 48 };
      const plotWidth = width - margin.left - margin.right;
      const plotHeight = height - margin.top - margin.bottom;
      const values = data.flatMap(point => series.map(item => Number(point[item.key]) || 0));
      const maximum = Math.max(1, ...values);
      const svg = createSvgElement('svg', {
        class: 'chart-svg',
        viewBox: '0 0 ' + width + ' ' + height,
        preserveAspectRatio: 'xMidYMid meet',
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
        label.textContent = formatEvolutionDate(point.date || point.label);
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

      if (!updateEvolutionScopeAvailability()) {
        clearEvolutionChart(elements.typeChart, elements.typeLegend);
        clearEvolutionChart(elements.severityChart, elements.severityLegend);
        return;
      }

      const source = currentSummary.evolution || [];
      const typeData = groupedEvolution(
        source,
        evolutionGranularities.types
      );
      const severityData = groupedEvolution(
        source,
        evolutionGranularities.severity
      );
      updateEvolutionHelp();
      renderLineChart('types', elements.typeChart, elements.typeLegend, typeData);
      renderLineChart(
        'severity',
        elements.severityChart,
        elements.severityLegend,
        severityData
      );
    }

    const observedChartWidths = new WeakMap();
    let chartResizeFrame = 0;

    function rerenderResponsiveCharts() {
      renderEvolutionCharts();
      if (!elements.coverageView.hidden && typeof renderCoverageEvolution === 'function') {
        renderCoverageEvolution();
      }
    }

    const chartResizeObserver = new ResizeObserver(entries => {
      const widthChanged = entries.some(entry => {
        const width = Math.round(entry.contentRect.width);
        const previousWidth = observedChartWidths.get(entry.target);
        observedChartWidths.set(entry.target, width);
        return previousWidth !== undefined && Math.abs(previousWidth - width) > 1;
      });
      if (!widthChanged) {
        return;
      }
      cancelAnimationFrame(chartResizeFrame);
      chartResizeFrame = requestAnimationFrame(rerenderResponsiveCharts);
    });

    [
      elements.typeChart,
      elements.severityChart,
      elements.coverageChart,
      elements.duplicationChart
    ].forEach(container => {
      observedChartWidths.set(
        container,
        Math.round(container.getBoundingClientRect().width)
      );
      chartResizeObserver.observe(container);
    });

`;
