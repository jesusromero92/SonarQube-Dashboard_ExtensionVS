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
  const source = read('src/modules/liveRemediation/manager.ts')
    + read('src/modules/liveRemediation/sonarIde.ts')
    + read('src/modules/liveRemediation/diagnostics.ts')
    + read('src/modules/liveRemediation/rangeTracking.ts')
    + read('src/modules/liveRemediation/persistence.ts');

  assert.equal(manifest.version, '2.0.0');
  assert.ok(
    manifest.contributes?.configuration?.properties?.[
      'sonarQubeDashboard.modules.liveRemediation.enabled'
    ]
  );
  assert.equal(
    manifest.contributes?.configuration?.properties?.[
      'sonarQubeDashboard.liveRemediation.enabled'
    ],
    undefined
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
  const diagnostics = read('src/modules/liveRemediation/diagnostics.ts')
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
  const source = read('src/modules/liveRemediation/manager.ts') + read('src/modules/liveRemediation/sonarIde.ts') + read('src/modules/liveRemediation/diagnostics.ts');

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
  const manager = read('src/modules/liveRemediation/manager.ts');
  const navigation = read('src/issueNavigation.ts');

  assert.match(manager, /tracked\.state === 'server'[\s\S]*DiagnosticSeverity\.Information/);
  assert.match(manager, /diagnostics\.sort\(compareDiagnosticPosition\)/);
  assert.match(navigation, /return this\.issues/);
  assert.doesNotMatch(navigation, /filter\(issue => !this\./);
});

test('Live Remediation se activa o desactiva como módulo completo desde Configuración', () => {
  const facade = read('src/modules/webview.ts');
  const liveConfiguration = read('src/modules/liveRemediation/webview/configuration.ts');
  const events = read('src/dashboard/webview/scripts/events/configuration.ts');
  const runtime = read('src/modules/runtime.ts');

  assert.match(facade, /data-module-toggle="\$\{escapeHtml\(definition\.id\)\}"/);
  assert.match(liveConfiguration, /Integración con el editor/);
  assert.doesNotMatch(liveConfiguration, /liveRemediationEnabled/);
  assert.match(events, /type: 'setModule'/);
  assert.match(runtime, /setEnabled\(moduleId: string, enabled: boolean\)/);
});

test('los archivos reemplazados fuera del editor también aparecen como modificados localmente', () => {
  const source = read('src/modules/liveRemediation/manager.ts');

  assert.match(source, /createFileSystemWatcher/);
  assert.match(source, /trackedFilesWatcher\.onDidChange/);
  assert.match(source, /trackedFilesWatcher\.onDidCreate/);
  assert.match(source, /trackedFilesWatcher\.onDidDelete/);
  assert.match(source, /queueTrackedFileSystemChange/);
  assert.match(source, /reconcileTrackedFileState/);
  assert.match(source, /workspace\.fs\.readFile/);
  assert.match(source, /document\.getText/);
  assert.match(source, /reconcileTrackedIssueAfterFileChange/);
  assert.match(source, /markTrackedModified/);
});

test('una edición adyacente al rango Sonar vuelve a pending validation', () => {
  const source = read('src/modules/liveRemediation/manager.ts')
    + read('src/modules/liveRemediation/rangeTracking.ts');

  assert.match(source, /horizontalGap\(change\.range, range\) <= 2/);
  assert.match(source, /if \(transformed\.touched\)[\s\S]*return this\.markTrackedModified\(key, tracked\)/);
  assert.match(source, /if \(tracked\.state === 'modified'\) return false;[\s\S]*tracked\.state = 'modified'/);
});

test('el estado pendiente y la sesión completa sobreviven a reinicios con esquema v4', () => {
  const persistence = read('src/modules/liveRemediation/persistence.ts');
  const constants = read('src/modules/liveRemediation/constants.ts');
  const models = read('src/modules/liveRemediation/models.ts');
  const manager = read('src/modules/liveRemediation/manager.ts');

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
  const manager = read('src/modules/liveRemediation/manager.ts');
  const provider = read('src/modules/liveRemediation/treeView.ts');
  const liveModule = read('src/modules/liveRemediation/module.ts');
  const views = manifest.contributes?.views?.sonarQubeDashboardContainer ?? [];

  assert.ok(views.some(view => view.id === 'sonarQubeDashboard.locallyModifiedIssues'));
  assert.match(manager, /getLocallyModifiedIssues\(\)/);
  assert.match(manager, /if \(tracked\.state === 'server'\) continue;/);
  assert.match(manager, /for \(const \[key, persisted\] of this\.stateStore\.pendingByKey\)/);
  assert.match(provider, /class LocallyModifiedIssuesTreeProvider/);
  assert.match(provider, /new vscode\.ThemeIcon\([\s\S]*'edit'/);
  assert.match(provider, /SHOW_LIVE_REMEDIATION_DIFF_COMMAND/);
  assert.match(liveModule, /registerTreeDataProvider\(LOCALLY_MODIFIED_ISSUES_TREE_VIEW_ID/);
  assert.match(liveModule, /revealLocallyModifiedIssue/);
  assert.match(read('README.md'), /\*\*Issues modified locally\*\*/);
  assert.match(read('README.es.md'), /\*\*Issues modificados localmente\*\*/);
});

test('el análisis cuenta cualquier issue modificado que desaparece y lo notifica sin afirmar un fix previo', () => {
  const remediation = read('src/modules/liveRemediation/manager.ts');
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
  const index = read('src/modules/liveRemediation/index.ts');
  const manager = read('src/modules/liveRemediation/manager.ts');
  const persistence = read('src/modules/liveRemediation/persistence.ts');
  const sonarIde = read('src/modules/liveRemediation/sonarIde.ts');
  const rangeTracking = read('src/modules/liveRemediation/rangeTracking.ts');
  const tree = read('src/modules/liveRemediation/treeView.ts');
  const constants = read('src/modules/liveRemediation/constants.ts');

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

test('los comandos inline de Live Remediation pertenecen al módulo y resuelven la key del TreeView', () => {
  const module = read('src/modules/liveRemediation/module.ts');
  assert.match(module, /function issueKey\(argument: unknown\)/);
  assert.match(module, /candidate\.issue\?\.key/);
  assert.match(module, /SHOW_LIVE_REMEDIATION_DIFF_COMMAND,[\s\S]*issueKey\(argument\)/);
  assert.match(module, /REVERT_LIVE_REMEDIATION_CHANGE_COMMAND,[\s\S]*issueKey\(argument\)/);
  assert.match(module, /OPEN_LOCALLY_MODIFIED_ISSUE_COMMAND,[\s\S]*issueKey\(argument\)/);
});

test('la sesión separa estado actual de resultados del último análisis', () => {
  const manager = read('src/modules/liveRemediation/manager.ts');
  const models = read('src/modules/liveRemediation/models.ts');
  const tree = read('src/modules/liveRemediation/treeView.ts');
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
  const baseline = read('src/modules/liveRemediation/baseline.ts');
  assert.match(baseline, /const candidates = \[tracked\.range, tracked\.baselineRange\]/);
  assert.match(baseline, /anchoredReplacementRange/);
  assert.match(baseline, /baseline\.beforeAnchor/);
  assert.match(baseline, /baseline\.afterAnchor/);
});

test('tras el último análisis agrupa solucionados, los que siguen y el historial', () => {
  const manager = read('src/modules/liveRemediation/manager.ts');
  const tree = read('src/modules/liveRemediation/treeView.ts');
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

test('un análisis real sin pendientes vacía los resultados del análisis anterior y conserva el historial', () => {
  const manager = read('src/modules/liveRemediation/manager.ts');
  const validationMethod = manager.match(
    /private recordValidationResults\([\s\S]*?private validationEntryFromServerIssue/
  )?.[0] ?? '';

  const clearSolved = validationMethod.indexOf('this.lastConfirmedResults.length = 0');
  const emptyPendingBranch = validationMethod.indexOf('if (pending.size === 0)');
  assert.ok(clearSolved >= 0 && clearSolved < emptyPendingBranch);
  assert.match(validationMethod, /if \(pending\.size === 0\) \{[\s\S]*this\.remediationSession\.confirmed = 0/);
  assert.match(validationMethod, /if \(pending\.size === 0\) \{[\s\S]*this\.remediationSession\.stillDetected = 0/);
  assert.match(validationMethod, /if \(pending\.size === 0\) \{[\s\S]*this\.persistSessionState\(\);[\s\S]*return 0/);
  assert.doesNotMatch(validationMethod, /this\.remediationHistory\.length = 0/);
});

test('el reinicio y los refresh normales conservan Cambios pendientes hasta un análisis real', () => {
  const extension = read('src/extension.ts');
  const manager = read('src/modules/liveRemediation/manager.ts');
  const persistence = read('src/modules/liveRemediation/persistence.ts');

  assert.match(extension, /applyServerSnapshot\([\s\S]*source === 'analysis'/);
  assert.match(manager, /syncPersistedStateFromTracked\(!confirmLocalRemediation\)/);
  assert.match(manager, /for \(const \[key, persisted\] of this\.stateStore\.pendingByKey\)[\s\S]*summaries\.set\(key/);
  assert.match(persistence, /preserveMissing = false/);
  assert.match(persistence, /if \(!trackedByKey\.has\(key\)\) this\.pendingByKey\.set\(key, issue\)/);
});


test('los issues que siguen detectándose usan la ubicación nueva del último análisis y son navegables', () => {
  const manager = read('src/modules/liveRemediation/manager.ts');
  const tree = read('src/modules/liveRemediation/treeView.ts');

  assert.match(manager, /const serverIssuesByKey = new Map\(issues\.map/);
  assert.match(manager, /validationEntryFromServerIssue\(currentServerIssue, validatedAt, key\)/);
  assert.match(manager, /line: Math\.max\(1, issue\.line \|\| 1\)/);
  assert.match(tree, /liveRemediationStillDetected[\s\S]*command: 'vscode\.open'/);
  assert.match(tree, /selection: new vscode\.Range\(line, 0, line, 0\)/);
  assert.match(tree, /ubicación devuelta por el último análisis de SonarQube/);
});


test('la sesión de remediación tiene una papelera inline que limpia solo el estado local de sesión', () => {
  const manifest = read('package.json');
  const constants = read('src/modules/liveRemediation/constants.ts');
  const module = read('src/modules/liveRemediation/module.ts');
  const manager = read('src/modules/liveRemediation/manager.ts');
  const tree = read('src/modules/liveRemediation/treeView.ts');

  assert.match(constants, /CLEAR_LIVE_REMEDIATION_SESSION_COMMAND/);
  assert.match(manifest, /sonarQubeDashboard\.clearLiveRemediationSession/);
  assert.match(manifest, /viewItem == liveRemediationSession/);
  assert.match(manifest, /\$\(trash\)/);
  assert.match(tree, /item\.contextValue = 'liveRemediationSession'/);
  assert.match(module, /CLEAR_LIVE_REMEDIATION_SESSION_COMMAND,[\s\S]*clearRemediationSession/);
  assert.match(manager, /async clearRemediationSession\(\): Promise<void>/);
  assert.match(manager, /showWarningMessage[\s\S]*\{ modal: true \}/);
  assert.match(manager, /tracked\.state = 'server'/);
  assert.match(manager, /this\.resetSession\(\);[\s\S]*this\.ensureSession\(this\.trackedByKey\.size\)/);
  assert.match(manager, /Los archivos locales y los issues de SonarQube Server no se modificarán/);
});

test('Solucionados y Siguen detectándose pueden limpiarse de forma independiente', () => {
  const manager = read('src/modules/liveRemediation/manager.ts');
  const tree = read('src/modules/liveRemediation/treeView.ts');
  const constants = read('src/modules/liveRemediation/constants.ts');
  const module = read('src/modules/liveRemediation/module.ts');
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
  assert.match(module, /CLEAR_LAST_SOLVED_REMEDIATION_RESULTS_COMMAND/);
  assert.match(module, /CLEAR_LAST_STILL_DETECTED_REMEDIATION_RESULTS_COMMAND/);
  assert.match(packageJson, /clearLastSolvedRemediationResults/);
  assert.match(packageJson, /clearLastStillDetectedRemediationResults/);
});

test('Live Remediation reconcilia pegados/reemplazos de varios archivos como un lote', () => {
  const manager = read('src/modules/liveRemediation/manager.ts');
  const constants = read('src/modules/liveRemediation/constants.ts');

  assert.match(manager, /queueTrackedFileSystemChange/);
  assert.match(manager, /trackedFileReconciliationTimers/);
  assert.match(manager, /scheduleTrackedBatchReconciliation/);
  assert.match(manager, /reconcileAllTrackedFiles/);
  assert.match(manager, /for \(const uriString of this\.keysByUri\.keys\(\)\)/);
  assert.match(constants, /TRACKED_FILE_RECONCILIATION_DELAY_MS/);
  assert.match(constants, /TRACKED_BATCH_RECONCILIATION_DELAY_MS/);
});

test('los cambios externos en archivos abiertos se comparan contra baseline y no se descartan por coincidir con disco', () => {
  const manager = read('src/modules/liveRemediation/manager.ts');

  assert.doesNotMatch(manager, /openDocumentMatchesDisk/);
  assert.match(manager, /openDocument\?\.isDirty/);
  assert.match(manager, /readCurrentTrackedFileText/);
  assert.match(manager, /reconcileTrackedFileState/);
});

test('un bloque desplazado sin cambios se relocaliza y no genera un Modified locally falso', () => {
  const manager = read('src/modules/liveRemediation/manager.ts');
  const baseline = read('src/modules/liveRemediation/baseline.ts');

  assert.match(baseline, /matchingBaselineRangeInText/);
  assert.match(baseline, /matchingBlockStarts/);
  assert.match(baseline, /baselineAnchorScore/);
  assert.match(manager, /matchingBaselineRangeInText\(currentText, tracked\)/);
  assert.match(manager, /restoreTrackedServerState\(tracked, matchingRange\)/);
});

test('las operaciones de archivos de VS Code y los saves refuerzan el watcher para lotes', () => {
  const manager = read('src/modules/liveRemediation/manager.ts');

  assert.match(manager, /onDidCreateFiles/);
  assert.match(manager, /onDidDeleteFiles/);
  assert.match(manager, /onDidRenameFiles/);
  assert.match(manager, /onDidSaveTextDocument/);
});

test('una baseline no se acepta si el archivo cambia mientras se está capturando', () => {
  const manager = read('src/modules/liveRemediation/manager.ts');

  assert.match(manager, /fileChangeVersions/);
  assert.match(manager, /const fileChangeVersionsAtSnapshot = new Map\(this\.fileChangeVersions\)/);
  assert.match(manager, /const captureVersion = versionsAtSnapshot\?\.get\(uriString\)/);
  assert.match(manager, /this\.fileChangeVersions\.get\(uriString\)[\s\S]*!== captureVersion/);
  assert.match(manager, /this\.markTrackedModified\(tracked\.issue\.key, tracked\)/);
});

test('los documentos ya abiertos se reconcilian después de capturar baselines', () => {
  const manager = read('src/modules/liveRemediation/manager.ts');

  assert.match(manager, /reconcileOpenTrackedDocuments/);
  assert.match(manager, /for \(const document of vscode\.workspace\.textDocuments\)/);
  assert.match(manager, /reconcileTrackedFileState\(document\.uri\)/);
});

test('Live Remediation normaliza las URI de Windows antes de resolver eventos de edición', () => {
  const manager = read('src/modules/liveRemediation/manager.ts');

  assert.match(manager, /private uriKey\(value: string \| vscode\.Uri\)/);
  assert.match(manager, /process\.platform === 'win32'/);
  assert.match(manager, /normalized\.toLowerCase\(\)/);
  assert.match(manager, /keysByUri\.get\(this\.uriKey\(event\.document\.uri\)\)/);
  assert.match(manager, /this\.uriKey\(persisted\.fileUri\) !== this\.uriKey\(issue\.fileUri\)/);
});

test('una edición directa del rango prevalece sobre bloques duplicados del archivo', () => {
  const manager = read('src/modules/liveRemediation/manager.ts');
  const touchedStart = manager.indexOf('if (transformed.touched)');
  const relocationStart = manager.indexOf('if (tracked.baseline)', touchedStart + 1);
  const touchedBranch = manager.slice(touchedStart, relocationStart);

  assert.ok(touchedStart >= 0 && relocationStart > touchedStart);
  assert.match(touchedBranch, /issueMatchesBaseline\(document, tracked\)/);
  assert.match(touchedBranch, /markTrackedModified\(key, tracked\)/);
});
