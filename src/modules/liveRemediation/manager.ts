import * as vscode from 'vscode';
import { getDashboardLanguage } from '../../i18n';
import { DashboardIssue } from '../../types';
import type {
  IssueDiagnosticPresentation,
  IssueDiagnosticSnapshot
} from '../../issueDiagnostics';
import {
  baselineReplacementText,
  captureIssueBaseline,
  currentIssueSnippet,
  issueMatchesBaseline,
  matchingBaselineRangeInText,
  safeRevertRange,
  serverIssueSnippet
} from './baseline';
import {
  ACTIVE_PROBLEMS_REVEAL_DELAY_MS,
  DASHBOARD_DIAGNOSTIC_SOURCE,
  EXTERNAL_EVALUATION_DELAY_MS,
  TRACKED_BATCH_RECONCILIATION_DELAY_MS,
  TRACKED_FILE_RECONCILIATION_DELAY_MS
} from './constants';
import {
  collectDiagnosticsByIssueKey,
  compareDiagnosticPosition,
  diagnosticMessage
} from './diagnostics';
import { LiveRemediationDiffProvider, LIVE_REMEDIATION_DIFF_SCHEME } from './diffProvider';
import {
  IssueBaseline,
  IssueLocalRemediationState,
  LocallyModifiedIssueSummary,
  PersistedRemediationSession,
  RemediationValidationEntry,
  RemediationSessionSummary,
  TrackedIssue
} from './models';
import {
  persistedBaselineRange,
  persistedRange,
  RemediationStateStore
} from './persistence';
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

interface RestoredPendingState {
  state: Exclude<IssueLocalRemediationState, 'server'>;
  range: vscode.Range;
  baselineRange: vscode.Range;
  baseline?: IssueBaseline;
  observedBySonarIde: boolean;
}

interface PendingIssueReference {
  issueKey: string;
  rule: string;
  ruleName: string;
  message: string;
  relativePath: string;
  fileUri: string;
  line: number;
  severity: string;
}

interface MutableRemediationSession {
  startedAt: string;
  issuesAtStart: number;
  lastValidationAt?: string;
  confirmed: number;
  stillDetected: number;
  modifiedIssueKeys: Set<string>;
}

const MAX_REMEDIATION_HISTORY = 20;

/**
 * Tracks the local remediation state of server-side issues without pretending that
 * a local edit has already been accepted by SonarQube Server.
 */
export class LiveRemediationManager implements vscode.Disposable {
  private readonly trackedByKey = new Map<string, TrackedIssue>();
  private readonly keysByUri = new Map<string, Set<string>>();
  private readonly trackedFileUris = new Set<string>();
  private readonly evaluationTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly trackedFileReconciliationTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private trackedBatchReconciliationTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly fileChangeVersions = new Map<string, number>();
  private activeProblemsRevealTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly changedEmitter = new vscode.EventEmitter<void>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    89
  );
  private readonly stateStore: RemediationStateStore;
  private readonly sonarIde = new SonarIdeDiagnosticsObserver();
  private readonly diffProvider = new LiveRemediationDiffProvider();
  private readonly remediationHistory: RemediationValidationEntry[] = [];
  private readonly lastConfirmedResults: RemediationValidationEntry[] = [];
  private readonly stillDetectedHistory: RemediationValidationEntry[] = [];
  private remediationSession: MutableRemediationSession | undefined;
  private historySequence = 0;
  private readonly enabled = true;

  readonly onDidChange = this.changedEmitter.event;

  constructor(
    context: vscode.ExtensionContext,
    private readonly diagnostics: IssueDiagnosticPresentation,
    statusBarCommand: string
  ) {
    this.stateStore = new RemediationStateStore(context);
    this.restoreSessionState();
    this.statusBar.name = 'SonarQube live remediation';
    this.statusBar.command = statusBarCommand;

    const trackedFilesWatcher = vscode.workspace.createFileSystemWatcher('**/*');

    this.disposables.push(
      this.statusBar,
      this.changedEmitter,
      this.diffProvider,
      vscode.workspace.registerTextDocumentContentProvider(
        LIVE_REMEDIATION_DIFF_SCHEME,
        this.diffProvider
      ),
      trackedFilesWatcher,
      trackedFilesWatcher.onDidChange(uri => this.queueTrackedFileSystemChange(uri)),
      trackedFilesWatcher.onDidCreate(uri => this.queueTrackedFileSystemChange(uri)),
      trackedFilesWatcher.onDidDelete(uri => this.queueTrackedFileSystemChange(uri)),
      vscode.workspace.onDidCreateFiles(event => {
        for (const uri of event.files) this.queueTrackedFileSystemChange(uri);
      }),
      vscode.workspace.onDidDeleteFiles(event => {
        for (const uri of event.files) this.queueTrackedFileSystemChange(uri);
      }),
      vscode.workspace.onDidRenameFiles(event => {
        for (const file of event.files) {
          this.queueTrackedFileSystemChange(file.oldUri);
          this.queueTrackedFileSystemChange(file.newUri);
        }
      }),
      vscode.workspace.onDidSaveTextDocument(document => {
        this.queueTrackedFileSystemChange(document.uri);
      }),
      vscode.workspace.onDidChangeTextDocument(event => this.onDocumentChanged(event)),
      vscode.languages.onDidChangeDiagnostics(event => {
        for (const uri of event.uris) {
          this.scheduleExternalEvaluation(uri);
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
    this.ensureSession(issues.length);
    const fileChangeVersionsAtSnapshot = new Map(this.fileChangeVersions);
    const diagnosticByKey = collectDiagnosticsByIssueKey(serverDiagnostics);
    const previousTracked = new Map(this.trackedByKey);
    const serverIssuesByKey = new Map(issues.map(issue => [issue.key, issue] as const));
    const pendingLocallyModified = this.collectPendingLocallyModified(previousTracked);
    const confirmedLocallyModifiedCount = confirmLocalRemediation
      ? this.recordValidationResults(pendingLocallyModified, serverIssuesByKey)
      : 0;

    this.resetTrackedSnapshot();

    for (const issue of issues) {
      const sourceDiagnostic = diagnosticByKey.get(issue.key);
      if (!sourceDiagnostic) continue;
      this.trackServerIssue(
        issue,
        sourceDiagnostic,
        previousTracked,
        confirmLocalRemediation
      );
    }

    this.syncTrackedFileUris();
    this.syncPersistedStateFromTracked(!confirmLocalRemediation);
    void this.captureMissingBaselines(fileChangeVersionsAtSnapshot);
    if (this.enabled) this.observeExternalDiagnosticsForAllFiles();
    this.publishAll();
    this.fireChanged();
    return confirmedLocallyModifiedCount;
  }

  private collectPendingLocallyModified(
    previousTracked: ReadonlyMap<string, TrackedIssue>
  ): Map<string, PendingIssueReference> {
    const pending = new Map<string, PendingIssueReference>();
    for (const [key, tracked] of previousTracked) {
      if (tracked.state === 'server') continue;
      pending.set(key, this.pendingReferenceFromTracked(key, tracked));
    }
    for (const [key, persisted] of this.stateStore.pendingByKey) {
      if (pending.has(key)) continue;
      pending.set(key, {
        issueKey: key,
        rule: persisted.rule,
        ruleName: persisted.ruleName,
        message: persisted.message,
        relativePath: persisted.relativePath,
        fileUri: persisted.fileUri,
        line: persisted.line,
        severity: persisted.severity
      });
    }
    return pending;
  }

  private pendingReferenceFromTracked(
    key: string,
    tracked: TrackedIssue
  ): PendingIssueReference {
    return {
      issueKey: key,
      rule: tracked.issue.rule,
      ruleName: tracked.issue.ruleName,
      message: tracked.issue.message,
      relativePath: tracked.issue.relativePath,
      fileUri: tracked.issue.fileUri,
      line: Math.max(1, tracked.baselineRange.start.line + 1),
      severity: tracked.issue.severity
    };
  }

  private recordValidationResults(
    pending: ReadonlyMap<string, PendingIssueReference>,
    serverIssuesByKey: ReadonlyMap<string, DashboardIssue>
  ): number {
    const validatedAt = new Date().toISOString();
    let confirmed = 0;
    let stillDetected = 0;

    // Every real analysis replaces the latest-analysis result buckets, even when
    // there is nothing pending to validate. Confirmed fixes already live in the
    // cumulative remediation history, so stale "Solved" entries must not survive
    // into the next analysis cycle.
    this.lastConfirmedResults.length = 0;
    this.stillDetectedHistory.length = 0;

    if (pending.size === 0) {
      if (this.remediationSession) {
        this.remediationSession.lastValidationAt = validatedAt;
        this.remediationSession.confirmed = 0;
        this.remediationSession.stillDetected = 0;
      }
      this.persistSessionState();
      return 0;
    }

    for (const [key, reference] of pending) {
      this.historySequence += 1;
      const currentServerIssue = serverIssuesByKey.get(key);
      const entry: RemediationValidationEntry = currentServerIssue
        ? this.validationEntryFromServerIssue(currentServerIssue, validatedAt, key)
        : {
          id: `${validatedAt}:${this.historySequence}:${key}`,
          issueKey: reference.issueKey,
          rule: reference.rule,
          ruleName: reference.ruleName,
          message: reference.message,
          relativePath: reference.relativePath,
          fileUri: reference.fileUri,
          line: reference.line,
          severity: reference.severity,
          validatedAt
        };

      if (currentServerIssue) {
        stillDetected += 1;
        this.stillDetectedHistory.push({ ...entry, id: `${entry.id}:still` });
        continue;
      }

      confirmed += 1;
      this.lastConfirmedResults.push(entry);
      this.remediationHistory.unshift(entry);
    }

    if (this.remediationHistory.length > MAX_REMEDIATION_HISTORY) {
      this.remediationHistory.length = MAX_REMEDIATION_HISTORY;
    }
    if (this.remediationSession) {
      this.remediationSession.lastValidationAt = validatedAt;
      this.remediationSession.confirmed = confirmed;
      this.remediationSession.stillDetected = stillDetected;
    }
    this.persistSessionState();
    return confirmed;
  }

  private validationEntryFromServerIssue(
    issue: DashboardIssue,
    validatedAt: string,
    issueKey: string
  ): RemediationValidationEntry {
    return {
      id: `${validatedAt}:${this.historySequence}:${issueKey}`,
      issueKey,
      rule: issue.rule,
      ruleName: issue.ruleName,
      message: issue.message,
      relativePath: issue.relativePath,
      fileUri: issue.fileUri,
      line: Math.max(1, issue.line || 1),
      severity: issue.severity,
      validatedAt
    };
  }

  private resetTrackedSnapshot(): void {
    this.cancelEvaluationTimers();
    this.cancelTrackedFileReconciliation();
    this.cancelActiveProblemsReveal();
    this.trackedByKey.clear();
    this.keysByUri.clear();
    this.diagnostics.restoreServerSnapshot();
    this.sonarIde.forget();
  }

  private restoredPendingState(
    issue: DashboardIssue,
    previousTracked: ReadonlyMap<string, TrackedIssue>
  ): RestoredPendingState | undefined {
    if (!this.enabled) return undefined;

    const previous = previousTracked.get(issue.key);
    if (previous?.state !== undefined && previous.state !== 'server') {
      return {
        state: previous.state,
        range: previous.range,
        baselineRange: previous.baselineRange,
        baseline: previous.baseline,
        observedBySonarIde: previous.observedBySonarIde
      };
    }

    const persisted = this.stateStore.pendingByKey.get(issue.key);
    if (!persisted || this.uriKey(persisted.fileUri) !== this.uriKey(issue.fileUri)) {
      return undefined;
    }
    return {
      state: persisted.state,
      range: persistedRange(persisted),
      baselineRange: persistedBaselineRange(persisted),
      baseline: persisted.baseline,
      observedBySonarIde: persisted.state === 'awaitingConfirmation'
        ? persisted.observedBySonarIde
        : false
    };
  }

  private trackServerIssue(
    issue: DashboardIssue,
    sourceDiagnostic: vscode.Diagnostic,
    previousTracked: ReadonlyMap<string, TrackedIssue>,
    confirmLocalRemediation: boolean
  ): void {
    const restoredPending = this.restoredPendingState(issue, previousTracked);
    const pendingState = !confirmLocalRemediation ? restoredPending : undefined;
    const tracked: TrackedIssue = {
      issue,
      range: pendingState?.range ?? sourceDiagnostic.range,
      baselineRange: pendingState?.baselineRange ?? sourceDiagnostic.range,
      baseline: pendingState?.baseline,
      serverSeverity: sourceDiagnostic.severity,
      serverMessage: sourceDiagnostic.message,
      state: pendingState?.state ?? 'server',
      observedBySonarIde: pendingState?.observedBySonarIde ?? false
    };

    this.trackedByKey.set(issue.key, tracked);
    if (tracked.state !== 'server') this.markSessionModified(issue.key);
    const uriKey = this.uriKey(issue.fileUri);
    const keys = this.keysByUri.get(uriKey) ?? new Set<string>();
    keys.add(issue.key);
    this.keysByUri.set(uriKey, keys);
    this.trackedFileUris.add(uriKey);
  }

  clear(): void {
    this.cancelEvaluationTimers();
    this.cancelTrackedFileReconciliation();
    this.cancelActiveProblemsReveal();
    this.trackedByKey.clear();
    this.keysByUri.clear();
    this.trackedFileUris.clear();
    this.fileChangeVersions.clear();
    this.diagnostics.restoreServerSnapshot();
    this.sonarIde.forget();
    this.stateStore.clear();
    this.resetSession();
    this.fireChanged();
  }

  async clearRemediationSession(): Promise<void> {
    if (!this.enabled) return;

    const confirmLabel = this.text('Borrar sesión', 'Clear session');
    const choice = await vscode.window.showWarningMessage(
      this.text(
        'Se borrarán todos los cambios pendientes, resultados del último análisis e historial de esta sesión de remediación. Los archivos locales y los issues de SonarQube Server no se modificarán.',
        'All pending changes, latest-analysis results, and remediation history for this session will be cleared. Local files and SonarQube Server issues will not be modified.'
      ),
      { modal: true },
      confirmLabel
    );
    if (choice !== confirmLabel) return;

    this.cancelEvaluationTimers();
    this.cancelTrackedFileReconciliation();
    this.cancelActiveProblemsReveal();
    this.sonarIde.forget();
    for (const tracked of this.trackedByKey.values()) {
      tracked.state = 'server';
      tracked.observedBySonarIde = false;
      tracked.range = tracked.baselineRange;
    }

    // Keep the current server snapshot/tracking, but replace every piece of
    // session-local state with a brand-new empty session for this workspace.
    this.stateStore.syncFromTracked(this.trackedByKey);
    this.resetSession();
    this.ensureSession(this.trackedByKey.size);
    this.publishAll();
    this.fireChanged();
  }

  async clearLastSolvedResults(): Promise<void> {
    if (!this.enabled || this.lastConfirmedResults.length === 0) return;

    const confirmLabel = this.text('Borrar solucionados', 'Clear solved');
    const choice = await vscode.window.showWarningMessage(
      this.text(
        'Se eliminarán únicamente los issues de “Solucionados” del último análisis. El historial de solucionados, los archivos locales y SonarQube Server no se modificarán.',
        'Only the issues in “Solved” from the latest analysis will be cleared. Solved history, local files, and SonarQube Server will not be modified.'
      ),
      { modal: true },
      confirmLabel
    );
    if (choice !== confirmLabel) return;

    this.lastConfirmedResults.length = 0;
    if (this.remediationSession) this.remediationSession.confirmed = 0;
    this.persistSessionState();
    this.fireChanged();
  }

  async clearLastStillDetectedResults(): Promise<void> {
    if (!this.enabled || this.stillDetectedHistory.length === 0) return;

    const confirmLabel = this.text('Borrar detectados', 'Clear detected');
    const choice = await vscode.window.showWarningMessage(
      this.text(
        'Se eliminarán únicamente los issues de “Siguen detectándose” del último análisis. Los cambios pendientes, los archivos locales y SonarQube Server no se modificarán.',
        'Only the issues in “Still detected” from the latest analysis will be cleared. Pending changes, local files, and SonarQube Server will not be modified.'
      ),
      { modal: true },
      confirmLabel
    );
    if (choice !== confirmLabel) return;

    this.stillDetectedHistory.length = 0;
    if (this.remediationSession) this.remediationSession.stillDetected = 0;
    this.persistSessionState();
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
    const summaries = new Map<string, LocallyModifiedIssueSummary>();
    for (const [key, tracked] of this.trackedByKey) {
      if (tracked.state === 'server') continue;
      summaries.set(key, {
        key: tracked.issue.key,
        rule: tracked.issue.rule,
        ruleName: tracked.issue.ruleName,
        message: tracked.issue.message,
        relativePath: tracked.issue.relativePath,
        fileUri: tracked.issue.fileUri,
        line: Math.max(1, tracked.range.start.line + 1),
        severity: tracked.issue.severity,
        state: tracked.state as Exclude<IssueLocalRemediationState, 'server'>,
        diffAvailable: tracked.baseline !== undefined,
        revertAvailable: tracked.baseline !== undefined
      });
    }

    // During startup the first server snapshot may still be loading. Surface the
    // persisted pending entries immediately so the tree never appears to lose
    // local changes just because VS Code was restarted.
    for (const [key, persisted] of this.stateStore.pendingByKey) {
      if (summaries.has(key)) continue;
      summaries.set(key, {
        key,
        rule: persisted.rule,
        ruleName: persisted.ruleName,
        message: persisted.message,
        relativePath: persisted.relativePath,
        fileUri: persisted.fileUri,
        line: persisted.line,
        severity: persisted.severity,
        state: persisted.state,
        diffAvailable: persisted.baseline !== undefined,
        revertAvailable: persisted.baseline !== undefined
      });
    }

    return [...summaries.values()].sort((left, right) =>
      left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: 'base' })
      || left.line - right.line
      || left.rule.localeCompare(right.rule, undefined, { sensitivity: 'base' })
    );
  }

  getSessionSummary(): RemediationSessionSummary | undefined {
    if (!this.enabled || !this.remediationSession) return undefined;
    let modified = 0;
    let pendingValidation = 0;
    let pendingServer = 0;
    const countedKeys = new Set<string>();
    for (const [key, tracked] of this.trackedByKey) {
      if (tracked.state === 'server') continue;
      countedKeys.add(key);
      modified += 1;
      if (tracked.state === 'modified') pendingValidation += 1;
      if (tracked.state === 'awaitingConfirmation') pendingServer += 1;
    }
    // Immediately after a VS Code restart the server snapshot may not have been
    // rebuilt yet. Count restored pending entries as a fallback so the session
    // summary does not briefly reset to zero while the first refresh is running.
    for (const [key, persisted] of this.stateStore.pendingByKey) {
      if (countedKeys.has(key)) continue;
      modified += 1;
      if (persisted.state === 'modified') pendingValidation += 1;
      if (persisted.state === 'awaitingConfirmation') pendingServer += 1;
    }
    return {
      startedAt: this.remediationSession.startedAt,
      issuesAtStart: this.remediationSession.issuesAtStart,
      modified,
      modifiedDuringSession: this.remediationSession.modifiedIssueKeys.size,
      pendingValidation,
      pendingServer,
      lastValidationAt: this.remediationSession.lastValidationAt,
      confirmed: this.remediationSession.confirmed,
      stillDetected: this.remediationSession.stillDetected
    };
  }

  getRemediationHistory(): readonly RemediationValidationEntry[] {
    return [...this.remediationHistory];
  }

  getLastConfirmedResults(): readonly RemediationValidationEntry[] {
    return [...this.lastConfirmedResults];
  }

  getStillDetectedHistory(): readonly RemediationValidationEntry[] {
    return [...this.stillDetectedHistory];
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

  async showIssueDiff(issueKey: string): Promise<void> {
    const tracked = this.trackedByKey.get(issueKey);
    if (!tracked || tracked.state === 'server') return;
    const baseline = await this.ensureBaseline(tracked);
    if (!baseline) {
      await vscode.window.showWarningMessage(this.text(
        'No se puede mostrar el diff porque no existe una baseline segura del último snapshot del servidor.',
        'The diff cannot be shown because no safe baseline from the last server snapshot is available.'
      ));
      return;
    }

    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(tracked.issue.fileUri));
    const serverContent = serverIssueSnippet(baseline);
    const localContent = currentIssueSnippet(document, tracked);
    if (serverContent === localContent) {
      await vscode.window.showInformationMessage(this.text(
        'El bloque local coincide con la baseline del servidor.',
        'The local block matches the server baseline.'
      ));
      return;
    }

    const serverUri = this.diffProvider.createUri(
      tracked.issue.key,
      'server',
      tracked.issue.relativePath,
      serverContent
    );
    const localUri = this.diffProvider.createUri(
      tracked.issue.key,
      'local',
      tracked.issue.relativePath,
      localContent
    );
    const label = tracked.issue.ruleName || tracked.issue.rule || tracked.issue.message;
    await vscode.commands.executeCommand(
      'vscode.diff',
      serverUri,
      localUri,
      `${label} — ${this.text('Servidor ↔ Local', 'Server ↔ Local')}`,
      { preview: true }
    );
  }

  async revertLocallyModifiedIssue(issueKey: string): Promise<void> {
    const tracked = this.trackedByKey.get(issueKey);
    if (!tracked || tracked.state === 'server') return;
    const baseline = await this.ensureBaseline(tracked);
    if (!baseline) {
      await this.showUnsafeRevertMessage();
      return;
    }

    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(tracked.issue.fileUri));
    const replacementRange = safeRevertRange(document, tracked);
    if (!replacementRange) {
      await this.showUnsafeRevertMessage();
      return;
    }

    const confirmLabel = this.text('Revertir cambio', 'Revert change');
    const choice = await vscode.window.showWarningMessage(
      this.text(
        'Se restaurará únicamente el bloque asociado al issue usando la baseline del último snapshot de SonarQube. Los cambios fuera de ese bloque no se modificarán.',
        'Only the block associated with this issue will be restored from the latest SonarQube server baseline. Changes outside that block will not be modified.'
      ),
      { modal: true },
      confirmLabel
    );
    if (choice !== confirmLabel) return;

    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      replacementRange,
      baselineReplacementText(document, baseline, replacementRange)
    );
    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) {
      await vscode.window.showErrorMessage(this.text(
        'VS Code no pudo aplicar el revert del issue.',
        'VS Code could not apply the issue revert.'
      ));
      return;
    }

    const refreshedDocument = await vscode.workspace.openTextDocument(document.uri);
    if (issueMatchesBaseline(refreshedDocument, tracked)) {
      tracked.state = 'server';
      tracked.observedBySonarIde = false;
      tracked.range = clampRangeToDocument(refreshedDocument, tracked.baselineRange);
      this.syncPersistedStateFromTracked();
      this.publishUri(document.uri);
      this.fireChanged();
    }
  }

  dispose(): void {
    this.diagnostics.restoreServerSnapshot();
    this.cancelEvaluationTimers();
    this.cancelTrackedFileReconciliation();
    this.cancelActiveProblemsReveal();
    this.syncPersistedStateFromTracked();
    this.persistSessionState();
    this.stateStore.dispose();
    for (const disposable of this.disposables) disposable.dispose();
  }

  private ensureSession(issueCount: number): void {
    if (this.remediationSession) return;
    this.remediationSession = {
      startedAt: new Date().toISOString(),
      issuesAtStart: issueCount,
      confirmed: 0,
      stillDetected: 0,
      modifiedIssueKeys: new Set<string>()
    };
    this.persistSessionState();
  }

  private markSessionModified(issueKey: string): void {
    if (!this.remediationSession || this.remediationSession.modifiedIssueKeys.has(issueKey)) return;
    this.remediationSession.modifiedIssueKeys.add(issueKey);
    this.persistSessionState();
  }

  private restoreSessionState(): void {
    const persisted = this.stateStore.session;
    if (!persisted) return;

    this.remediationSession = {
      startedAt: persisted.startedAt,
      issuesAtStart: persisted.issuesAtStart,
      lastValidationAt: persisted.lastValidationAt,
      confirmed: persisted.confirmed,
      stillDetected: persisted.stillDetected,
      modifiedIssueKeys: new Set(persisted.modifiedIssueKeys)
    };
    this.remediationHistory.push(...persisted.remediationHistory.slice(0, MAX_REMEDIATION_HISTORY));
    this.lastConfirmedResults.push(...persisted.lastConfirmedResults);
    this.stillDetectedHistory.push(...persisted.stillDetectedHistory);
    this.historySequence = persisted.historySequence;
  }

  private persistSessionState(): void {
    if (!this.remediationSession) {
      this.stateStore.syncSession(undefined);
      return;
    }

    const persisted: PersistedRemediationSession = {
      startedAt: this.remediationSession.startedAt,
      issuesAtStart: this.remediationSession.issuesAtStart,
      lastValidationAt: this.remediationSession.lastValidationAt,
      confirmed: this.remediationSession.confirmed,
      stillDetected: this.remediationSession.stillDetected,
      modifiedIssueKeys: [...this.remediationSession.modifiedIssueKeys],
      historySequence: this.historySequence,
      remediationHistory: [...this.remediationHistory],
      lastConfirmedResults: [...this.lastConfirmedResults],
      stillDetectedHistory: [...this.stillDetectedHistory]
    };
    this.stateStore.syncSession(persisted);
  }

  private resetSession(): void {
    this.remediationSession = undefined;
    this.remediationHistory.length = 0;
    this.lastConfirmedResults.length = 0;
    this.stillDetectedHistory.length = 0;
    this.historySequence = 0;
    this.persistSessionState();
  }


  private resetLocalStates(): void {
    for (const tracked of this.trackedByKey.values()) {
      tracked.state = 'server';
      tracked.observedBySonarIde = false;
    }
    this.stateStore.clear();
  }

  private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
    if (!this.shouldProcessDocumentChange(event)) return;

    const keys = this.keysByUri.get(this.uriKey(event.document.uri));
    if (!keys?.size) return;

    const changes = this.sortedContentChanges(event.contentChanges);
    let stateChanged = false;
    for (const key of keys) {
      stateChanged = this.reconcileTrackedIssueAfterDocumentChange(
        key,
        event.document,
        changes
      ) || stateChanged;
    }

    this.syncPersistedStateFromTracked();
    this.publishUri(event.document.uri);
    if (stateChanged) this.fireChanged();
  }

  private shouldProcessDocumentChange(event: vscode.TextDocumentChangeEvent): boolean {
    return this.enabled
      && event.document.uri.scheme === 'file'
      && event.contentChanges.length > 0;
  }

  private sortedContentChanges(
    changes: readonly vscode.TextDocumentContentChangeEvent[]
  ): vscode.TextDocumentContentChangeEvent[] {
    return [...changes].sort((left, right) =>
      comparePositions(right.range.start, left.range.start)
    );
  }

  private reconcileTrackedIssueAfterDocumentChange(
    key: string,
    document: vscode.TextDocument,
    changes: readonly vscode.TextDocumentContentChangeEvent[]
  ): boolean {
    const tracked = this.trackedByKey.get(key);
    if (!tracked) return false;

    const transformed = this.transformTrackedRange(tracked.range, changes);
    tracked.range = clampRangeToDocument(document, transformed.range);

    // A direct edit of the issue range takes precedence over global relocation.
    // Otherwise an identical line elsewhere in the file can be mistaken for the
    // unchanged issue and hide a real local modification.
    if (transformed.touched) {
      if (tracked.baseline && issueMatchesBaseline(document, tracked)) {
        const matchingRange = matchingBaselineRangeInText(document.getText(), tracked);
        if (matchingRange) {
          return this.restoreTrackedServerState(
            tracked,
            clampRangeToDocument(document, matchingRange)
          );
        }
      }
      return this.markTrackedModified(key, tracked);
    }

    if (tracked.baseline) {
      const matchingRange = matchingBaselineRangeInText(document.getText(), tracked);
      if (matchingRange) {
        return this.restoreTrackedServerState(
          tracked,
          clampRangeToDocument(document, matchingRange)
        );
      }
    }

    return false;
  }

  private transformTrackedRange(
    initialRange: vscode.Range,
    changes: readonly vscode.TextDocumentContentChangeEvent[]
  ): { range: vscode.Range; touched: boolean } {
    let range = initialRange;
    let touched = false;
    for (const change of changes) {
      touched = touched || changeTouchesRange(change, range);
      range = transformRangeAfterChange(range, change);
    }
    return { range, touched };
  }

  private queueTrackedFileSystemChange(uri: vscode.Uri): void {
    if (!this.enabled || uri.scheme !== 'file') return;

    const uriString = this.uriKey(uri);
    if (!this.keysByUri.has(uriString) && !this.trackedFileUris.has(uriString)) return;
    this.fileChangeVersions.set(uriString, (this.fileChangeVersions.get(uriString) ?? 0) + 1);
    if (!this.keysByUri.has(uriString)) return;

    const existing = this.trackedFileReconciliationTimers.get(uriString);
    if (existing) clearTimeout(existing);
    this.trackedFileReconciliationTimers.set(uriString, setTimeout(() => {
      this.trackedFileReconciliationTimers.delete(uriString);
      void this.reconcileTrackedFileUri(uri);
    }, TRACKED_FILE_RECONCILIATION_DELAY_MS));

    this.scheduleTrackedBatchReconciliation();
  }

  private scheduleTrackedBatchReconciliation(): void {
    if (this.trackedBatchReconciliationTimer) {
      clearTimeout(this.trackedBatchReconciliationTimer);
    }
    this.trackedBatchReconciliationTimer = setTimeout(() => {
      this.trackedBatchReconciliationTimer = undefined;
      void this.reconcileAllTrackedFiles();
    }, TRACKED_BATCH_RECONCILIATION_DELAY_MS);
  }

  private async reconcileTrackedFileUri(uri: vscode.Uri): Promise<void> {
    const changed = await this.reconcileTrackedFileState(uri, true);
    if (!changed) return;
    this.syncPersistedStateFromTracked();
    this.publishUri(uri);
    this.fireChanged();
  }

  private async reconcileAllTrackedFiles(): Promise<void> {
    if (!this.enabled) return;
    const changedUris: vscode.Uri[] = [];
    for (const uriString of this.keysByUri.keys()) {
      const uri = vscode.Uri.parse(uriString);
      if (await this.reconcileTrackedFileState(uri, false)) changedUris.push(uri);
    }
    if (changedUris.length === 0) return;

    this.syncPersistedStateFromTracked();
    for (const uri of changedUris) this.publishUri(uri);
    this.fireChanged();
  }

  private async reconcileTrackedFileState(
    uri: vscode.Uri,
    missingMeansModified = false
  ): Promise<boolean> {
    if (!this.enabled || uri.scheme !== 'file') return false;
    const keys = this.keysByUri.get(this.uriKey(uri));
    if (!keys?.size) return false;

    const currentText = await this.readCurrentTrackedFileText(uri);
    if (currentText === undefined && !missingMeansModified) return false;
    let stateChanged = false;
    for (const key of keys) {
      stateChanged = this.reconcileTrackedIssueAfterFileChange(key, currentText) || stateChanged;
    }
    return stateChanged;
  }

  private async readCurrentTrackedFileText(uri: vscode.Uri): Promise<string | undefined> {
    const openDocument = vscode.workspace.textDocuments.find(
      candidate => this.uriKey(candidate.uri) === this.uriKey(uri)
    );
    if (openDocument?.isDirty) return openDocument.getText();

    try {
      let text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
      if (text.startsWith('\uFEFF')) text = text.slice(1);
      return text;
    } catch {
      return openDocument?.getText();
    }
  }

  private reconcileTrackedIssueAfterFileChange(
    key: string,
    currentText: string | undefined
  ): boolean {
    const tracked = this.trackedByKey.get(key);
    if (!tracked) return false;

    if (currentText !== undefined && tracked.baseline) {
      const matchingRange = matchingBaselineRangeInText(currentText, tracked);
      if (matchingRange) return this.restoreTrackedServerState(tracked, matchingRange);
    }
    return this.markTrackedModified(key, tracked);
  }

  private restoreTrackedServerState(tracked: TrackedIssue, range: vscode.Range): boolean {
    const rangeChanged = !tracked.range.isEqual(range);
    const stateChanged = tracked.state !== 'server' || tracked.observedBySonarIde;
    tracked.range = range;
    if (stateChanged) {
      tracked.state = 'server';
      tracked.observedBySonarIde = false;
    }
    return rangeChanged || stateChanged;
  }

  private markTrackedModified(key: string, tracked: TrackedIssue): boolean {
    if (tracked.state === 'modified') return false;
    tracked.state = 'modified';
    this.markSessionModified(key);
    return true;
  }

  private scheduleExternalEvaluation(uri: vscode.Uri): void {
    if (!this.enabled || uri.scheme !== 'file' || !this.keysByUri.has(this.uriKey(uri))) return;
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
      if (issue.state === 'awaitingConfirmation') {
        issue.state = 'modified';
        this.markSessionModified(issue.issue.key);
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
          this.markSessionModified(issue.issue.key);
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
    for (const key of this.keysByUri.get(this.uriKey(uri)) ?? []) {
      const tracked = this.trackedByKey.get(key);
      if (tracked) result.push(tracked);
    }
    return result;
  }

  private async captureMissingBaselines(
    versionsAtSnapshot?: ReadonlyMap<string, number>
  ): Promise<void> {
    const pending = [...this.trackedByKey.values()].filter(
      tracked => tracked.state === 'server' && !tracked.baseline
    );
    if (pending.length === 0) return;

    let baselineChanged = false;
    let stateChanged = false;
    await Promise.all(pending.map(async tracked => {
      const uriString = this.uriKey(tracked.issue.fileUri);
      const captureVersion = versionsAtSnapshot?.get(uriString)
        ?? this.fileChangeVersions.get(uriString)
        ?? 0;
      const baseline = await captureIssueBaseline(tracked);
      if (
        !baseline
        || this.trackedByKey.get(tracked.issue.key) !== tracked
        || tracked.state !== 'server'
      ) return;

      if ((this.fileChangeVersions.get(uriString) ?? 0) !== captureVersion) {
        stateChanged = this.markTrackedModified(tracked.issue.key, tracked) || stateChanged;
        return;
      }

      tracked.baseline = baseline;
      baselineChanged = true;
    }));

    const openDocumentsChanged = await this.reconcileOpenTrackedDocuments();
    if (!baselineChanged && !stateChanged && !openDocumentsChanged) return;
    this.syncPersistedStateFromTracked();
    this.publishAll();
    this.fireChanged();
  }

  private async reconcileOpenTrackedDocuments(): Promise<boolean> {
    let changed = false;
    for (const document of vscode.workspace.textDocuments) {
      if (document.uri.scheme !== 'file' || !this.keysByUri.has(this.uriKey(document.uri))) continue;
      changed = await this.reconcileTrackedFileState(document.uri) || changed;
    }
    return changed;
  }

  private async ensureBaseline(tracked: TrackedIssue): Promise<IssueBaseline | undefined> {
    if (tracked.baseline) return tracked.baseline;
    // Once an issue is already modified there is no trustworthy way to reconstruct
    // the previous server-side source block from the current file. Refuse to invent one.
    if (tracked.state !== 'server') return undefined;
    const baseline = await captureIssueBaseline(tracked);
    if (!baseline || this.trackedByKey.get(tracked.issue.key) !== tracked) return undefined;
    tracked.baseline = baseline;
    this.syncPersistedStateFromTracked();
    this.fireChanged();
    return baseline;
  }

  private async showUnsafeRevertMessage(): Promise<void> {
    await vscode.window.showWarningMessage(this.text(
      'No se puede revertir automáticamente porque el bloque original ya no puede localizarse con seguridad. Usa “Ver cambio” y revierte manualmente.',
      'The change cannot be reverted automatically because the original block can no longer be located safely. Use “View change” and revert it manually.'
    ));
  }

  private publishAll(): void {
    this.cancelActiveProblemsReveal();
    this.diagnostics.restoreServerSnapshot();
    if (!this.enabled) return;
    const activeUri = vscode.window.activeTextEditor
      ? this.uriKey(vscode.window.activeTextEditor.document.uri)
      : undefined;

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

  private syncTrackedFileUris(): void {
    this.trackedFileUris.clear();
    for (const uriString of this.keysByUri.keys()) this.trackedFileUris.add(uriString);
    for (const uriString of this.fileChangeVersions.keys()) {
      if (!this.trackedFileUris.has(uriString)) this.fileChangeVersions.delete(uriString);
    }
  }

  private uriKey(value: string | vscode.Uri): string {
    const uri = typeof value === 'string' ? vscode.Uri.parse(value) : value;
    const normalized = uri.with({ query: '', fragment: '' }).toString();
    return process.platform === 'win32' && uri.scheme === 'file'
      ? normalized.toLowerCase()
      : normalized;
  }

  private syncPersistedStateFromTracked(preserveMissing = false): void {
    this.stateStore.syncFromTracked(this.trackedByKey, preserveMissing);
  }

  private cancelEvaluationTimers(): void {
    for (const timer of this.evaluationTimers.values()) clearTimeout(timer);
    this.evaluationTimers.clear();
  }

  private cancelTrackedFileReconciliation(): void {
    for (const timer of this.trackedFileReconciliationTimers.values()) clearTimeout(timer);
    this.trackedFileReconciliationTimers.clear();
    if (this.trackedBatchReconciliationTimer) {
      clearTimeout(this.trackedBatchReconciliationTimer);
      this.trackedBatchReconciliationTimer = undefined;
    }
  }

  private cancelActiveProblemsReveal(): void {
    if (!this.activeProblemsRevealTimer) return;
    clearTimeout(this.activeProblemsRevealTimer);
    this.activeProblemsRevealTimer = undefined;
  }

  private text(spanishText: string, englishText: string): string {
    return getDashboardLanguage() === 'es' ? spanishText : englishText;
  }
}
