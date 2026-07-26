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
  QUALITY_GATE_STATUS_RANKS,
  RATING_GRADE_RANKS,
  SONAR_CONFIGURATION_SECTION
} from './constants';
import { createEmptyRefreshSummary } from './dashboard/summary';
import { DashboardPanel } from './dashboardPanel';
import {
  issueSeverityRank,
  mapFolderHotspots,
  mapFolderIssues,
  publishFolderDiagnostics
} from './diagnostics';
import { fetchAllIssues } from './sonarClient';
import {
  DashboardIssue,
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
      left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })
    );
}

function aggregateEvolution(points: EvolutionPoint[]): EvolutionPoint[] {
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
  }
  return [...byLabel.values()]
    .sort((left, right) => left.label.localeCompare(right.label))
    .slice(-15);
}

async function refreshAll(context: vscode.ExtensionContext): Promise<RefreshSummary> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const summary = createEmptyRefreshSummary();
  dashboardPanel?.setLoading(true);

  if (folders.length === 0) {
    diagnostics.clear();
    dashboardPanel?.setRefreshSummary(summary);
    dashboardPanel?.setLoading(false);
    return summary;
  }

  activeRefresh?.abort();
  activeRefresh = new AbortController();
  const refreshController = activeRefresh;
  const signal = refreshController.signal;

  diagnostics.clear();

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
        diagnostics,
        folder,
        config.projectKey,
        config.baseDir,
        loaded
      );
      summary.published += result.published;
      summary.skipped += result.skipped;
      summary.issues.push(...result.issues);
      const [newIssues, hotspots, newHotspots] = await Promise.all([
        mapFolderIssues(folder, config.projectKey, config.baseDir, loaded, loaded.newIssues),
        mapFolderHotspots(folder, config.projectKey, config.baseDir, loaded, loaded.hotspots),
        mapFolderHotspots(folder, config.projectKey, config.baseDir, loaded, loaded.newHotspots)
      ]);
      summary.newIssues.push(...newIssues);
      summary.newPublished += newIssues.length;
      summary.hotspots.push(...hotspots);
      summary.newHotspots.push(...newHotspots);
      summary.evolution.push(...loaded.evolution);
      summary.types.bugs += loaded.types.bugs;
      summary.types.codeSmells += loaded.types.codeSmells;
      summary.types.vulnerabilities += loaded.types.vulnerabilities;
      summary.types.securityHotspots += loaded.types.securityHotspots;
      summary.newTypes.bugs += loaded.newTypes.bugs;
      summary.newTypes.codeSmells += loaded.newTypes.codeSmells;
      summary.newTypes.vulnerabilities += loaded.newTypes.vulnerabilities;
      summary.newTypes.securityHotspots += loaded.newTypes.securityHotspots;
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
      summary.errors.push(`${folder.name}: ${message}`);
    }
  }

  summary.severity = aggregateSeverity(summary.issues);
  summary.newSeverity = aggregateSeverity(summary.newIssues);
  summary.evolution = aggregateEvolution(summary.evolution);
  summary.issues.sort((left, right) =>
    right.severityRank - left.severityRank ||
    left.relativePath.localeCompare(right.relativePath, 'es', { sensitivity: 'base' }) ||
    left.line - right.line ||
    left.ruleName.localeCompare(right.ruleName, 'es', { sensitivity: 'base' })
  );
  summary.newIssues.sort((left, right) =>
    right.severityRank - left.severityRank ||
    left.relativePath.localeCompare(right.relativePath, 'es', { sensitivity: 'base' }) ||
    left.line - right.line ||
    left.ruleName.localeCompare(right.ruleName, 'es', { sensitivity: 'base' })
  );
  const hotspotRank = (priority: string) =>
    ({ HIGH: 3, MEDIUM: 2, LOW: 1 }[priority.toUpperCase()] ?? 0);
  const sortHotspots = (left: typeof summary.hotspots[number], right: typeof summary.hotspots[number]) =>
    hotspotRank(right.priority) - hotspotRank(left.priority) ||
    left.relativePath.localeCompare(right.relativePath, 'es', { sensitivity: 'base' }) ||
    left.line - right.line;
  summary.hotspots.sort(sortHotspots);
  summary.newHotspots.sort(sortHotspots);

  dashboardPanel?.setRefreshSummary(
    summary,
    summary.configuredFolders > 0
  );

  if (summary.errors.length > 0) {
    void vscode.window.setStatusBarMessage(
      `SonarQube Dashboard: error al sincronizar ${summary.errors.length} carpeta(s)`,
      6000
    );
  } else if (summary.configuredFolders > 0) {
    void vscode.window.setStatusBarMessage(
      `SonarQube Dashboard: ${summary.published} issues encontrados` +
        (summary.skipped ? `, ${summary.skipped} omitidos` : ''),
      5000
    );
  }

  if (activeRefresh === refreshController) {
    dashboardPanel?.setLoading(false);
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
  context.subscriptions.push(diagnostics);

  dashboardPanel = new DashboardPanel(
    context,
    () => refreshAll(context),
    () => diagnostics.clear()
  );

  const launcherProvider = new DashboardLauncherViewProvider(
    context,
    dashboardPanel
  );

  context.subscriptions.push(
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
