export type PipelineFindingSeverity =
  | 'info'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical'
  | 'unknown';

export type PipelineStructuredResultStatus =
  | 'parsed'
  | 'partial'
  | 'unsupported'
  | 'error';

export interface PipelineFindingLocation {
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface PipelineFinding {
  fingerprint: string;
  ruleId?: string;
  title: string;
  message?: string;
  severity: PipelineFindingSeverity;
  category?: string;
  location?: PipelineFindingLocation;
  helpUrl?: string;
}

export interface PipelineResultMetric {
  key: string;
  label: string;
  value: number;
  unit?: string;
}

export interface PipelineStructuredResultSummary {
  total: number;
  info: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
  unknown: number;
}

export interface PipelineStructuredResult {
  schemaVersion: 1;
  toolId: string;
  toolName: string;
  parserId: string;
  status: PipelineStructuredResultStatus;
  summary: PipelineStructuredResultSummary;
  findings: PipelineFinding[];
  metrics: PipelineResultMetric[];
  truncated?: boolean;
  message?: string;
}

export interface PipelineToolOutput {
  toolId: string;
  toolName: string;
  command: string;
  cwd: string;
  exitCode: number;
  output: string;
}

export type PipelineStructuredResultParser = (
  output: PipelineToolOutput
) => PipelineStructuredResult;

export interface PipelineStructuredResultDiff {
  baselineEntryId: string;
  newCount: number;
  resolvedCount: number;
  persistentCount: number;
  newFindings: PipelineFinding[];
  resolvedFindings: PipelineFinding[];
  reliable: boolean;
}
