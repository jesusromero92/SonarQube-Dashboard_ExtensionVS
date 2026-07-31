import { FolderSonarConfig, ScannerMode } from '../types';

export type { ScannerMode } from '../types';

export type ScannerKind = Exclude<ScannerMode, 'auto'>;

export type AnalysisStepKind = 'build' | 'test' | 'custom' | 'sonar';
export type AnalysisFailurePolicy = 'stop' | 'continue';
export type AnalysisStepStatus = 'pending' | 'running' | 'success' | 'warning' | 'failed' | 'skipped';

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

export interface DetectedScanner {
  kind: ScannerKind;
  label: string;
  rootPath: string;
  evidence: string;
  buildTarget?: string;
  gradleSonarConfigured?: boolean;
}

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
}

export interface AnalysisExecutionOptions {
  steps: AnalysisExecutionStep[];
}

export interface AnalysisRequest {
  rootPath: string;
  config: FolderSonarConfig;
  actions: AnalysisExecutionOptions;
}

export interface ProcessSpec {
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  shellCommand?: string;
  displayCommand?: string;
  timeoutMs?: number;
}

export interface ProcessResult {
  exitCode: number;
  output: string[];
}

export interface SonarCeTaskResponse {
  task?: {
    id?: string;
    status?: string;
    errorMessage?: string;
    analysisId?: string;
  };
}
