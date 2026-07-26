import { QualityGateStatus, RatingGrade } from './types';

export const DASHBOARD_PANEL_VIEW_TYPE = 'sonarQubeDashboard.panel';
export const DASHBOARD_LAUNCHER_VIEW_ID = 'sonarQubeDashboard.launcher';

export const SONAR_CONFIGURATION_SECTION = 'sonarQubeDashboard.sonar';
export const DASHBOARD_CONFIGURATION_SECTION = 'sonarQubeDashboard';
export const SONAR_TOKEN_KEY_PREFIX = 'sonarQubeDashboard.sonar.token:';

export const SONAR_CONFIGURATION_KEYS = {
  serverUrl: 'serverUrl',
  projectKey: 'projectKey',
  branch: 'branch',
  baseDir: 'baseDir',
  scannerMode: 'scannerMode',
  buildCommand: 'buildCommand',
  customScannerCommand: 'customScannerCommand'
} as const;

export const DASHBOARD_CONFIGURATION_KEYS = {
  language: 'language',
  autoRefresh: 'autoRefresh',
  refreshIntervalMinutes: 'refreshIntervalMinutes',
  notificationsEnabled: 'notifications.enabled',
  significantIncreasePercent: 'notifications.significantIncreasePercent',
  significantIncreaseMinimum: 'notifications.significantIncreaseMinimum'
} as const;

export const DASHBOARD_COMMANDS = {
  open: 'sonarQubeDashboard.open',
  refresh: 'sonarQubeDashboard.refresh',
  clear: 'sonarQubeDashboard.clear',
  analyze: 'sonarQubeDashboard.analyze',
  cancelAnalysis: 'sonarQubeDashboard.cancelAnalysis',
  showIssueDetail: 'sonarQubeDashboard.showIssueDetail',
  showHotspotDetail: 'sonarQubeDashboard.showHotspotDetail',
  nextIssue: 'sonarQubeDashboard.nextIssue',
  previousIssue: 'sonarQubeDashboard.previousIssue',
  nextIssueSameType: 'sonarQubeDashboard.nextIssueSameType',
  nextCriticalIssue: 'sonarQubeDashboard.nextCriticalIssue',
  toggleCurrentFileIssues: 'sonarQubeDashboard.toggleCurrentFileIssues',
  groupIssues: 'sonarQubeDashboard.groupIssues',
  openIssue: 'sonarQubeDashboard.openIssue',
  previousFlowLocation: 'sonarQubeDashboard.previousFlowLocation',
  nextFlowLocation: 'sonarQubeDashboard.nextFlowLocation',
  openFlowLocation: 'sonarQubeDashboard.openFlowLocation',
  showCoverage: 'sonarQubeDashboard.showCoverage',
  showDuplications: 'sonarQubeDashboard.showDuplications'
} as const;


export const SCANNER_MODES = [
  { value: 'auto', label: 'Automático (recomendado)' },
  { value: 'maven', label: 'Maven · Java / Kotlin' },
  { value: 'gradle', label: 'Gradle · Java / Kotlin / Android' },
  { value: 'dotnet', label: '.NET · C# / VB.NET / F#' },
  { value: 'npm', label: 'Genérico NPM · JavaScript / TypeScript / React / Python y otros' },
  { value: 'docker', label: 'Docker · SonarScanner CLI' },
  { value: 'custom', label: 'Comando personalizado' }
] as const;

export const DASHBOARD_COLORS = {
  types: {
    BUG: '#00aa00',
    CODE_SMELL: '#eabf00',
    VULNERABILITY: '#a40014',
    SECURITY_HOTSPOT: '#d4333f'
  },
  severities: {
    BLOCKER: '#a40014',
    CRITICAL: '#d4333f',
    HIGH: '#d4333f',
    MAJOR: '#ed7d20',
    MEDIUM: '#ed7d20',
    MINOR: '#eabf00',
    LOW: '#eabf00',
    INFO: '#2563eb'
  },
  qualityGate: {
    OK: '#22a447',
    WARN: '#eabf00',
    ERROR: '#d4333f'
  },
  coverage: {
    covered: '#22a447',
    partial: '#eabf00',
    uncovered: '#d4333f',
    duplicated: '#8b5cf6'
  },
  flows: {
    source: '#2563eb',
    intermediate: '#eabf00',
    sink: '#d4333f',
    related: '#8b5cf6'
  },
  ratings: {
    A: { foreground: '#00aa00', background: '#e6f7e8' },
    B: { foreground: '#7fa000', background: '#f1f8d7' },
    C: { foreground: '#b88a00', background: '#fff4cc' },
    D: { foreground: '#ed7d20', background: '#fff0df' },
    E: { foreground: '#d4333f', background: '#ffe2e5' }
  }
} as const;

export const DASHBOARD_TYPE_ICON_FILES = {
  BUG: 'bug-svgrepo-com.svg',
  CODE_SMELL: 'radiation-svgrepo-com.svg',
  VULNERABILITY: 'shield-exclamation-svgrepo-com.svg',
  SECURITY_HOTSPOT: 'hotspot-svgrepo-com.svg'
} as const;

export const SEVERITY_RANKS: Readonly<Record<string, number>> = {
  BLOCKER: 100,
  CRITICAL: 90,
  HIGH: 90,
  MAJOR: 70,
  MEDIUM: 70,
  MINOR: 50,
  LOW: 50,
  INFO: 30,
  UNKNOWN: 0
};

export const RATING_GRADE_RANKS: Readonly<Record<RatingGrade, number>> = {
  NONE: 0,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5
};

export const QUALITY_GATE_STATUS_RANKS: Readonly<Record<QualityGateStatus, number>> = {
  NONE: 0,
  OK: 1,
  WARN: 2,
  ERROR: 3
};

export const SONAR_PAGE_SIZE = 500;
export const SONAR_MODE_SETTING_KEY = 'sonar.multi-quality-mode.enabled';
export const SONAR_EVOLUTION_LIMIT = 15;

export const SONAR_EVOLUTION_METRICS = [
  'bugs',
  'code_smells',
  'vulnerabilities',
  'security_hotspots',
  'blocker_violations',
  'critical_violations',
  'major_violations',
  'minor_violations',
  'info_violations',
  'new_bugs',
  'new_code_smells',
  'new_vulnerabilities',
  'new_security_hotspots',
  'new_blocker_violations',
  'new_critical_violations',
  'new_major_violations',
  'new_minor_violations',
  'new_info_violations',
  'coverage',
  'new_coverage',
  'duplicated_lines_density',
  'new_duplicated_lines_density'
] as const;

export const SONAR_SUMMARY_METRICS = [
  'sqale_rating',
  'reliability_rating',
  'security_rating',
  'security_review_rating',
  'new_maintainability_rating',
  'new_reliability_rating',
  'new_security_rating',
  'new_security_review_rating',
  'bugs',
  'code_smells',
  'vulnerabilities',
  'security_hotspots',
  'new_bugs',
  'new_code_smells',
  'new_vulnerabilities',
  'new_security_hotspots'
] as const;



export const SONAR_COVERAGE_METRICS = [
  'coverage',
  'new_coverage',
  'line_coverage',
  'new_line_coverage',
  'branch_coverage',
  'new_branch_coverage',
  'lines_to_cover',
  'new_lines_to_cover',
  'uncovered_lines',
  'new_uncovered_lines',
  'duplicated_lines_density',
  'new_duplicated_lines_density',
  'duplicated_blocks',
  'duplicated_lines'
] as const;

export const ISSUE_TREE_VIEW_ID = 'sonarQubeDashboard.issueTree';
export const ISSUE_TREE_GROUPS = ['file', 'rule', 'severity'] as const;
export type IssueTreeGroup = typeof ISSUE_TREE_GROUPS[number];

export const DASHBOARD_WEBVIEW_CONSTANTS = {
  typeIconClasses: {
    BUG: 'bug',
    CODE_SMELL: 'code-smell',
    VULNERABILITY: 'vulnerability'
  },
  severityEvolutionKeys: {
    overall: {
      BLOCKER: 'blockerViolations',
      CRITICAL: 'criticalViolations',
      MAJOR: 'majorViolations',
      MINOR: 'minorViolations',
      INFO: 'infoViolations'
    },
    newCode: {
      BLOCKER: 'newBlockerViolations',
      CRITICAL: 'newCriticalViolations',
      MAJOR: 'newMajorViolations',
      MINOR: 'newMinorViolations',
      INFO: 'newInfoViolations'
    }
  },
  qualityMetricNames: {
    new_coverage: 'Cobertura en New Code',
    coverage: 'Cobertura',
    new_duplicated_lines_density: 'Duplicación en New Code',
    duplicated_lines_density: 'Duplicación',
    new_reliability_rating: 'Reliability Rating en New Code',
    reliability_rating: 'Reliability Rating',
    new_security_rating: 'Security Rating en New Code',
    security_rating: 'Security Rating',
    new_software_quality_reliability_rating: 'Reliability Rating en New Code',
    software_quality_reliability_rating: 'Reliability Rating',
    new_software_quality_security_rating: 'Security Rating en New Code',
    software_quality_security_rating: 'Security Rating',
    new_software_quality_maintainability_rating: 'Maintainability Rating en New Code',
    software_quality_maintainability_rating: 'Maintainability Rating',
    new_maintainability_rating: 'Maintainability Rating en New Code',
    sqale_rating: 'Maintainability Rating',
    new_security_review_rating: 'Security Review Rating en New Code',
    security_review_rating: 'Security Review Rating',
    new_security_hotspots_reviewed: 'Hotspots revisados en New Code',
    security_hotspots_reviewed: 'Hotspots revisados',
    new_violations: 'Issues en New Code',
    violations: 'Issues'
  },
  comparatorSymbols: {
    GT: '>',
    LT: '<',
    GTE: '≥',
    LTE: '≤',
    EQ: '=',
    NE: '≠'
  },
  qualityGateLabels: {
    OK: 'Aprobado',
    WARN: 'Aviso',
    ERROR: 'Fallido',
    NONE: 'No disponible'
  },
  compactQualityGateLabels: {
    OK: 'APROBADO',
    WARN: 'AVISO',
    ERROR: 'FALLIDO',
    NONE: 'NO DISP.'
  },
  qualityGateStatuses: ['OK', 'WARN', 'ERROR'],
  qualityGateStatusRanks: QUALITY_GATE_STATUS_RANKS,
  ratingGrades: ['A', 'B', 'C', 'D', 'E'],
  evolutionSeries: {
    types: [
      { key: 'bugs', name: 'Bugs', colorGroup: 'types', colorKey: 'BUG' },
      { key: 'codeSmells', name: 'Code Smells', colorGroup: 'types', colorKey: 'CODE_SMELL' },
      { key: 'vulnerabilities', name: 'Vulnerabilidades', colorGroup: 'types', colorKey: 'VULNERABILITY' },
      { key: 'securityHotspots', name: 'Security Hotspots', colorGroup: 'types', colorKey: 'SECURITY_HOTSPOT' }
    ],
    severity: [
      { key: 'blockerViolations', name: 'Blocker', colorGroup: 'severities', colorKey: 'BLOCKER' },
      { key: 'criticalViolations', name: 'Critical', colorGroup: 'severities', colorKey: 'CRITICAL' },
      { key: 'majorViolations', name: 'Major', colorGroup: 'severities', colorKey: 'MAJOR' },
      { key: 'minorViolations', name: 'Minor', colorGroup: 'severities', colorKey: 'MINOR' },
      { key: 'infoViolations', name: 'Info', colorGroup: 'severities', colorKey: 'INFO' }
    ]
  }
} as const;
