import * as vscode from 'vscode';
import {
  DASHBOARD_COMMANDS,
  PIPELINE_EXECUTION_TREE_VIEW_ID
} from './constants';
import { DashboardPanel } from './dashboardPanel';
import { getDashboardLanguage } from './i18n';
import {
  AnalysisState,
  AnalysisStepProgress,
  PipelineRunHistoryEntry,
  PipelineRunHistoryStatus,
  PipelineRunHistoryStep
} from './scanner/types';

type PipelineExecutionTreeNode = ExecutionNode | StepNode;

interface ExecutionNode {
  kind: 'execution';
  entry: PipelineRunHistoryEntry;
  running: boolean;
}

interface StepNode {
  kind: 'step';
  executionId: string;
  step: PipelineRunHistoryStep | AnalysisStepProgress;
}

const RUNNING_EXECUTION_ID = 'running-analysis';

export class PipelineExecutionTreeProvider
implements vscode.TreeDataProvider<PipelineExecutionTreeNode>, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<
    PipelineExecutionTreeNode | undefined | void
  >();
  private readonly subscriptions: vscode.Disposable[];
  private analysisTreeSignature = '';
  private delayedRefresh: ReturnType<typeof setTimeout> | undefined;

  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly dashboardPanel: DashboardPanel) {
    this.subscriptions = [
      dashboardPanel.onDidChangeAnalysis(state => {
        const signature = analysisStateTreeSignature(state);
        if (signature !== this.analysisTreeSignature) {
          this.analysisTreeSignature = signature;
          this.refresh();
        }
        if (!state.running) {
          if (this.delayedRefresh) clearTimeout(this.delayedRefresh);
          this.delayedRefresh = setTimeout(() => {
            this.delayedRefresh = undefined;
            this.refresh();
          }, 500);
        }
      }),
      dashboardPanel.onDidChangeLanguage(() => this.refresh())
    ];
  }

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(element: PipelineExecutionTreeNode): vscode.TreeItem {
    return element.kind === 'execution'
      ? this.executionTreeItem(element)
      : this.stepTreeItem(element);
  }

  async getChildren(
    element?: PipelineExecutionTreeNode
  ): Promise<PipelineExecutionTreeNode[]> {
    if (element?.kind === 'step') {
      return [];
    }

    if (element?.kind === 'execution') {
      return element.entry.steps.map(step => ({
        kind: 'step',
        executionId: element.entry.id,
        step
      }));
    }

    const history = await this.dashboardPanel.getPipelineExecutions();
    const uniqueEntries = new Map<string, PipelineRunHistoryEntry>();
    for (const entry of history) {
      if (!uniqueEntries.has(entry.id)) {
        uniqueEntries.set(entry.id, entry);
      }
    }

    return [...uniqueEntries.values()].map(entry => ({
      kind: 'execution' as const,
      entry,
      running:
        entry.id === RUNNING_EXECUTION_ID ||
        entry.status === 'running'
    }));
  }

  private executionTreeItem(element: ExecutionNode): vscode.TreeItem {
    const { entry, running } = element;
    const spanish = getDashboardLanguage() === 'es';
    const title = running
      ? runningExecutionTitle(spanish)
      : executionProjectTitle(entry);
    const item = new vscode.TreeItem(
      title,
      entry.steps.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );

    item.description = [
      statusLabel(entry.status, spanish),
      formatDate(entry.startedAt),
      formatDuration(entry.durationMs)
    ].filter(Boolean).join(' · ');
    item.iconPath = executionIcon(entry.status);
    item.contextValue = running
      ? 'sonarPipelineExecutionRunning'
      : 'sonarPipelineExecution';
    item.command = {
      command: DASHBOARD_COMMANDS.openPipelineExecution,
      title: spanish ? 'Abrir ejecución' : 'Open execution',
      arguments: [entry.id]
    };
    item.id = `pipeline-execution:${entry.id}`;
    item.tooltip = executionTooltip(entry, spanish);
    return item;
  }

  private stepTreeItem(element: StepNode): vscode.TreeItem {
    const spanish = getDashboardLanguage() === 'es';
    const { step } = element;
    const item = new vscode.TreeItem(
      step.name,
      vscode.TreeItemCollapsibleState.None
    );
    item.description = [
      stepStatusLabel(step.status, spanish),
      formatDuration(step.durationMs ?? 0)
    ].filter(Boolean).join(' · ');
    item.iconPath = stepIcon(step.status);
    item.id = `pipeline-step:${element.executionId}:${step.id}`;
    item.contextValue = 'sonarPipelineExecutionStep';
    const tooltipLines = [
      `**${step.name}**`,
      '',
      `${spanish ? 'Estado' : 'Status'}: ${stepStatusLabel(step.status, spanish)}`
    ];
    if (step.command) {
      const commandLabel = spanish ? 'Comando' : 'Command';
      tooltipLines.push(`${commandLabel}: \`${step.command}\``);
    }
    if (step.message) {
      const messageLabel = spanish ? 'Mensaje' : 'Message';
      tooltipLines.push(`${messageLabel}: ${step.message}`);
    }
    item.tooltip = new vscode.MarkdownString(tooltipLines.join('\n\n'));
    return item;
  }

  dispose(): void {
    if (this.delayedRefresh) clearTimeout(this.delayedRefresh);
    this.subscriptions.forEach(subscription => subscription.dispose());
    this.emitter.dispose();
  }
}


function analysisStateTreeSignature(state: AnalysisState): string {
  return JSON.stringify({
    running: state.running,
    phase: state.phase,
    scanner: state.scanner,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    steps: state.steps.map(step => ({
      id: step.id,
      name: step.name,
      status: step.status,
      failurePolicy: step.failurePolicy
    }))
  });
}


function executionIcon(status: PipelineRunHistoryStatus): vscode.ThemeIcon {
  switch (status) {
    case 'running':
      return new vscode.ThemeIcon('loading~spin');
    case 'success':
      return new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('testing.iconPassed'));
    case 'warning':
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
    case 'failed':
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
    case 'cancelled':
      return new vscode.ThemeIcon('circle-slash');
  }
}

function stepIcon(status: PipelineRunHistoryStep['status']): vscode.ThemeIcon {
  switch (status) {
    case 'running':
      return new vscode.ThemeIcon('loading~spin');
    case 'success':
      return new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('testing.iconPassed'));
    case 'warning':
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
    case 'failed':
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
    case 'skipped':
      return new vscode.ThemeIcon('debug-step-over');
    case 'pending':
      return new vscode.ThemeIcon('circle-outline');
  }
}

function statusLabel(status: PipelineRunHistoryStatus, spanish: boolean): string {
  const labels = spanish
    ? {
        running: 'En curso',
        success: 'Correcta',
        warning: 'Con advertencias',
        failed: 'Fallida',
        cancelled: 'Cancelada'
      }
    : {
        running: 'Running',
        success: 'Succeeded',
        warning: 'With warnings',
        failed: 'Failed',
        cancelled: 'Cancelled'
      };
  return labels[status];
}

function stepStatusLabel(
  status: PipelineRunHistoryStep['status'],
  spanish: boolean
): string {
  const labels = spanish
    ? {
        pending: 'Pendiente',
        running: 'En curso',
        success: 'Correcto',
        warning: 'Advertencia',
        failed: 'Fallido',
        skipped: 'Omitido'
      }
    : {
        pending: 'Pending',
        running: 'Running',
        success: 'Succeeded',
        warning: 'Warning',
        failed: 'Failed',
        skipped: 'Skipped'
      };
  return labels[status];
}

function formatDate(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : '';
}

function formatDuration(durationMs: number): string {
  const value = Math.max(0, Number(durationMs) || 0);
  if (value < 1000) return `${value} ms`;
  const seconds = Math.round(value / 1000);
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

function executionTooltip(
  entry: PipelineRunHistoryEntry,
  spanish: boolean
): vscode.MarkdownString {
  const title = executionProjectTitle(entry, spanish);
  const statusTitle = spanish ? 'Estado' : 'Status';
  const branchTitle = spanish ? 'Rama' : 'Branch';
  const startedTitle = spanish ? 'Inicio' : 'Started';
  const durationTitle = spanish ? 'Duración' : 'Duration';
  const messageTitle = spanish ? 'Mensaje' : 'Message';
  const lines = [
    `**${title}**`,
    '',
    `${statusTitle}: ${statusLabel(entry.status, spanish)}`
  ];

  if (entry.scanner) {
    lines.push(`Scanner: ${entry.scanner}`);
  }
  if (entry.branch) {
    lines.push(`${branchTitle}: ${entry.branch}`);
  }
  lines.push(`${startedTitle}: ${formatDate(entry.startedAt)}`);
  lines.push(`${durationTitle}: ${formatDuration(entry.durationMs)}`);
  if (entry.message) {
    lines.push(`${messageTitle}: ${entry.message}`);
  }

  return new vscode.MarkdownString(lines.join('\n\n'));
}

function runningExecutionTitle(spanish: boolean): string {
  return spanish ? 'Ejecución en curso' : 'Execution in progress';
}

function executionProjectTitle(
  entry: PipelineRunHistoryEntry,
  spanish?: boolean
): string {
  if (entry.projectName) {
    return entry.projectName;
  }
  if (entry.projectKey) {
    return entry.projectKey;
  }
  if (spanish === undefined) {
    return 'SonarQube';
  }
  return spanish ? 'Ejecución del pipeline' : 'Pipeline execution';
}

export { PIPELINE_EXECUTION_TREE_VIEW_ID };
