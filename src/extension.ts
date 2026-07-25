import * as vscode from 'vscode';
import { getFolderConfig } from './configuration';
import {
  DASHBOARD_VIEW_ID,
  DashboardLauncherViewProvider
} from './dashboardLauncherViewProvider';
import {
  DASHBOARD_PANEL_VIEW_TYPE,
  DashboardPanel
} from './dashboardPanel';
import { issueSeverityRank, publishFolderDiagnostics } from './diagnostics';
import { fetchAllIssues } from './sonarClient';
import { DashboardIssue, EvolutionPoint, RefreshSummary, SeverityCount } from './types';

let diagnostics: vscode.DiagnosticCollection;
let refreshTimer: NodeJS.Timeout | undefined;
let configurationRefreshTimer: NodeJS.Timeout | undefined;
let activeRefresh: AbortController | undefined;
let dashboardPanel: DashboardPanel | undefined;

function emptySummary(): RefreshSummary {
  return {
    configuredFolders: 0,
    published: 0,
    skipped: 0,
    errors: [],
    issues: [],
    severity: [],
    evolution: []
  };
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
  }
  return [...byLabel.values()]
    .sort((left, right) => left.label.localeCompare(right.label))
    .slice(-15);
}

async function refreshAll(context: vscode.ExtensionContext): Promise<RefreshSummary> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const summary = emptySummary();

  if (folders.length === 0) {
    diagnostics.clear();
    dashboardPanel?.setRefreshSummary(summary);
    return summary;
  }

  activeRefresh?.abort();
  activeRefresh = new AbortController();
  const signal = activeRefresh.signal;

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
      summary.evolution.push(...loaded.evolution);
    } catch (error) {
      if (signal.aborted) {
        break;
      }
      const message = error instanceof Error ? error.message : String(error);
      summary.errors.push(`${folder.name}: ${message}`);
    }
  }

  summary.severity = aggregateSeverity(summary.issues);
  summary.evolution = aggregateEvolution(summary.evolution);
  summary.issues.sort((left, right) =>
    right.severityRank - left.severityRank ||
    left.relativePath.localeCompare(right.relativePath, 'es', { sensitivity: 'base' }) ||
    left.line - right.line ||
    left.ruleName.localeCompare(right.ruleName, 'es', { sensitivity: 'base' })
  );

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
      `SonarQube Dashboard: ${summary.published} issues en Problems` +
        (summary.skipped ? `, ${summary.skipped} omitidos` : ''),
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
    .getConfiguration('sonarQubeDashboard')
    .get<number>('refreshIntervalMinutes', 0);

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
      'sonarQubeDashboard.open',
      () => dashboardPanel?.show()
    ),
    vscode.commands.registerCommand(
      'sonarQubeDashboard.refresh',
      async () => {
        const summary = await refreshAll(context);
        dashboardPanel?.setRefreshSummary(summary, summary.configuredFolders > 0);
      }
    ),
    vscode.commands.registerCommand(
      'sonarQubeDashboard.clear',
      () => {
        diagnostics.clear();
        dashboardPanel?.setRefreshSummary(emptySummary());
      }
    ),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void dashboardPanel?.refreshWorkspaceState();
      if (
        vscode.workspace
          .getConfiguration('sonarQubeDashboard')
          .get<boolean>('autoRefresh', true)
      ) {
        void refreshAll(context);
      }
    }),
    vscode.workspace.onDidChangeConfiguration(
      (event: vscode.ConfigurationChangeEvent) => {
        if (
          event.affectsConfiguration('sonarQubeDashboard') ||
          event.affectsConfiguration('sonarQubeDashboard.sonar')
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
      .getConfiguration('sonarQubeDashboard')
      .get<boolean>('autoRefresh', true)
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
