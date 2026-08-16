import assert from 'node:assert/strict';
import { promises as fs, readFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import {
  PIPELINE_INTEGRATION_PROVIDERS,
  getRegisteredIntegrationWatchFiles
} from '../src/modules/pipeline/integrations';
import { detectProjectActions } from '../src/modules/pipeline/projectActions';
import { SOURCE_MESSAGES } from '../src/modules/pipeline/i18n/source';
import { EN_MESSAGES } from '../src/modules/pipeline/i18n/en';
import { ES_MESSAGES } from '../src/modules/pipeline/i18n/es';

const PROJECT_ACTIONS_SOURCE = readFileSync(
  path.join(process.cwd(), 'src/modules/pipeline/projectActions.ts'),
  'utf8'
);

test('las integraciones se registran como providers independientes y con ids únicos', () => {
  assert.ok(PIPELINE_INTEGRATION_PROVIDERS.length >= 14);
  const ids = PIPELINE_INTEGRATION_PROVIDERS.map(provider => provider.descriptor.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes('eslint'));
  assert.ok(ids.includes('react-doctor'));
  assert.ok(ids.includes('semgrep'));
  assert.ok(ids.includes('ruff'));
  assert.ok(ids.includes('checkov'));
});

test('projectActions delega las herramientas al registro y no contiene detectores concretos', () => {
  assert.doesNotMatch(PROJECT_ACTIONS_SOURCE, /detectEslintIntegration/);
  assert.doesNotMatch(PROJECT_ACTIONS_SOURCE, /detectReactDoctorIntegration/);
  assert.doesNotMatch(PROJECT_ACTIONS_SOURCE, /detectSemgrepIntegration/);
  assert.doesNotMatch(PROJECT_ACTIONS_SOURCE, /detectRuffIntegration/);
  assert.match(PROJECT_ACTIONS_SOURCE, /detectRegisteredIntegrations/);
  assert.match(PROJECT_ACTIONS_SOURCE, /getRegisteredIntegrationCatalog/);
});

test('los providers contribuyen sus archivos al watcher sin enumerarlos en el watcher central', () => {
  const files = getRegisteredIntegrationWatchFiles();
  assert.ok(files.includes('doctor.config.ts'));
  assert.ok(files.includes('.semgrep.yml'));
  assert.ok(files.includes('.golangci.yml'));
  assert.equal(new Set(files).size, files.length);

  const watcherSource = readFileSync(
    path.join(process.cwd(), 'src/modules/pipeline/projectActionsWatcher.ts'),
    'utf8'
  );
  assert.match(watcherSource, /getRegisteredIntegrationWatchFiles/);
  assert.doesNotMatch(watcherSource, /doctor\.config\.ts/);
  assert.doesNotMatch(watcherSource, /\.semgrep\.yml/);
});

test('detecta versión instalada, orígenes y salud de una integración Node', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sonar-provider-health-'));
  try {
    await fs.mkdir(path.join(root, 'node_modules', 'eslint'), { recursive: true });
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({
        packageManager: 'npm@11.5.0',
        scripts: { lint: 'eslint .' },
        devDependencies: { eslint: '^9.0.0' }
      })
    );
    await fs.writeFile(path.join(root, 'eslint.config.js'), 'export default [];\n');
    await fs.writeFile(
      path.join(root, 'node_modules', 'eslint', 'package.json'),
      JSON.stringify({ name: 'eslint', version: '9.12.0' })
    );

    const actions = await detectProjectActions(root);
    const eslint = actions.integrations.find(item => item.id === 'eslint');
    assert.ok(eslint);
    assert.equal(eslint.version, '9.12.0');
    assert.equal(eslint.versionSource, 'installed');
    assert.equal(eslint.health, 'healthy');
    assert.equal(eslint.configurationStatus, 'configured');
    assert.deepEqual(
      new Set(eslint.evidences.map(item => item.source)),
      new Set(['script', 'config', 'devDependency'])
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('marca como parcial una herramienta que está declarada pero requiere configuración', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sonar-provider-partial-'));
  try {
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ devDependencies: { stylelint: '^16.0.0' } })
    );
    const actions = await detectProjectActions(root);
    const stylelint = actions.integrations.find(item => item.id === 'stylelint');
    assert.ok(stylelint);
    assert.equal(stylelint.configurationStatus, 'partial');
    assert.equal(stylelint.health, 'warning');
    assert.equal(stylelint.version, '^16.0.0');
    assert.equal(stylelint.versionSource, 'declared');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('el catálogo de providers genera la instalación Node según el gestor detectado', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sonar-provider-catalog-'));
  try {
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ packageManager: 'pnpm@10.15.0' })
    );
    const actions = await detectProjectActions(root);
    const reactDoctor = actions.integrationCatalog.find(item => item.id === 'react-doctor');
    const audit = actions.integrationCatalog.find(item => item.id === 'dependency-audit');
    assert.equal(reactDoctor?.setupCommand, 'pnpm add -D react-doctor');
    assert.equal(audit?.setupCommand, 'pnpm install');
    assert.equal(audit?.name, 'pnpm audit');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});


test('descripciones y ayudas de providers tienen traducción modular completa', () => {
  const sourceEntries = Object.entries(SOURCE_MESSAGES);
  const context = { rootPath: process.cwd(), platform: process.platform };
  for (const provider of PIPELINE_INTEGRATION_PROVIDERS) {
    const values = [
      provider.descriptor.description,
      provider.getSetup(context).hint,
      provider.descriptor.recommendation?.reason
    ].filter((value): value is string => Boolean(value));
    for (const value of values) {
      const source = sourceEntries.find(([, sourceValue]) => sourceValue === value);
      assert.ok(source, `Falta registrar en i18n/source el texto de ${provider.descriptor.id}: ${value}`);
      const [key] = source;
      assert.ok(EN_MESSAGES[key], `Falta traducción EN de ${provider.descriptor.id}: ${key}`);
      assert.ok(ES_MESSAGES[key], `Falta traducción ES de ${provider.descriptor.id}: ${key}`);
    }
  }
});

test('todos los providers ofrecen una prueba segura o declaran explícitamente que no la soportan', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sonar-provider-probes-'));
  try {
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ packageManager: 'npm@10.9.2' }));
    const context = { rootPath: root, platform: process.platform, node: {
      packageJson: { packageManager: 'npm@10.9.2' },
      packageManager: 'npm' as const,
      declaredPackageManager: 'npm@10.9.2'
    }};
    for (const provider of PIPELINE_INTEGRATION_PROVIDERS) {
      assert.equal(typeof provider.getProbe, 'function', `Falta probe seguro en ${provider.descriptor.id}`);
      const probe = provider.getProbe?.(context, {
        id: provider.descriptor.id,
        name: provider.descriptor.displayName,
        description: provider.descriptor.description,
        command: provider.descriptor.id === 'owasp-dependency-check' ? 'mvn dependency-check:check' : provider.descriptor.id,
        evidence: '',
        evidences: [],
        category: provider.descriptor.category,
        failurePolicy: provider.descriptor.failurePolicy,
        configurationStatus: 'configured',
        health: 'healthy',
        probeSupported: true
      });
      assert.ok(probe);
      assert.equal(probe.cwd, root);
      assert.ok(probe.displayCommand.includes('version'));
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('un provider defectuoso no impide detectar el resto de integraciones', async () => {
  const { detectIntegrationsFromProviders } = await import('../src/modules/pipeline/integrations');
  const descriptor = {
    id: 'healthy-test-provider',
    displayName: 'Healthy',
    description: 'Healthy provider',
    category: 'quality' as const,
    failurePolicy: 'continue' as const
  };
  const context = { rootPath: process.cwd(), platform: process.platform };
  const detected = await detectIntegrationsFromProviders([
    {
      descriptor: { ...descriptor, id: 'broken-test-provider' },
      async detect() { throw new Error('boom'); },
      getSetup() { return { hint: 'none' }; }
    },
    {
      descriptor,
      async detect() {
        return {
          id: descriptor.id,
          name: descriptor.displayName,
          description: descriptor.description,
          command: 'healthy --check',
          evidence: 'test',
          evidences: [{ source: 'config' as const, value: 'test' }],
          category: descriptor.category,
          failurePolicy: descriptor.failurePolicy,
          configurationStatus: 'configured' as const,
          health: 'healthy' as const,
          probeSupported: false
        };
      },
      getSetup() { return { hint: 'none' }; }
    }
  ], context);
  assert.deepEqual(detected.map(item => item.id), ['healthy-test-provider']);
});

test('el runner de probes ejecuta sin shell y aplica timeout', async () => {
  const { IntegrationProbeRunner } = await import('../src/modules/pipeline/integrations');
  const runner = new IntegrationProbeRunner();
  try {
    const version = await runner.run({
      executable: process.execPath,
      args: ['--version'],
      cwd: process.cwd(),
      displayCommand: 'node --version',
      timeoutMs: 2000
    });
    assert.equal(version.success, true);
    assert.match(version.output, /^v\d+/);

    const timeout = await runner.run({
      executable: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 1000)'],
      cwd: process.cwd(),
      displayCommand: 'node timeout-test',
      timeoutMs: 30
    });
    assert.equal(timeout.success, false);
    assert.equal(timeout.timedOut, true);
  } finally {
    runner.dispose();
  }
});

test('los providers con resultados estructurados registran su parser dentro de Pipeline', () => {
  const parserProviders = new Set(
    PIPELINE_INTEGRATION_PROVIDERS
      .filter(provider => Boolean(provider.parseResult))
      .map(provider => provider.descriptor.id)
  );
  for (const id of ['eslint', 'dependency-audit', 'semgrep', 'react-doctor', 'ruff']) {
    assert.equal(parserProviders.has(id), true, `Falta parser estructurado para ${id}`);
  }
});
