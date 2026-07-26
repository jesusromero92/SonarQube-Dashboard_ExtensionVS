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

export interface SonarQualityGateResponse {
  projectStatus?: {
    status?: string;
    conditions?: SonarQualityGateCondition[];
  };
}

export interface SonarQualityGateCondition {
  status?: string;
  metricKey?: string;
  comparator?: string;
  errorThreshold?: string;
  actualValue?: string;
  periodIndex?: number;
}

export interface SonarCurrentMeasure {
  metric: string;
  value?: string;
  period?: {
    value?: string;
  };
}

export interface SonarMeasuresComponentResponse {
  component?: {
    measures?: SonarCurrentMeasure[];
  };
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

export interface SonarHotspot {
  key: string;
  rule?: string;
  ruleKey?: string;
  component: string;
  project?: string;
  line?: number;
  textRange?: SonarTextRange;
  message?: string;
  status?: string;
  resolution?: string;
  vulnerabilityProbability?: string;
  securityReviewPriority?: string;
  securitySeverity?: string;
  priority?: string;
}

export interface SonarHotspotsResponse {
  paging?: {
    pageIndex: number;
    pageSize: number;
    total: number;
  };
  hotspots?: SonarHotspot[];
  issues?: SonarHotspot[];
  items?: SonarHotspot[];
}

export interface SonarHotspotDetailResponse {
  key?: string;
  message?: string;
  component?: string;
  project?: string;
  line?: number;
  textRange?: SonarTextRange;
  status?: string;
  resolution?: string;
  vulnerabilityProbability?: string;
  rule?: {
    key?: string;
    name?: string;
    riskDescription?: string;
    vulnerabilityDescription?: string;
    fixRecommendations?: string;
  };
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
export type ScannerMode = 'auto' | 'maven' | 'gradle' | 'dotnet' | 'npm' | 'docker' | 'custom';

export interface FolderSonarConfig {
  serverUrl: string;
  projectKey: string;
  branch?: string;
  baseDir?: string;
  token: string;
  scannerMode: ScannerMode;
  buildCommand?: string;
  customScannerCommand?: string;
}

export interface FolderSonarFormConfig {
  serverUrl: string;
  projectKey: string;
  branch: string;
  baseDir: string;
  hasToken: boolean;
  scannerMode: ScannerMode;
  buildCommand: string;
  customScannerCommand: string;
}

export interface LoadedIssues {
  issues: SonarIssue[];
  newIssues: SonarIssue[];
  hotspots: SonarHotspot[];
  newHotspots: SonarHotspot[];
  componentPaths: Map<string, string>;
  instanceMode: SonarInstanceMode;
  evolution: EvolutionPoint[];
  qualityGate: QualityGateSummary;
  ratings: RatingsSummary;
  types: DefectTypeSummary;
  newTypes: DefectTypeSummary;
}

export type DashboardSeverity = string;
export type QualityGateStatus = 'OK' | 'WARN' | 'ERROR' | 'NONE';
export type RatingGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'NONE';

export interface QualityGateSummary {
  status: QualityGateStatus;
  conditions: QualityGateCondition[];
}

export interface QualityGateCondition {
  status: QualityGateStatus;
  metricKey: string;
  comparator: string;
  errorThreshold: string;
  actualValue: string;
  scope: 'overall' | 'newCode';
  projectKey: string;
}

export interface CodeQualityRatings {
  maintainability: RatingGrade;
  reliability: RatingGrade;
  security: RatingGrade;
  securityReview: RatingGrade;
}

export interface RatingsSummary {
  overall: CodeQualityRatings;
  newCode: CodeQualityRatings;
}

export interface DefectTypeSummary {
  bugs: number;
  codeSmells: number;
  vulnerabilities: number;
  securityHotspots: number;
}

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

export interface DashboardHotspot {
  key: string;
  ruleKey: string;
  message: string;
  status: string;
  resolution: string;
  priority: string;
  relativePath: string;
  fileUri: string;
  folderUri: string;
  line: number;
}

export interface DashboardHotspotDetail {
  key: string;
  ruleKey: string;
  ruleName: string;
  message: string;
  status: string;
  resolution: string;
  priority: string;
  riskDescription: string;
  vulnerabilityDescription: string;
  fixRecommendations: string;
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
  newBugs: number;
  newCodeSmells: number;
  newVulnerabilities: number;
  newSecurityHotspots: number;
  newBlockerViolations: number;
  newCriticalViolations: number;
  newMajorViolations: number;
  newMinorViolations: number;
  newInfoViolations: number;
}

export interface PublishResult {
  published: number;
  skipped: number;
  issues: DashboardIssue[];
}

export interface RefreshSummary {
  configuredFolders: number;
  published: number;
  newPublished: number;
  skipped: number;
  errors: string[];
  issues: DashboardIssue[];
  newIssues: DashboardIssue[];
  hotspots: DashboardHotspot[];
  newHotspots: DashboardHotspot[];
  severity: SeverityCount[];
  newSeverity: SeverityCount[];
  evolution: EvolutionPoint[];
  qualityGate: QualityGateSummary;
  ratings: RatingsSummary;
  types: DefectTypeSummary;
  newTypes: DefectTypeSummary;
}
