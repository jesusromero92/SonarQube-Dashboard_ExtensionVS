import { ScannerMode } from '../types';

export type { ScannerMode } from '../types';

export type ScannerKind = Exclude<ScannerMode, 'auto'>;

export interface DetectedScanner {
  kind: ScannerKind;
  label: string;
  rootPath: string;
  evidence: string;
  buildTarget?: string;
  gradleSonarConfigured?: boolean;
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
