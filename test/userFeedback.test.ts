import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildMarketplaceRatingUrl,
  buildSupportIssuePageUrl,
  buildSupportIssueReport,
  sanitizeSupportText,
  shouldPromptForRating
} from '../src/userFeedbackPolicy';

const read = (relativePath: string): string =>
  readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

test('support report is valid Markdown and redacts secrets', () => {
  const report = buildSupportIssueReport({
    extensionVersion: '2.0.0',
    vscodeVersion: '1.100.0',
    platform: 'win32',
    architecture: 'x64',
    source: 'Pipeline',
    errorMessage: 'Failed token=abc123 Bearer super-secret https://x.test?a=1&api_key=hidden'
  });

  assert.match(report, /^## What happened\?/u);
  assert.match(report, /\n## Environment\n/u);
  assert.match(report, /Extension: 2\.0\.0/u);
  assert.match(report, /VS Code: 1\.100\.0/u);
  assert.doesNotMatch(report, /abc123|super-secret|hidden/u);
  assert.match(report, /\[redacted\]/u);
  assert.doesNotMatch(report, /%23|%0A|%5B|%5D/u);
  assert.match(report, /not added automatically/iu);
});

test('support page URL opens the GitHub Bug report template without encoded body query', () => {
  const supportUrl = buildSupportIssuePageUrl(
    'https://github.com/example/repo/issues?old=value#fragment'
  );
  const parsed = new URL(supportUrl);

  assert.equal(parsed.pathname, '/example/repo/issues/new');
  assert.equal(parsed.searchParams.get('template'), 'bug_report.yml');
  assert.equal([...parsed.searchParams.keys()].length, 1);
  assert.equal(parsed.hash, '');
});

test('support text redaction handles common credentials without altering ordinary diagnostics', () => {
  const redacted = sanitizeSupportText(
    String.raw`Connection failed token:abc password=def authorization=Bearer123 C:\Users\demo\project\file.ts https://sonar.example/api normal=value`
  );
  assert.doesNotMatch(redacted, /\babc\b|\bdef\b|Bearer123|Users\\demo|sonar\.example/);
  assert.match(redacted, /\[path\]/);
  assert.match(redacted, /\[url\]/);
  assert.match(redacted, /normal=value/);
});

test('marketplace rating URL targets the extension review section', () => {
  const url = new URL(buildMarketplaceRatingUrl(
    'jesusromero',
    'vscode-sonarqube-dashboard-pipeline'
  ));
  assert.equal(url.hostname, 'marketplace.visualstudio.com');
  assert.equal(
    url.searchParams.get('itemName'),
    'jesusromero.vscode-sonarqube-dashboard-pipeline'
  );
  assert.equal(url.hash, '#review-details');
});

test('rating reminder requires repeated successful use, elapsed usage time and no recent error', () => {
  const now = Date.UTC(2026, 7, 16);
  const fourDaysAgo = now - 4 * 24 * 60 * 60 * 1000;
  assert.equal(
    shouldPromptForRating({ successCount: 5, firstSuccessAt: fourDaysAgo }, now),
    true
  );
  assert.equal(
    shouldPromptForRating({ successCount: 4, firstSuccessAt: fourDaysAgo }, now),
    false
  );
  assert.equal(
    shouldPromptForRating({
      successCount: 5,
      firstSuccessAt: fourDaysAgo,
      lastErrorAt: now - 60 * 60 * 1000
    }, now),
    false
  );
  assert.equal(
    shouldPromptForRating({
      successCount: 5,
      firstSuccessAt: fourDaysAgo,
      ratingDismissed: true
    }, now),
    false
  );
});

test('dashboard and manifest expose support/rating entry points and errors use the shared helper', () => {
  const manifest = JSON.parse(read('package.json')) as {
    contributes?: { commands?: Array<{ command?: string }> };
  };
  const commandIds = new Set(
    (manifest.contributes?.commands ?? []).map(command => command.command)
  );
  assert.equal(commandIds.has('sonarQubeDashboard.contactSupport'), true);
  assert.equal(commandIds.has('sonarQubeDashboard.rateExtension'), true);

  const diagnosticsPage = read('src/dashboard/webview/pages/diagnosticsPage.ts');
  const configurationScript = read('src/dashboard/webview/scripts/core/configuration.ts');
  const userFeedback = read('src/userFeedback.ts');
  const extension = read('src/extension.ts');
  const runtime = read('src/modules/runtime.ts');
  const navigation = read('src/issueNavigation.ts');
  const remediation = read('src/modules/liveRemediation/manager.ts');

  assert.match(diagnosticsPage, /id="contactSupport"/);
  assert.match(diagnosticsPage, /id="rateExtension"/);
  assert.match(configurationScript, /type: 'contactSupport', errorMessage: message/);
  assert.match(userFeedback, /vscode\.env\.clipboard\.writeText\(report\)/);
  assert.match(userFeedback, /buildSupportIssuePageUrl\(issuesUrl\)/);
  for (const source of [extension, runtime, navigation, remediation]) {
    assert.match(source, /showErrorWithSupport/);
  }
});
