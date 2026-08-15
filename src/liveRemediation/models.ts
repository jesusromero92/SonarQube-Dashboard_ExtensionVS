import * as vscode from 'vscode';
import { DashboardIssue } from '../types';
import type { IssueLocalRemediationState } from '../issueLocalState';

export type { IssueLocalRemediationState } from '../issueLocalState';

export interface SerializedRange {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

export interface IssueBaseline {
  range: SerializedRange;
  blockStartLine: number;
  blockEndLine: number;
  blockLines: string[];
  contextStartLine: number;
  contextEndLine: number;
  contextLines: string[];
  beforeAnchor?: string;
  afterAnchor?: string;
  languageId?: string;
}

export interface LocallyModifiedIssueSummary {
  key: string;
  rule: string;
  ruleName: string;
  message: string;
  relativePath: string;
  fileUri: string;
  line: number;
  severity: string;
  state: Exclude<IssueLocalRemediationState, 'server'>;
  diffAvailable: boolean;
  revertAvailable: boolean;
}

export interface TrackedIssue {
  issue: DashboardIssue;
  range: vscode.Range;
  baselineRange: vscode.Range;
  baseline?: IssueBaseline;
  serverSeverity: vscode.DiagnosticSeverity;
  serverMessage: string;
  state: IssueLocalRemediationState;
  /** Current-session evidence that SonarQube for IDE reported this exact finding. */
  observedBySonarIde: boolean;
}

export interface PersistedRemediationIssue {
  fileUri: string;
  relativePath: string;
  rule: string;
  ruleName: string;
  message: string;
  severity: string;
  line: number;
  state: Exclude<IssueLocalRemediationState, 'server'>;
  observedBySonarIde: boolean;
  range: SerializedRange;
  baselineRange: SerializedRange;
  baseline?: IssueBaseline;
}

export interface PersistedRemediationSession {
  startedAt: string;
  issuesAtStart: number;
  lastValidationAt?: string;
  confirmed: number;
  stillDetected: number;
  modifiedIssueKeys: string[];
  historySequence: number;
  remediationHistory: RemediationValidationEntry[];
  lastConfirmedResults: RemediationValidationEntry[];
  stillDetectedHistory: RemediationValidationEntry[];
}

export interface PersistedRemediationSnapshot {
  version: 4;
  issues: Record<string, PersistedRemediationIssue>;
  session?: PersistedRemediationSession;
}

export interface LegacyPersistedRemediationSnapshot {
  version: 3;
  issues: Record<string, PersistedRemediationIssue>;
}

export interface RemediationValidationEntry {
  id: string;
  issueKey: string;
  rule: string;
  ruleName: string;
  message: string;
  relativePath: string;
  fileUri: string;
  line: number;
  severity: string;
  validatedAt: string;
}

export interface RemediationSessionSummary {
  startedAt: string;
  issuesAtStart: number;
  /** Current number of issues with a local state different from the server snapshot. */
  modified: number;
  /** Unique issues that have been modified at least once during this remediation session. */
  modifiedDuringSession: number;
  pendingValidation: number;
  pendingServer: number;
  lastValidationAt?: string;
  /** Issues confirmed as solved by the most recent server validation. */
  confirmed: number;
  /** Issues still reported by the most recent server validation. */
  stillDetected: number;
}
