import * as vscode from 'vscode';
import { DashboardIssue } from '../types';
import type { IssueLocalRemediationState } from '../issueLocalState';

export type { IssueLocalRemediationState } from '../issueLocalState';

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
}

export interface TrackedIssue {
  issue: DashboardIssue;
  range: vscode.Range;
  serverSeverity: vscode.DiagnosticSeverity;
  serverMessage: string;
  state: IssueLocalRemediationState;
  /** Current-session evidence that SonarQube for IDE reported this exact finding. */
  observedBySonarIde: boolean;
}

export interface PersistedRemediationIssue {
  fileUri: string;
  state: Exclude<IssueLocalRemediationState, 'server'>;
  observedBySonarIde: boolean;
  range: SerializedRange;
}

export interface SerializedRange {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

export interface PersistedRemediationSnapshot {
  version: 2;
  issues: Record<string, PersistedRemediationIssue>;
}
