import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDependencyAuditResult } from '../src/modules/pipeline/results/parsers/dependencyAudit';
import { parseEslintResult } from '../src/modules/pipeline/results/parsers/eslint';
import { parseReactDoctorResult } from '../src/modules/pipeline/results/parsers/reactDoctor';
import { parseRuffResult } from '../src/modules/pipeline/results/parsers/ruff';
import { parseSemgrepResult } from '../src/modules/pipeline/results/parsers/semgrep';
import { diffStructuredResults } from '../src/modules/pipeline/results/diff';
import { createStructuredResult, stripAnsi } from '../src/modules/pipeline/results/fingerprint';
import { attachStructuredResultDiffs } from '../src/modules/pipeline/history';
import { associatePipelineStepsWithIntegrations } from '../src/modules/pipeline/requests';
import type { DetectedProjectIntegration } from '../src/modules/pipeline/integrations';
import type { PipelineRunHistoryEntry } from '../src/modules/pipeline/models';

const baseOutput = {
  toolId: 'tool',
  toolName: 'Tool',
  command: 'tool --json',
  cwd: '/workspace',
  exitCode: 1
};

test('ESLint parser converts JSON messages into stable findings and metrics', () => {
  const result = parseEslintResult({
    ...baseOutput,
    toolId: 'eslint',
    toolName: 'ESLint',
    output: JSON.stringify([{
      filePath: '/workspace/src/a.ts',
      errorCount: 1,
      warningCount: 1,
      messages: [
        { ruleId: 'eqeqeq', severity: 2, message: 'Expected ===.', line: 4, column: 7 },
        { ruleId: 'no-console', severity: 1, message: 'Unexpected console.', line: 8, column: 3 }
      ]
    }])
  });

  assert.equal(result.status, 'parsed');
  assert.equal(result.summary.total, 2);
  assert.equal(result.summary.high, 1);
  assert.equal(result.summary.medium, 1);
  assert.equal(result.findings[0].location?.file, 'src/a.ts');
  assert.equal(result.metrics.find(item => item.key === 'errors')?.value, 1);
});

test('ESLint text fallback parses the standard summary without a backtracking regex', () => {
  const result = parseEslintResult({
    ...baseOutput,
    toolId: 'eslint',
    toolName: 'ESLint',
    output: '✖ 3 problems (2 errors, 1 warning)'
  });

  assert.equal(result.status, 'partial');
  assert.equal(result.metrics.find(item => item.key === 'total')?.value, 3);
  assert.equal(result.metrics.find(item => item.key === 'errors')?.value, 2);
  assert.equal(result.metrics.find(item => item.key === 'warnings')?.value, 1);
});

test('ANSI stripping preserves Unicode code points while removing control sequences', () => {
  assert.equal(stripAnsi('\u001b[31m🚀 café\u001b[0m'), '🚀 café');
  assert.equal(stripAnsi('A\u001b]0;title\u0007🚀'), 'A🚀');
});

test('npm audit parser converts advisories and severity totals', () => {
  const result = parseDependencyAuditResult({
    ...baseOutput,
    toolId: 'dependency-audit',
    toolName: 'npm audit',
    output: JSON.stringify({
      auditReportVersion: 2,
      vulnerabilities: {
        demo: {
          severity: 'high',
          range: '<2.0.0',
          via: [{ source: 123, title: 'Prototype pollution', severity: 'high', url: 'https://example.invalid/123', range: '<2.0.0' }]
        }
      },
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } }
    })
  });

  assert.equal(result.status, 'parsed');
  assert.equal(result.findings[0].fingerprint, 'npm-advisory:123');
  assert.equal(result.summary.high, 1);
  assert.equal(result.metrics.find(item => item.key === 'vulnerabilities.total')?.value, 1);
});

test('Semgrep parser keeps tool fingerprint and source location', () => {
  const result = parseSemgrepResult({
    ...baseOutput,
    toolId: 'semgrep',
    toolName: 'Semgrep',
    output: JSON.stringify({
      results: [{
        check_id: 'javascript.lang.security.demo',
        path: 'src/a.ts',
        start: { line: 5, col: 2 },
        end: { line: 5, col: 10 },
        extra: { message: 'Unsafe call', severity: 'ERROR', fingerprint: 'semgrep-fingerprint' }
      }],
      errors: []
    })
  });
  assert.equal(result.summary.total, 1);
  assert.equal(result.findings[0].fingerprint, 'semgrep-fingerprint');
  assert.equal(result.findings[0].location?.line, 5);
});

test('Ruff parser converts JSON diagnostics and fixable metric', () => {
  const result = parseRuffResult({
    ...baseOutput,
    toolId: 'ruff',
    toolName: 'Ruff',
    output: JSON.stringify([{
      code: 'F401',
      message: 'Imported but unused',
      filename: '/workspace/app.py',
      location: { row: 1, column: 1 },
      end_location: { row: 1, column: 10 },
      fix: { applicability: 'safe' }
    }])
  });
  assert.equal(result.summary.total, 1);
  assert.equal(result.findings[0].ruleId, 'F401');
  assert.equal(result.metrics.find(item => item.key === 'fixable')?.value, 1);
});

test('React Doctor parser produces findings for file locations and remains partial for summary-only output', () => {
  const parsed = parseReactDoctorResult({
    ...baseOutput,
    toolId: 'react-doctor',
    toolName: 'React Doctor',
    output: 'src/App.tsx:12:4 warning: Avoid unstable context value\n1 problem'
  });
  assert.equal(parsed.status, 'parsed');
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0].location?.file, 'src/App.tsx');

  const partial = parseReactDoctorResult({
    ...baseOutput,
    toolId: 'react-doctor',
    toolName: 'React Doctor',
    output: 'React Doctor completed. Problems: 6'
  });
  assert.equal(partial.status, 'partial');
  assert.equal(partial.metrics.find(item => item.key === 'problems')?.value, 6);
});

test('structured diff identifies new, persistent and resolved fingerprints', () => {
  const previous = createStructuredResult(
    { ...baseOutput, output: '', exitCode: 0 },
    'test-parser',
    'parsed',
    [
      { fingerprint: 'a', title: 'A', severity: 'high' },
      { fingerprint: 'b', title: 'B', severity: 'medium' }
    ]
  );
  const current = createStructuredResult(
    { ...baseOutput, output: '', exitCode: 0 },
    'test-parser',
    'parsed',
    [
      { fingerprint: 'b', title: 'B', severity: 'medium' },
      { fingerprint: 'c', title: 'C', severity: 'high' }
    ]
  );
  const diff = diffStructuredResults(current, previous, 'previous-run');
  assert.equal(diff?.newCount, 1);
  assert.equal(diff?.resolvedCount, 1);
  assert.equal(diff?.persistentCount, 1);
  assert.equal(diff?.newFindings[0].fingerprint, 'c');
  assert.equal(diff?.resolvedFindings[0].fingerprint, 'a');
});


test('structured diff rejects incompatible parser versions and reports truncated snapshots as unreliable', () => {
  const previous = createStructuredResult(
    { ...baseOutput, output: '', exitCode: 0 },
    'parser-v1',
    'parsed',
    [{ fingerprint: 'a', title: 'A', severity: 'high' }]
  );
  const incompatible = createStructuredResult(
    { ...baseOutput, output: '', exitCode: 0 },
    'parser-v2',
    'parsed',
    [{ fingerprint: 'b', title: 'B', severity: 'high' }]
  );
  assert.equal(diffStructuredResults(incompatible, previous, 'run-v1'), undefined);

  const manyFindings = Array.from({ length: 501 }, (_, index) => ({
    fingerprint: `finding-${index}`,
    title: `Finding ${index}`,
    severity: 'medium' as const
  }));
  const truncated = createStructuredResult(
    { ...baseOutput, output: '', exitCode: 0 },
    'parser-v1',
    'parsed',
    manyFindings
  );
  const diff = diffStructuredResults(truncated, previous, 'run-v1');
  assert.equal(truncated.summary.total, 501);
  assert.equal(truncated.findings.length, 500);
  assert.equal(truncated.truncated, true);
  assert.equal(diff?.reliable, false);
});

test('history attaches structured diff only to the same tool/integration', () => {
  const previousResult = createStructuredResult(
    { ...baseOutput, toolId: 'eslint', toolName: 'ESLint', output: '', exitCode: 0 },
    'eslint-json-v1',
    'parsed',
    [{ fingerprint: 'old', title: 'Old', severity: 'high' }]
  );
  const currentResult = createStructuredResult(
    { ...baseOutput, toolId: 'eslint', toolName: 'ESLint', output: '', exitCode: 0 },
    'eslint-json-v1',
    'parsed',
    [{ fingerprint: 'new', title: 'New', severity: 'high' }]
  );
  const baseline: PipelineRunHistoryEntry = {
    id: 'run-1', rootPath: '/workspace', projectKey: 'demo', projectName: 'Demo', branch: 'main', scanner: 'scanner',
    status: 'warning', message: '', startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:01:00Z', durationMs: 60000,
    steps: [{ id: 'eslint', name: 'ESLint', kind: 'custom', command: 'eslint', failurePolicy: 'continue', integrationId: 'eslint', status: 'warning', result: previousResult }],
    log: []
  };
  const [step] = attachStructuredResultDiffs([
    { id: 'eslint-next', name: 'ESLint', kind: 'custom', command: 'eslint', failurePolicy: 'continue', integrationId: 'eslint', status: 'warning', result: currentResult }
  ], baseline);
  assert.equal(step.resultDiff?.newCount, 1);
  assert.equal(step.resultDiff?.resolvedCount, 1);
});

test('pipeline steps are associated with integrations by explicit id, generated id, command, or integration variable', () => {
  const integration: DetectedProjectIntegration = {
    id: 'eslint', name: 'ESLint', description: '', command: 'npm exec -- eslint . --format json', evidence: 'package.json', evidences: [],
    category: 'formatting-lint', failurePolicy: 'stop', configurationStatus: 'configured', health: 'healthy', probeSupported: true
  };
  const steps = associatePipelineStepsWithIntegrations([
    { id: 'custom', name: 'A', kind: 'custom', command: '${integration.eslint.command}', failurePolicy: 'stop', enabled: true },
    { id: 'integration-eslint', name: 'B', kind: 'custom', command: 'anything', failurePolicy: 'stop', enabled: true },
    { id: 'custom-2', name: 'C', kind: 'custom', command: integration.command, failurePolicy: 'stop', enabled: true }
  ], [integration]);
  assert.deepEqual(steps.map(step => step.integrationId), ['eslint', 'eslint', 'eslint']);
});
