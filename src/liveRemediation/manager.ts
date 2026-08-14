import * as vscode from 'vscode';
import {
  DASHBOARD_COMMANDS,
  DASHBOARD_CONFIGURATION_SECTION
} from '../constants';
import { getDashboardLanguage } from '../i18n';
import { DashboardIssue } from '../types';
import type {
  IssueDiagnosticPresentation,
  IssueDiagnosticSnapshot
} from '../issueDiagnostics';
import {
  ACTIVE_PROBLEMS_REVEAL_DELAY_MS,
  DASHBOARD_DIAGNOSTIC_SOURCE,
  EXTERNAL_EVALUATION_DELAY_MS,
  LIVE_REMEDIATION_CONFIGURATION_KEY
} from './constants';
import {
  collectDiagnosticsByIssueKey,
  compareDiagnosticPosition,
  diagnosticMessage
} from './diagnostics';
import { IssueLocalRemediationState, LocallyModifiedIssueSummary, TrackedIssue } from './models';
import { persistedRange, RemediationStateStore } from './persistence';
import {
  changeTouchesRange,
  clampRangeToDocument,
  comparePositions,
  transformRangeAfterChange
} from './rangeTracking';
import {
  matchExternalDiagnostics,
  SonarIdeDiagnosticsObserver
} from './sonarIde';

/**
 * Tracks the local remediation state of server-side issues without pretending that
 * a local edit has already been accepted by SonarQube Server.
 */
export class LiveRemediationManager implements vscode.Disposable {
  private readonly trackedByKey = new Map<string, TrackedIssue>();
  private readonly keysByUri = new Map<string, Set<string>>();
  private readonly evaluationTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private activeProblemsRevealTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly changedEmitter = new vscode.EventEmitter<void>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    89
  );
  private readonly stateStore: RemediationStateStore;
  private readonly sonarIde = new SonarIdeDiagnosticsObserver();
  private enabled = true;

  readonly onDidChange = this.changedEmitter.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly diagnostics: IssueDiagnosticPresentation
  ) {
    this.enabled = this.readEnabled();
    this.stateStore = new RemediationStateStore(context);
    this.statusBar.name = 'SonarQube live remediation';
    this.statusBar.command = DASHBOARD_COMMANDS.refresh;

    this.disposables.push(
      this.statusBar,
      this.changedEmitter,
      vscode.workspace.onDidChangeTextDocument(event => this.onDocumentChanged(event)),
      vscode.languages.onDidChangeDiagnostics(event => {
        for (const uri of event.uris) {
          this.scheduleExternalEvaluation(uri);
        }
      }),
      vscode.workspace.onDidChangeConfiguration(event => {
        if (
          event.affectsConfiguration(
            `${DASHBOARD_CONFIGURATION_SECTION}.${LIVE_REMEDIATION_CONFIGURATION_KEY}`
          )
        ) {
          const wasEnabled = this.enabled;
          this.enabled = this.readEnabled();
          if (!this.enabled) {
            this.cancelEvaluationTimers();
            this.cancelActiveProblemsReveal();
            this.sonarIde.forget();
            this.resetLocalStates();
          } else if (!wasEnabled) {
            this.observeExternalDiagnosticsForAllFiles();
          }
          this.publishAll();
          this.fireChanged();
        }
      })
    );

    this.updateStatusBar();
  }

  applyServerSnapshot(
    issues: readonly DashboardIssue[],
    serverDiagnostics: IssueDiagnosticSnapshot,
    confirmLocalRemediation = false
  ): number {
    const diagnosticByKey = collectDiagnosticsByIssueKey(serverDiagnostics);
    const previousTracked = new Map(this.trackedByKey);
    const serverIssueKeys = new Set(issues.map(issue => issue.key));
    const pendingLocallyModifiedKeys = new Set<string>();

    for (const [key, tracked] of previousTracked) {
      if (tracked.state !== 'server') pendingLocallyModifiedKeys.add(key);
    }
    for (const key of this.stateStore.pendingByKey.keys()) {
      pendingLocallyModifiedKeys.add(key);
    }

    const confirmedLocallyModifiedCount = confirmLocalRemediation
      ? [...pendingLocallyModifiedKeys].filter(key => !serverIssueKeys.has(key)).length
      : 0;

    this.cancelEvaluationTimers();
    this.cancelActiveProblemsReveal();
    this.trackedByKey.clear();
    this.keysByUri.clear();
    this.diagnostics.restoreServerSnapshot();
    this.sonarIde.forget();

    for (const issue of issues) {
      const sourceDiagnostic = diagnosticByKey.get(issue.key);
      if (!sourceDiagnostic) continue;

      const previous = this.enabled ? previousTracked.get(issue.key) : undefined;
      const persisted = this.enabled ? this.stateStore.pendingByKey.get(issue.key) : undefined;
      let restoredPending: {
        state: Exclude<IssueLocalRemediationState, 'server'>;
        range: vscode.Range;
        observedBySonarIde: boolean;
      } | undefined;

      if (previous && previous.state !== 'server') {
        restoredPending = {
          state: previous.state,
          range: previous.range,
          observedBySonarIde: previous.observedBySonarIde
        };
      } else if (persisted?.fileUri === issue.fileUri) {
        restoredPending = {
          state: persisted.state,
          range: persistedRange(persisted),
          // For a persisted issue still pending validation, external evidence from a
          // previous VS Code session is stale. Require SonarQube for IDE to report it
          // again before local analyzer disappearance can move it to awaiting confirmation.
          observedBySonarIde: persisted.state === 'awaitingConfirmation'
            ? persisted.observedBySonarIde
            : false
        };
      }

      const preservePendingState = !confirmLocalRemediation && restoredPending !== undefined;
      const pendingState = preservePendingState ? restoredPending : undefined;
      const tracked: TrackedIssue = {
        issue,
        range: pendingState ? pendingState.range : sourceDiagnostic.range,
        serverSeverity: sourceDiagnostic.severity,
        serverMessage: sourceDiagnostic.message,
        state: pendingState ? pendingState.state : 'server',
        observedBySonarIde: pendingState ? pendingState.observedBySonarIde : false
      };

      this.trackedByKey.set(issue.key, tracked);
      const keys = this.keysByUri.get(issue.fileUri) ?? new Set<string>();
      keys.add(issue.key);
      this.keysByUri.set(issue.fileUri, keys);
    }

    this.syncPersistedStateFromTracked();
    if (this.enabled) {
      this.observeExternalDiagnosticsForAllFiles();
    }
    this.publishAll();
    this.fireChanged();
    return confirmedLocallyModifiedCount;
  }

  clear(): void {
    this.cancelEvaluationTimers();
    this.cancelActiveProblemsReveal();
    this.trackedByKey.clear();
    this.keysByUri.clear();
    this.diagnostics.restoreServerSnapshot();
    this.sonarIde.forget();
    this.stateStore.clear();
    this.fireChanged();
  }

  refreshLanguage(): void {
    this.publishAll();
    this.fireChanged();
  }

  getStates(): ReadonlyMap<string, IssueLocalRemediationState> {
    if (!this.enabled) return new Map();
    const result = new Map<string, IssueLocalRemediationState>();
    for (const [key, tracked] of this.trackedByKey) result.set(key, tracked.state);
    return result;
  }

  getRanges(): ReadonlyMap<string, vscode.Range> {
    if (!this.enabled) return new Map();
    const result = new Map<string, vscode.Range>();
    for (const [key, tracked] of this.trackedByKey) result.set(key, tracked.range);
    return result;
  }

  getLocallyModifiedIssues(): LocallyModifiedIssueSummary[] {
    if (!this.enabled) return [];
    return [...this.trackedByKey.values()]
      .filter(tracked => tracked.state !== 'server')
      .map(tracked => ({
        key: tracked.issue.key,
        rule: tracked.issue.rule,
        ruleName: tracked.issue.ruleName,
        message: tracked.issue.message,
        relativePath: tracked.issue.relativePath,
        fileUri: tracked.issue.fileUri,
        line: Math.max(1, tracked.range.start.line + 1),
        severity: tracked.issue.severity,
        state: tracked.state as Exclude<IssueLocalRemediationState, 'server'>
      }))
      .sort((left, right) =>
        left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: 'base' })
        || left.line - right.line
        || left.rule.localeCompare(right.rule, undefined, { sensitivity: 'base' })
      );
  }

  async revealLocallyModifiedIssue(issueKey: string): Promise<void> {
    const tracked = this.trackedByKey.get(issueKey);
    if (!tracked || tracked.state === 'server') return;

    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(tracked.issue.fileUri));
    const editor = await vscode.window.showTextDocument(document, {
      preview: false,
      preserveFocus: false
    });
    const range = clampRangeToDocument(document, tracked.range);
    editor.selection = new vscode.Selection(range.start, range.start);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }

  dispose(): void {
    this.diagnostics.restoreServerSnapshot();
    this.cancelEvaluationTimers();
    this.cancelActiveProblemsReveal();
    this.syncPersistedStateFromTracked();
    this.stateStore.dispose();
    for (const disposable of this.disposables) disposable.dispose();
  }

  private readEnabled(): boolean {
    const configuration = vscode.workspace.getConfiguration(
      DASHBOARD_CONFIGURATION_SECTION
    );
    return configuration.get<boolean>(
      LIVE_REMEDIATION_CONFIGURATION_KEY,
      true
    );
  }

  private resetLocalStates(): void {
    for (const tracked of this.trackedByKey.values()) {
      tracked.state = 'server';
      tracked.observedBySonarIde = false;
    }
    this.stateStore.clear();
  }

  private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
    if (!this.enabled || event.document.uri.scheme !== 'file' || event.contentChanges.length === 0) {
      return;
    }

    const uriString = event.document.uri.toString();
    const keys = this.keysByUri.get(uriString);
    if (!keys?.size) return;

    const changes = [...event.contentChanges].sort((left, right) =>
      comparePositions(right.range.start, left.range.start)
    );
    let stateChanged = false;

    for (const key of keys) {
      const tracked = this.trackedByKey.get(key);
      if (!tracked) continue;

      let currentRange = tracked.range;
      let touched = false;
      for (const change of changes) {
        touched = touched || changeTouchesRange(change, currentRange);
        currentRange = transformRangeAfterChange(currentRange, change);
      }

      tracked.range = clampRangeToDocument(event.document, currentRange);
      if (touched && tracked.state !== 'modified') {
        tracked.state = 'modified';
        stateChanged = true;
      }
    }

    this.syncPersistedStateFromTracked();
    this.publishUri(event.document.uri);
    if (stateChanged) this.fireChanged();
  }

  private scheduleExternalEvaluation(uri: vscode.Uri): void {
    if (!this.enabled || uri.scheme !== 'file' || !this.keysByUri.has(uri.toString())) return;
    if (!this.sonarIde.hasExternalSnapshotChanged(uri)) return;

    const key = uri.toString();
    const existing = this.evaluationTimers.get(key);
    if (existing) clearTimeout(existing);

    this.evaluationTimers.set(key, setTimeout(() => {
      this.evaluationTimers.delete(key);
      this.evaluateExternalDiagnostics(uri);
    }, EXTERNAL_EVALUATION_DELAY_MS));
  }

  private observeExternalDiagnosticsForAllFiles(): void {
    if (!this.enabled || !this.sonarIde.isActive()) return;
    for (const uriString of this.keysByUri.keys()) {
      this.observeExternalPresence(vscode.Uri.parse(uriString));
    }
  }

  private observeExternalPresence(uri: vscode.Uri): void {
    if (!this.enabled || !this.sonarIde.isActive()) return;
    const external = this.sonarIde.rememberCurrentSnapshot(uri);
    if (external.length === 0) return;

    const tracked = this.trackedIssuesForUri(uri);
    const matches = matchExternalDiagnostics(tracked, external);
    let changed = false;
    for (const issue of tracked) {
      if (!matches.has(issue.issue.key)) continue;
      if (!issue.observedBySonarIde) {
        issue.observedBySonarIde = true;
        changed = true;
      }
      // A persisted awaiting-confirmation state can outlive the editor session.
      // If the official local analyzer reports the same finding again when the
      // workspace is restored, return it to pending validation immediately.
      if (issue.state === 'awaitingConfirmation') {
        issue.state = 'modified';
        changed = true;
      }
    }
    if (changed) this.syncPersistedStateFromTracked();
  }

  private evaluateExternalDiagnostics(uri: vscode.Uri): void {
    if (!this.enabled || !this.sonarIde.isActive()) return;
    const tracked = this.trackedIssuesForUri(uri);
    if (tracked.length === 0) return;

    const external = this.sonarIde.getExternalDiagnostics(uri);
    const matches = matchExternalDiagnostics(tracked, external);
    let changed = false;

    for (const issue of tracked) {
      const match = matches.get(issue.issue.key);
      if (match) {
        issue.observedBySonarIde = true;
        if (!issue.range.isEqual(match.range)) {
          issue.range = match.range;
          changed = true;
        }
        if (issue.state === 'awaitingConfirmation') {
          issue.state = 'modified';
          changed = true;
        }
        continue;
      }

      if (issue.state === 'modified' && issue.observedBySonarIde) {
        issue.state = 'awaitingConfirmation';
        changed = true;
      }
    }

    if (changed) {
      this.syncPersistedStateFromTracked();
      this.publishUri(uri);
      this.fireChanged();
    }
  }

  private trackedIssuesForUri(uri: vscode.Uri): TrackedIssue[] {
    const result: TrackedIssue[] = [];
    for (const key of this.keysByUri.get(uri.toString()) ?? []) {
      const tracked = this.trackedByKey.get(key);
      if (tracked) result.push(tracked);
    }
    return result;
  }

  private publishAll(): void {
    this.cancelActiveProblemsReveal();
    this.diagnostics.restoreServerSnapshot();
    if (!this.enabled) return;
    const activeUri = vscode.window.activeTextEditor?.document.uri.toString();

    for (const uriString of this.keysByUri.keys()) {
      if (uriString !== activeUri) this.publishUri(vscode.Uri.parse(uriString));
    }

    if (!activeUri || !this.keysByUri.has(activeUri)) return;

    const uri = vscode.Uri.parse(activeUri);
    const autoReveal = vscode.workspace
      .getConfiguration('problems')
      .get<boolean>('autoReveal', true);

    if (!autoReveal) {
      this.publishUri(uri);
      return;
    }

    this.activeProblemsRevealTimer = setTimeout(() => {
      this.activeProblemsRevealTimer = undefined;
      this.publishUri(uri);
    }, ACTIVE_PROBLEMS_REVEAL_DELAY_MS);
  }

  private publishUri(uri: vscode.Uri): void {
    const diagnostics: vscode.Diagnostic[] = [];
    for (const tracked of this.trackedIssuesForUri(uri)) {
      const diagnostic = new vscode.Diagnostic(
        tracked.range,
        diagnosticMessage(tracked),
        tracked.state === 'server'
          ? tracked.serverSeverity
          : vscode.DiagnosticSeverity.Information
      );
      diagnostic.source = DASHBOARD_DIAGNOSTIC_SOURCE;
      diagnostic.code = tracked.issue.key;
      diagnostics.push(diagnostic);
    }

    diagnostics.sort(compareDiagnosticPosition);
    if (diagnostics.length > 0) this.diagnostics.setPresentation(uri, diagnostics);
    else this.diagnostics.deletePresentation(uri);
  }

  private fireChanged(): void {
    this.updateStatusBar();
    this.changedEmitter.fire();
  }

  private updateStatusBar(): void {
    if (!this.enabled) {
      this.statusBar.hide();
      return;
    }

    let modified = 0;
    let awaitingConfirmation = 0;
    for (const tracked of this.trackedByKey.values()) {
      if (tracked.state !== 'server') modified += 1;
      if (tracked.state === 'awaitingConfirmation') awaitingConfirmation += 1;
    }
    if (modified === 0) {
      this.statusBar.hide();
      return;
    }

    const spanish = getDashboardLanguage() === 'es';
    const fragments = [
      `${modified} ${spanish ? 'modificados localmente' : 'modified locally'}`
    ];
    if (awaitingConfirmation > 0) {
      fragments.push(
        `${awaitingConfirmation} ${spanish ? 'pendientes de confirmación' : 'awaiting confirmation'}`
      );
    }
    this.statusBar.text = `$(pulse) SonarQube: ${fragments.join(' · ')}`;
    this.statusBar.tooltip = spanish
      ? 'Estado local pendiente de confirmación de SonarQube. Haz clic para sincronizar con el servidor.'
      : 'Local state pending SonarQube confirmation. Click to refresh from the server.';
    this.statusBar.show();
  }

  private syncPersistedStateFromTracked(): void {
    this.stateStore.syncFromTracked(this.trackedByKey);
  }

  private cancelEvaluationTimers(): void {
    for (const timer of this.evaluationTimers.values()) clearTimeout(timer);
    this.evaluationTimers.clear();
  }

  private cancelActiveProblemsReveal(): void {
    if (!this.activeProblemsRevealTimer) return;
    clearTimeout(this.activeProblemsRevealTimer);
    this.activeProblemsRevealTimer = undefined;
  }
}
