import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';
import {
  compareAnalysisBaselines,
  createAnalysisBaselineSnapshot,
  numericBaselineDelta
} from '../src/scanner/baseline';
import type { SonarAnalysisBaselineData } from '../src/types';

const read = (relativePath: string): string => readFileSync(
  path.resolve(process.cwd(), relativePath),
  'utf8'
);

function baselineData(
  overrides: Partial<SonarAnalysisBaselineData> = {}
): SonarAnalysisBaselineData {
  return {
    hasAnalysis: true,
    issues: 1,
    newIssues: 0,
    securityHotspots: 0,
    newSecurityHotspots: 0,
    coverage: 73.2,
    newCoverage: 80,
    duplication: 4.1,
    newDuplication: 1.2,
    qualityGate: 'OK',
    ...overrides
  };
}

test('v1.3.0 captura una línea base completa y calcula diferencias numéricas', () => {
  const before = createAnalysisBaselineSnapshot(baselineData(), '2026-08-13T10:00:00.000Z');
  const after = createAnalysisBaselineSnapshot(baselineData({
    issues: 0,
    coverage: 75.8,
    duplication: 3.7
  }), '2026-08-13T10:05:00.000Z');
  const comparison = compareAnalysisBaselines(before, after, {
    projectKey: 'demo',
    branch: 'main',
    serverUrl: 'https://sonar.example.test/'
  });

  assert.equal(before.issues, 1);
  assert.equal(before.coverage, 73.2);
  assert.equal(before.duplication, 4.1);
  assert.equal(comparison.projectKey, 'demo');
  assert.equal(comparison.branch, 'main');
  assert.equal(comparison.serverUrl, 'https://sonar.example.test');
  assert.equal(comparison.after.issues, 0);
  assert.equal(numericBaselineDelta(before.issues, after.issues), -1);
  assert.ok(Math.abs((numericBaselineDelta(before.coverage, after.coverage) ?? 0) - 2.6) < 1e-9);
  assert.ok(Math.abs((numericBaselineDelta(before.duplication, after.duplication) ?? 0) + 0.4) < 1e-9);
});

test('v1.3.0 distingue la primera medición de una comparación contra cero', () => {
  const first = createAnalysisBaselineSnapshot(baselineData({ hasAnalysis: false }));
  assert.equal(first.hasAnalysis, false);
});

test('v1.3.0 mantiene la comparación exclusivamente en el historial del pipeline', () => {
  const manifest = JSON.parse(read('package.json')) as { version?: string };
  assert.equal(manifest.version, '1.4.0');

  const control = read('src/dashboard/webview/components/analysisControl.ts');
  const dialog = read('src/dashboard/webview/modals/analysisDialog.ts');
  const history = read('src/dashboard/webview/pages/historyPage.ts');
  const analysisScript = read('src/dashboard/webview/scripts/analysis.ts');
  const historyScript = read('src/dashboard/webview/scripts/history.ts');
  const historyStore = read('src/scanner/history.ts');
  const analysisService = read('src/scanner/analysisService.ts');
  const sonarClient = read('src/sonarClient.ts');
  const dashboardPanel = read('src/dashboardPanel.ts');
  const analysisStyles = read('src/dashboard/webview/styles/analysis.ts');

  assert.doesNotMatch(control, /analysisComparisonPanel/);
  assert.doesNotMatch(dialog, /analysisDialogComparison/);
  assert.match(history, /historyComparison/);
  assert.doesNotMatch(analysisScript, /renderCurrentAnalysisBaselineComparisons/);
  assert.match(historyScript, /renderBaselineComparison/);
  const baselineScript = read('src/dashboard/webview/scripts/baseline.ts');
  assert.match(baselineScript, /snapshot\.newIssues/);
  assert.match(baselineScript, /snapshot\.newCoverage/);
  assert.match(baselineScript, /delta\.hidden = deltaText === ''/);
  assert.match(baselineScript, /baselineDeltaLabel/);
  assert.match(historyStore, /comparison: state\.comparison/);
  assert.match(historyStore, /updateComparison/);
  assert.match(historyStore, /compactHistoryLog\(log\)/);
  assert.doesNotMatch(analysisService, /formatBaselineComparisonLog/);
  assert.match(sonarClient, /fetchAnalysisBaselineData/);
  assert.match(sonarClient, /fetchProjectCoverageTotals/);
  assert.match(sonarClient, /analysisAvailability \?\? summaryMetrics\.hasMeasures/);
  assert.match(dashboardPanel, /fetchAnalysisBaselineData/);
  assert.match(analysisStyles, /--vscode-badge-foreground/);
  assert.doesNotMatch(dashboardPanel, /fetchAllIssues/);
});

test('documentación y changelog describen la línea base 1.3.0', () => {
  assert.match(read('CHANGELOG.md'), /## \[1\.3\.0\] - 2026-08-13/);
  assert.match(read('README.md'), /Before\/after analysis baseline/);
  assert.match(read('README.es.md'), /Línea base antes\/después del análisis/);
});
