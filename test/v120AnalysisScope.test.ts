import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';
import {
  analysisScopeProperties,
  hasExplicitAnalysisScope,
  normalizeAnalysisPatterns
} from '../src/modules/pipeline/scanner/analysisScope';
import { PIPELINE_CONFIGURATION_PANEL_MARKUP } from '../src/modules/pipeline/webview/configuration';
import { PIPELINE_INTEGRATION_SCRIPT } from '../src/modules/pipeline/webview/integration';
import { PIPELINE_LOCALIZATION } from '../src/modules/pipeline/i18n';

import { DISCLOSURE_STYLES } from '../src/dashboard/webview/design/components/disclosure';
import { SOURCE_MESSAGES } from '../src/i18n/source';
import { EN_MESSAGES } from '../src/i18n/en';
import { ES_MESSAGES } from '../src/i18n/es';

const ALL_SOURCE_MESSAGES: Record<string, string> = { ...SOURCE_MESSAGES, ...PIPELINE_LOCALIZATION.source };
const ALL_EN_MESSAGES: Record<string, string> = { ...EN_MESSAGES, ...PIPELINE_LOCALIZATION.en };
const ALL_ES_MESSAGES: Record<string, string> = { ...ES_MESSAGES, ...PIPELINE_LOCALIZATION.es };

test('las inclusiones y exclusiones pertenecen a la configuración del módulo Pipeline', () => {
  assert.match(PIPELINE_CONFIGURATION_PANEL_MARKUP, /Inclusiones y exclusiones/);
  assert.match(PIPELINE_CONFIGURATION_PANEL_MARKUP, /id="analysisInclusions"/);
  assert.match(PIPELINE_CONFIGURATION_PANEL_MARKUP, /id="analysisExclusions"/);
  assert.match(PIPELINE_CONFIGURATION_PANEL_MARKUP, /sonar\.inclusions/);
  assert.match(PIPELINE_CONFIGURATION_PANEL_MARKUP, /sonar\.exclusions/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /analysisInclusions: elements\.analysisInclusions\.value\.trim\(\)/);
  assert.match(PIPELINE_INTEGRATION_SCRIPT, /analysisExclusions: elements\.analysisExclusions\.value\.trim\(\)/);
});

test('los patrones aceptan líneas y comas, se limpian y no se duplican', () => {
  assert.equal(
    normalizeAnalysisPatterns('src/**\n packages/*/src/**,src/**\r\n'),
    'src/**,packages/*/src/**'
  );
  assert.equal(normalizeAnalysisPatterns('   '), '');
});

test('las propiedades de alcance usan la sintaxis de cada scanner', () => {
  const config = {
    analysisInclusions: 'src/**\npackages/*/src/**',
    analysisExclusions: '**/generated/**, **/*.min.js'
  };

  assert.deepEqual(analysisScopeProperties(config, '-D'), [
    '-Dsonar.inclusions=src/**,packages/*/src/**',
    '-Dsonar.exclusions=**/generated/**,**/*.min.js'
  ]);
  assert.deepEqual(analysisScopeProperties(config, '/d:'), [
    '/d:sonar.inclusions=src/**,packages/*/src/**',
    '/d:sonar.exclusions=**/generated/**,**/*.min.js'
  ]);
  assert.equal(hasExplicitAnalysisScope(config), true);
  assert.equal(
    hasExplicitAnalysisScope({ analysisInclusions: '', analysisExclusions: '' }),
    false
  );
});

test('los scanners integrados consumen el alcance y conservan los defaults solo sin configuración explícita', () => {
  const analysisService = readFileSync(
    path.resolve(process.cwd(), 'src/modules/pipeline/executionService.ts'),
    'utf8'
  );

  assert.match(
    analysisService,
    /\.\.\.analysisScopeProperties\(request\.config, '\/d:'\)/
  );
  assert.match(
    analysisService,
    /values\.push\(\.\.\.analysisScopeProperties\(request\.config, prefix\)\)/
  );
  assert.match(
    analysisService,
    /if \(!hasExplicitAnalysisScope\(request\.config\)\) \{[\s\S]*DEFAULT_EXCLUSIONS/
  );
  assert.match(analysisService, /analysisInclusions/);
  assert.match(analysisService, /analysisExclusions/);
});

test('la barra de tabs ya no tiene separación horizontal inicial', () => {
  const tabRule = DISCLOSURE_STYLES.match(/\.configuration-tabs \{[\s\S]*?\n    \}/)?.[0] ?? '';
  assert.match(tabRule, /padding: 0;/);
  assert.doesNotMatch(tabRule, /padding: 0 16px/);
});

test('manifest 1.3.0, traducciones y documentación mantienen la configuración 1.2.0', () => {
  const packageManifest = JSON.parse(readFileSync(
    path.resolve(process.cwd(), 'package.json'),
    'utf8'
  )) as {
    version?: string;
    contributes?: { configuration?: { properties?: Record<string, unknown> } };
  };
  const properties = packageManifest.contributes?.configuration?.properties ?? {};
  assert.equal(packageManifest.version, '2.0.0');
  assert.ok(properties['sonarQubeDashboard.pipeline.analysisInclusions']);
  assert.ok(properties['sonarQubeDashboard.pipeline.analysisExclusions']);

  for (const key of [
    'analysisScopeTitle',
    'analysisScopeDescription',
    'analysisScopePatternsHint',
    'analysisInclusions',
    'analysisInclusionsHint',
    'analysisExclusions',
    'analysisExclusionsHint',
    'analysisScopeDefaultsHint'
  ] as const) {
    assert.ok(ALL_SOURCE_MESSAGES[key]);
    assert.ok(ALL_EN_MESSAGES[key]);
    assert.ok(ALL_ES_MESSAGES[key]);
  }

  const readme = readFileSync(path.resolve(process.cwd(), 'README.md'), 'utf8');
  const readmeEs = readFileSync(path.resolve(process.cwd(), 'README.es.md'), 'utf8');
  const changelog = readFileSync(path.resolve(process.cwd(), 'CHANGELOG.md'), 'utf8');
  assert.match(readme, /analysisInclusions/);
  assert.match(readmeEs, /analysisExclusions/);
  assert.match(changelog, /## \[1\.2\.0\] - 2026-08-09/);
});
