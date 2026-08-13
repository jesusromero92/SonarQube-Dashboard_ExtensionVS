import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';

const read = (relativePath: string): string => readFileSync(
  path.resolve(process.cwd(), relativePath),
  'utf8'
);

test('v1.4.0 incorpora seguimiento conservador de remediación local', () => {
  const manifest = JSON.parse(read('package.json')) as {
    version?: string;
    contributes?: { configuration?: { properties?: Record<string, unknown> } };
  };
  const source = read('src/liveRemediation.ts');

  assert.equal(manifest.version, '1.4.0');
  assert.ok(
    manifest.contributes?.configuration?.properties?.[
      'sonarQubeDashboard.liveRemediation.enabled'
    ]
  );
  assert.match(source, /onDidChangeTextDocument/);
  assert.match(source, /onDidChangeDiagnostics/);
  assert.match(source, /: 'server'/);
  assert.match(source, /tracked\.state = 'modified'/);
  assert.match(source, /tracked\.state = 'locallyFixed'/);
  assert.match(source, /observedBySonarIde/);
  assert.match(source, /isExternalSonarDiagnostic/);
  assert.match(source, /SONARQUBE_FOR_IDE_EXTENSION_ID/);
  assert.match(source, /isSonarIdeActive/);
  assert.match(source, /rangesNear/);
});

test('los issues localmente corregidos permanecen informativos en Problems hasta confirmación', () => {
  const source = read('src/liveRemediation.ts');
  const navigation = read('src/issueNavigation.ts');
  const decorations = read('src/issueDecorations.ts');
  const extension = read('src/extension.ts');

  assert.match(source, /tracked\.state === 'locallyFixed'/);
  assert.match(source, /✓ Corregido localmente · pendiente de confirmación de SonarQube/);
  assert.match(source, /✓ Fixed locally · awaiting SonarQube confirmation/);
  assert.match(source, /tracked\.state === 'server'[\s\S]*DiagnosticSeverity\.Information/);
  assert.match(source, /diagnostics\.sort\(compareDiagnosticPosition\)/);
  assert.match(navigation, /locallyFixedIssueKeys/);
  assert.match(navigation, /!this\.locallyFixedIssueKeys\.has\(issue\.key\)/);
  assert.match(decorations, /Corregido localmente · pendiente de confirmación de SonarQube/);
  assert.match(decorations, /locallyFixedDecorationType/);
  assert.match(extension, /liveRemediation\.applyServerSnapshot/);
  assert.match(extension, /liveRemediation\.getLocallyFixedIssueKeys/);
});

test('la remediación local no declara un fix sin señal previa del analizador Sonar externo', () => {
  const source = read('src/liveRemediation.ts');

  assert.match(
    source,
    /tracked\.state === 'modified' && tracked\.observedBySonarIde[\s\S]*tracked\.state = 'locallyFixed'/
  );
  assert.match(source, /source\.includes\('sonar'\) \|\| source\.includes\('sonarlint'\)/);
  assert.match(source, /normalizedRuleCandidates/);
});

test('README y changelog documentan Live remediation state', () => {
  assert.match(read('CHANGELOG.md'), /## \[1\.4\.0\] - 2026-08-13/);
  assert.match(read('CHANGELOG.md'), /Live remediation state/);
  assert.match(read('README.md'), /### Live remediation state/);
  assert.match(read('README.es.md'), /### Estado de remediación en vivo/);
  assert.match(read('package.nls.json'), /liveRemediation\.enabled/);
  assert.match(read('package.nls.es.json'), /liveRemediation\.enabled/);
});

test('la configuración del dashboard permite activar o desactivar la remediación al instante', () => {
  const page = read('src/dashboard/webview/pages/configurationPage.ts');
  const events = read('src/dashboard/webview/scripts/events/configuration.ts');
  const panel = read('src/dashboardPanel.ts');

  assert.match(page, /id="liveRemediationEnabled"/);
  assert.match(page, /Integración con el editor/);
  assert.match(events, /type: 'setLiveRemediation'/);
  assert.match(panel, /case 'setLiveRemediation'/);
  assert.match(panel, /DASHBOARD_CONFIGURATION_KEYS\.liveRemediationEnabled/);
});


test('el estado corregido localmente persiste hasta un análisis de servidor y usa verde explícito', () => {
  const source = read('src/liveRemediation.ts');
  const extension = read('src/extension.ts');
  const decorations = read('src/issueDecorations.ts');
  const changelog = read('CHANGELOG.md');

  assert.match(source, /confirmLocalRemediation = false/);
  assert.match(source, /preservePendingState/);
  assert.match(extension, /source === 'analysis'/);
  assert.match(decorations, /testing\.iconPassed/);
  assert.match(decorations, /awaiting SonarQube confirmation/);
  assert.match(changelog, /ordinary synchronization/);
});


test('la UI informa si SonarQube for IDE está disponible pero no lo convierte en dependencia', () => {
  const constants = read('src/constants.ts');
  const panel = read('src/dashboardPanel.ts');
  const page = read('src/dashboard/webview/pages/configurationPage.ts');
  const configuration = read('src/dashboard/webview/scripts/core/configuration.ts');
  const source = read('src/liveRemediation.ts');

  assert.match(constants, /SonarSource\.sonarlint-vscode/);
  assert.match(panel, /sonarIdeIntegrationState/);
  assert.match(panel, /vscode\.extensions\.getExtension/);
  assert.match(page, /id="sonarIdeStatus"/);
  assert.match(configuration, /renderSonarIdeIntegrationStatus/);
  assert.match(configuration, /SonarQube for IDE no detectado/);
  assert.match(source, /isSonarIdeActive/);
  assert.doesNotMatch(read('package.json'), /extensionDependencies/);
});


test('una edición adyacente al rango Sonar mantiene el estado modificado hasta confirmación', () => {
  const source = read('src/liveRemediation.ts');

  assert.match(source, /horizontalGap\(change\.range, range\) <= 2/);
  assert.match(source, /tracked\.state === 'locallyFixed'[\s\S]*tracked\.state = 'modified'/);
  assert.doesNotMatch(
    source,
    /if \(tracked\.state !== 'server'\) \{[\s\S]{0,120}tracked\.state = 'server'/
  );
});


test('los estados locales pendientes sobreviven a reinicios de VS Code', () => {
  const source = read('src/liveRemediation.ts');
  const extension = read('src/extension.ts');

  assert.match(source, /LIVE_REMEDIATION_STORAGE_KEY/);
  assert.match(source, /context\.workspaceState\.get/);
  assert.match(source, /context\.workspaceState\.update/);
  assert.match(source, /restorePersistedState/);
  assert.match(source, /syncPersistedStateFromTracked/);
  assert.match(source, /persistedRange/);
  assert.match(source, /state: Exclude<IssueLocalRemediationState, 'server'>/);
  assert.match(extension, /new LiveRemediationManager\(context, diagnostics\)/);
});

test('los issues corregidos localmente usan una vista nativa independiente en la barra lateral', () => {
  const manifest = JSON.parse(read('package.json')) as {
    contributes?: { views?: Record<string, Array<{ id?: string }>> };
  };
  const manager = read('src/liveRemediation.ts');
  const provider = read('src/locallyFixedIssuesTreeView.ts');
  const launcher = read('src/dashboard/launcherWebview.ts');
  const extension = read('src/extension.ts');
  const views = manifest.contributes?.views?.sonarQubeDashboardContainer ?? [];

  assert.ok(views.some(view => view.id === 'sonarQubeDashboard.locallyFixedIssues'));
  assert.match(manager, /getLocallyFixedIssues\(\)/);
  assert.match(manager, /revealLocallyFixedIssue/);
  assert.match(provider, /class LocallyFixedIssuesTreeProvider/);
  assert.match(provider, /liveRemediation\.onDidChange/);
  assert.match(provider, /getLocallyFixedIssues\(\)/);
  assert.match(provider, /testing\.iconPassed/);
  assert.match(provider, /DASHBOARD_COMMANDS\.openLocallyFixedIssue/);
  assert.match(extension, /LOCALLY_FIXED_ISSUES_TREE_VIEW_ID/);
  assert.match(extension, /registerTreeDataProvider\([\s\S]*LOCALLY_FIXED_ISSUES_TREE_VIEW_ID/);
  assert.match(extension, /revealLocallyFixedIssue/);
  assert.doesNotMatch(launcher, /fixedLocallyPanel/);
  assert.doesNotMatch(launcher, /fixed-locally-item/);
  assert.match(read('README.md'), /dedicated native \*\*Issues fixed locally\*\* view/);
  assert.match(read('README.es.md'), /vista nativa independiente \*\*Issues corregidos localmente\*\*/);
});

test('el análisis notifica los fixes locales confirmados por SonarQube sin duplicar avisos', () => {
  const remediation = read('src/liveRemediation.ts');
  const extension = read('src/extension.ts');
  const notifications = read('src/notificationManager.ts');
  const changelog = read('CHANGELOG.md');

  assert.match(remediation, /confirmedLocallyFixedCount/);
  assert.match(remediation, /pendingLocallyFixedKeys/);
  assert.match(remediation, /!serverIssueKeys\.has\(key\)/);
  assert.match(extension, /notifications\.evaluate\(notificationScopes, source, confirmedLocallyFixedCount\)/);
  assert.match(notifications, /SonarQube confirmó 1 defecto corregido localmente/);
  assert.match(notifications, /SonarQube confirmed 1 locally fixed issue/);
  assert.match(notifications, /source === 'analysis'/);
  assert.match(changelog, /completion notifications now report how many \*\*Fixed locally\*\*/);
});
