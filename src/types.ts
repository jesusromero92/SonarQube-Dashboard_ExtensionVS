export interface SonarTextRange {
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
}

export interface SonarImpact {
  softwareQuality: string;
  severity: string;
}

export interface SonarIssue {
  key: string;
  rule: string;
  ruleName?: string;
  severity?: string;
  component: string;
  project?: string;
  line?: number;
  textRange?: SonarTextRange;
  message: string;
  status: string;
  type?: string;
  impacts?: SonarImpact[];
}

export interface SonarRuleResponse {
  rule?: {
    key: string;
    name?: string;
  };
}

export interface SonarMeasureHistoryEntry {
  date: string;
  value?: string;
}

export interface SonarHistoryMeasure {
  metric: string;
  history?: SonarMeasureHistoryEntry[];
}

export interface SonarMeasuresHistoryResponse {
  measures?: SonarHistoryMeasure[];
}

export interface SonarComponent {
  key: string;
  name?: string;
  path?: string;
  qualifier?: string;
  visibility?: string;
}

export interface SonarIssuesResponse {
  total: number;
  p?: number;
  ps?: number;
  paging?: {
    pageIndex: number;
    pageSize: number;
    total: number;
  };
  issues: SonarIssue[];
  components?: SonarComponent[];
}

export interface SonarProject {
  key: string;
  name: string;
  qualifier?: string;
  visibility?: string;
}

export interface SonarProjectsResponse {
  paging?: {
    pageIndex: number;
    pageSize: number;
    total: number;
  };
  components?: SonarProject[];
  projects?: SonarProject[];
}

export interface SonarSetting {
  key: string;
  value?: string;
  values?: string[];
  inherited?: boolean;
  parentValue?: string;
}

export interface SonarSettingsResponse {
  settings?: SonarSetting[];
}

export type SonarInstanceMode = 'MQR' | 'STANDARD' | 'UNKNOWN';

export interface FolderSonarConfig {
  serverUrl: string;
  projectKey: string;
  branch?: string;
  baseDir?: string;
  token: string;
}

export interface FolderSonarFormConfig {
  serverUrl: string;
  projectKey: string;
  branch: string;
  baseDir: string;
  hasToken: boolean;
}

export interface LoadedIssues {
  issues: SonarIssue[];
  componentPaths: Map<string, string>;
  instanceMode: SonarInstanceMode;
  evolution: EvolutionPoint[];
}

export type DashboardSeverity = string;

export interface DashboardIssue {
  key: string;
  rule: string;
  ruleName: string;
  severity: DashboardSeverity;
  severityRank: number;
  type: string;
  message: string;
  relativePath: string;
  fileUri: string;
  line: number;
}

export interface SeverityCount {
  name: DashboardSeverity;
  count: number;
  rank: number;
}

export interface EvolutionPoint {
  date: string;
  label: string;
  bugs: number;
  codeSmells: number;
  vulnerabilities: number;
  securityHotspots: number;
  blockerViolations: number;
  criticalViolations: number;
  majorViolations: number;
  minorViolations: number;
  infoViolations: number;
}

export interface PublishResult {
  published: number;
  skipped: number;
  issues: DashboardIssue[];
}

export interface RefreshSummary {
  configuredFolders: number;
  published: number;
  skipped: number;
  errors: string[];
  issues: DashboardIssue[];
  severity: SeverityCount[];
  evolution: EvolutionPoint[];
}
