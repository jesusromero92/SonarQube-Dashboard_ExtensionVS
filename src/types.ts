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

export interface SonarIssueLocation {
  component: string;
  msg?: string;
  textRange?: SonarTextRange;
}

export interface SonarIssueFlow {
  locations?: SonarIssueLocation[];
}

export interface SonarIssueComment {
  key?: string;
  login?: string;
  markdown?: string;
  htmlText?: string;
  createdAt?: string;
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
  issueStatus?: string;
  resolution?: string;
  assignee?: string;
  author?: string;
  creationDate?: string;
  updateDate?: string;
  type?: string;
  impacts?: SonarImpact[];
  flows?: SonarIssueFlow[];
  comments?: SonarIssueComment[];
  actions?: string[];
  transitions?: string[];
}

export interface SonarRuleParameter {
  key: string;
  htmlDesc?: string;
  defaultValue?: string;
  type?: string;
}

export interface SonarRuleActive {
  qProfile?: string;
  inherit?: string;
  severity?: string;
}

export interface SonarRuleDefinition {
  key: string;
  repo?: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  htmlDesc?: string;
  mdDesc?: string;
  htmlNote?: string;
  mdNote?: string;
  severity?: string;
  status?: string;
  isTemplate?: boolean;
  templateKey?: string;
  tags?: string[];
  sysTags?: string[];
  lang?: string;
  langName?: string;
  params?: SonarRuleParameter[];
  defaultDebtRemFnType?: string;
  defaultDebtRemFnGapMultiplier?: string;
  defaultDebtRemFnBaseEffort?: string;
  debtRemFnType?: string;
  debtRemFnGapMultiplier?: string;
  debtRemFnBaseEffort?: string;
  defaultRemFnType?: string;
  defaultRemFnGapMultiplier?: string;
  defaultRemFnBaseEffort?: string;
  remFnType?: string;
  remFnGapMultiplier?: string;
  remFnBaseEffort?: string;
  gapDescription?: string;
  scope?: string;
  type?: string;
  external?: boolean;
  isExternal?: boolean;
  cleanCodeAttribute?: string;
  cleanCodeAttributeCategory?: string;
  impacts?: SonarImpact[];
}

export interface SonarRuleResponse {
  rule?: SonarRuleDefinition;
  actives?: SonarRuleActive[];
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
    key?: string;
    name?: string;
    path?: string;
    qualifier?: string;
    measures?: SonarCurrentMeasure[];
  };
}

export interface SonarMeasureComponent {
  key: string;
  name?: string;
  path?: string;
  qualifier?: string;
  measures?: SonarCurrentMeasure[];
}

export interface SonarMeasuresComponentTreeResponse {
  paging?: {
    pageIndex: number;
    pageSize: number;
    total: number;
  };
  baseComponent?: SonarMeasureComponent;
  components?: SonarMeasureComponent[];
}

export interface SonarSourceLine {
  line: number;
  code?: string;
  lineHits?: number;
  conditions?: number;
  coveredConditions?: number;
  duplicated?: boolean;
  scmAuthor?: string;
  scmDate?: string;
  scmRevision?: string;
}

export interface SonarSourceLinesResponse {
  sources?: SonarSourceLine[];
}

export interface SonarDuplicationBlock {
  from: number;
  size: number;
  _ref?: string;
}

export interface SonarDuplicationGroup {
  blocks?: SonarDuplicationBlock[];
}

export interface SonarDuplicationFile {
  key?: string;
  name?: string;
  projectName?: string;
  projectKey?: string;
  branch?: string;
}

export interface SonarDuplicationsResponse {
  duplications?: SonarDuplicationGroup[];
  files?: Record<string, SonarDuplicationFile>;
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

export interface SonarIssueTransition {
  key: string;
  name?: string;
}

export interface SonarIssueTransitionsResponse {
  transitions?: SonarIssueTransition[];
}

export interface SonarIssueChangelogDiff {
  key?: string;
  oldValue?: string;
  newValue?: string;
}

export interface SonarIssueChangelogEntry {
  user?: string;
  userName?: string;
  creationDate?: string;
  avatar?: string;
  isUserActive?: boolean;
  diffs?: SonarIssueChangelogDiff[];
}

export interface SonarIssueChangelogResponse {
  changelog?: SonarIssueChangelogEntry[];
}

export interface SonarUser {
  login: string;
  name?: string;
  active?: boolean;
  avatar?: string;
}

export interface SonarUsersResponse {
  paging?: {
    pageIndex: number;
    pageSize: number;
    total: number;
  };
  users?: SonarUser[];
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

export type SonarCreatableComponentKind = 'project' | 'application';

export interface SonarCreationCapabilities {
  canCreateProjects: boolean;
  canCreateApplications: boolean;
}

export interface CreateSonarComponentRequest {
  kind: SonarCreatableComponentKind;
  key: string;
  name: string;
  description?: string;
  visibility?: 'private' | 'public';
}

export interface SonarCurrentUserResponse {
  login?: string;
  name?: string;
  active?: boolean;
  permissions?: {
    global?: string[];
  };
}

export interface SonarNavigationGlobalResponse {
  qualifiers?: string[];
}

export interface SonarCreatedComponentResponse {
  project?: SonarProject;
  application?: SonarProject;
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
export type AnalysisPermissionStatus = 'allowed' | 'denied' | 'unknown';

export interface FolderSonarConfig {
  serverUrl: string;
  projectKey: string;
  projectName: string;
  branch?: string;
  baseDir?: string;
  token: string;
  scannerMode: ScannerMode;
  analysisInclusions?: string;
  analysisExclusions?: string;
  buildCommand?: string;
  testCommand?: string;
  customScannerCommand?: string;
  preAnalysisCommands?: string;
  postAnalysisCommands?: string;
}

export interface FolderSonarFormConfig {
  serverUrl: string;
  projectKey: string;
  projectName: string;
  branch: string;
  baseDir: string;
  hasToken: boolean;
  scannerMode: ScannerMode;
  analysisInclusions: string;
  analysisExclusions: string;
  buildCommand: string;
  testCommand: string;
  customScannerCommand: string;
  preAnalysisCommands: string;
  postAnalysisCommands: string;
}

export interface RemoteCoverageFile {
  component: string;
  path: string;
  name: string;
  coverage: number | null;
  newCoverage: number | null;
  lineCoverage: number | null;
  newLineCoverage: number | null;
  branchCoverage: number | null;
  newBranchCoverage: number | null;
  linesToCover: number;
  newLinesToCover: number;
  uncoveredLines: number;
  newUncoveredLines: number;
  duplicatedLinesDensity: number | null;
  newDuplicatedLinesDensity: number | null;
  duplicatedBlocks: number;
  duplicatedLines: number;
}

export interface CoverageTotals {
  coverage: number | null;
  lineCoverage: number | null;
  branchCoverage: number | null;
  linesToCover: number;
  uncoveredLines: number;
  duplicatedLinesDensity: number | null;
  duplicatedBlocks: number;
  duplicatedLines: number;
}

export interface RemoteCoverageData {
  overall: CoverageTotals;
  newCode: CoverageTotals;
  files: RemoteCoverageFile[];
}

export interface LoadedIssues {
  issues: SonarIssue[];
  newIssues: SonarIssue[];
  hotspots: SonarHotspot[];
  newHotspots: SonarHotspot[];
  componentPaths: Map<string, string>;
  instanceMode: SonarInstanceMode;
  hasAnalysis: boolean;
  evolution: EvolutionPoint[];
  qualityGate: QualityGateSummary;
  ratings: RatingsSummary;
  types: DefectTypeSummary;
  newTypes: DefectTypeSummary;
  coverage: RemoteCoverageData;
}

export interface SonarAnalysisBaselineData {
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

export type IssueFlowRole = 'source' | 'intermediate' | 'sink' | 'related';

export interface DashboardIssueLocation {
  component: string;
  message: string;
  relativePath: string;
  fileUri: string;
  resolved: boolean;
  line: number;
  endLine: number;
  role: IssueFlowRole;
}

export interface DashboardIssueFlow {
  index: number;
  locations: DashboardIssueLocation[];
}

export interface DashboardIssue {
  key: string;
  rule: string;
  ruleName: string;
  status: string;
  resolution: string;
  assignee: string;
  author: string;
  creationDate: string;
  updateDate: string;
  project: string;
  component: string;
  folderUri: string;
  impacts: SonarImpact[];
  severity: string;
  severityRank: number;
  type: string;
  message: string;
  relativePath: string;
  fileUri: string;
  line: number;
  flows: DashboardIssueFlow[];
  secondaryLocations: DashboardIssueLocation[];
}

export interface IssueTransition {
  key: string;
  name: string;
}

export interface IssueHistoryItem {
  date: string;
  user: string;
  changes: Array<{
    field: string;
    oldValue: string;
    newValue: string;
  }>;
}

export interface IssueComment {
  key: string;
  user: string;
  text: string;
  createdAt: string;
}

export interface IssueLifecycleDetail {
  issue: DashboardIssue;
  transitions: IssueTransition[];
  comments: IssueComment[];
  history: IssueHistoryItem[];
  users: SonarUser[];
  canComment: boolean;
  canAssign: boolean;
}

export type IssueMutationKind = 'transition' | 'assign' | 'comment';

export interface IssueMutationRequest {
  kind: IssueMutationKind;
  issueKey: string;
  folderUri: string;
  transition?: string;
  assignee?: string;
  comment?: string;
}

export interface DashboardRuleParameter {
  key: string;
  description: string;
  defaultValue: string;
  type: string;
}

export interface DashboardRuleActiveProfile {
  profile: string;
  inheritance: string;
  severity: string;
}

export interface DashboardRuleRemediation {
  functionType: string;
  baseEffort: string;
  gapMultiplier: string;
  gapDescription: string;
}

export interface DashboardRuleDetail {
  key: string;
  repository: string;
  name: string;
  language: string;
  languageName: string;
  status: string;
  type: string;
  severity: string;
  scope: string;
  description: string;
  note: string;
  cleanCodeAttribute: string;
  cleanCodeAttributeCategory: string;
  impacts: SonarImpact[];
  remediation: DashboardRuleRemediation;
  parameters: DashboardRuleParameter[];
  tags: string[];
  activeProfiles: DashboardRuleActiveProfile[];
  isTemplate: boolean;
  templateKey: string;
  isExternal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardHotspot {
  key: string;
  ruleKey: string;
  project: string;
  component: string;
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
  name: string;
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
  coverage: number | null;
  newCoverage: number | null;
  duplicatedLinesDensity: number | null;
  newDuplicatedLinesDensity: number | null;
}

export interface CoverageFileSummary extends RemoteCoverageFile {
  relativePath: string;
  fileUri: string;
  folderUri: string;
  projectKey: string;
}

export interface CoverageSummary {
  overall: CoverageTotals;
  newCode: CoverageTotals;
  files: CoverageFileSummary[];
}

export type CoverageLineStatus = 'covered' | 'partial' | 'uncovered' | 'none';

export interface CoverageLineDetail {
  line: number;
  hits: number | null;
  conditions: number;
  coveredConditions: number;
  duplicated: boolean;
  status: CoverageLineStatus;
}

export interface DuplicationLocation {
  component: string;
  relativePath: string;
  fileUri: string;
  from: number;
  size: number;
  isCurrentFile: boolean;
}

export interface DuplicationGroup {
  locations: DuplicationLocation[];
}

export interface FileCoverageDetail {
  file: CoverageFileSummary;
  lines: CoverageLineDetail[];
  duplications: DuplicationGroup[];
}

export interface PublishResult {
  published: number;
  skipped: number;
  issues: DashboardIssue[];
}

export type RefreshSyncStatus = 'idle' | 'success' | 'error';

export interface RefreshSummary {
  syncStatus: RefreshSyncStatus;
  hasSuccessfulSync: boolean;
  lastSuccessfulAt: string | null;
  configuredFolders: number;
  published: number;
  newPublished: number;
  skipped: number;
  errors: string[];
  issues: DashboardIssue[];
  newIssues: DashboardIssue[];
  hotspots: DashboardHotspot[];
  newHotspots: DashboardHotspot[];
  hasAnalysis: boolean;
  severity: SeverityCount[];
  newSeverity: SeverityCount[];
  evolution: EvolutionPoint[];
  latestAnalysis: EvolutionPoint | null;
  previousAnalysis: EvolutionPoint | null;
  analysisComparisonAvailable: boolean;
  qualityGate: QualityGateSummary;
  ratings: RatingsSummary;
  types: DefectTypeSummary;
  newTypes: DefectTypeSummary;
  coverage: CoverageSummary;
}
