import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';

const read = (relativePath: string): string => readFileSync(
  path.resolve(process.cwd(), relativePath),
  'utf8'
);

test('los issues del editor exponen acciones Quick Fix de remediación', () => {
  const source = read('src/issueDecorations.ts');
  const constants = read('src/constants.ts');

  assert.match(source, /SonarQube: Ver regla/);
  assert.match(source, /SonarQube: Marcar como aceptado/);
  assert.match(source, /SonarQube: Asignarme issue/);
  assert.match(source, /SonarQube: Abrir en SonarQube/);
  assert.doesNotMatch(source, /SonarQube: Corregir con IA/);
  assert.doesNotMatch(source, /vscode\.editorChat\.start/);

  assert.match(constants, /showRuleDetail: 'sonarQubeDashboard\.showRuleDetail'/);
  assert.match(constants, /acceptIssue: 'sonarQubeDashboard\.acceptIssue'/);
  assert.match(constants, /assignIssueToMe: 'sonarQubeDashboard\.assignIssueToMe'/);
  assert.match(constants, /openIssueInSonarQube: 'sonarQubeDashboard\.openIssueInSonarQube'/);
  assert.doesNotMatch(constants, /fixIssueWithAi/);
});

test('las acciones remotas usan el usuario y las transiciones reales de SonarQube', () => {
  const extension = read('src/extension.ts');
  const sonarClient = read('src/sonarClient.ts');

  assert.match(extension, /fetchIssueLifecycle\(connection\.config, issue\)/);
  assert.match(extension, /acceptTransitionKey\(detail\.transitions\)/);
  assert.match(extension, /fetchCurrentUser\(connection\.config\)/);
  assert.match(extension, /kind: 'assign'/);
  assert.match(extension, /kind: 'transition'/);
  assert.match(sonarClient, /export async function fetchCurrentUser/);
  assert.match(sonarClient, /api\/users\/current/);
});

test('la versión 1.3.0 elimina el Quick Fix específico de IA', () => {
  const extension = read('src/extension.ts');
  const packageManifest = JSON.parse(read('package.json')) as { version?: string };

  assert.equal(packageManifest.version, '1.3.0');
  assert.doesNotMatch(extension, /fixIssueWithAi/);
  assert.doesNotMatch(extension, /aiFixPrompt/);
  assert.doesNotMatch(extension, /vscode\.editorChat\.start/);
});

test('Ver regla abre directamente el modal de la regla del dashboard', () => {
  const panel = read('src/dashboardPanel.ts');
  const messages = read('src/dashboard/webview/scripts/events/messages.ts');

  assert.match(panel, /async showRuleDetail\(issue: DashboardIssue\)/);
  assert.match(panel, /type: 'showRuleDetail'/);
  assert.match(messages, /case 'showRuleDetail':[\s\S]*showRuleDialog\(message\.issue\)/);
});

test('README y changelog documentan los Quick Fix del editor', () => {
  assert.match(read('CHANGELOG.md'), /Mark as accepted/);
  assert.doesNotMatch(read('CHANGELOG.md'), /Fix with AI/);
  assert.doesNotMatch(read('CHANGELOG.md'), /Corregir con IA/);
  assert.doesNotMatch(read('README.md'), /same Quick Fix menu exposes \*\*Fix with AI\*\*/);
  assert.doesNotMatch(read('README.es.md'), /mismo menú Quick Fix incorpora \*\*Corregir con IA\*\*/);
  assert.match(read('README.md'), /native VS Code light bulb exposes Quick Fix actions/);
  assert.match(read('README.es.md'), /bombilla nativa de VS Code ofrece acciones Quick Fix/);
});
