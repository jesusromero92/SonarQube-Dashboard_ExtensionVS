import * as vscode from 'vscode';
import { getFolderConfig } from './configuration';
import {
  DASHBOARD_VIEW_ID,
  DashboardLauncherViewProvider
} from './dashboardLauncherViewProvider';
import {
  DASHBOARD_COMMANDS,
  DASHBOARD_CONFIGURATION_KEYS,
  DASHBOARD_CONFIGURATION_SECTION,
  DASHBOARD_PANEL_VIEW_TYPE,
  ISSUE_TREE_GROUPS,
  ISSUE_TREE_VIEW_ID,
  QUALITY_GATE_STATUS_RANKS,
  RATING_GRADE_RANKS,
  SONAR_CONFIGURATION_SECTION
} from './constants';
import {
  createEmptyRefreshSummary,
  preserveRefreshSummaryAfterErrors
} from './dashboard/summary';
import {
  connectionErrorMessage,
  normalizeConnectionServerUrl
} from './dashboard/connectionValidation';
import {
  getDashboardLanguage,
  localeTag,
  localizeRuntimeText
} from './i18n';
import { DashboardPanel } from './dashboardPanel';
import {
  issueSeverityRank,
  mapFolderCoverage,
  mapFolderHotspots,
  mapFolderIssues,
  publishFolderDiagnostics
} from './diagnostics';
import {
  IssueDecorationManager,
  SonarIssueCodeActionProvider,
  SonarIssueCodeLensProvider
} from './issueDecorations';
import { CoverageDecorationManager } from './coverageDecorations';
import { IssueFlowController } from './issueFlowController';
import { IssueNavigationManager } from './issueNavigation';
import { IssueDiagnosticManager } from './issueDiagnostics';

import { IssueTreeProvider } from './issueTreeView';
import {
  createDashboardModuleRuntime,
  type DashboardModulesRuntime
} from './modules';

import {
  NotificationManager,
  NotificationScope
} from './notificationManager';
import {
  fetchAllIssues,
  fetchCurrentUser,
  fetchIssueLifecycle,
  mutateIssue
} from './sonarClient';
import {
  CoverageSummary,
  DashboardHotspot,
  DashboardIssue,
  DefectTypeSummary,
  EvolutionPoint,
  FolderSonarConfig,
  QualityGateStatus,
  RatingGrade,
  RefreshSummary,
  SeverityCount
} from './types';

let issueDiagnostics: IssueDiagnosticManager;
let refreshTimer: NodeJS.Timeout | undefined;
let configurationRefreshTimer: NodeJS.Timeout | undefined;
let activeRefresh: AbortController | undefined;
let dashboardPanel: DashboardPanel | undefined;
let issueDecorations: IssueDecorationManager;
let coverageDecorations: CoverageDecorationManager;
let flowController: IssueFlowController;
let issueNavigation: IssueNavigationManager;
let issueTree: IssueTreeProvider;
let notifications: NotificationManager;
let modules: DashboardModulesRuntime;

const CHANGELOG_VERSION_STATE_KEY = 'sonarqubeDashboard.lastShownChangelogVersion';


async function showChangelogIfNeeded(context: vscode.ExtensionContext): Promise<void> {
  const currentVersion = String(context.extension.packageJSON.version ?? '').trim();
  if (!currentVersion) {
    return;
  }

  const lastShownVersion = context.globalState.get<string>(
    CHANGELOG_VERSION_STATE_KEY
  );
  if (lastShownVersion === currentVersion) {
    return;
  }

  const changelogUri = vscode.Uri.joinPath(context.extensionUri, 'CHANGELOG.md');

  try {
    await vscode.workspace.fs.stat(changelogUri);
    await vscode.commands.executeCommand('markdown.showPreview', changelogUri);
    await context.globalState.update(
      CHANGELOG_VERSION_STATE_KEY,
      currentVersion
    );
  } catch (error) {
    console.warn(
      `SonarQube Dashboard could not open CHANGELOG.md for version ${currentVersion}:`,
      error
    );
  }
}

function worstRating(current: RatingGrade, candidate: RatingGrade): RatingGrade {
  return RATING_GRADE_RANKS[candidate] > RATING_GRADE_RANKS[current]
    ? candidate
    : current;
}

function worstQualityGateStatus(
  current: QualityGateStatus,
  candidate: QualityGateStatus
): QualityGateStatus {
  return QUALITY_GATE_STATUS_RANKS[candidate] > QUALITY_GATE_STATUS_RANKS[current]
    ? candidate
    : current;
}

function aggregateSeverity(issues: DashboardIssue[]): SeverityCount[] {
  const counts = new Map<string, number>();

  for (const issue of issues) {
    const name = issue.severity || 'UNKNOWN';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      rank: issueSeverityRank(name)
    }))
    .sort((left, right) =>
      right.rank - left.rank ||
      left.name.localeCompare(right.name, localeTag(getDashboardLanguage()), { sensitivity: 'base' })
    );
}

function aggregateTypes(
  issues: DashboardIssue[],
  hotspots: DashboardHotspot[]
): DefectTypeSummary {
  const types: DefectTypeSummary = {
    bugs: 0,
    codeSmells: 0,
    vulnerabilities: 0,
    securityHotspots: hotspots.length
  };

  for (const issue of issues) {
    switch (issue.type.trim().toUpperCase()) {
      case 'BUG':
        types.bugs += 1;
        break;
      case 'CODE_SMELL':
        types.codeSmells += 1;
        break;
      case 'VULNERABILITY':
        types.vulnerabilities += 1;
        break;
    }
  }

  return types;
}

function maximumEvolutionMetric(
  left: number | null,
  right: number | null
): number | null {
  if (left === null) {
    return right;
  }
  if (right === null) {
    return left;
  }
  return Math.max(left, right);
}

function mergeEvolutionPoint(current: EvolutionPoint, point: EvolutionPoint): void {
  current.date = Date.parse(point.date) > Date.parse(current.date) ? point.date : current.date;
  current.bugs += point.bugs;
  current.codeSmells += point.codeSmells;
  current.vulnerabilities += point.vulnerabilities;
  current.securityHotspots += point.securityHotspots;
  current.blockerViolations += point.blockerViolations;
  current.criticalViolations += point.criticalViolations;
  current.majorViolations += point.majorViolations;
  current.minorViolations += point.minorViolations;
  current.infoViolations += point.infoViolations;
  current.newBugs += point.newBugs;
  current.newCodeSmells += point.newCodeSmells;
  current.newVulnerabilities += point.newVulnerabilities;
  current.newSecurityHotspots += point.newSecurityHotspots;
  current.newBlockerViolations += point.newBlockerViolations;
  current.newCriticalViolations += point.newCriticalViolations;
  current.newMajorViolations += point.newMajorViolations;
  current.newMinorViolations += point.newMinorViolations;
  current.newInfoViolations += point.newInfoViolations;
  current.coverage = maximumEvolutionMetric(current.coverage, point.coverage);
  current.newCoverage = maximumEvolutionMetric(current.newCoverage, point.newCoverage);
  current.duplicatedLinesDensity = maximumEvolutionMetric(
    current.duplicatedLinesDensity,
    point.duplicatedLinesDensity
  );
  current.newDuplicatedLinesDensity = maximumEvolutionMetric(
    current.newDuplicatedLinesDensity,
    point.newDuplicatedLinesDensity
  );
}

function latestEvolutionByDay(points: EvolutionPoint[]): EvolutionPoint[] {
  const byDay = new Map<string, EvolutionPoint>();
  for (const point of [...points].sort((left, right) =>
    Date.parse(left.date) - Date.parse(right.date)
  )) {
    const parsed = new Date(point.date);
    const day = Number.isFinite(parsed.getTime())
      ? parsed.toISOString().slice(0, 10)
      : point.date.slice(0, 10);
    byDay.set(day, { ...point, label: day });
  }
  return [...byDay.values()];
}

function aggregateEvolution(points: EvolutionPoint[]): EvolutionPoint[] {
  const byLabel = new Map<string, EvolutionPoint>();
  for (const point of points) {
    const current = byLabel.get(point.label);
    if (!current) {
      byLabel.set(point.label, { ...point });
      continue;
    }
    mergeEvolutionPoint(current, point);
  }
  return [...byLabel.values()]
    .sort((left, right) => left.label.localeCompare(right.label));
}

function appendAnalysisComparison(
  summary: RefreshSummary,
  evolution: EvolutionPoint[]
): void {
  if (evolution.length < 2) {
    summary.analysisComparisonAvailable = false;
    return;
  }
  const latest = evolution.at(-1)!;
  const previous = evolution.at(-2)!;
  if (summary.latestAnalysis) {
    mergeEvolutionPoint(summary.latestAnalysis, latest);
  } else {
    summary.latestAnalysis = { ...latest };
  }
  if (summary.previousAnalysis) {
    mergeEvolutionPoint(summary.previousAnalysis, previous);
  } else {
    summary.previousAnalysis = { ...previous };
  }
}


function recomputeCoverageTotals(summary: CoverageSummary): void {
  const calculate = (newCode: boolean) => {
    const files = summary.files;
    const linesToCover = files.reduce(
      (total, file) => total + (newCode ? file.newLinesToCover : file.linesToCover),
      0
    );
    const uncoveredLines = files.reduce(
      (total, file) => total + (newCode ? file.newUncoveredLines : file.uncoveredLines),
      0
    );
    const duplicatedLines = newCode ? 0 : files.reduce((total, file) => total + file.duplicatedLines, 0);
    const duplicatedBlocks = newCode ? 0 : files.reduce((total, file) => total + file.duplicatedBlocks, 0);
    const coverage = linesToCover > 0
      ? Math.max(0, Math.min(100, (linesToCover - uncoveredLines) / linesToCover * 100))
      : null;
    const densityValues = files
      .map(file => newCode ? file.newDuplicatedLinesDensity : file.duplicatedLinesDensity)
      .filter((value): value is number => value !== null);
    const duplicatedLinesDensity = densityValues.length > 0
      ? densityValues.reduce((sum, value) => sum + value, 0) / densityValues.length
      : null;
    return {
      coverage,
      lineCoverage: coverage,
      branchCoverage: null,
      linesToCover,
      uncoveredLines,
      duplicatedLinesDensity,
      duplicatedBlocks,
      duplicatedLines
    };
  };
  if (summary.files.length > 0) {
    summary.overall = calculate(false);
    summary.newCode = calculate(true);
  }
}

type LoadedSonarData = Awaited<ReturnType<typeof fetchAllIssues>>;

interface RefreshOperation {
  controller: AbortController;
  signal: AbortSignal;
  pendingDiagnostics: vscode.DiagnosticCollection;
}

function runAsync(task: Promise<unknown> | undefined, operation: string): void {
  task?.catch(error => {
    console.error(`SonarQube Dashboard ${operation} failed:`, error);
  });
}

function clearWorkspaceData(summary: RefreshSummary): RefreshSummary {
  modules?.clearWorkspaceState();
  issueDiagnostics.clear();
  issueDecorations.clear();
  coverageDecorations.clear();
  issueNavigation.clear();
  flowController.clear();
  dashboardPanel?.setRefreshSummary(summary);
  dashboardPanel?.setLoading(false);
  return summary;
}

function startRefreshOperation(): RefreshOperation {
  activeRefresh?.abort();
  const controller = new AbortController();
  activeRefresh = controller;

  return {
    controller,
    signal: controller.signal,
    pendingDiagnostics: vscode.languages.createDiagnosticCollection(
      'sonarqube-dashboard-pending'
    )
  };
}

function appendRatings(
  summary: RefreshSummary,
  loaded: LoadedSonarData
): void {
  for (const scope of ['overall', 'newCode'] as const) {
    for (const rating of [
      'maintainability',
      'reliability',
      'security',
      'securityReview'
    ] as const) {
      summary.ratings[scope][rating] = worstRating(
        summary.ratings[scope][rating],
        loaded.ratings[scope][rating]
      );
    }
  }
}

interface FolderRefreshData {
  loaded: LoadedSonarData;
  publishedCount: number;
  issues: DashboardIssue[];
  newIssues: DashboardIssue[];
  hotspots: DashboardHotspot[];
  newHotspots: DashboardHotspot[];
  coverage: CoverageSummary;
}

function appendFolderData(
  summary: RefreshSummary,
  data: FolderRefreshData
): void {
  summary.published += data.publishedCount;
  summary.newPublished += data.newIssues.length;
  summary.issues.push(...data.issues);
  summary.newIssues.push(...data.newIssues);
  summary.hotspots.push(...data.hotspots);
  summary.newHotspots.push(...data.newHotspots);
  summary.hasAnalysis = summary.hasAnalysis || data.loaded.hasAnalysis;
  summary.coverage.files.push(...data.coverage.files);

  if (summary.configuredFolders === 1) {
    summary.coverage.overall = data.coverage.overall;
    summary.coverage.newCode = data.coverage.newCode;
  }

  summary.evolution.push(...latestEvolutionByDay(data.loaded.evolution));
  appendAnalysisComparison(summary, data.loaded.evolution);
  summary.qualityGate.status = worstQualityGateStatus(
    summary.qualityGate.status,
    data.loaded.qualityGate.status
  );
  summary.qualityGate.conditions.push(...data.loaded.qualityGate.conditions);
  appendRatings(summary, data.loaded);
}

async function refreshWorkspaceFolder(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
  summary: RefreshSummary,
  notificationScopes: NotificationScope[],
  pendingDiagnostics: vscode.DiagnosticCollection,
  signal: AbortSignal
): Promise<void> {
  const config = await getFolderConfig(context, folder);
  if (!config) {
    return;
  }

  summary.configuredFolders += 1;

  try {
    const loaded = await fetchAllIssues(config, signal);
    const result = await publishFolderDiagnostics(
      pendingDiagnostics,
      folder,
      config.projectKey,
      config.baseDir,
      loaded
    );
    summary.skipped += result.skipped;

    const [newIssues, hotspots, newHotspots, coverage] = await Promise.all([
      mapFolderIssues(folder, config.projectKey, config.baseDir, loaded, loaded.newIssues),
      mapFolderHotspots(folder, config.projectKey, config.baseDir, loaded, loaded.hotspots),
      mapFolderHotspots(folder, config.projectKey, config.baseDir, loaded, loaded.newHotspots),
      mapFolderCoverage(folder, config.projectKey, config.baseDir, loaded.coverage)
    ]);

    appendFolderData(summary, {
      loaded,
      publishedCount: result.published,
      issues: result.issues,
      newIssues,
      hotspots,
      newHotspots,
      coverage
    });

    notificationScopes.push({
      id: [
        folder.uri.toString(),
        config.serverUrl,
        config.projectKey,
        config.branch?.trim() ?? ''
      ].join('|'),
      issues: result.issues,
      hotspots,
      qualityGate: loaded.qualityGate.status
    });
  } catch (error) {
    if (signal.aborted) {
      return;
    }

    const message = connectionErrorMessage(error);
    summary.errors.push(
      `${folder.name}: ${localizeRuntimeText(message, getDashboardLanguage())}`
    );
  }
}

async function refreshWorkspaceFolders(
  context: vscode.ExtensionContext,
  folders: readonly vscode.WorkspaceFolder[],
  summary: RefreshSummary,
  notificationScopes: NotificationScope[],
  operation: RefreshOperation
): Promise<void> {
  for (const folder of folders) {
    if (operation.signal.aborted) {
      return;
    }

    await refreshWorkspaceFolder(
      context,
      folder,
      summary,
      notificationScopes,
      operation.pendingDiagnostics,
      operation.signal
    );
  }
}

function isObsoleteRefresh(operation: RefreshOperation): boolean {
  return operation.signal.aborted || activeRefresh !== operation.controller;
}

function finishObsoleteRefresh(
  operation: RefreshOperation,
  previousSummary: RefreshSummary
): RefreshSummary {
  operation.pendingDiagnostics.dispose();

  if (activeRefresh === operation.controller) {
    dashboardPanel?.setLoading(false);
  }

  return dashboardPanel?.getRefreshSummary() ?? previousSummary;
}

function preserveSummaryAfterErrors(
  summary: RefreshSummary,
  previousSummary: RefreshSummary,
  pendingDiagnostics: vscode.DiagnosticCollection
): RefreshSummary {
  pendingDiagnostics.dispose();
  const preserved = preserveRefreshSummaryAfterErrors(previousSummary, summary);

  dashboardPanel?.setRefreshSummary(
    preserved,
    summary.configuredFolders > 0
  );
  dashboardPanel?.setLoading(false);
  vscode.window.setStatusBarMessage(
    localizeRuntimeText(
      `SonarQube Dashboard: error al sincronizar ${summary.errors.length} carpeta(s)`,
      getDashboardLanguage()
    ),
    6000
  );

  return preserved;
}

function compareIssues(left: DashboardIssue, right: DashboardIssue): number {
  const locale = localeTag(getDashboardLanguage());
  return (
    right.severityRank - left.severityRank ||
    left.relativePath.localeCompare(right.relativePath, locale, {
      sensitivity: 'base'
    }) ||
    left.line - right.line ||
    left.ruleName.localeCompare(right.ruleName, locale, {
      sensitivity: 'base'
    })
  );
}

function hotspotPriorityRank(priority: string): number {
  return ({ HIGH: 3, MEDIUM: 2, LOW: 1 }[priority.toUpperCase()] ?? 0);
}

function compareHotspots(
  left: DashboardHotspot,
  right: DashboardHotspot
): number {
  return (
    hotspotPriorityRank(right.priority) -
      hotspotPriorityRank(left.priority) ||
    left.relativePath.localeCompare(
      right.relativePath,
      localeTag(getDashboardLanguage()),
      { sensitivity: 'base' }
    ) ||
    left.line - right.line
  );
}

function prepareRefreshSummary(summary: RefreshSummary): void {
  summary.syncStatus = 'success';
  summary.hasSuccessfulSync = true;
  summary.lastSuccessfulAt = new Date().toISOString();
  summary.severity = aggregateSeverity(summary.issues);
  summary.newSeverity = aggregateSeverity(summary.newIssues);
  summary.types = aggregateTypes(summary.issues, summary.hotspots);
  summary.newTypes = aggregateTypes(summary.newIssues, summary.newHotspots);
  summary.evolution = aggregateEvolution(summary.evolution);
  recomputeCoverageTotals(summary.coverage);
  summary.issues.sort(compareIssues);
  summary.newIssues.sort(compareIssues);
  summary.hotspots.sort(compareHotspots);
  summary.newHotspots.sort(compareHotspots);
}

function applyModuleIssueOverlayState(): void {
  const overlay = modules?.getIssueOverlay() ?? { states: new Map(), ranges: new Map() };
  issueDecorations.setLocalRemediation(overlay.states, overlay.ranges);
  issueTree.refresh();
}

function applyRefreshSummary(
  summary: RefreshSummary,
  operation: RefreshOperation,
  source: 'sync' | 'analysis'
): number {
  issueDecorations.setIssues(summary.issues, summary.hotspots);
  issueDiagnostics.replaceServerSnapshot(operation.pendingDiagnostics);
  operation.pendingDiagnostics.dispose();
  const confirmedLocallyModifiedCount = modules?.applyServerSnapshot(
    summary.issues,
    issueDiagnostics.getServerSnapshot(),
    source === 'analysis'
  ) ?? 0;
  coverageDecorations.setCoverage(summary.coverage);
  issueNavigation.setIssues(summary.issues, summary.newIssues);
  applyModuleIssueOverlayState();
  dashboardPanel?.setRefreshSummary(
    summary,
    summary.configuredFolders > 0
  );

  if (activeRefresh === operation.controller) {
    dashboardPanel?.setLoading(false);
  }

  return confirmedLocallyModifiedCount;
}

function showSuccessfulRefreshStatus(summary: RefreshSummary): void {
  if (summary.configuredFolders === 0) {
    return;
  }

  vscode.window.setStatusBarMessage(
    localizeRuntimeText(
      `SonarQube Dashboard: ${summary.published} issues encontrados` +
        (summary.skipped ? `, ${summary.skipped} omitidos` : ''),
      getDashboardLanguage()
    ),
    5000
  );
}

async function refreshAll(
  context: vscode.ExtensionContext,
  source: 'sync' | 'analysis' = 'sync'
): Promise<RefreshSummary> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const summary = createEmptyRefreshSummary();
  const notificationScopes: NotificationScope[] = [];
  const previousSummary =
    dashboardPanel?.getRefreshSummary() ?? createEmptyRefreshSummary();

  dashboardPanel?.setLoading(true);

  if (folders.length === 0) {
    return clearWorkspaceData(summary);
  }

  const operation = startRefreshOperation();
  try {
    await refreshWorkspaceFolders(
      context,
      folders,
      summary,
      notificationScopes,
      operation
    );

    if (isObsoleteRefresh(operation)) {
      return finishObsoleteRefresh(operation, previousSummary);
    }

    if (summary.errors.length > 0) {
      return preserveSummaryAfterErrors(
        summary,
        previousSummary,
        operation.pendingDiagnostics
      );
    }

    prepareRefreshSummary(summary);
    const confirmedLocallyModifiedCount = applyRefreshSummary(summary, operation, source);
    runAsync(
      notifications.evaluate(notificationScopes, source, confirmedLocallyModifiedCount),
      'notification evaluation'
    );
    showSuccessfulRefreshStatus(summary);

    return summary;
  } finally {
    if (activeRefresh === operation.controller) {
      dashboardPanel?.setLoading(false);
    }
  }
}

function configureRefreshTimer(context: vscode.ExtensionContext): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = undefined;
  }

  const minutes = vscode.workspace
    .getConfiguration(DASHBOARD_CONFIGURATION_SECTION)
    .get<number>(DASHBOARD_CONFIGURATION_KEYS.refreshIntervalMinutes, 0);

  if (minutes > 0) {
    refreshTimer = setInterval(() => {
      runAsync(refreshAll(context), 'scheduled refresh');
    }, minutes * 60_000);
  }
}

function scheduleWorkspaceStateRefresh(): void {
  if (configurationRefreshTimer) {
    clearTimeout(configurationRefreshTimer);
  }

  configurationRefreshTimer = setTimeout(() => {
    configurationRefreshTimer = undefined;
    runAsync(
      dashboardPanel?.refreshWorkspaceState(),
      'workspace state refresh'
    );
  }, 150);
}

function currentFileFilterMessage(enabled: boolean): string {
  const spanish = getDashboardLanguage() === 'es';

  if (enabled) {
    return spanish
      ? 'Mostrando solo los defectos del archivo abierto.'
      : 'Showing only issues from the open file.';
  }

  return spanish
    ? 'Mostrando los defectos de todo el workspace.'
    : 'Showing issues from the whole workspace.';
}

function issueTreeGroupLabel(
  value: typeof ISSUE_TREE_GROUPS[number],
  spanish: boolean
): string {
  switch (value) {
    case 'file':
      return spanish ? 'Archivo' : 'File';
    case 'rule':
      return spanish ? 'Regla' : 'Rule';
    default:
      return spanish ? 'Severidad' : 'Severity';
  }
}


function workspaceFolderForIssue(issue: DashboardIssue): vscode.WorkspaceFolder | undefined {
  const folderUri = issue.folderUri?.trim();
  if (folderUri) {
    const exact = vscode.workspace.workspaceFolders?.find(
      folder => folder.uri.toString() === folderUri
    );
    if (exact) {
      return exact;
    }
  }
  return vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(issue.fileUri));
}

async function issueConnection(
  context: vscode.ExtensionContext,
  issue: DashboardIssue
): Promise<{ folder: vscode.WorkspaceFolder; config: FolderSonarConfig } | undefined> {
  const spanish = getDashboardLanguage() === 'es';
  const folder = workspaceFolderForIssue(issue);
  if (!folder) {
    await vscode.window.showWarningMessage(
      spanish
        ? 'La carpeta asociada al issue ya no está abierta.'
        : 'The workspace folder associated with the issue is no longer open.'
    );
    return undefined;
  }
  const config = await getFolderConfig(context, folder);
  if (!config) {
    await vscode.window.showWarningMessage(
      spanish
        ? 'La carpeta no tiene una conexión válida con SonarQube.'
        : 'The folder does not have a valid SonarQube connection.'
    );
    return undefined;
  }
  return { folder, config };
}

function acceptTransitionKey(
  transitions: readonly { key: string; name: string }[]
): string | undefined {
  const normalize = (value: string): string => value
    .trim()
    .toLowerCase()
    .replace(/[\s'’_-]+/g, '');
  const accepted = new Set(['accept', 'accepted', 'wontfix']);
  return transitions.find(transition =>
    accepted.has(normalize(transition.key)) ||
    accepted.has(normalize(transition.name))
  )?.key;
}

async function refreshAfterIssueMutation(
  context: vscode.ExtensionContext,
  successMessageEs: string,
  successMessageEn: string
): Promise<void> {
  const summary = await refreshAll(context, 'sync');
  dashboardPanel?.setRefreshSummary(summary, summary.configuredFolders > 0);
  await vscode.window.showInformationMessage(
    getDashboardLanguage() === 'es' ? successMessageEs : successMessageEn
  );
}

function sonarIssueUri(config: FolderSonarConfig, issue: DashboardIssue): vscode.Uri {
  const base = normalizeConnectionServerUrl(config.serverUrl);
  const url = new URL(`${base}/project/issues`);
  url.searchParams.set('id', issue.project || config.projectKey);
  url.searchParams.set('open', issue.key);
  if (config.branch?.trim()) {
    url.searchParams.set('branch', config.branch.trim());
  }
  return vscode.Uri.parse(url.toString());
}


export async function activate(context: vscode.ExtensionContext): Promise<void> {
  issueDiagnostics = new IssueDiagnosticManager();
  issueDecorations = new IssueDecorationManager(context.extensionUri);
  coverageDecorations = new CoverageDecorationManager(context, context.extensionUri);
  flowController = new IssueFlowController();
  issueNavigation = new IssueNavigationManager();
  issueTree = new IssueTreeProvider(issueNavigation);
  notifications = new NotificationManager(context);
  const issueCodeLensProvider = new SonarIssueCodeLensProvider(issueDecorations);
  context.subscriptions.push(
    issueDiagnostics,
    issueDecorations,
    coverageDecorations,
    flowController,
    issueNavigation,
    issueTree,
    issueCodeLensProvider
  );

  modules = createDashboardModuleRuntime(
    context,
    issueDiagnostics,
    () => applyModuleIssueOverlayState()
  );

  dashboardPanel = new DashboardPanel(
    context,
    source => refreshAll(context, source),
    () => {
      modules.clearWorkspaceState();
      issueDiagnostics.clear();
      issueDecorations.clear();
      coverageDecorations.clear();
      issueNavigation.clear();
      flowController.clear();
    },
    coverageDecorations,
    flowController,
    modules,
    scope => {
      issueNavigation.setScope(scope);
      issueTree.refresh();
    }
  );

  modules.attachDashboard(dashboardPanel);
  // Resolve enabled modules before a command or serializer can build the
  // dashboard. Restored panels must see the same contributions as new panels.
  await modules.syncEnabledModules();

  const launcherProvider = new DashboardLauncherViewProvider(
    context,
    dashboardPanel
  );


  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(ISSUE_TREE_VIEW_ID, issueTree),
    vscode.languages.registerCodeLensProvider({ scheme: 'file' }, flowController),
    vscode.languages.registerCodeLensProvider({ scheme: 'file' }, issueCodeLensProvider),
    vscode.window.registerWebviewViewProvider(
      DASHBOARD_VIEW_ID,
      launcherProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    ),
    vscode.window.registerWebviewPanelSerializer(
      DASHBOARD_PANEL_VIEW_TYPE,
      {
        deserializeWebviewPanel: panel => dashboardPanel?.revive(panel) ?? Promise.resolve()
      }
    ),
    vscode.commands.registerCommand(
      DASHBOARD_COMMANDS.getStarted,
      () => vscode.commands.executeCommand(
        'workbench.action.openWalkthrough',
        `${context.extension.id}#sonarQubeDashboard.gettingStarted`,
        false
      )
    ),
    vscode.commands.registerCommand(
      DASHBOARD_COMMANDS.configure,
      () => dashboardPanel?.showPage('configuration')
    ),
    vscode.commands.registerCommand(
      DASHBOARD_COMMANDS.open,
      () => dashboardPanel?.show()
    ),
    vscode.commands.registerCommand(
      DASHBOARD_COMMANDS.refresh,
      async () => {
        const summary = await refreshAll(context);
        dashboardPanel?.setRefreshSummary(summary, summary.configuredFolders > 0);
      }
    ),
    vscode.commands.registerCommand(
      DASHBOARD_COMMANDS.clear,
      () => {
        modules.clearWorkspaceState();
        issueDiagnostics.clear();
        issueDecorations.clear();
        coverageDecorations.clear();
        issueNavigation.clear();
        flowController.clear();
        dashboardPanel?.setRefreshSummary(createEmptyRefreshSummary());
      }
    ),
    vscode.commands.registerCommand(
      DASHBOARD_COMMANDS.showIssueDetail,
      async (issueKey: string) => {
        const issue = issueDecorations.getIssue(issueKey);
        if (!issue) {
          await vscode.window.showWarningMessage(
            getDashboardLanguage() === 'es'
              ? 'El defecto ya no está disponible. Actualiza los datos de SonarQube.'
              : 'The issue is no longer available. Refresh the SonarQube data.'
          );
          return;
        }
        await dashboardPanel?.showIssueDetail(issue);
      }
    ),
    vscode.commands.registerCommand(
      DASHBOARD_COMMANDS.showRuleDetail,
      async (issueKey: string) => {
        const issue = issueDecorations.getIssue(issueKey);
        if (!issue) {
          await vscode.window.showWarningMessage(
            getDashboardLanguage() === 'es'
              ? 'El issue ya no está disponible. Actualiza los datos de SonarQube.'
              : 'The issue is no longer available. Refresh the SonarQube data.'
          );
          return;
        }
        await dashboardPanel?.showRuleDetail(issue);
      }
    ),
    vscode.commands.registerCommand(
      DASHBOARD_COMMANDS.acceptIssue,
      async (issueKey: string) => {
        const spanish = getDashboardLanguage() === 'es';
        const issue = issueDecorations.getIssue(issueKey);
        if (!issue) {
          await vscode.window.showWarningMessage(
            spanish
              ? 'El issue ya no está disponible. Actualiza los datos de SonarQube.'
              : 'The issue is no longer available. Refresh the SonarQube data.'
          );
          return;
        }
        try {
          const connection = await issueConnection(context, issue);
          if (!connection) return;
          const detail = await fetchIssueLifecycle(connection.config, issue);
          const transition = acceptTransitionKey(detail.transitions);
          if (!transition) {
            await vscode.window.showWarningMessage(
              spanish
                ? 'SonarQube no permite marcar este issue como aceptado con el usuario actual.'
                : 'SonarQube does not allow the current user to mark this issue as accepted.'
            );
            return;
          }
          const confirmLabel = spanish ? 'Marcar como aceptado' : 'Mark as accepted';
          const confirmation = await vscode.window.showWarningMessage(
            spanish
              ? `¿Marcar como aceptado el issue “${issue.ruleName || issue.rule}”?`
              : `Mark the “${issue.ruleName || issue.rule}” issue as accepted?`,
            { modal: true },
            confirmLabel
          );
          if (confirmation !== confirmLabel) return;
          await mutateIssue(connection.config, {
            kind: 'transition',
            issueKey: issue.key,
            folderUri: connection.folder.uri.toString(),
            transition
          });
          await refreshAfterIssueMutation(
            context,
            'Issue marcado como aceptado en SonarQube.',
            'Issue marked as accepted in SonarQube.'
          );
        } catch (error) {
          await vscode.window.showErrorMessage(
            `${spanish ? 'No se pudo actualizar el issue' : 'Could not update the issue'}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    ),
    vscode.commands.registerCommand(
      DASHBOARD_COMMANDS.assignIssueToMe,
      async (issueKey: string) => {
        const spanish = getDashboardLanguage() === 'es';
        const issue = issueDecorations.getIssue(issueKey);
        if (!issue) {
          await vscode.window.showWarningMessage(
            spanish
              ? 'El issue ya no está disponible. Actualiza los datos de SonarQube.'
              : 'The issue is no longer available. Refresh the SonarQube data.'
          );
          return;
        }
        try {
          const connection = await issueConnection(context, issue);
          if (!connection) return;
          const [currentUser, detail] = await Promise.all([
            fetchCurrentUser(connection.config),
            fetchIssueLifecycle(connection.config, issue)
          ]);
          if (!detail.canAssign) {
            await vscode.window.showWarningMessage(
              spanish
                ? 'SonarQube no permite asignar este issue con el usuario actual.'
                : 'SonarQube does not allow the current user to assign this issue.'
            );
            return;
          }
          if (detail.issue.assignee === currentUser.login) {
            await vscode.window.showInformationMessage(
              spanish
                ? 'Este issue ya está asignado a tu usuario.'
                : 'This issue is already assigned to you.'
            );
            return;
          }
          await mutateIssue(connection.config, {
            kind: 'assign',
            issueKey: issue.key,
            folderUri: connection.folder.uri.toString(),
            assignee: currentUser.login
          });
          await refreshAfterIssueMutation(
            context,
            `Issue asignado a ${currentUser.name || currentUser.login}.`,
            `Issue assigned to ${currentUser.name || currentUser.login}.`
          );
        } catch (error) {
          await vscode.window.showErrorMessage(
            `${spanish ? 'No se pudo asignar el issue' : 'Could not assign the issue'}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    ),
    vscode.commands.registerCommand(
      DASHBOARD_COMMANDS.openIssueInSonarQube,
      async (issueKey: string) => {
        const issue = issueDecorations.getIssue(issueKey);
        if (!issue) return;
        const connection = await issueConnection(context, issue);
        if (!connection) return;
        await vscode.env.openExternal(sonarIssueUri(connection.config, issue));
      }
    ),
    vscode.commands.registerCommand(
      DASHBOARD_COMMANDS.showHotspotDetail,
      async (hotspotKey: string) => {
        const hotspot = issueDecorations.getHotspot(hotspotKey);
        if (!hotspot) {
          await vscode.window.showWarningMessage(
            getDashboardLanguage() === 'es'
              ? 'El Security Hotspot ya no está disponible. Actualiza los datos de SonarQube.'
              : 'The Security Hotspot is no longer available. Refresh the SonarQube data.'
          );
          return;
        }
        await dashboardPanel?.showHotspotDetail(hotspot);
      }
    ),

    vscode.commands.registerCommand(DASHBOARD_COMMANDS.openIssue, async (issueKey: string) => {
      const issue = issueNavigation.find(issueKey) ?? issueDecorations.getIssue(issueKey);
      if (issue) await issueNavigation.open(issue);
    }),
    vscode.commands.registerCommand(DASHBOARD_COMMANDS.nextIssue, () => issueNavigation.next()),
    vscode.commands.registerCommand(DASHBOARD_COMMANDS.previousIssue, () => issueNavigation.previous()),
    vscode.commands.registerCommand(DASHBOARD_COMMANDS.nextIssueSameType, () => issueNavigation.nextSameType()),
    vscode.commands.registerCommand(DASHBOARD_COMMANDS.nextCriticalIssue, () => issueNavigation.nextCritical()),
    vscode.commands.registerCommand(DASHBOARD_COMMANDS.toggleCurrentFileIssues, async () => {
      const enabled = issueNavigation.toggleCurrentFileOnly();
      await vscode.window.showInformationMessage(
        currentFileFilterMessage(enabled)
      );
    }),
    vscode.commands.registerCommand(DASHBOARD_COMMANDS.groupIssues, async () => {
      const spanish = getDashboardLanguage() === 'es';
      const selected = await vscode.window.showQuickPick(
        ISSUE_TREE_GROUPS.map(value => ({
          value,
          label: issueTreeGroupLabel(value, spanish)
        })),
        { placeHolder: spanish ? 'Agrupar defectos por…' : 'Group issues by…' }
      );
      if (selected) issueTree.setGroupBy(selected.value);
    }),
    vscode.commands.registerCommand(
      DASHBOARD_COMMANDS.copyFileIssues,
      (element: unknown) => issueTree.copyFileIssues(element)
    ),
    vscode.commands.registerCommand(DASHBOARD_COMMANDS.previousFlowLocation, () => flowController.previous()),
    vscode.commands.registerCommand(DASHBOARD_COMMANDS.nextFlowLocation, () => flowController.next()),
    vscode.commands.registerCommand(
      DASHBOARD_COMMANDS.openFlowLocation,
      async (flowIndex: number, locationIndex: number) => {
        flowController.select(flowIndex, locationIndex);
        const issue = flowController.getIssue();
        const location = issue?.flows[flowIndex]?.locations[locationIndex];
        if (location) await flowController.openLocation(location);
      }
    ),
    vscode.commands.registerCommand(DASHBOARD_COMMANDS.showCoverage, () => dashboardPanel?.showCoverage()),
    vscode.commands.registerCommand(DASHBOARD_COMMANDS.showDuplications, async (fileUri?: string) => {
      await dashboardPanel?.showCoverage(fileUri);
    }),
    vscode.languages.registerCodeActionsProvider(
      { scheme: 'file' },
      new SonarIssueCodeActionProvider(issueDecorations),
      {
        providedCodeActionKinds: SonarIssueCodeActionProvider.providedCodeActionKinds
      }
    ),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      runAsync(
        dashboardPanel?.refreshWorkspaceState(),
        'workspace state refresh'
      );
      if (
        vscode.workspace
          .getConfiguration(DASHBOARD_CONFIGURATION_SECTION)
          .get<boolean>(DASHBOARD_CONFIGURATION_KEYS.autoRefresh, true)
      ) {
        runAsync(refreshAll(context), 'workspace refresh');
      }
    }),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      runAsync(
        dashboardPanel?.refreshWorkspaceState(),
        'workspace trust refresh'
      );
    }),
    vscode.workspace.onDidChangeConfiguration(
      (event: vscode.ConfigurationChangeEvent) => {
        if (
          event.affectsConfiguration(DASHBOARD_CONFIGURATION_SECTION) ||
          event.affectsConfiguration(SONAR_CONFIGURATION_SECTION) ||
          modules.affectsConfiguration(event)
        ) {
          configureRefreshTimer(context);
          if (modules.affectsLifecycleConfiguration(event)) {
            runAsync(
              modules.syncEnabledModules().then(changed => {
                if (changed) dashboardPanel?.rebuildWebview();
              }),
              'optional module lifecycle refresh'
            );
          }
          if (event.affectsConfiguration(`${DASHBOARD_CONFIGURATION_SECTION}.${DASHBOARD_CONFIGURATION_KEYS.language}`)) {
            runAsync(
              dashboardPanel?.refreshLanguage(),
              'language refresh'
            );
            issueDecorations.refreshLanguage();
            modules.refreshLanguage();
            coverageDecorations.refreshLanguage();
            flowController.refreshLanguage();
            issueNavigation.refreshLanguage();
            issueTree.refresh();
          }
          scheduleWorkspaceStateRefresh();
        }
      }
    ),
    {
      dispose: () => {
        activeRefresh?.abort();
        modules.dispose();
        dashboardPanel?.dispose();
        if (refreshTimer) {
          clearInterval(refreshTimer);
        }
        if (configurationRefreshTimer) {
          clearTimeout(configurationRefreshTimer);
        }
      }
    }
  );

  configureRefreshTimer(context);
  runAsync(showChangelogIfNeeded(context), 'changelog display');

  if (
    vscode.workspace
      .getConfiguration(DASHBOARD_CONFIGURATION_SECTION)
      .get<boolean>(DASHBOARD_CONFIGURATION_KEYS.autoRefresh, true)
  ) {
    runAsync(refreshAll(context), 'startup refresh');
  }
}

export function deactivate(): void {
  activeRefresh?.abort();
  dashboardPanel?.dispose();
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  if (configurationRefreshTimer) {
    clearTimeout(configurationRefreshTimer);
  }
}
