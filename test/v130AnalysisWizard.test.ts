import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';

const read = (relativePath: string): string => readFileSync(
  path.resolve(process.cwd(), relativePath),
  'utf8'
);

test('v1.3.0 usa un asistente de dos pasos antes de iniciar el análisis', () => {
  const manifest = JSON.parse(read('package.json')) as { version?: string };
  const modal = read('src/dashboard/webview/modals/analysisConfirmationDialog.ts');
  const analysis = read('src/dashboard/webview/scripts/analysis.ts');
  const events = read('src/dashboard/webview/scripts/events/dialogs.ts');
  const elements = read('src/dashboard/webview/scripts/core/elements.ts');

  assert.equal(manifest.version, '1.4.0');
  assert.match(modal, /Seleccionar plantilla/);
  assert.match(modal, /Confirmación/);
  assert.match(modal, /analysisConfirmationTemplateStep/);
  assert.match(modal, /analysisConfirmationReviewStep/);
  assert.match(modal, /Carpeta a analizar/);
  assert.match(modal, /analysisConfirmationInclusions/);
  assert.match(modal, /analysisConfirmationExclusions/);
  assert.match(modal, /analysisConfirmationStepsSummary/);
  assert.match(analysis, /function showAnalysisConfirmationStep\(stepNumber\)/);
  assert.match(analysis, /function reviewRepositoryAnalysis\(\)/);
  assert.match(analysis, /currentConfig\.analysisInclusions/);
  assert.match(analysis, /currentConfig\.analysisExclusions/);
  assert.match(analysis, /currentConfig\.baseDir/);
  assert.match(events, /analysisConfirmationNext\.addEventListener/);
  assert.match(events, /analysisConfirmationBack\.addEventListener/);
  assert.match(elements, /analysisConfirmationTemplateStepIndicator/);
  assert.match(elements, /analysisConfirmationReviewStepIndicator/);
});

test('v1.3.0 oculta el badge de delta cuando no existe variación', () => {
  const baseline = read('src/dashboard/webview/scripts/baseline.ts');
  const styles = read('src/dashboard/webview/styles/analysis.ts');

  assert.match(baseline, /function baselineDeltaLabel/);
  assert.match(baseline, /Math\.abs\(numeric\) < 0\.0001 \? ''/);
  assert.match(baseline, /delta\.hidden = deltaText === ''/);
  assert.match(baseline, /rankDelta === 0\s*\? ''/);
  assert.match(styles, /\.analysis-baseline-delta\[hidden\] \{ display: none; \}/);
});

test('documentación y traducciones registran el flujo 1.3.0', () => {
  const changelog = read('CHANGELOG.md');
  const readme = read('README.md');
  const readmeEs = read('README.es.md');
  const source = read('src/i18n/source.ts');
  const english = read('src/i18n/en.ts');

  assert.match(changelog, /## \[1\.3\.0\] - 2026-08-13/);
  assert.match(changelog, /two-step wizard/);
  assert.match(readme, /Step 1 — Select template/);
  assert.match(readmeEs, /Paso 1 — Seleccionar plantilla/);
  assert.match(source, /analysisWizardSelectTemplate/);
  assert.match(english, /Select template/);
});
