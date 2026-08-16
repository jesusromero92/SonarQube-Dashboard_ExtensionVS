import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';
import type * as vscode from 'vscode';
import { PipelineHistoryStore } from '../src/modules/pipeline/history';
import type {
  AnalysisRequest,
  AnalysisState,
  PipelineRunHistoryEntry,
  PipelineRunHistoryStep
} from '../src/modules/pipeline/models';
import { diffStructuredResults } from '../src/modules/pipeline/results/diff';
import { createStructuredResult } from '../src/modules/pipeline/results/fingerprint';
import { parseRegisteredIntegrationResult } from '../src/modules/pipeline/results/integrationParser';
import { parseEslintResult } from '../src/modules/pipeline/results/parsers/eslint';
import { ProcessRunner } from '../src/modules/pipeline/scanner/processRunner';
import { HISTORY_SCRIPT } from '../src/modules/pipeline/webview/history';

const FIXTURE_DIRECTORY = path.join(process.cwd(), 'test', 'fixtures');
const RUN_1_FIXTURE = path.join(FIXTURE_DIRECTORY, 'eslint-run-1.json');
const RUN_2_FIXTURE = path.join(FIXTURE_DIRECTORY, 'eslint-run-2.json');

interface MemoryContext {
  context: vscode.ExtensionContext;
  values: Map<string, unknown>;
}

function createMemoryContext(): MemoryContext {
  const values = new Map<string, unknown>();
  const workspaceState = {
    keys: () => [...values.keys()],
    get: <T>(key: string, defaultValue?: T): T | undefined =>
      values.has(key) ? values.get(key) as T : defaultValue,
    update: async (key: string, value: unknown): Promise<void> => {
      if (value === undefined) values.delete(key);
      else values.set(key, value);
    }
  };
  return {
    values,
    context: { workspaceState } as unknown as vscode.ExtensionContext
  };
}

function fixtureOutput(file: string, exitCode = 1) {
  return {
    toolId: 'eslint',
    toolName: 'ESLint',
    command: 'eslint . --format json',
    cwd: process.cwd(),
    exitCode,
    output: readFileSync(file, 'utf8')
  };
}

function request(rootPath: string, projectKey = 'demo', branch = 'main'): AnalysisRequest {
  return {
    rootPath,
    config: {
      projectKey,
      projectName: 'Demo',
      branch
    },
    actions: { steps: [] },
    variables: { customVariables: {}, integrationCommands: {}, secrets: {} }
  } as unknown as AnalysisRequest;
}

function state(
  result: ReturnType<typeof parseEslintResult>,
  startedAt: string,
  integrationId = 'eslint',
  log = [result.toolName]
): AnalysisState {
  const step: PipelineRunHistoryStep = {
    id: `eslint-${startedAt}`,
    name: 'ESLint',
    kind: 'custom',
    command: 'eslint . --format json',
    failurePolicy: 'continue',
    integrationId,
    status: 'warning',
    result
  };
  return {
    running: false,
    phase: 'success',
    message: 'Pipeline completado con 1 advertencia(s).',
    scanner: 'SonarScanner genérico (NPM)',
    startedAt,
    completedAt: new Date(new Date(startedAt).getTime() + 1_000).toISOString(),
    canCancel: false,
    log,
    steps: [{ ...step, enabled: true }]
  };
}

async function executeFixture(file: string) {
  const script = [
    "const fs = require('node:fs');",
    "process.stdout.write(fs.readFileSync(process.argv[1], 'utf8'));",
    "process.stderr.write('\\nESLint completed with findings.\\n');",
    'process.exitCode = 1;'
  ].join('');
  return new ProcessRunner().run(
    {
      command: process.execPath,
      args: ['-e', script, file],
      cwd: process.cwd(),
      env: { ...process.env, NO_COLOR: '1' }
    },
    new AbortController().signal,
    () => undefined
  );
}

test('ESLint RUN #1 -> RUN #2 -> restart conserva findings, fingerprints, diff y logs reales', async () => {
  const memory = createMemoryContext();
  const rootPath = path.join(process.cwd(), 'test', 'fixtures');
  const history = new PipelineHistoryStore(memory.context);

  const processRun1 = await executeFixture(RUN_1_FIXTURE);
  assert.equal(processRun1.exitCode, 1);
  const run1 = parseRegisteredIntegrationResult({
    ...fixtureOutput(RUN_1_FIXTURE, processRun1.exitCode),
    output: processRun1.output.join('')
  });
  assert.ok(run1);
  assert.equal(run1.status, 'parsed');
  assert.equal(run1.summary.total, 2);
  assert.equal(run1.findings.length, 2);
  assert.match(processRun1.output.join(''), /ESLint completed with findings/);

  await history.record(request(rootPath), state(
    run1,
    '2026-08-16T10:00:00.000Z',
    'eslint',
    processRun1.output
  ));
  const storedRun1 = (await history.list(rootPath))[0];
  assert.equal(storedRun1.steps[0].result?.summary.total, 2);
  assert.equal(storedRun1.steps[0].resultDiff, undefined);
  assert.match(storedRun1.log.join(''), /eqeqeq/);
  assert.match(storedRun1.log.join(''), /ESLint completed with findings/);

  const processRun2 = await executeFixture(RUN_2_FIXTURE);
  assert.equal(processRun2.exitCode, 1);
  const run2 = parseRegisteredIntegrationResult({
    ...fixtureOutput(RUN_2_FIXTURE, processRun2.exitCode),
    output: processRun2.output.join('')
  });
  assert.ok(run2);
  assert.equal(run2.status, 'parsed');
  assert.equal(run2.summary.total, 2);

  const run1ByRule = new Map(run1.findings.map(finding => [finding.ruleId, finding]));
  const run2ByRule = new Map(run2.findings.map(finding => [finding.ruleId, finding]));
  assert.equal(
    run1ByRule.get('no-console')?.fingerprint,
    run2ByRule.get('no-console')?.fingerprint
  );
  assert.notEqual(run1ByRule.get('eqeqeq')?.fingerprint, run2ByRule.get('no-unused-vars')?.fingerprint);

  await history.record(request(rootPath), state(
    run2,
    '2026-08-16T10:05:00.000Z',
    'eslint',
    processRun2.output
  ));
  const storedRun2 = (await history.list(rootPath))[0];
  assert.equal(storedRun2.steps[0].result?.summary.total, 2);
  assert.deepEqual(
    {
      new: storedRun2.steps[0].resultDiff?.newCount,
      persistent: storedRun2.steps[0].resultDiff?.persistentCount,
      resolved: storedRun2.steps[0].resultDiff?.resolvedCount
    },
    { new: 1, persistent: 1, resolved: 1 }
  );

  const restoredHistory = new PipelineHistoryStore(memory.context);
  const restoredRun2 = (await restoredHistory.list(rootPath))[0];
  assert.equal(restoredRun2.steps[0].result?.summary.total, 2);
  assert.deepEqual(
    {
      new: restoredRun2.steps[0].resultDiff?.newCount,
      persistent: restoredRun2.steps[0].resultDiff?.persistentCount,
      resolved: restoredRun2.steps[0].resultDiff?.resolvedCount
    },
    { new: 1, persistent: 1, resolved: 1 }
  );
});

test('diff ESLint cubre ejecución idéntica, todo resuelto y todo nuevo', () => {
  const run1 = parseEslintResult(fixtureOutput(RUN_1_FIXTURE));
  const identical = parseEslintResult(fixtureOutput(RUN_1_FIXTURE));
  const run2 = parseEslintResult(fixtureOutput(RUN_2_FIXTURE));
  const empty = parseEslintResult({
    ...fixtureOutput(RUN_2_FIXTURE, 0),
    output: '[]'
  });

  const identicalDiff = diffStructuredResults(identical, run1, 'run-1');
  assert.deepEqual(
    [identicalDiff?.newCount, identicalDiff?.persistentCount, identicalDiff?.resolvedCount],
    [0, 2, 0]
  );
  const resolvedDiff = diffStructuredResults(empty, run1, 'run-1');
  assert.deepEqual(
    [resolvedDiff?.newCount, resolvedDiff?.persistentCount, resolvedDiff?.resolvedCount],
    [0, 0, 2]
  );
  const allNewDiff = diffStructuredResults(run2, run1, 'run-1');
  assert.deepEqual(
    [allNewDiff?.newCount, allNewDiff?.persistentCount, allNewDiff?.resolvedCount],
    [1, 1, 1]
  );

  const cAndD = createStructuredResult(
    fixtureOutput(RUN_2_FIXTURE, 0),
    run1.parserId,
    'parsed',
    [
      { fingerprint: 'c', title: 'C', severity: 'high' },
      { fingerprint: 'd', title: 'D', severity: 'medium' }
    ]
  );
  const aAndB = createStructuredResult(
    fixtureOutput(RUN_1_FIXTURE, 0),
    run1.parserId,
    'parsed',
    [
      { fingerprint: 'a', title: 'A', severity: 'high' },
      { fingerprint: 'b', title: 'B', severity: 'medium' }
    ]
  );
  const disjointDiff = diffStructuredResults(cAndD, aAndB, 'run-ab');
  assert.deepEqual(
    [disjointDiff?.newCount, disjointDiff?.persistentCount, disjointDiff?.resolvedCount],
    [2, 0, 2]
  );
});

test('el historial rechaza baselines incompatibles por proyecto, rama, integración o parser', async () => {
  const rootPath = path.join(process.cwd(), 'test', 'fixtures');
  const run1 = parseEslintResult(fixtureOutput(RUN_1_FIXTURE));
  const run2 = parseEslintResult(fixtureOutput(RUN_2_FIXTURE));
  const scenarios = [
    {
      name: 'project',
      baselineRequest: request(rootPath, 'other-project', 'main'),
      currentRequest: request(rootPath, 'demo', 'main'),
      baselineState: state(run1, '2026-08-16T11:00:00.000Z')
    },
    {
      name: 'branch',
      baselineRequest: request(rootPath, 'demo', 'develop'),
      currentRequest: request(rootPath, 'demo', 'main'),
      baselineState: state(run1, '2026-08-16T11:00:00.000Z')
    },
    {
      name: 'integration',
      baselineRequest: request(rootPath),
      currentRequest: request(rootPath),
      baselineState: state(run1, '2026-08-16T11:00:00.000Z', 'other-integration')
    },
    {
      name: 'parser',
      baselineRequest: request(rootPath),
      currentRequest: request(rootPath),
      baselineState: state(
        { ...run1, parserId: 'eslint-json-v0' },
        '2026-08-16T11:00:00.000Z'
      )
    }
  ];

  for (const scenario of scenarios) {
    const memory = createMemoryContext();
    const history = new PipelineHistoryStore(memory.context);
    await history.record(scenario.baselineRequest, scenario.baselineState);
    await history.record(
      scenario.currentRequest,
      state(run2, '2026-08-16T11:05:00.000Z')
    );
    const current = (await history.list(rootPath))[0];
    assert.equal(current.steps[0].resultDiff, undefined, scenario.name);
  }
});

test('historial legacy sin resultado, diff ni integrationId se restaura sin excepción', async () => {
  const memory = createMemoryContext();
  const rootPath = path.join(process.cwd(), 'test', 'fixtures');
  const history = new PipelineHistoryStore(memory.context);
  const run1 = parseEslintResult(fixtureOutput(RUN_1_FIXTURE));
  await history.record(request(rootPath), state(run1, '2026-08-16T12:00:00.000Z'));
  const key = [...memory.values.keys()][0];
  const legacy: PipelineRunHistoryEntry = {
    ...(await history.list(rootPath))[0],
    steps: [{
      id: 'legacy-lint',
      name: 'Legacy lint',
      kind: 'custom',
      command: 'eslint .',
      failurePolicy: 'continue',
      status: 'warning'
    }]
  };
  memory.values.set(key, [legacy]);

  const restored = await new PipelineHistoryStore(memory.context).list(rootPath);
  assert.equal(restored.length, 1);
  assert.equal(restored[0].steps[0].result, undefined);
  assert.equal(restored[0].steps[0].resultDiff, undefined);
  assert.equal(restored[0].steps[0].integrationId, undefined);
});

test('snapshot truncado se persiste con total real y diff no fiable', async () => {
  const output = fixtureOutput(RUN_1_FIXTURE, 0);
  const findings = Array.from({ length: 501 }, (_, index) => ({
    fingerprint: `eslint-${index}`,
    title: `Finding ${index}`,
    severity: 'high' as const
  }));
  const truncated = createStructuredResult(output, 'eslint-json-v1', 'parsed', findings);
  const baseline = createStructuredResult(output, 'eslint-json-v1', 'parsed', findings.slice(0, 2));
  const memory = createMemoryContext();
  const rootPath = path.join(process.cwd(), 'test', 'fixtures');
  const history = new PipelineHistoryStore(memory.context);
  await history.record(request(rootPath), state(baseline, '2026-08-16T13:00:00.000Z'));
  await history.record(request(rootPath), state(truncated, '2026-08-16T13:05:00.000Z'));

  const restored = (await new PipelineHistoryStore(memory.context).list(rootPath))[0].steps[0];
  assert.equal(restored.result?.summary.total, 501);
  assert.equal(restored.result?.findings.length, 500);
  assert.equal(restored.result?.truncated, true);
  assert.equal(restored.resultDiff?.reliable, false);
});

test('JSON inválido degrada a partial, conserva el log y el webview representa findings y diff', async () => {
  const rawLog = ['ESLint output that is not valid JSON\n', 'stderr diagnostic\n'];
  const partial = parseEslintResult({
    ...fixtureOutput(RUN_1_FIXTURE),
    output: rawLog.join('')
  });
  assert.equal(partial.status, 'partial');
  assert.equal(partial.summary.total, 0);
  assert.match(partial.message ?? '', /interpretar/i);

  const memory = createMemoryContext();
  const rootPath = path.join(process.cwd(), 'test', 'fixtures');
  const history = new PipelineHistoryStore(memory.context);
  await history.record(
    request(rootPath),
    state(partial, '2026-08-16T14:00:00.000Z', 'eslint', rawLog)
  );
  const restored = (await new PipelineHistoryStore(memory.context).list(rootPath))[0];
  assert.equal(restored.steps[0].result?.status, 'partial');
  assert.match(restored.log.join(''), /ESLint output that is not valid JSON/);
  assert.match(restored.log.join(''), /stderr diagnostic/);

  assert.match(HISTORY_SCRIPT, /result\.summary\?\.total/);
  assert.match(HISTORY_SCRIPT, /diff\.newCount/);
  assert.match(HISTORY_SCRIPT, /diff\.persistentCount/);
  assert.match(HISTORY_SCRIPT, /diff\.resolvedCount/);
  assert.match(HISTORY_SCRIPT, /diff\.reliable === false/);
});
