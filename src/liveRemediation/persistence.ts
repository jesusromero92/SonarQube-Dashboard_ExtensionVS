import * as vscode from 'vscode';
import {
  LEGACY_LIVE_REMEDIATION_STORAGE_KEY,
  LIVE_REMEDIATION_STORAGE_KEY,
  PERSISTENCE_DEBOUNCE_MS
} from './constants';
import {
  LegacyPersistedRemediationSnapshot,
  PersistedRemediationIssue,
  PersistedRemediationSession,
  PersistedRemediationSnapshot,
  RemediationValidationEntry,
  SerializedRange,
  TrackedIssue
} from './models';

export class RemediationStateStore implements vscode.Disposable {
  readonly pendingByKey = new Map<string, PersistedRemediationIssue>();
  private persistedSession: PersistedRemediationSession | undefined;
  private persistTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.restore();
  }

  get session(): PersistedRemediationSession | undefined {
    return this.persistedSession ? cloneSession(this.persistedSession) : undefined;
  }

  syncFromTracked(
    trackedByKey: ReadonlyMap<string, TrackedIssue>,
    preserveMissing = false
  ): void {
    const previousPending = preserveMissing
      ? new Map(this.pendingByKey)
      : undefined;
    this.pendingByKey.clear();
    for (const [key, tracked] of trackedByKey) {
      if (tracked.state === 'server') continue;
      this.pendingByKey.set(key, {
        fileUri: tracked.issue.fileUri,
        relativePath: tracked.issue.relativePath,
        rule: tracked.issue.rule,
        ruleName: tracked.issue.ruleName,
        message: tracked.issue.message,
        severity: tracked.issue.severity,
        line: Math.max(1, tracked.baselineRange.start.line + 1),
        state: tracked.state,
        observedBySonarIde: tracked.observedBySonarIde,
        range: serializeRange(tracked.range),
        baselineRange: serializeRange(tracked.baselineRange),
        baseline: tracked.baseline
      });
    }
    if (previousPending) {
      for (const [key, issue] of previousPending) {
        if (!trackedByKey.has(key)) this.pendingByKey.set(key, issue);
      }
    }
    this.schedulePersist();
  }

  syncSession(session: PersistedRemediationSession | undefined): void {
    this.persistedSession = session ? cloneSession(session) : undefined;
    this.schedulePersist();
  }

  clear(): void {
    this.pendingByKey.clear();
    this.persistedSession = undefined;
    this.flush();
  }

  flush(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = undefined;
    }
    const issues = Object.fromEntries(this.pendingByKey);
    const value: PersistedRemediationSnapshot | undefined =
      this.pendingByKey.size > 0 || this.persistedSession
        ? {
          version: 4,
          issues,
          session: this.persistedSession ? cloneSession(this.persistedSession) : undefined
        }
        : undefined;
    void this.context.workspaceState.update(LIVE_REMEDIATION_STORAGE_KEY, value);
    void this.context.workspaceState.update(LEGACY_LIVE_REMEDIATION_STORAGE_KEY, undefined);
  }

  dispose(): void {
    this.flush();
  }

  private restore(): void {
    const snapshot = this.context.workspaceState.get<PersistedRemediationSnapshot>(
      LIVE_REMEDIATION_STORAGE_KEY
    );
    if (snapshot?.version === 4 && snapshot.issues) {
      this.restoreIssues(snapshot.issues);
      if (isPersistedRemediationSession(snapshot.session)) {
        this.persistedSession = cloneSession(snapshot.session);
      }
      return;
    }

    const legacy = this.context.workspaceState.get<LegacyPersistedRemediationSnapshot>(
      LEGACY_LIVE_REMEDIATION_STORAGE_KEY
    );
    if (legacy?.version !== 3 || !legacy.issues) return;
    this.restoreIssues(legacy.issues);
    this.schedulePersist();
  }

  private restoreIssues(issues: Record<string, PersistedRemediationIssue>): void {
    for (const [key, issue] of Object.entries(issues)) {
      if (isPersistedRemediationIssue(issue)) {
        this.pendingByKey.set(key, issue);
      }
    }
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = undefined;
      this.flush();
    }, PERSISTENCE_DEBOUNCE_MS);
  }
}

export function persistedRange(issue: PersistedRemediationIssue): vscode.Range {
  return rangeFromSerialized(issue.range);
}

export function persistedBaselineRange(issue: PersistedRemediationIssue): vscode.Range {
  return rangeFromSerialized(issue.baselineRange);
}

function rangeFromSerialized(range: SerializedRange): vscode.Range {
  return new vscode.Range(
    Math.max(0, range.startLine),
    Math.max(0, range.startCharacter),
    Math.max(0, range.endLine),
    Math.max(0, range.endCharacter)
  );
}

function serializeRange(range: vscode.Range): SerializedRange {
  return {
    startLine: range.start.line,
    startCharacter: range.start.character,
    endLine: range.end.line,
    endCharacter: range.end.character
  };
}

function cloneSession(session: PersistedRemediationSession): PersistedRemediationSession {
  return {
    ...session,
    modifiedIssueKeys: [...session.modifiedIssueKeys],
    remediationHistory: session.remediationHistory.map(entry => ({ ...entry })),
    lastConfirmedResults: session.lastConfirmedResults.map(entry => ({ ...entry })),
    stillDetectedHistory: session.stillDetectedHistory.map(entry => ({ ...entry }))
  };
}

function isPersistedRemediationSession(
  value: unknown
): value is PersistedRemediationSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<PersistedRemediationSession>;
  return typeof session.startedAt === 'string'
    && Number.isInteger(session.issuesAtStart)
    && (session.lastValidationAt === undefined || typeof session.lastValidationAt === 'string')
    && Number.isInteger(session.confirmed)
    && Number.isInteger(session.stillDetected)
    && Number.isInteger(session.historySequence)
    && Array.isArray(session.modifiedIssueKeys)
    && session.modifiedIssueKeys.every(key => typeof key === 'string')
    && isValidationEntries(session.remediationHistory)
    && isValidationEntries(session.lastConfirmedResults)
    && isValidationEntries(session.stillDetectedHistory);
}

function isValidationEntries(value: unknown): value is RemediationValidationEntry[] {
  return Array.isArray(value) && value.every(isValidationEntry);
}

function isValidationEntry(value: unknown): value is RemediationValidationEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<RemediationValidationEntry>;
  return typeof entry.id === 'string'
    && typeof entry.issueKey === 'string'
    && typeof entry.rule === 'string'
    && typeof entry.ruleName === 'string'
    && typeof entry.message === 'string'
    && typeof entry.relativePath === 'string'
    && typeof entry.fileUri === 'string'
    && Number.isInteger(entry.line)
    && typeof entry.severity === 'string'
    && typeof entry.validatedAt === 'string';
}

function isPersistedRemediationIssue(value: unknown): value is PersistedRemediationIssue {
  if (!value || typeof value !== 'object') return false;
  const issue = value as Partial<PersistedRemediationIssue>;
  const range = issue.range as Partial<PersistedRemediationIssue['range']> | undefined;
  const baselineRange = issue.baselineRange as Partial<PersistedRemediationIssue['baselineRange']> | undefined;
  return typeof issue.fileUri === 'string'
    && typeof issue.relativePath === 'string'
    && typeof issue.rule === 'string'
    && typeof issue.ruleName === 'string'
    && typeof issue.message === 'string'
    && typeof issue.severity === 'string'
    && Number.isInteger(issue.line)
    && (issue.state === 'modified' || issue.state === 'awaitingConfirmation')
    && typeof issue.observedBySonarIde === 'boolean'
    && isSerializedRange(range)
    && isSerializedRange(baselineRange);
}

function isSerializedRange(
  range: Partial<SerializedRange> | undefined
): range is SerializedRange {
  return range !== undefined
    && Number.isInteger(range.startLine)
    && Number.isInteger(range.startCharacter)
    && Number.isInteger(range.endLine)
    && Number.isInteger(range.endCharacter);
}
