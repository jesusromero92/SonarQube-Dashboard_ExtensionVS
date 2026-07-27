export const COVERAGE_SCRIPT = `    let selectedCoverageFile = null;
    let currentCoverageDetail = null;

    function formatPercent(value) {
      return value === null || value === undefined
        ? '—'
        : new Intl.NumberFormat(dashboardLocale, { maximumFractionDigits: 1 }).format(Number(value)) + '%';
    }

    function selectedCoverageTotals() {
      const coverage = currentSummary.coverage || { overall: {}, newCode: {}, files: [] };
      return currentScope === 'newCode' ? coverage.newCode || {} : coverage.overall || {};
    }

    function createCoverageMetric(value, label, className) {
      const card = document.createElement('div');
      card.className = 'metric-summary ' + (className || '');
      const strong = document.createElement('strong');
      strong.textContent = value;
      const caption = document.createElement('span');
      caption.className = 'metric-label';
      caption.textContent = label;
      card.append(strong, caption);
      return card;
    }

    function renderCoverageSummary() {
      const totals = selectedCoverageTotals();
      elements.coverageSummary.textContent = '';
      elements.coverageSummary.append(
        createCoverageMetric(formatPercent(totals.coverage), 'Cobertura', 'coverage-covered'),
        createCoverageMetric(formatPercent(totals.lineCoverage), 'Cobertura de líneas', 'coverage-covered'),
        createCoverageMetric(formatPercent(totals.branchCoverage), 'Cobertura de condiciones', 'coverage-partial'),
        createCoverageMetric(String(totals.uncoveredLines || 0), 'Líneas sin cubrir', 'coverage-uncovered'),
        createCoverageMetric(formatPercent(totals.duplicatedLinesDensity), 'Duplicación', 'coverage-duplicated')
      );
    }

    function coverageForFile(file) {
      return currentScope === 'newCode' ? file.newCoverage : file.coverage;
    }

    function uncoveredForFile(file) {
      return currentScope === 'newCode' ? file.newUncoveredLines : file.uncoveredLines;
    }

    function duplicationForFile(file) {
      return currentScope === 'newCode' ? file.newDuplicatedLinesDensity : file.duplicatedLinesDensity;
    }

    function openCoverageDetail(file) {
      selectedCoverageFile = file;
      currentCoverageDetail = null;
      elements.coverageDialogTitle.textContent = 'Cobertura y duplicaciones';
      elements.coverageDialogPath.textContent = file.relativePath;
      elements.coverageDialogLoading.textContent = 'Cargando cobertura y duplicaciones…';
      elements.coverageDialogLoading.hidden = false;
      elements.coverageDialogContent.hidden = true;
      if (!elements.coverageDialog.open) elements.coverageDialog.showModal();
      vscode.postMessage({ type: 'loadCoverageDetail', fileUri: file.fileUri });
    }

    function createCoverageFileRow(file, value, thirdValue, thirdSuffix) {
      const row = document.createElement('tr');
      row.tabIndex = 0;
      row.appendChild(fileCellUtils.create(file.relativePath));
      row.appendChild(createCell(formatPercent(value), 'count-cell'));
      row.appendChild(createCell(String(thirdValue || 0) + (thirdSuffix || ''), 'count-cell'));
      const open = () => openCoverageDetail(file);
      row.addEventListener('click', open);
      row.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
      return row;
    }

    function renderCoverageTables() {
      const files = currentSummary.coverage?.files || [];
      const withCoverage = files
        .filter(file => coverageForFile(file) !== null && (currentScope !== 'newCode' || file.newLinesToCover > 0))
        .sort((left, right) => Number(coverageForFile(left)) - Number(coverageForFile(right)))
        .slice(0, 20);
      elements.coverageFilesBody.textContent = '';
      elements.coverageFilesCount.textContent = String(withCoverage.length) + (withCoverage.length === 1 ? ' archivo' : ' archivos');
      elements.noCoverageFiles.hidden = withCoverage.length > 0;
      for (const file of withCoverage) {
        elements.coverageFilesBody.appendChild(createCoverageFileRow(
          file,
          coverageForFile(file),
          uncoveredForFile(file)
        ));
      }

      const withDuplications = files
        .filter(file => Number(duplicationForFile(file) || 0) > 0)
        .sort((left, right) => Number(duplicationForFile(right)) - Number(duplicationForFile(left)))
        .slice(0, 20);
      elements.duplicationFilesBody.textContent = '';
      elements.duplicationFilesCount.textContent = String(withDuplications.length) + (withDuplications.length === 1 ? ' archivo' : ' archivos');
      elements.noDuplicationFiles.hidden = withDuplications.length > 0;
      for (const file of withDuplications) {
        elements.duplicationFilesBody.appendChild(createCoverageFileRow(
          file,
          duplicationForFile(file),
          file.duplicatedBlocks,
          ''
        ));
      }
    }

    function renderSinglePercentChart(container, legend, data, key, name, color) {
      container.textContent = '';
      legend.textContent = '';
      const legendItem = document.createElement('span');
      legendItem.className = 'coverage-legend-item';
      const dot = document.createElement('i');
      dot.style.backgroundColor = color;
      legendItem.append(dot, document.createTextNode(name));
      legend.appendChild(legendItem);
      const availableData = data.filter(point =>
        point[key] !== null && point[key] !== undefined && Number.isFinite(Number(point[key]))
      );
      if (!availableData.length) {
        const empty = document.createElement('div');
        empty.className = 'chart-empty';
        empty.textContent = 'No hay análisis históricos disponibles.';
        container.appendChild(empty);
        return;
      }
      const viewport = chartViewport(container, 760, 260);
      const width = viewport.width;
      const height = viewport.height;
      const margin = { top: 18, right: 18, bottom: 38, left: 45 };
      const plotWidth = width - margin.left - margin.right;
      const plotHeight = height - margin.top - margin.bottom;
      const svg = createSvgElement('svg', { class: 'chart-svg', viewBox: '0 0 ' + width + ' ' + height, preserveAspectRatio: 'xMidYMid meet' });
      for (let index = 0; index <= 4; index += 1) {
        const y = margin.top + plotHeight * index / 4;
        const labelValue = 100 - index * 25;
        svg.appendChild(createSvgElement('line', { x1: margin.left, y1: y, x2: width - margin.right, y2: y, stroke: 'var(--vscode-panel-border)', 'stroke-dasharray': '3 3' }));
        const label = createSvgElement('text', { x: margin.left - 8, y: y + 4, fill: 'var(--vscode-descriptionForeground)', 'font-size': 10, 'text-anchor': 'end' });
        label.textContent = labelValue + '%';
        svg.appendChild(label);
      }
      const xFor = index => margin.left + (availableData.length === 1 ? plotWidth / 2 : plotWidth * index / (availableData.length - 1));
      const yFor = value => margin.top + plotHeight - Math.max(0, Math.min(100, Number(value))) / 100 * plotHeight;
      const labelStep = Math.max(1, Math.ceil(availableData.length / 5));
      availableData.forEach((point, index) => {
        if (index % labelStep !== 0 && index !== availableData.length - 1) return;
        const label = createSvgElement('text', {
          x: xFor(index),
          y: height - 12,
          fill: 'var(--vscode-descriptionForeground)',
          'font-size': 10,
          'text-anchor': 'middle'
        });
        label.textContent = formatEvolutionDate(point.date || point.label);
        svg.appendChild(label);
      });
      const points = availableData.map((point, index) => xFor(index) + ',' + yFor(point[key])).join(' ');
      svg.appendChild(createSvgElement('polyline', { points, fill: 'none', stroke: color, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
      availableData.forEach((point, index) => {
        const circle = createSvgElement('circle', { cx: xFor(index), cy: yFor(point[key]), r: 4, fill: color });
        svg.appendChild(circle);
      });
      svg.addEventListener('mousemove', event => {
        const rect = svg.getBoundingClientRect();
        const viewX = ((event.clientX - rect.left) / rect.width) * width;
        const ratio = clamp((viewX - margin.left) / plotWidth, 0, 1);
        const pointIndex = Math.round(
          ratio * Math.max(0, availableData.length - 1)
        );
        showChartTooltip(
          availableData[pointIndex],
          [{ key, name, color }],
          event.clientX,
          event.clientY
        );
      });
      svg.addEventListener('mouseleave', () =>
        document.querySelector('.chart-tooltip')?.remove()
      );
      container.appendChild(svg);
    }

    function renderCoverageEvolution() {
      const data = currentSummary.evolution || [];
      const coverageKey = currentScope === 'newCode' ? 'newCoverage' : 'coverage';
      const duplicationKey = currentScope === 'newCode' ? 'newDuplicatedLinesDensity' : 'duplicatedLinesDensity';
      elements.coverageEvolutionCount.textContent = String(data.length) + ' análisis';
      renderSinglePercentChart(elements.coverageChart, elements.coverageLegend, data, coverageKey, 'Cobertura', dashboardColors.coverage.covered);
      renderSinglePercentChart(elements.duplicationChart, elements.duplicationLegend, data, duplicationKey, 'Duplicación', dashboardColors.coverage.duplicated);
    }

    function renderCoverageView() {
      renderCoverageSummary();
      renderCoverageTables();
      renderCoverageEvolution();
    }

    function renderCoverageDetail(detail) {
      currentCoverageDetail = detail;
      selectedCoverageFile = detail.file;
      elements.coverageDialogLoading.hidden = true;
      elements.coverageDialogContent.hidden = false;
      elements.coverageDialogPath.textContent = detail.file.relativePath;
      const counts = { covered: 0, partial: 0, uncovered: 0, none: 0 };
      for (const line of detail.lines || []) counts[line.status] = (counts[line.status] || 0) + 1;
      elements.coverageLineSummary.textContent = '';
      elements.coverageLineSummary.append(
        createCoverageMetric(String(counts.covered), 'Cubiertas', 'coverage-covered'),
        createCoverageMetric(String(counts.partial), 'Parciales', 'coverage-partial'),
        createCoverageMetric(String(counts.uncovered), 'Sin cubrir', 'coverage-uncovered'),
        createCoverageMetric(String((detail.duplications || []).length), 'Grupos duplicados', 'coverage-duplicated')
      );
      elements.duplicationGroups.textContent = '';
      const groups = detail.duplications || [];
      elements.noDuplicationGroups.hidden = groups.length > 0;
      groups.forEach((group, groupIndex) => {
        const section = document.createElement('section');
        section.className = 'duplication-group';
        const heading = document.createElement('h4');
        heading.textContent = 'Grupo ' + String(groupIndex + 1);
        const headingRow = document.createElement('div');
        headingRow.className = 'duplication-group-heading';
        const compare = document.createElement('button');
        compare.type = 'button';
        compare.className = 'secondary';
        compare.textContent = 'Comparar código';
        compare.addEventListener('click', () => vscode.postMessage({
          type: 'openDuplicationComparison',
          fileUri: detail.file.fileUri,
          groupIndex
        }));
        headingRow.append(heading, compare);
        section.appendChild(headingRow);
        for (const location of group.locations || []) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'duplication-location secondary';
          button.textContent = location.relativePath + ':' + location.from + '–' + String(location.from + location.size - 1);
          button.disabled = !location.fileUri;
          button.addEventListener('click', () => vscode.postMessage({ type: 'openIssue', fileUri: location.fileUri, line: location.from }));
          section.appendChild(button);
        }
        elements.duplicationGroups.appendChild(section);
      });
    }
`;
