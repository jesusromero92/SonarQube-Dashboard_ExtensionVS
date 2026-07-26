import { FolderSonarConfig, ScannerMode } from '../types';

export type { ScannerMode } from '../types';

export type ScannerKind = Exclude<ScannerMode, 'auto'>;

export type AnalysisPhase =
  | 'idle'
  | 'detecting'
  | 'installing'
  | 'building'
  | 'scanning'
  | 'processing'
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
}

export interface AnalysisRequest {
  rootPath: string;
  config: FolderSonarConfig;
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
