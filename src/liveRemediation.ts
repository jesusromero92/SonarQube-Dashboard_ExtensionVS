import * as vscode from 'vscode';
import {
  DASHBOARD_COMMANDS,
  DASHBOARD_CONFIGURATION_KEYS,
  DASHBOARD_CONFIGURATION_SECTION,
  SONARQUBE_FOR_IDE_EXTENSION_ID
} from './constants';
import { getDashboardLanguage } from './i18n';
import { DashboardIssue, IssueLocalRemediationState } from './types';

export interface LocallyFixedIssueSummary {
  key: string;
  rule: string;
  ruleName: string;
  message: string;
  relativePath: string;
  fileUri: string;
  line: number;
  severity: string;
}

interface TrackedIssue {
  issue: DashboardIssue;
  range: vscode.Range;
  serverSeverity: vscode.DiagnosticSeverity;
  serverMessage: string;
  state: IssueLocalRemediationState;
  observedBySonarIde: boolean;
}

interface PersistedRemediationIssue {
  fileUri: string;
  state: Exclude<IssueLocalRemediationState, 'server'>;
  observedBySonarIde: boolean;
  range: {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
  };
}

interface PersistedRemediationSnapshot {
  version: 1;
  issues: Record<string, PersistedRemediationIssue>;
}

const DASHBOARD_DIAGNOSTIC_SOURCE = 'SonarQube Dashboard';
const EXTERNAL_EVALUATION_DELAY_MS = 1400;
// VS Code debounces marker changes in the Problems view. Publishing the restored
// active file in a separate update makes its native problems.autoReveal logic run
// after the rest of the workspace markers have settled.
const ACTIVE_PROBLEMS_REVEAL_DELAY_MS = 120;
const LIVE_REMEDIATION_STORAGE_KEY = 'sonarQubeDashboard.liveRemediation.pending.v1';

/**
 * Tracks the local remediation state of server-side issues without pretending that
 * a local edit has already been accepted by SonarQube Server.
 *
 * - A touched finding becomes `modified` immediately.
 * - If the official SonarQube for IDE extension is installed and active, had independently
 *   reported the same rule/location, and then removes that diagnostic after the edit,
 *   the finding becomes `locallyFixed`, remains in Problems as an informational
 *   pending-confirmation entry, and keeps its green marker in the editor.
 * - Ordinary dashboard refreshes preserve pending local states so their visual feedback
 *   does not disappear while SonarQube Server still exposes the previous analysis.
 * - A refresh triggered by a completed repository analysis is authoritative: issues still
 *   returned become `server` again, while issues no longer returned disappear permanently.
 */
export class LiveRemediationManager implements vscode.Disposable {
  private readonly trackedByKey = new Map<string, TrackedIssue>();
  private readonly keysByUri = new Map<string, Set<string>>();
  private readonly evaluationTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly persistedByKey = new Map<string, PersistedRemediationIssue>();
  private activeProblemsRevealTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly changedEmitter = new vscode.EventEmitter<void>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    89
  );
  private enabled = true;

  readonly onDidChange = this.changedEmitter.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly diagnostics: vscode.DiagnosticCollection
  ) {
    this.enabled = this.readEnabled();
    this.restorePersistedState();
    this.statusBar.name = 'SonarQube live remediation';
    this.statusBar.command = DASHBOARD_COMMANDS.analyze;

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
            `${DASHBOARD_CONFIGURATION_SECTION}.${DASHBOARD_CONFIGURATION_KEYS.liveRemediationEnabled}`
          )
        ) {
          const wasEnabled = this.enabled;
          this.enabled = this.readEnabled();
          if (!this.enabled) {
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
    pendingDiagnostics: vscode.DiagnosticCollection,
    confirmLocalRemediation = false
  ): number {
    const diagnosticByKey = collectDiagnosticsByIssueKey(pendingDiagnostics);
    const previousTracked = new Map(this.trackedByKey);
    const serverIssueKeys = new Set(issues.map(issue => issue.key));
    const pendingLocallyFixedKeys = new Set<string>();

    for (const [key, tracked] of previousTracked) {
      if (tracked.state === 'locallyFixed') {
        pendingLocallyFixedKeys.add(key);
      }
    }
    for (const [key, persisted] of this.persistedByKey) {
      if (persisted.state === 'locallyFixed') {
        pendingLocallyFixedKeys.add(key);
      }
    }

    const confirmedLocallyFixedCount = confirmLocalRemediation
      ? [...pendingLocallyFixedKeys].filter(key => !serverIssueKeys.has(key)).length
      : 0;

    this.cancelEvaluationTimers();
    this.cancelActiveProblemsReveal();
    this.trackedByKey.clear();
    this.keysByUri.clear();
    this.diagnostics.clear();

    for (const issue of issues) {
      const sourceDiagnostic = diagnosticByKey.get(issue.key);
      if (!sourceDiagnostic) {
        continue;
      }

      const previous = previousTracked.get(issue.key);
      const persisted = this.persistedByKey.get(issue.key);
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
          observedBySonarIde: persisted.observedBySonarIde
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

    pendingDiagnostics.dispose();
    this.syncPersistedStateFromTracked();
    this.observeExternalDiagnosticsForAllFiles();
    this.publishAll();
    this.fireChanged();
    return confirmedLocallyFixedCount;
  }

  clear(): void {
    this.cancelEvaluationTimers();
    this.cancelActiveProblemsReveal();
    this.trackedByKey.clear();
    this.keysByUri.clear();
    this.diagnostics.clear();
    this.persistedByKey.clear();
    this.persistPendingState();
    this.fireChanged();
  }

  refreshLanguage(): void {
    this.publishAll();
    this.fireChanged();
  }

  getStates(): ReadonlyMap<string, IssueLocalRemediationState> {
    return new Map(
      [...this.trackedByKey.entries()].map(([key, tracked]) => [key, tracked.state])
    );
  }

  getRanges(): ReadonlyMap<string, vscode.Range> {
    return new Map(
      [...this.trackedByKey.entries()].map(([key, tracked]) => [key, tracked.range])
    );
  }

  getLocallyFixedIssueKeys(): ReadonlySet<string> {
    return new Set(
      [...this.trackedByKey.entries()]
        .filter(([, tracked]) => tracked.state === 'locallyFixed')
        .map(([key]) => key)
    );
  }

  getModifiedIssueKeys(): ReadonlySet<string> {
    return new Set(
      [...this.trackedByKey.entries()]
        .filter(([, tracked]) => tracked.state === 'modified')
        .map(([key]) => key)
    );
  }

  getLocallyFixedIssues(): LocallyFixedIssueSummary[] {
    return [...this.trackedByKey.values()]
      .filter(tracked => tracked.state === 'locallyFixed')
      .map(tracked => ({
        key: tracked.issue.key,
        rule: tracked.issue.rule,
        ruleName: tracked.issue.ruleName,
        message: tracked.issue.message,
        relativePath: tracked.issue.relativePath,
        fileUri: tracked.issue.fileUri,
        line: Math.max(1, tracked.range.start.line + 1),
        severity: tracked.issue.severity
      }))
      .sort((left, right) =>
        left.relativePath.localeCompare(right.relativePath, undefined, { sensitivity: 'base' }) ||
        left.line - right.line ||
        left.rule.localeCompare(right.rule, undefined, { sensitivity: 'base' })
      );
  }

  async revealLocallyFixedIssue(issueKey: string): Promise<void> {
    const tracked = this.trackedByKey.get(issueKey);
    if (!tracked || tracked.state !== 'locallyFixed') {
      return;
    }

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
    this.cancelEvaluationTimers();
    this.cancelActiveProblemsReveal();
    this.syncPersistedStateFromTracked();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private readEnabled(): boolean {
    return vscode.workspace
      .getConfiguration(DASHBOARD_CONFIGURATION_SECTION)
      .get<boolean>(DASHBOARD_CONFIGURATION_KEYS.liveRemediationEnabled, true);
  }

  private resetLocalStates(): void {
    for (const tracked of this.trackedByKey.values()) {
      tracked.state = 'server';
      tracked.observedBySonarIde = false;
    }
    this.persistedByKey.clear();
    this.persistPendingState();
  }

  private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
    if (!this.enabled || event.document.uri.scheme !== 'file' || event.contentChanges.length === 0) {
      return;
    }

    const uriString = event.document.uri.toString();
    const keys = this.keysByUri.get(uriString);
    if (!keys || keys.size === 0) {
      return;
    }

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
    if (stateChanged) {
      this.fireChanged();
    }
  }

  private isSonarIdeActive(): boolean {
    return vscode.extensions.getExtension(SONARQUBE_FOR_IDE_EXTENSION_ID)?.isActive === true;
  }

  private scheduleExternalEvaluation(uri: vscode.Uri): void {
    if (!this.enabled || uri.scheme !== 'file' || !this.keysByUri.has(uri.toString())) {
      return;
    }

    const key = uri.toString();
    const existing = this.evaluationTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    this.evaluationTimers.set(key, setTimeout(() => {
      this.evaluationTimers.delete(key);
      this.evaluateExternalDiagnostics(uri);
    }, EXTERNAL_EVALUATION_DELAY_MS));
  }

  private observeExternalDiagnosticsForAllFiles(): void {
    if (!this.enabled || !this.isSonarIdeActive()) return;
    for (const uriString of this.keysByUri.keys()) {
      this.observeExternalPresence(vscode.Uri.parse(uriString));
    }
  }

  private observeExternalPresence(uri: vscode.Uri): void {
    if (!this.isSonarIdeActive()) return;
    const external = vscode.languages.getDiagnostics(uri).filter(isExternalSonarDiagnostic);
    if (external.length === 0) return;

    let changed = false;
    for (const key of this.keysByUri.get(uri.toString()) ?? []) {
      const tracked = this.trackedByKey.get(key);
      if (!tracked) continue;
      if (findMatchingExternalDiagnostic(tracked, external) && !tracked.observedBySonarIde) {
        tracked.observedBySonarIde = true;
        changed = true;
      }
    }
    if (changed) {
      this.syncPersistedStateFromTracked();
    }
  }

  private evaluateExternalDiagnostics(uri: vscode.Uri): void {
    if (!this.isSonarIdeActive()) return;
    const uriString = uri.toString();
    const keys = this.keysByUri.get(uriString);
    if (!keys || keys.size === 0) return;

    const external = vscode.languages.getDiagnostics(uri).filter(isExternalSonarDiagnostic);
    let changed = false;

    for (const key of keys) {
      const tracked = this.trackedByKey.get(key);
      if (!tracked) continue;

      const match = findMatchingExternalDiagnostic(tracked, external);
      if (match) {
        tracked.observedBySonarIde = true;
        const externalRangeChanged = !tracked.range.isEqual(match.range);
        tracked.range = match.range;
        changed = changed || externalRangeChanged;

        // A local analyzer still reporting the issue does not mean the working tree
        // went back to the server snapshot. Once the user has touched the finding,
        // keep it as locally modified until a repository analysis confirms the
        // authoritative server state. If a previously locally-fixed issue reappears
        // in SonarQube for IDE (for example after Undo/Redo), move it back to
        // `modified` rather than silently restoring the stale server state.
        if (tracked.state === 'locallyFixed') {
          tracked.state = 'modified';
          changed = true;
        }
        continue;
      }

      if (tracked.state === 'modified' && tracked.observedBySonarIde) {
        tracked.state = 'locallyFixed';
        changed = true;
      }
    }

    if (changed) {
      this.syncPersistedStateFromTracked();
      this.publishUri(uri);
      this.fireChanged();
    }
  }

  private publishAll(): void {
    this.cancelActiveProblemsReveal();
    this.diagnostics.clear();
    const activeUri = vscode.window.activeTextEditor?.document.uri.toString();
    const uriStrings = [...this.keysByUri.keys()];

    for (const uriString of uriStrings) {
      if (uriString !== activeUri) {
        this.publishUri(vscode.Uri.parse(uriString));
      }
    }

    if (!activeUri || !this.keysByUri.has(activeUri)) {
      return;
    }

    const uri = vscode.Uri.parse(activeUri);
    const autoReveal = vscode.workspace
      .getConfiguration('problems')
      .get<boolean>('autoReveal', true);

    if (!autoReveal) {
      this.publishUri(uri);
      return;
    }

    // Keep the active resource out of this collection for one Problems marker
    // debounce window, then add it in a distinct update. This is important on a
    // restored VS Code window: the active editor already exists before startup
    // synchronization publishes Sonar diagnostics, so no editor-change event is
    // available to trigger Problems auto-reveal.
    this.activeProblemsRevealTimer = setTimeout(() => {
      this.activeProblemsRevealTimer = undefined;
      this.publishUri(uri);
    }, ACTIVE_PROBLEMS_REVEAL_DELAY_MS);
  }

  private publishUri(uri: vscode.Uri): void {
    const diagnostics: vscode.Diagnostic[] = [];
    for (const key of this.keysByUri.get(uri.toString()) ?? []) {
      const tracked = this.trackedByKey.get(key);
      if (!tracked) {
        continue;
      }

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

    if (diagnostics.length > 0) {
      this.diagnostics.set(uri, diagnostics);
    } else {
      this.diagnostics.delete(uri);
    }
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

    const modified = this.getModifiedIssueKeys().size;
    const fixed = this.getLocallyFixedIssueKeys().size;
    if (modified === 0 && fixed === 0) {
      this.statusBar.hide();
      return;
    }

    const spanish = getDashboardLanguage() === 'es';
    const fragments: string[] = [];
    if (modified > 0) {
      fragments.push(`${modified} ${spanish ? 'modificados' : 'modified'}`);
    }
    if (fixed > 0) {
      fragments.push(`${fixed} ${spanish ? 'corregidos localmente' : 'locally fixed'}`);
    }
    this.statusBar.text = `$(pulse) SonarQube: ${fragments.join(' · ')}`;
    this.statusBar.tooltip = spanish
      ? 'Estado local pendiente de confirmación de SonarQube. Haz clic para analizar el repositorio.'
      : 'Local state pending SonarQube confirmation. Click to analyze the repository.';
    this.statusBar.show();
  }

  private restorePersistedState(): void {
    const snapshot = this.context.workspaceState.get<PersistedRemediationSnapshot>(
      LIVE_REMEDIATION_STORAGE_KEY
    );
    if (!snapshot || snapshot.version !== 1 || !snapshot.issues) {
      return;
    }

    for (const [key, issue] of Object.entries(snapshot.issues)) {
      if (isPersistedRemediationIssue(issue)) {
        this.persistedByKey.set(key, issue);
      }
    }
  }

  private syncPersistedStateFromTracked(): void {
    this.persistedByKey.clear();
    for (const [key, tracked] of this.trackedByKey) {
      if (tracked.state === 'server') {
        continue;
      }
      this.persistedByKey.set(key, {
        fileUri: tracked.issue.fileUri,
        state: tracked.state,
        observedBySonarIde: tracked.observedBySonarIde,
        range: serializeRange(tracked.range)
      });
    }
    this.persistPendingState();
  }

  private persistPendingState(): void {
    const issues = Object.fromEntries(this.persistedByKey);
    const value: PersistedRemediationSnapshot | undefined = this.persistedByKey.size > 0
      ? { version: 1, issues }
      : undefined;
    void this.context.workspaceState.update(LIVE_REMEDIATION_STORAGE_KEY, value);
  }

  private cancelEvaluationTimers(): void {
    for (const timer of this.evaluationTimers.values()) {
      clearTimeout(timer);
    }
    this.evaluationTimers.clear();
  }

  private cancelActiveProblemsReveal(): void {
    if (this.activeProblemsRevealTimer) {
      clearTimeout(this.activeProblemsRevealTimer);
      this.activeProblemsRevealTimer = undefined;
    }
  }
}

function serializeRange(range: vscode.Range): PersistedRemediationIssue['range'] {
  return {
    startLine: range.start.line,
    startCharacter: range.start.character,
    endLine: range.end.line,
    endCharacter: range.end.character
  };
}

function persistedRange(issue: PersistedRemediationIssue): vscode.Range {
  return new vscode.Range(
    Math.max(0, issue.range.startLine),
    Math.max(0, issue.range.startCharacter),
    Math.max(0, issue.range.endLine),
    Math.max(0, issue.range.endCharacter)
  );
}

function isPersistedRemediationIssue(value: unknown): value is PersistedRemediationIssue {
  if (!value || typeof value !== 'object') return false;
  const issue = value as Partial<PersistedRemediationIssue>;
  const range = issue.range as Partial<PersistedRemediationIssue['range']> | undefined;
  return typeof issue.fileUri === 'string'
    && (issue.state === 'modified' || issue.state === 'locallyFixed')
    && typeof issue.observedBySonarIde === 'boolean'
    && range !== undefined
    && Number.isInteger(range.startLine)
    && Number.isInteger(range.startCharacter)
    && Number.isInteger(range.endLine)
    && Number.isInteger(range.endCharacter);
}

function collectDiagnosticsByIssueKey(
  collection: vscode.DiagnosticCollection
): Map<string, vscode.Diagnostic> {
  const result = new Map<string, vscode.Diagnostic>();
  collection.forEach((_uri, diagnostics) => {
    for (const diagnostic of diagnostics) {
      const key = diagnosticCode(diagnostic);
      if (key) result.set(key, diagnostic);
    }
  });
  return result;
}

function diagnosticMessage(tracked: TrackedIssue): string {
  if (tracked.state === 'server') {
    return tracked.serverMessage;
  }
  if (tracked.state === 'locallyFixed') {
    const prefix = getDashboardLanguage() === 'es'
      ? '[✓ Corregido localmente · pendiente de confirmación de SonarQube] '
      : '[✓ Fixed locally · awaiting SonarQube confirmation] ';
    return `${prefix}${tracked.serverMessage}`;
  }
  const prefix = getDashboardLanguage() === 'es'
    ? '[Modificado localmente · pendiente de validación] '
    : '[Modified locally · pending validation] ';
  return `${prefix}${tracked.serverMessage}`;
}

function compareDiagnosticPosition(
  left: vscode.Diagnostic,
  right: vscode.Diagnostic
): number {
  return left.range.start.line - right.range.start.line
    || left.range.start.character - right.range.start.character
    || left.severity - right.severity;
}

function isExternalSonarDiagnostic(diagnostic: vscode.Diagnostic): boolean {
  const source = diagnostic.source?.trim().toLowerCase() ?? '';
  return source !== DASHBOARD_DIAGNOSTIC_SOURCE.toLowerCase()
    && (source.includes('sonar') || source.includes('sonarlint'));
}

function findMatchingExternalDiagnostic(
  tracked: TrackedIssue,
  diagnostics: readonly vscode.Diagnostic[]
): vscode.Diagnostic | undefined {
  const ruleCandidates = normalizedRuleCandidates(tracked.issue.rule);
  return diagnostics.find(diagnostic => {
    const code = diagnosticCode(diagnostic);
    if (!code || ![...normalizedRuleCandidates(code)].some(candidate => ruleCandidates.has(candidate))) {
      return false;
    }
    return rangesNear(tracked.range, diagnostic.range, 3);
  });
}

function normalizedRuleCandidates(value: string): Set<string> {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '');
  const result = new Set<string>();
  if (!normalized) return result;
  result.add(normalized);
  const suffix = normalized.split(':').at(-1);
  if (suffix) result.add(suffix);
  return result;
}

function diagnosticCode(diagnostic: vscode.Diagnostic): string | undefined {
  if (typeof diagnostic.code === 'string' || typeof diagnostic.code === 'number') {
    return String(diagnostic.code);
  }
  return diagnostic.code?.value === undefined
    ? undefined
    : String(diagnostic.code.value);
}

function rangesNear(left: vscode.Range, right: vscode.Range, toleranceLines: number): boolean {
  if (left.intersection(right)) return true;
  return Math.abs(left.start.line - right.start.line) <= toleranceLines;
}

function comparePositions(left: vscode.Position, right: vscode.Position): number {
  return left.line - right.line || left.character - right.character;
}

function changeTouchesRange(
  change: vscode.TextDocumentContentChangeEvent,
  range: vscode.Range
): boolean {
  if (Boolean(range.intersection(change.range))
    || change.range.contains(range.start)
    || change.range.contains(range.end)) {
    return true;
  }

  // Sonar diagnostics can target only the offending token (for example `\d`)
  // instead of the whole expression. VS Code then reports a one-character insertion
  // immediately before/after that diagnostic range when the user escapes or rewrites
  // the token. Treat a tiny same-line boundary gap as touching the finding so edits
  // such as `\d` -> `\\d`, Quick Fix replacements, Undo and Redo cannot lose the
  // local-remediation state merely because the diagnostic range was narrower than
  // the edited token.
  return horizontalGap(change.range, range) <= 2;
}

function horizontalGap(left: vscode.Range, right: vscode.Range): number {
  if (left.end.line === right.start.line && left.end.character <= right.start.character) {
    return right.start.character - left.end.character;
  }
  if (right.end.line === left.start.line && right.end.character <= left.start.character) {
    return left.start.character - right.end.character;
  }
  return Number.POSITIVE_INFINITY;
}

export function transformRangeAfterChange(
  range: vscode.Range,
  change: Pick<vscode.TextDocumentContentChangeEvent, 'range' | 'text'>
): vscode.Range {
  const start = transformPositionAfterChange(range.start, change);
  const end = transformPositionAfterChange(range.end, change);
  return new vscode.Range(start, end.isBefore(start) ? start : end);
}

function transformPositionAfterChange(
  position: vscode.Position,
  change: Pick<vscode.TextDocumentContentChangeEvent, 'range' | 'text'>
): vscode.Position {
  const changedRange = change.range;
  if (position.isBefore(changedRange.start)) {
    return position;
  }

  const insertedEnd = insertedTextEnd(changedRange.start, change.text);
  if (changedRange.contains(position)) {
    return insertedEnd;
  }

  if (position.isEqual(changedRange.end) && !changedRange.isEmpty) {
    return insertedEnd;
  }

  const removedLines = changedRange.end.line - changedRange.start.line;
  const insertedLines = insertedEnd.line - changedRange.start.line;
  const lineDelta = insertedLines - removedLines;

  if (position.line > changedRange.end.line) {
    return new vscode.Position(position.line + lineDelta, position.character);
  }

  if (position.line === changedRange.end.line) {
    if (insertedLines === 0) {
      const removedCharacters = changedRange.end.character - changedRange.start.character;
      const insertedCharacters = insertedEnd.character - changedRange.start.character;
      return new vscode.Position(
        position.line + lineDelta,
        Math.max(0, position.character + insertedCharacters - removedCharacters)
      );
    }
    return new vscode.Position(
      position.line + lineDelta,
      Math.max(0, insertedEnd.character + (position.character - changedRange.end.character))
    );
  }

  return new vscode.Position(Math.max(0, position.line + lineDelta), position.character);
}

function insertedTextEnd(start: vscode.Position, text: string): vscode.Position {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length === 1) {
    return new vscode.Position(start.line, start.character + lines[0].length);
  }
  return new vscode.Position(start.line + lines.length - 1, lines.at(-1)?.length ?? 0);
}

function clampRangeToDocument(document: vscode.TextDocument, range: vscode.Range): vscode.Range {
  const maxLine = Math.max(0, document.lineCount - 1);
  const clampPosition = (position: vscode.Position): vscode.Position => {
    const line = Math.min(Math.max(0, position.line), maxLine);
    const maxCharacter = document.lineAt(line).text.length;
    return new vscode.Position(line, Math.min(Math.max(0, position.character), maxCharacter));
  };
  const start = clampPosition(range.start);
  const end = clampPosition(range.end);
  return new vscode.Range(start, end.isBefore(start) ? start : end);
}
