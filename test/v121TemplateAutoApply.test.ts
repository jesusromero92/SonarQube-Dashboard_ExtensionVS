import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';

const read = (relativePath: string): string => readFileSync(
  path.resolve(process.cwd(), relativePath),
  'utf8'
);

test('la versión 1.3.0 mantiene la aplicación inmediata de plantillas de la 1.2.1', () => {
  const packageManifest = JSON.parse(read('package.json')) as { version?: string };
  const modal = read('src/modules/pipeline/webview/modals/analysisConfirmationDialog.ts');
  const events = read('src/modules/pipeline/webview/integration.ts');
  const pipelineEditor = read('src/modules/pipeline/webview/editor.ts');

  assert.equal(packageManifest.version, '2.0.0');
  assert.doesNotMatch(modal, /applyAnalysisPipelineTemplate/);
  assert.doesNotMatch(modal, /Aplicar plantilla/);
  assert.match(
    events,
    /analysisPipelineTemplate\.addEventListener\('change',[\s\S]*applyTemplateToAnalysis\([\s\S]*pipelineTemplateById\(elements\.analysisPipelineTemplate\.value\)/
  );
  assert.match(
    pipelineEditor,
    /function applyTemplateToAnalysis\(template\)[\s\S]*if \(!template\)[\s\S]*createAnalysisRunStepRow\(sonarAnalysisRunStep\(\)\)/
  );
});

test('la documentación registra el comportamiento de selección inmediata de plantillas', () => {
  assert.match(read('CHANGELOG.md'), /## \[1\.2\.1\] - 2026-08-13/);
  assert.match(read('README.md'), /applies its steps immediately/);
  assert.match(read('README.es.md'), /aplica sus pasos inmediatamente/);
});
