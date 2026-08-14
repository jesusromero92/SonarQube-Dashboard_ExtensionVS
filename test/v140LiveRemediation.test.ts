import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';

const read = (relativePath: string): string => readFileSync(
  path.resolve(process.cwd(), relativePath),
  'utf8'
);

test('v2.0.0 mantiene seguimiento conservador de remediación local', () => {
  const manifest = JSON.parse(read('package.json')) as {
    version?: string;
    contributes?: { configuration?: { properties?: Record<string, unknown> } };
  };
  const source = read('src/liveRemediation/manager.ts')
    + read('src/liveRemediation/sonarIde.ts')
    + read('src/liveRemediation/diagnostics.ts')
    + read('src/liveRemediation/rangeTracking.ts')
    + read('src/liveRemediation/persistence.ts');

  assert.equal(manifest.version, '2.0.0');
  assert.ok(
    manifest.contributes?.configuration?.properties?.[
      'sonarQubeDashboard.liveRemediation.enabled'
    ]
  );
  assert.match(source, /onDidChangeTextDocument/);
  assert.match(source, /onDidChangeDiagnostics/);
  assert.match(source, /tracked\.state = 'modified'/);
  assert.match(source, /state = 'awaitingConfirmation'/);
  assert.match(source, /observedBySonarIde/);
  assert.match(source, /SONARQUBE_FOR_IDE_EXTENSION_ID/);
  assert.match(source, /matchExternalDiagnostics/);
  assert.doesNotMatch(source, /locallyFixed/);
});

test('Live Remediation nunca presenta un issue como fixed antes del análisis de servidor', () => {
  const diagnostics = read('src/liveRemediation/diagnostics.ts');
  const decorations = read('src/issueDecorations.ts');
  const navigation = read('src/issueNavigation.ts');

  assert.match(diagnostics, /Modified locally · pending validation/);
  assert.match(diagnostics, /Modified locally · awaiting SonarQube confirmation/);
  assert.match(diagnostics, /Modificado localmente · pendiente de confirmación de SonarQube/);
  assert.doesNotMatch(diagnostics, /Fixed locally|Corregido localmente|✓/);
  assert.doesNotMatch(decorations, /testing\.iconPassed|pass-filled|qualityGate\.OK/);
  assert.match(decorations, /gitDecoration\.modifiedResourceForeground/);
  assert.doesNotMatch(navigation, /locallyFixedIssueKeys|setLocallyFixedIssueKeys/);
});

test('la desaparición en SonarQube for IDE solo cambia a pendiente de confirmación', () => {
  const source = read('src/liveRemediation/manager.ts') + read('src/liveRemediation/sonarIde.ts') + read('src/liveRemediation/diagnostics.ts');

  assert.match(
    source,
    /state === 'modified' && issue\.observedBySonarIde[\s\S]*issue\.state = 'awaitingConfirmation'/
  );
  assert.match(
    source,
    /issue\.state === 'awaitingConfirmation'[\s\S]*issue\.state = 'modified'/
  );
  assert.match(source, /source\.includes\('sonar'\) \|\| source\.includes\('sonarlint'\)/);
});

test('los issues modificados siguen visibles en Problems y navegación normal', () => {
  const manager = read('src/liveRemediation/manager.ts');
  const navigation = read('src/issueNavigation.ts');

  assert.match(manager, /tracked\.state === 'server'[\s\S]*DiagnosticSeverity\.Information/);
  assert.match(manager, /diagnostics\.sort\(compareDiagnosticPosition\)/);
  assert.match(navigation, /return this\.issues/);
  assert.doesNotMatch(navigation, /filter\(issue => !this\./);
});

test('la configuración del dashboard permite activar o desactivar la remediación al instante', () => {
  const page = read('src/dashboard/webview/pages/configurationPage.ts');
  const events = read('src/dashboard/webview/scripts/events/configuration.ts');
  const panel = read('src/dashboardPanel.ts');

  assert.match(page, /id="liveRemediationEnabled"/);
  assert.match(page, /Integración con el editor/);
  assert.match(events, /type: 'setLiveRemediation'/);
  assert.match(panel, /case 'setLiveRemediation'/);
  assert.match(panel, /LIVE_REMEDIATION_CONFIGURATION_KEY/);
});

test('una edición adyacente al rango Sonar vuelve a pending validation', () => {
  const source = read('src/liveRemediation/manager.ts')
    + read('src/liveRemediation/rangeTracking.ts');

  assert.match(source, /horizontalGap\(change\.range, range\) <= 2/);
  assert.match(source, /touched && tracked\.state !== 'modified'[\s\S]*tracked\.state = 'modified'/);
});

test('los estados locales pendientes sobreviven a reinicios de VS Code con esquema v2', () => {
  const persistence = read('src/liveRemediation/persistence.ts');
  const constants = read('src/liveRemediation/constants.ts');
  const manager = read('src/liveRemediation/manager.ts');

  assert.match(constants, /pending\.v2/);
  assert.match(persistence, /version: 2/);
  assert.match(persistence, /snapshot\.version !== 2/);
  assert.match(persistence, /awaitingConfirmation/);
  assert.match(manager, /persisted\.state === 'awaitingConfirmation'/);
  assert.match(manager, /syncPersistedStateFromTracked/);
});

test('la vista nativa lista todos los issues modificados localmente', () => {
  const manifest = JSON.parse(read('package.json')) as {
    contributes?: { views?: Record<string, Array<{ id?: string }>> };
  };
  const manager = read('src/liveRemediation/manager.ts');
  const provider = read('src/liveRemediation/treeView.ts');
  const extension = read('src/extension.ts');
  const views = manifest.contributes?.views?.sonarQubeDashboardContainer ?? [];

  assert.ok(views.some(view => view.id === 'sonarQubeDashboard.locallyModifiedIssues'));
  assert.match(manager, /getLocallyModifiedIssues\(\)/);
  assert.match(manager, /filter\(tracked => tracked\.state !== 'server'\)/);
  assert.match(provider, /class LocallyModifiedIssuesTreeProvider/);
  assert.match(provider, /new vscode\.ThemeIcon\([\s\S]*'edit'/);
  assert.match(provider, /OPEN_LOCALLY_MODIFIED_ISSUE_COMMAND/);
  assert.match(extension, /LOCALLY_MODIFIED_ISSUES_TREE_VIEW_ID/);
  assert.match(extension, /revealLocallyModifiedIssue/);
  assert.match(read('README.md'), /\*\*Issues modified locally\*\*/);
  assert.match(read('README.es.md'), /\*\*Issues modificados localmente\*\*/);
});

test('el análisis cuenta cualquier issue modificado que desaparece y lo notifica sin afirmar un fix previo', () => {
  const remediation = read('src/liveRemediation/manager.ts');
  const extension = read('src/extension.ts');
  const notifications = read('src/notificationManager.ts');

  assert.match(remediation, /pendingLocallyModifiedKeys/);
  assert.match(remediation, /tracked\.state !== 'server'/);
  assert.match(remediation, /confirmedLocallyModifiedCount/);
  assert.match(remediation, /!serverIssueKeys\.has\(key\)/);
  assert.match(extension, /notifications\.evaluate\(notificationScopes, source, confirmedLocallyModifiedCount\)/);
  assert.match(notifications, /1 defecto modificado localmente ya no se detecta/);
  assert.match(notifications, /1 locally modified issue is no longer detected/);
});

test('Live Remediation permanece completamente encapsulado en su módulo', () => {
  const index = read('src/liveRemediation/index.ts');
  const manager = read('src/liveRemediation/manager.ts');
  const persistence = read('src/liveRemediation/persistence.ts');
  const sonarIde = read('src/liveRemediation/sonarIde.ts');
  const rangeTracking = read('src/liveRemediation/rangeTracking.ts');
  const tree = read('src/liveRemediation/treeView.ts');
  const constants = read('src/liveRemediation/constants.ts');

  assert.equal(existsSync(path.resolve(process.cwd(), 'src/liveRemediation.ts')), false);
  assert.equal(existsSync(path.resolve(process.cwd(), 'src/locallyFixedIssuesTreeView.ts')), false);
  assert.match(index, /LiveRemediationManager/);
  assert.match(index, /LocallyModifiedIssuesTreeProvider/);
  assert.match(index, /IssueLocalRemediationState/);
  assert.match(constants, /OPEN_LOCALLY_MODIFIED_ISSUE_COMMAND/);
  assert.match(manager, /RemediationStateStore/);
  assert.match(manager, /SonarIdeDiagnosticsObserver/);
  assert.match(persistence, /PERSISTENCE_DEBOUNCE_MS/);
  assert.match(sonarIde, /hasExternalSnapshotChanged/);
  assert.match(sonarIde, /usedDiagnostics/);
  assert.match(rangeTracking, /transformRangeAfterChange/);
  assert.match(tree, /class LocallyModifiedIssuesTreeProvider/);
});

test('README y changelog documentan la semántica conservadora de v2.0.0', () => {
  assert.match(read('CHANGELOG.md'), /## \[2\.0\.0\]/);
  assert.match(read('README.md'), /Modified locally · awaiting SonarQube confirmation/);
  assert.match(read('README.es.md'), /Modificado localmente · pendiente de confirmación de SonarQube/);
  assert.doesNotMatch(read('README.md'), /Issues fixed locally/);
  assert.doesNotMatch(read('README.es.md'), /Issues corregidos localmente/);
});
