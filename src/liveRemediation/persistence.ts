import * as vscode from 'vscode';
import {
  LIVE_REMEDIATION_STORAGE_KEY,
  PERSISTENCE_DEBOUNCE_MS
} from './constants';
import {
  PersistedRemediationIssue,
  PersistedRemediationSnapshot,
  SerializedRange,
  TrackedIssue
} from './models';

export class RemediationStateStore implements vscode.Disposable {
  readonly pendingByKey = new Map<string, PersistedRemediationIssue>();
  private persistTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.restore();
  }

  syncFromTracked(trackedByKey: ReadonlyMap<string, TrackedIssue>): void {
    this.pendingByKey.clear();
    for (const [key, tracked] of trackedByKey) {
      if (tracked.state === 'server') continue;
      this.pendingByKey.set(key, {
        fileUri: tracked.issue.fileUri,
        state: tracked.state,
        observedBySonarIde: tracked.observedBySonarIde,
        range: serializeRange(tracked.range)
      });
    }
    this.schedulePersist();
  }

  clear(): void {
    this.pendingByKey.clear();
    this.flush();
  }

  flush(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = undefined;
    }
    const issues = Object.fromEntries(this.pendingByKey);
    const value: PersistedRemediationSnapshot | undefined = this.pendingByKey.size > 0
      ? { version: 2, issues }
      : undefined;
    void this.context.workspaceState.update(LIVE_REMEDIATION_STORAGE_KEY, value);
  }

  dispose(): void {
    this.flush();
  }

  private restore(): void {
    const snapshot = this.context.workspaceState.get<PersistedRemediationSnapshot>(
      LIVE_REMEDIATION_STORAGE_KEY
    );
    if (!snapshot) return;
    if (snapshot.version !== 2 || !snapshot.issues) return;

    for (const [key, issue] of Object.entries(snapshot.issues)) {
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
  return new vscode.Range(
    Math.max(0, issue.range.startLine),
    Math.max(0, issue.range.startCharacter),
    Math.max(0, issue.range.endLine),
    Math.max(0, issue.range.endCharacter)
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

function isPersistedRemediationIssue(value: unknown): value is PersistedRemediationIssue {
  if (!value || typeof value !== 'object') return false;
  const issue = value as Partial<PersistedRemediationIssue>;
  const range = issue.range as Partial<PersistedRemediationIssue['range']> | undefined;
  return typeof issue.fileUri === 'string'
    && (issue.state === 'modified' || issue.state === 'awaitingConfirmation')
    && typeof issue.observedBySonarIde === 'boolean'
    && range !== undefined
    && Number.isInteger(range.startLine)
    && Number.isInteger(range.startCharacter)
    && Number.isInteger(range.endLine)
    && Number.isInteger(range.endCharacter);
}
