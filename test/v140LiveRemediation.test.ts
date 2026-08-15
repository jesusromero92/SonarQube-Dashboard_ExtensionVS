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
  const diagnostics = read('src/liveRemediation/diagnostics.ts')
    + read('src/issueLocalState.ts');
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

test('los archivos reemplazados fuera del editor también aparecen como modificados localmente', () => {
  const source = read('src/liveRemediation/manager.ts');

  assert.match(source, /createFileSystemWatcher/);
  assert.match(source, /trackedFilesWatcher\.onDidChange/);
  assert.match(source, /trackedFilesWatcher\.onDidCreate/);
  assert.match(source, /trackedFilesWatcher\.onDidDelete/);
  assert.match(source, /onTrackedFileSystemChanged/);
  assert.match(source, /workspace\.fs\.readFile/);
  assert.match(source, /document\.getText/);
  assert.match(source, /reconcileTrackedIssueAfterFileChange/);
  assert.match(source, /markTrackedModified/);
});

test('una edición adyacente al rango Sonar vuelve a pending validation', () => {
  const source = read('src/liveRemediation/manager.ts')
    + read('src/liveRemediation/rangeTracking.ts');

  assert.match(source, /horizontalGap\(change\.range, range\) <= 2/);
  assert.match(source, /transformed\.touched && this\.markTrackedModified\(key, tracked\)/);
  assert.match(source, /if \(tracked\.state === 'modified'\) return false;[\s\S]*tracked\.state = 'modified'/);
});

test('el estado pendiente y la sesión completa sobreviven a reinicios con esquema v4', () => {
  const persistence = read('src/liveRemediation/persistence.ts');
  const constants = read('src/liveRemediation/constants.ts');
  const models = read('src/liveRemediation/models.ts');
  const manager = read('src/liveRemediation/manager.ts');

  assert.match(constants, /state\.v4/);
  assert.match(constants, /pending\.v3/);
  assert.match(persistence, /version: 4/);
  assert.match(persistence, /LegacyPersistedRemediationSnapshot/);
  assert.match(persistence, /awaitingConfirmation/);
  assert.match(manager, /persisted\.state === 'awaitingConfirmation'/);
  assert.match(persistence, /baselineRange/);
  assert.match(persistence, /baseline: tracked\.baseline/);
  assert.match(manager, /syncPersistedStateFromTracked/);
  assert.match(models, /interface PersistedRemediationSession/);
  assert.match(models, /remediationHistory: RemediationValidationEntry\[\]/);
  assert.match(models, /lastConfirmedResults: RemediationValidationEntry\[\]/);
  assert.match(models, /stillDetectedHistory: RemediationValidationEntry\[\]/);
  assert.match(manager, /this\.restoreSessionState\(\)/);
  assert.match(manager, /this\.persistSessionState\(\)/);
  assert.match(manager, /modifiedIssueKeys: new Set\(persisted\.modifiedIssueKeys\)/);
  assert.match(persistence, /session: this\.persistedSession/);
  assert.match(manager, /for \(const \[key, persisted\] of this\.stateStore\.pendingByKey\)/);
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
  assert.match(manager, /if \(tracked\.state === 'server'\) continue;/);
  assert.match(manager, /for \(const \[key, persisted\] of this\.stateStore\.pendingByKey\)/);
  assert.match(provider, /class LocallyModifiedIssuesTreeProvider/);
  assert.match(provider, /new vscode\.ThemeIcon\([\s\S]*'edit'/);
  assert.match(provider, /SHOW_LIVE_REMEDIATION_DIFF_COMMAND/);
  assert.match(extension, /LOCALLY_MODIFIED_ISSUES_TREE_VIEW_ID/);
  assert.match(extension, /revealLocallyModifiedIssue/);
  assert.match(read('README.md'), /\*\*Issues modified locally\*\*/);
  assert.match(read('README.es.md'), /\*\*Issues modificados localmente\*\*/);
});

test('el análisis cuenta cualquier issue modificado que desaparece y lo notifica sin afirmar un fix previo', () => {
  const remediation = read('src/liveRemediation/manager.ts');
  const extension = read('src/extension.ts');
  const notifications = read('src/notificationManager.ts');

  assert.match(remediation, /pendingLocallyModified/);
  assert.match(remediation, /tracked\.state !== 'server'/);
  assert.match(remediation, /confirmedLocallyModifiedCount/);
  assert.match(remediation, /const currentServerIssue = serverIssuesByKey\.get\(key\)/);
  assert.match(remediation, /if \(currentServerIssue\) \{[\s\S]*stillDetected \+= 1;[\s\S]*continue;/);
  assert.match(remediation, /confirmed \+= 1;[\s\S]*this\.remediationHistory\.unshift/);
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

test('los comandos inline de Live Remediation resuelven la key del nodo del TreeView', () => {
  const extension = read('src/extension.ts');
  assert.match(extension, /function liveRemediationIssueKey\(argument: unknown\)/);
  assert.match(extension, /candidate\.issue\?\.key/);
  assert.match(extension, /SHOW_LIVE_REMEDIATION_DIFF_COMMAND,[\s\S]*liveRemediationIssueKey\(argument\)/);
  assert.match(extension, /REVERT_LIVE_REMEDIATION_CHANGE_COMMAND,[\s\S]*liveRemediationIssueKey\(argument\)/);
  assert.match(extension, /OPEN_LOCALLY_MODIFIED_ISSUE_COMMAND,[\s\S]*liveRemediationIssueKey\(argument\)/);
});

test('la sesión separa estado actual de resultados del último análisis', () => {
  const manager = read('src/liveRemediation/manager.ts');
  const models = read('src/liveRemediation/models.ts');
  const tree = read('src/liveRemediation/treeView.ts');
  assert.match(models, /confirmed: number/);
  assert.match(models, /stillDetected: number/);
  assert.match(manager, /this\.remediationSession\.confirmed = confirmed/);
  assert.match(manager, /this\.remediationSession\.stillDetected = stillDetected/);
  assert.doesNotMatch(tree, /Modificados durante la sesión/);
  assert.doesNotMatch(tree, /Issues al comenzar/);
  assert.match(tree, /\{ kind: 'analyze' \},[\s\S]*this\.metricNode\('modified'/);
  assert.match(tree, /kind: 'afterAnalysisGroup'/);
  assert.match(tree, /Tras último análisis/);
  assert.match(tree, /Solucionados \(\$\{node\.count\}\)/);
  assert.match(tree, /Siguen detectándose \(\$\{node\.count\}\)/);
});

test('el revert seguro prueba el rango vivo y el rango baseline antes de rendirse', () => {
  const baseline = read('src/liveRemediation/baseline.ts');
  assert.match(baseline, /const candidates = \[tracked\.range, tracked\.baselineRange\]/);
  assert.match(baseline, /anchoredReplacementRange/);
  assert.match(baseline, /baseline\.beforeAnchor/);
  assert.match(baseline, /baseline\.afterAnchor/);
});

test('tras el último análisis agrupa solucionados, los que siguen y el historial', () => {
  const manager = read('src/liveRemediation/manager.ts');
  const tree = read('src/liveRemediation/treeView.ts');
  assert.match(manager, /this\.lastConfirmedResults\.length = 0/);
  assert.match(manager, /this\.stillDetectedHistory\.length = 0/);
  assert.match(manager, /getLastConfirmedResults/);
  assert.match(manager, /getStillDetectedHistory/);
  assert.match(tree, /afterAnalysisGroup/);
  assert.match(tree, /solvedGroup/);
  assert.match(tree, /stillDetectedGroup/);
  assert.match(tree, /Historial de solucionados/);
  assert.match(tree, /liveRemediationLatestSolved/);
  assert.match(tree, /liveRemediationStillDetected/);
});

test('el reinicio y los refresh normales conservan Cambios pendientes hasta un análisis real', () => {
  const extension = read('src/extension.ts');
  const manager = read('src/liveRemediation/manager.ts');
  const persistence = read('src/liveRemediation/persistence.ts');

  assert.match(extension, /applyServerSnapshot\([\s\S]*source === 'analysis'/);
  assert.match(manager, /syncPersistedStateFromTracked\(!confirmLocalRemediation\)/);
  assert.match(manager, /for \(const \[key, persisted\] of this\.stateStore\.pendingByKey\)[\s\S]*summaries\.set\(key/);
  assert.match(persistence, /preserveMissing = false/);
  assert.match(persistence, /if \(!trackedByKey\.has\(key\)\) this\.pendingByKey\.set\(key, issue\)/);
});


test('los issues que siguen detectándose usan la ubicación nueva del último análisis y son navegables', () => {
  const manager = read('src/liveRemediation/manager.ts');
  const tree = read('src/liveRemediation/treeView.ts');

  assert.match(manager, /const serverIssuesByKey = new Map\(issues\.map/);
  assert.match(manager, /validationEntryFromServerIssue\(currentServerIssue, validatedAt, key\)/);
  assert.match(manager, /line: Math\.max\(1, issue\.line \|\| 1\)/);
  assert.match(tree, /liveRemediationStillDetected[\s\S]*command: 'vscode\.open'/);
  assert.match(tree, /selection: new vscode\.Range\(line, 0, line, 0\)/);
  assert.match(tree, /ubicación devuelta por el último análisis de SonarQube/);
});


test('la sesión de remediación tiene una papelera inline que limpia solo el estado local de sesión', () => {
  const manifest = read('package.json');
  const constants = read('src/liveRemediation/constants.ts');
  const extension = read('src/extension.ts');
  const manager = read('src/liveRemediation/manager.ts');
  const tree = read('src/liveRemediation/treeView.ts');

  assert.match(constants, /CLEAR_LIVE_REMEDIATION_SESSION_COMMAND/);
  assert.match(manifest, /sonarQubeDashboard\.clearLiveRemediationSession/);
  assert.match(manifest, /viewItem == liveRemediationSession/);
  assert.match(manifest, /\$\(trash\)/);
  assert.match(tree, /item\.contextValue = 'liveRemediationSession'/);
  assert.match(extension, /CLEAR_LIVE_REMEDIATION_SESSION_COMMAND,[\s\S]*clearRemediationSession/);
  assert.match(manager, /async clearRemediationSession\(\): Promise<void>/);
  assert.match(manager, /showWarningMessage[\s\S]*\{ modal: true \}/);
  assert.match(manager, /tracked\.state = 'server'/);
  assert.match(manager, /this\.resetSession\(\);[\s\S]*this\.ensureSession\(this\.trackedByKey\.size\)/);
  assert.match(manager, /Los archivos locales y los issues de SonarQube Server no se modificarán/);
});

test('Solucionados y Siguen detectándose pueden limpiarse de forma independiente', () => {
  const manager = read('src/liveRemediation/manager.ts');
  const tree = read('src/liveRemediation/treeView.ts');
  const constants = read('src/liveRemediation/constants.ts');
  const extension = read('src/extension.ts');
  const packageJson = read('package.json');

  assert.match(constants, /CLEAR_LAST_SOLVED_REMEDIATION_RESULTS_COMMAND/);
  assert.match(constants, /CLEAR_LAST_STILL_DETECTED_REMEDIATION_RESULTS_COMMAND/);
  assert.match(manager, /clearLastSolvedResults\(\)/);
  assert.match(manager, /this\.lastConfirmedResults\.length = 0/);
  assert.match(manager, /clearLastStillDetectedResults\(\)/);
  assert.match(manager, /this\.stillDetectedHistory\.length = 0/);
  assert.match(manager, /this\.persistSessionState\(\)/);
  assert.match(tree, /liveRemediationSolvedGroup/);
  assert.match(tree, /liveRemediationStillDetectedGroup/);
  assert.match(extension, /CLEAR_LAST_SOLVED_REMEDIATION_RESULTS_COMMAND/);
  assert.match(extension, /CLEAR_LAST_STILL_DETECTED_REMEDIATION_RESULTS_COMMAND/);
  assert.match(packageJson, /clearLastSolvedRemediationResults/);
  assert.match(packageJson, /clearLastStillDetectedRemediationResults/);
});
