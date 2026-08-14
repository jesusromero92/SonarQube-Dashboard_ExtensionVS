import { FolderSonarConfig, QualityGateStatus } from '../types';

export type AnalysisStepKind = 'build' | 'test' | 'custom' | 'sonar';
export type AnalysisFailurePolicy = 'stop' | 'continue';
export type AnalysisStepStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'warning'
  | 'failed'
  | 'skipped';

export interface AnalysisExecutionStep {
  id: string;
  name: string;
  kind: AnalysisStepKind;
  command?: string;
  failurePolicy: AnalysisFailurePolicy;
  enabled: boolean;
}

export interface AnalysisStepProgress extends AnalysisExecutionStep {
  status: AnalysisStepStatus;
  message?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface AnalysisBaselineSnapshot {
  capturedAt: string;
  hasAnalysis: boolean;
  issues: number;
  newIssues: number;
  securityHotspots: number;
  newSecurityHotspots: number;
  coverage: number | null;
  newCoverage: number | null;
  duplication: number | null;
  newDuplication: number | null;
  qualityGate: QualityGateStatus;
}

export interface AnalysisBaselineComparison {
  projectKey: string;
  branch: string;
  serverUrl: string;
  before: AnalysisBaselineSnapshot;
  after: AnalysisBaselineSnapshot;
  capturedAt: string;
}

export type PipelineRunHistoryStatus =
  | 'running'
  | 'success'
  | 'warning'
  | 'failed'
  | 'cancelled';

export interface PipelineRunHistoryStep {
  id: string;
  name: string;
  kind: AnalysisStepKind;
  command?: string;
  failurePolicy: AnalysisFailurePolicy;
  status: AnalysisStepStatus;
  message?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface PipelineRunHistoryEntry {
  id: string;
  rootPath: string;
  projectKey: string;
  projectName: string;
  branch: string;
  scanner: string;
  status: PipelineRunHistoryStatus;
  message: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  steps: PipelineRunHistoryStep[];
  log: string[];
  comparison?: AnalysisBaselineComparison;
}

export type AnalysisPhase =
  | 'idle'
  | 'detecting'
  | 'preActions'
  | 'installing'
  | 'building'
  | 'scanning'
  | 'processing'
  | 'postActions'
  | 'refreshing'
  | 'success'
  | 'error'
  | 'cancelled';

export interface AnalysisState {
  running: boolean;
  phase: AnalysisPhase;
  message: string;
  scanner: string;
  startedAt?: string;
  completedAt?: string;
  canCancel: boolean;
  log: string[];
  steps: AnalysisStepProgress[];
  baseline?: AnalysisBaselineSnapshot;
  comparison?: AnalysisBaselineComparison;
}

export interface AnalysisExecutionOptions {
  steps: AnalysisExecutionStep[];
}

export interface AnalysisRequest {
  rootPath: string;
  config: FolderSonarConfig;
  actions: AnalysisExecutionOptions;
  baseline?: AnalysisBaselineSnapshot;
}
