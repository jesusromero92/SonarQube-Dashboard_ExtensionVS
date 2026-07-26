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
import { createEmptyRefreshSummary } from './dashboard/summary';
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
  SonarIssueCodeActionProvider
} from './issueDecorations';
import { CoverageDecorationManager } from './coverageDecorations';
import { IssueFlowController } from './issueFlowController';
import { IssueNavigationManager } from './issueNavigation';
import { IssueTreeProvider } from './issueTreeView';
import {
  NotificationManager,
  NotificationScope
} from './notificationManager';
import { fetchAllIssues } from './sonarClient';
import {
  CoverageSummary,
  DashboardHotspot,
  DashboardIssue,
  DefectTypeSummary,
  EvolutionPoint,
  QualityGateStatus,
  RatingGrade,
  RefreshSummary,
  SeverityCount
} from './types';

let diagnostics: vscode.DiagnosticCollection;
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

function aggregateEvolution(points: EvolutionPoint[]): EvolutionPoint[] {
  const maximumMetric = (left: number | null, right: number | null): number | null => {
    if (left === null) {
      return right;
    }
    if (right === null) {
      return left;
    }
    return Math.max(left, right);
  };
  const byLabel = new Map<string, EvolutionPoint>();
  for (const point of points) {
    const current = byLabel.get(point.label);
    if (!current) {
      byLabel.set(point.label, { ...point });
      continue;
    }
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
    current.coverage = maximumMetric(current.coverage, point.coverage);
    current.newCoverage = maximumMetric(current.newCoverage, point.newCoverage);
    current.duplicatedLinesDensity = maximumMetric(
      current.duplicatedLinesDensity,
      point.duplicatedLinesDensity
    );
    current.newDuplicatedLinesDensity = maximumMetric(
      current.newDuplicatedLinesDensity,
      point.newDuplicatedLinesDensity
    );
  }
  return [...byLabel.values()]
    .sort((left, right) => left.label.localeCompare(right.label))
    .slice(-15);
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

async function refreshAll(context: vscode.ExtensionContext, source: 'sync' | 'analysis' = 'sync'): Promise<RefreshSummary> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const summary = createEmptyRefreshSummary();
  const notificationScopes: NotificationScope[] = [];
  const previousSummary = dashboardPanel?.getRefreshSummary() ?? createEmptyRefreshSummary();
  dashboardPanel?.setLoading(true);

  if (folders.length === 0) {
    diagnostics.clear();
    issueDecorations.clear();
    coverageDecorations.clear();
    issueNavigation.clear();
    flowController.clear();
    dashboardPanel?.setRefreshSummary(summary);
    dashboardPanel?.setLoading(false);
    return summary;
  }

  activeRefresh?.abort();
  activeRefresh = new AbortController();
  const refreshController = activeRefresh;
  const signal = refreshController.signal;
  const pendingDiagnostics = vscode.languages.createDiagnosticCollection(
    'sonarqube-dashboard-pending'
  );

  for (const folder of folders) {
    if (signal.aborted) {
      break;
    }

    const config = await getFolderConfig(context, folder);
    if (!config) {
      continue;
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
      summary.published += result.published;
      summary.skipped += result.skipped;
      summary.issues.push(...result.issues);
      const [newIssues, hotspots, newHotspots, coverage] = await Promise.all([
        mapFolderIssues(folder, config.projectKey, config.baseDir, loaded, loaded.newIssues),
        mapFolderHotspots(folder, config.projectKey, config.baseDir, loaded, loaded.hotspots),
        mapFolderHotspots(folder, config.projectKey, config.baseDir, loaded, loaded.newHotspots),
        mapFolderCoverage(folder, config.projectKey, config.baseDir, loaded.coverage)
      ]);
      summary.newIssues.push(...newIssues);
      summary.newPublished += newIssues.length;
      summary.hotspots.push(...hotspots);
      summary.newHotspots.push(...newHotspots);
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
      summary.coverage.files.push(...coverage.files);
      if (summary.configuredFolders === 1) {
        summary.coverage.overall = coverage.overall;
        summary.coverage.newCode = coverage.newCode;
      }
      summary.evolution.push(...loaded.evolution);
      summary.qualityGate.status = worstQualityGateStatus(
        summary.qualityGate.status,
        loaded.qualityGate.status
      );
      summary.qualityGate.conditions.push(...loaded.qualityGate.conditions);
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
    } catch (error) {
      if (signal.aborted) {
        break;
      }
      const message = error instanceof Error ? error.message : String(error);
      summary.errors.push(
        `${folder.name}: ${localizeRuntimeText(message, getDashboardLanguage())}`
      );
    }
  }

  if (signal.aborted || activeRefresh !== refreshController) {
    pendingDiagnostics.dispose();
    if (activeRefresh === refreshController) {
      dashboardPanel?.setLoading(false);
    }
    return dashboardPanel?.getRefreshSummary() ?? previousSummary;
  }

  if (summary.errors.length > 0) {
    pendingDiagnostics.dispose();
    const preserved = {
      ...previousSummary,
      errors: [...summary.errors]
    };
    dashboardPanel?.setRefreshSummary(preserved, previousSummary.configuredFolders > 0);
    dashboardPanel?.setLoading(false);
    void vscode.window.setStatusBarMessage(
      localizeRuntimeText(
        `SonarQube Dashboard: error al sincronizar ${summary.errors.length} carpeta(s)`,
        getDashboardLanguage()
      ),
      6000
    );
    return preserved;
  }

  summary.severity = aggregateSeverity(summary.issues);
  summary.newSeverity = aggregateSeverity(summary.newIssues);
  summary.types = aggregateTypes(summary.issues, summary.hotspots);
  summary.newTypes = aggregateTypes(summary.newIssues, summary.newHotspots);
  summary.evolution = aggregateEvolution(summary.evolution);
  recomputeCoverageTotals(summary.coverage);
  summary.issues.sort((left, right) =>
    right.severityRank - left.severityRank ||
    left.relativePath.localeCompare(right.relativePath, localeTag(getDashboardLanguage()), { sensitivity: 'base' }) ||
    left.line - right.line ||
    left.ruleName.localeCompare(right.ruleName, localeTag(getDashboardLanguage()), { sensitivity: 'base' })
  );
  summary.newIssues.sort((left, right) =>
    right.severityRank - left.severityRank ||
    left.relativePath.localeCompare(right.relativePath, localeTag(getDashboardLanguage()), { sensitivity: 'base' }) ||
    left.line - right.line ||
    left.ruleName.localeCompare(right.ruleName, localeTag(getDashboardLanguage()), { sensitivity: 'base' })
  );
  const hotspotRank = (priority: string) =>
    ({ HIGH: 3, MEDIUM: 2, LOW: 1 }[priority.toUpperCase()] ?? 0);
  const sortHotspots = (left: typeof summary.hotspots[number], right: typeof summary.hotspots[number]) =>
    hotspotRank(right.priority) - hotspotRank(left.priority) ||
    left.relativePath.localeCompare(right.relativePath, localeTag(getDashboardLanguage()), { sensitivity: 'base' }) ||
    left.line - right.line;
  summary.hotspots.sort(sortHotspots);
  summary.newHotspots.sort(sortHotspots);
  diagnostics.clear();
  pendingDiagnostics.forEach((uri, fileDiagnostics) => {
    diagnostics.set(uri, fileDiagnostics);
  });
  pendingDiagnostics.dispose();
  issueDecorations.setIssues(summary.issues, summary.hotspots);
  coverageDecorations.setCoverage(summary.coverage);
  issueNavigation.setIssues(summary.issues, summary.newIssues);
  issueTree.refresh();

  dashboardPanel?.setRefreshSummary(
    summary,
    summary.configuredFolders > 0
  );

  if (activeRefresh === refreshController) {
    dashboardPanel?.setLoading(false);
  }

  void notifications.evaluate(notificationScopes, source).catch(error => {
    console.error('SonarQube Dashboard notification evaluation failed:', error);
  });

  if (summary.configuredFolders > 0) {
    void vscode.window.setStatusBarMessage(
      localizeRuntimeText(
        `SonarQube Dashboard: ${summary.published} issues encontrados` +
          (summary.skipped ? `, ${summary.skipped} omitidos` : ''),
        getDashboardLanguage()
      ),
      5000
    );
  }

  return summary;
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
      void refreshAll(context);
    }, minutes * 60_000);
  }
}

function scheduleWorkspaceStateRefresh(): void {
  if (configurationRefreshTimer) {
    clearTimeout(configurationRefreshTimer);
  }

  configurationRefreshTimer = setTimeout(() => {
    configurationRefreshTimer = undefined;
    void dashboardPanel?.refreshWorkspaceState();
  }, 150);
}

export function activate(context: vscode.ExtensionContext): void {
  diagnostics = vscode.languages.createDiagnosticCollection('sonarqube-dashboard');
  issueDecorations = new IssueDecorationManager(context.extensionUri);
  coverageDecorations = new CoverageDecorationManager(context, context.extensionUri);
  flowController = new IssueFlowController();
  issueNavigation = new IssueNavigationManager();
  issueTree = new IssueTreeProvider(issueNavigation);
  notifications = new NotificationManager(context);
  context.subscriptions.push(
    diagnostics,
    issueDecorations,
    coverageDecorations,
    flowController,
    issueNavigation,
    issueTree
  );

  dashboardPanel = new DashboardPanel(
    context,
    source => refreshAll(context, source),
    () => {
      diagnostics.clear();
      issueDecorations.clear();
      coverageDecorations.clear();
      issueNavigation.clear();
      flowController.clear();
    },
    coverageDecorations,
    flowController,
    scope => {
      issueNavigation.setScope(scope);
      issueTree.refresh();
    }
  );

  const launcherProvider = new DashboardLauncherViewProvider(
    context,
    dashboardPanel
  );

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(ISSUE_TREE_VIEW_ID, issueTree),
    vscode.languages.registerCodeLensProvider({ scheme: 'file' }, flowController),
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
        diagnostics.clear();
        issueDecorations.clear();
        coverageDecorations.clear();
        issueNavigation.clear();
        flowController.clear();
        dashboardPanel?.setRefreshSummary(createEmptyRefreshSummary());
      }
    ),
    vscode.commands.registerCommand(
      DASHBOARD_COMMANDS.analyze,
      () => dashboardPanel?.analyze()
    ),
    vscode.commands.registerCommand(
      DASHBOARD_COMMANDS.cancelAnalysis,
      () => dashboardPanel?.cancelAnalysis()
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
      const spanish = getDashboardLanguage() === 'es';
      await vscode.window.showInformationMessage(
        enabled
          ? (spanish ? 'Mostrando solo los defectos del archivo abierto.' : 'Showing only issues from the open file.')
          : (spanish ? 'Mostrando los defectos de todo el workspace.' : 'Showing issues from the whole workspace.')
      );
    }),
    vscode.commands.registerCommand(DASHBOARD_COMMANDS.groupIssues, async () => {
      const spanish = getDashboardLanguage() === 'es';
      const selected = await vscode.window.showQuickPick(
        ISSUE_TREE_GROUPS.map(value => ({
          value,
          label: value === 'file'
            ? (spanish ? 'Archivo' : 'File')
            : value === 'rule'
              ? (spanish ? 'Regla' : 'Rule')
              : (spanish ? 'Severidad' : 'Severity')
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
      void dashboardPanel?.refreshWorkspaceState();
      if (
        vscode.workspace
          .getConfiguration(DASHBOARD_CONFIGURATION_SECTION)
          .get<boolean>(DASHBOARD_CONFIGURATION_KEYS.autoRefresh, true)
      ) {
        void refreshAll(context);
      }
    }),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      void dashboardPanel?.refreshWorkspaceState();
    }),
    vscode.workspace.onDidChangeConfiguration(
      (event: vscode.ConfigurationChangeEvent) => {
        if (
          event.affectsConfiguration(DASHBOARD_CONFIGURATION_SECTION) ||
          event.affectsConfiguration(SONAR_CONFIGURATION_SECTION)
        ) {
          configureRefreshTimer(context);
          if (event.affectsConfiguration(`${DASHBOARD_CONFIGURATION_SECTION}.${DASHBOARD_CONFIGURATION_KEYS.language}`)) {
            void dashboardPanel?.refreshLanguage();
            issueDecorations.refreshLanguage();
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

  if (
    vscode.workspace
      .getConfiguration(DASHBOARD_CONFIGURATION_SECTION)
      .get<boolean>(DASHBOARD_CONFIGURATION_KEYS.autoRefresh, true)
  ) {
    void refreshAll(context);
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
