import * as path from 'node:path';
import * as vscode from 'vscode';
import { SEVERITY_RANKS } from './constants';
import {
  CoverageFileSummary,
  CoverageSummary,
  DashboardHotspot,
  DashboardIssue,
  DashboardIssueFlow,
  DashboardIssueLocation,
  DashboardSeverity,
  LoadedIssues,
  PublishResult,
  RemoteCoverageData,
  SonarImpact,
  SonarHotspot,
  SonarInstanceMode,
  SonarIssue,
  SonarIssueLocation
} from './types';

function normalizedUpperCase(value: string | undefined): string | undefined {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }
  return normalized;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function locationRole(
  index: number,
  total: number
): DashboardIssueLocation['role'] {
  if (total <= 1) {
    return 'related';
  }
  if (index === 0) {
    return 'source';
  }
  if (index === total - 1) {
    return 'sink';
  }
  return 'intermediate';
}

function highestImpact(impacts: SonarImpact[] | undefined): string | undefined {
  return [...(impacts ?? [])]
    .map(impact => normalizedUpperCase(impact.severity))
    .filter((severity): severity is string => Boolean(severity))
    .sort((left, right) => issueSeverityRank(right) - issueSeverityRank(left))[0];
}

export function issueSeverityLabel(
  issue: SonarIssue,
  instanceMode: SonarInstanceMode
): DashboardSeverity {
  const standardSeverity = normalizedUpperCase(issue.severity);
  const impactSeverity = highestImpact(issue.impacts);

  if (instanceMode === 'MQR') {
    return impactSeverity ?? standardSeverity ?? 'UNKNOWN';
  }
  if (instanceMode === 'STANDARD') {
    return standardSeverity ?? impactSeverity ?? 'UNKNOWN';
  }
  return impactSeverity ?? standardSeverity ?? 'UNKNOWN';
}

export function issueSeverityRank(severity: DashboardSeverity): number {
  return SEVERITY_RANKS[severity.toUpperCase()] ?? 10;
}

function vscodeSeverity(
  issue: SonarIssue,
  instanceMode: SonarInstanceMode
): vscode.DiagnosticSeverity {
  const severity = issueSeverityLabel(issue, instanceMode).toUpperCase();
  switch (severity) {
    case 'BLOCKER':
    case 'CRITICAL':
    case 'HIGH':
      return vscode.DiagnosticSeverity.Error;
    case 'MAJOR':
    case 'MEDIUM':
      return vscode.DiagnosticSeverity.Warning;
    case 'MINOR':
    case 'LOW':
      return vscode.DiagnosticSeverity.Information;
    default:
      return vscode.DiagnosticSeverity.Hint;
  }
}

function issueRange(issue: SonarIssue): vscode.Range {
  if (issue.textRange) {
    const startLine = Math.max(0, issue.textRange.startLine - 1);
    const endLine = Math.max(startLine, issue.textRange.endLine - 1);
    const startCharacter = Math.max(0, issue.textRange.startOffset);
    const endCharacter = endLine === startLine
      ? Math.max(startCharacter + 1, issue.textRange.endOffset)
      : Math.max(0, issue.textRange.endOffset);
    return new vscode.Range(startLine, startCharacter, endLine, endCharacter);
  }
  const line = Math.max(0, (issue.line ?? 1) - 1);
  return new vscode.Range(line, 0, line, 1);
}

export function normalizeRelativePath(candidate: string): string | undefined {
  const unixPath = candidate.replace(/\\/g, '/').replace(/^\/+/, '');
  const normalized = path.posix.normalize(unixPath);
  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function resolveIssuePath(
  component: string,
  projectKey: string,
  componentPaths: Map<string, string>
): string | undefined {
  const componentPath = componentPaths.get(component);
  if (componentPath) {
    return normalizeRelativePath(componentPath);
  }
  const prefix = `${projectKey}:`;
  if (component.startsWith(prefix)) {
    return normalizeRelativePath(component.slice(prefix.length));
  }
  return undefined;
}

async function isFile(uri: vscode.Uri): Promise<boolean> {
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    return (stat.type & vscode.FileType.File) !== 0;
  } catch {
    return false;
  }
}

export async function resolveLocalFile(
  folder: vscode.WorkspaceFolder,
  projectKey: string,
  baseDir: string | undefined,
  component: string,
  componentPaths: Map<string, string>,
  explicitPath?: string
): Promise<{ relativePath: string; uri: vscode.Uri } | undefined> {
  const issuePath = explicitPath
    ? normalizeRelativePath(explicitPath)
    : resolveIssuePath(component, projectKey, componentPaths);
  if (!issuePath) {
    return undefined;
  }
  const baseSegments = normalizeRelativePath(baseDir?.trim() ?? '')?.split('/') ?? [];
  const relativePath = [...baseSegments, ...issuePath.split('/')].join('/');
  const uri = vscode.Uri.joinPath(folder.uri, ...relativePath.split('/'));
  if (
    vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() !== folder.uri.toString() ||
    !(await isFile(uri))
  ) {
    return undefined;
  }
  return { relativePath, uri };
}

async function mapLocation(
  folder: vscode.WorkspaceFolder,
  projectKey: string,
  baseDir: string | undefined,
  componentPaths: Map<string, string>,
  location: SonarIssueLocation,
  role: DashboardIssueLocation['role']
): Promise<DashboardIssueLocation> {
  const local = await resolveLocalFile(
    folder,
    projectKey,
    baseDir,
    location.component,
    componentPaths
  );
  const line = Math.max(1, location.textRange?.startLine ?? 1);
  const remotePath = resolveIssuePath(
    location.component,
    projectKey,
    componentPaths
  ) ?? location.component;
  return {
    component: location.component,
    message: location.msg ?? '',
    relativePath: local?.relativePath ?? remotePath,
    fileUri: local?.uri.toString() ?? '',
    resolved: Boolean(local),
    line,
    endLine: Math.max(line, location.textRange?.endLine ?? line),
    role
  };
}

async function mapIssueFlows(
  folder: vscode.WorkspaceFolder,
  projectKey: string,
  baseDir: string | undefined,
  componentPaths: Map<string, string>,
  issue: SonarIssue
): Promise<{ flows: DashboardIssueFlow[]; secondaryLocations: DashboardIssueLocation[] }> {
  const mappedFlows = await Promise.all((issue.flows ?? []).map(async (flow, flowIndex) => {
    const rawLocations = flow.locations ?? [];
    const mapped = await Promise.all(rawLocations.map((location, index) => {
      const role = locationRole(index, rawLocations.length);
      return mapLocation(folder, projectKey, baseDir, componentPaths, location, role);
    }));
    return {
      index: flowIndex,
      locations: mapped
    };
  }));
  const flows = mappedFlows.filter(flow => flow.locations.length > 0);
  return {
    flows,
    secondaryLocations: flows.flatMap(flow => flow.locations)
  };
}

async function toDashboardIssue(
  folder: vscode.WorkspaceFolder,
  projectKey: string,
  baseDir: string | undefined,
  loaded: LoadedIssues,
  issue: SonarIssue
): Promise<DashboardIssue | undefined> {
  const local = await resolveLocalFile(
    folder,
    projectKey,
    baseDir,
    issue.component,
    loaded.componentPaths
  );
  if (!local) {
    return undefined;
  }
  const severity = issueSeverityLabel(issue, loaded.instanceMode);
  const flowData = await mapIssueFlows(
    folder,
    firstNonEmpty(issue.project, projectKey) ?? projectKey,
    baseDir,
    loaded.componentPaths,
    issue
  );
  return {
    key: issue.key,
    rule: issue.rule,
    ruleName: firstNonEmpty(issue.ruleName, issue.rule) ?? issue.rule,
    status: firstNonEmpty(issue.issueStatus, issue.status) ?? '',
    resolution: issue.resolution ?? '',
    assignee: issue.assignee ?? '',
    author: issue.author ?? '',
    creationDate: issue.creationDate ?? '',
    updateDate: issue.updateDate ?? '',
    project: firstNonEmpty(issue.project, projectKey) ?? projectKey,
    component: issue.component,
    folderUri: folder.uri.toString(),
    impacts: issue.impacts ?? [],
    severity,
    severityRank: issueSeverityRank(severity),
    type: firstNonEmpty(issue.type) ?? 'ISSUE',
    message: issue.message,
    relativePath: local.relativePath,
    fileUri: local.uri.toString(),
    line: Math.max(1, issue.textRange?.startLine ?? issue.line ?? 1),
    flows: flowData.flows,
    secondaryLocations: flowData.secondaryLocations
  };
}

export async function mapFolderIssues(
  folder: vscode.WorkspaceFolder,
  projectKey: string,
  baseDir: string | undefined,
  loaded: LoadedIssues,
  issues: SonarIssue[]
): Promise<DashboardIssue[]> {
  const mapped = await Promise.all(
    issues.map(issue => toDashboardIssue(folder, projectKey, baseDir, loaded, issue))
  );
  return mapped.filter((issue): issue is DashboardIssue => Boolean(issue));
}

function hotspotPriority(hotspot: SonarHotspot): string {
  return (
    firstNonEmpty(
      hotspot.securityReviewPriority,
      hotspot.vulnerabilityProbability,
      hotspot.priority,
      hotspot.securitySeverity
    ) ?? 'UNKNOWN'
  ).toUpperCase();
}

export async function mapFolderHotspots(
  folder: vscode.WorkspaceFolder,
  projectKey: string,
  baseDir: string | undefined,
  loaded: LoadedIssues,
  hotspots: SonarHotspot[]
): Promise<DashboardHotspot[]> {
  const mapped = await Promise.all(hotspots.map(async hotspot => {
    const local = await resolveLocalFile(
      folder,
      firstNonEmpty(hotspot.project, projectKey) ?? projectKey,
      baseDir,
      hotspot.component,
      loaded.componentPaths
    );
    if (!local) {
      return undefined;
    }
    return {
      key: hotspot.key,
      ruleKey: hotspot.rule ?? hotspot.ruleKey ?? '',
      project: firstNonEmpty(hotspot.project, projectKey) ?? projectKey,
      component: hotspot.component,
      message: hotspot.message ?? '',
      status: hotspot.status ?? '',
      resolution: hotspot.resolution ?? '',
      priority: hotspotPriority(hotspot),
      relativePath: local.relativePath,
      fileUri: local.uri.toString(),
      folderUri: folder.uri.toString(),
      line: Math.max(1, hotspot.textRange?.startLine ?? hotspot.line ?? 1)
    };
  }));
  return mapped.filter((hotspot): hotspot is DashboardHotspot => Boolean(hotspot));
}

const EMPTY_COVERAGE_TOTALS = {
  coverage: null,
  lineCoverage: null,
  branchCoverage: null,
  linesToCover: 0,
  uncoveredLines: 0,
  duplicatedLinesDensity: null,
  duplicatedBlocks: 0,
  duplicatedLines: 0
} as const;

export async function mapFolderCoverage(
  folder: vscode.WorkspaceFolder,
  projectKey: string,
  baseDir: string | undefined,
  coverage: RemoteCoverageData
): Promise<CoverageSummary> {
  const mapped = await Promise.all(coverage.files.map(async file => {
    const local = await resolveLocalFile(
      folder,
      projectKey,
      baseDir,
      file.component,
      new Map(),
      file.path
    );
    if (!local) {
      return undefined;
    }
    return {
      ...file,
      relativePath: local.relativePath,
      fileUri: local.uri.toString(),
      folderUri: folder.uri.toString(),
      projectKey
    } satisfies CoverageFileSummary;
  }));
  return {
    overall: coverage.overall ?? { ...EMPTY_COVERAGE_TOTALS },
    newCode: coverage.newCode ?? { ...EMPTY_COVERAGE_TOTALS },
    files: mapped.filter((file): file is CoverageFileSummary => Boolean(file))
  };
}

export async function publishFolderDiagnostics(
  collection: vscode.DiagnosticCollection,
  folder: vscode.WorkspaceFolder,
  projectKey: string,
  baseDir: string | undefined,
  loaded: LoadedIssues
): Promise<PublishResult> {
  const diagnosticsByUri = new Map<string, vscode.Diagnostic[]>();
  const dashboardIssues: DashboardIssue[] = [];
  let published = 0;
  let skipped = 0;

  for (const issue of loaded.issues) {
    const dashboardIssue = await toDashboardIssue(folder, projectKey, baseDir, loaded, issue);
    if (!dashboardIssue) {
      skipped += 1;
      continue;
    }
    const diagnostic = new vscode.Diagnostic(
      issueRange(issue),
      `[${firstNonEmpty(issue.ruleName, issue.rule) ?? issue.rule}] ${issue.message}`,
      vscodeSeverity(issue, loaded.instanceMode)
    );
    diagnostic.source = 'SonarQube Dashboard';
    diagnostic.code = issue.key;
    const current = diagnosticsByUri.get(dashboardIssue.fileUri) ?? [];
    current.push(diagnostic);
    diagnosticsByUri.set(dashboardIssue.fileUri, current);
    dashboardIssues.push(dashboardIssue);
    published += 1;
  }

  for (const [uriString, fileDiagnostics] of diagnosticsByUri) {
    collection.set(vscode.Uri.parse(uriString), fileDiagnostics);
  }
  return { published, skipped, issues: dashboardIssues };
}
