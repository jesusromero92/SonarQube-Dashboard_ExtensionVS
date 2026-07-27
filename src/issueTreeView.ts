import * as vscode from 'vscode';
import { DASHBOARD_COMMANDS, IssueTreeGroup } from './constants';
import { getDashboardLanguage } from './i18n';
import { IssueNavigationManager } from './issueNavigation';
import { DashboardIssue } from './types';

type TreeNode = GroupNode | IssueNode;
interface GroupNode { kind: 'group'; label: string; issues: DashboardIssue[]; }
interface IssueNode { kind: 'issue'; issue: DashboardIssue; }

export class IssueTreeProvider implements vscode.TreeDataProvider<TreeNode>, vscode.Disposable {
  private groupBy: IssueTreeGroup = 'file';
  private readonly emitter = new vscode.EventEmitter<TreeNode | undefined | void>();
  private readonly subscription: vscode.Disposable;
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly navigation: IssueNavigationManager) {
    this.subscription = navigation.onDidChange(() => this.refresh());
  }

  setGroupBy(groupBy: IssueTreeGroup): void {
    this.groupBy = groupBy;
    this.refresh();
  }

  getGroupBy(): IssueTreeGroup {
    return this.groupBy;
  }

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    if (element.kind === 'group') {
      const item = new vscode.TreeItem(
        element.label,
        vscode.TreeItemCollapsibleState.Expanded
      );
      item.description = String(element.issues.length);
      item.contextValue = this.groupBy === 'file'
        ? 'sonarIssueFileGroup'
        : 'sonarIssueGroup';
      return item;
    }
    const issue = element.issue;
    const item = new vscode.TreeItem(
      issue.ruleName || issue.message,
      vscode.TreeItemCollapsibleState.None
    );
    item.description = `${issue.severity} · ${issue.relativePath}:${issue.line}`;
    item.tooltip = new vscode.MarkdownString(
      `**${issue.ruleName || issue.rule}**\n\n${issue.message}\n\n` +
      `**${getDashboardLanguage() === 'es' ? 'Archivo' : 'File'}:** ${issue.relativePath}:${issue.line}`
    );
    item.command = {
      command: DASHBOARD_COMMANDS.openIssue,
      title: getDashboardLanguage() === 'es' ? 'Abrir defecto' : 'Open issue',
      arguments: [issue.key]
    };
    item.iconPath = new vscode.ThemeIcon(issueIconName(issue.severity));
    item.contextValue = 'sonarIssue';
    return item;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (element?.kind === 'group') {
      return element.issues.map(issue => ({ kind: 'issue', issue }));
    }
    if (element) {
      return [];
    }
    const groups = new Map<string, DashboardIssue[]>();
    for (const issue of this.navigation.getIssues()) {
      const key = issueGroupKey(issue, this.groupBy);
      const current = groups.get(key) ?? [];
      current.push(issue);
      groups.set(key, current);
    }
    return [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([label, issues]) => ({ kind: 'group', label, issues }));
  }

  async copyFileIssues(element: unknown): Promise<void> {
    if (!isGroupNode(element) || this.groupBy !== 'file') return;

    const spanish = getDashboardLanguage() === 'es';
    const issues = [...element.issues].sort((left, right) =>
      left.line - right.line ||
      left.severityRank - right.severityRank ||
      (left.ruleName || left.rule).localeCompare(right.ruleName || right.rule)
    );
    const lines = [
      `${spanish ? 'Archivo' : 'File'}: ${element.label}`,
      `${spanish ? 'Defectos' : 'Issues'}: ${issues.length}`,
      ''
    ];

    issues.forEach((issue, index) => {
      lines.push(
        `${index + 1}. [${issue.severity}] ${issue.ruleName || issue.rule}`,
        `   ${spanish ? 'Tipo' : 'Type'}: ${issue.type || '—'}`,
        `   ${spanish ? 'Estado' : 'Status'}: ${issue.status || '—'}`,
        `   ${spanish ? 'Resolución' : 'Resolution'}: ${issue.resolution || '—'}`,
        `   ${spanish ? 'Línea' : 'Line'}: ${issue.line || '—'}`,
        `   ${spanish ? 'Descripción' : 'Description'}: ${issue.message || '—'}`,
        `   ${spanish ? 'Clave de regla' : 'Rule key'}: ${issue.rule || '—'}`,
        `   ${spanish ? 'Clave del defecto' : 'Issue key'}: ${issue.key}`,
        ''
      );
    });

    await vscode.env.clipboard.writeText(lines.join('\n').trimEnd());
    vscode.window.setStatusBarMessage(
      spanish
        ? `${issues.length} defecto(s) de ${element.label} copiados.`
        : `${issues.length} issue(s) from ${element.label} copied.`,
      3000
    );
  }

  dispose(): void {
    this.subscription.dispose();
    this.emitter.dispose();
  }
}

function isGroupNode(value: unknown): value is GroupNode {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GroupNode>;
  return candidate.kind === 'group' &&
    typeof candidate.label === 'string' &&
    Array.isArray(candidate.issues);
}

function issueIconName(severity: string): string {
  const normalizedSeverity = severity.toUpperCase();
  if (['BLOCKER', 'CRITICAL', 'HIGH'].includes(normalizedSeverity)) {
    return 'error';
  }
  if (['MAJOR', 'MEDIUM'].includes(normalizedSeverity)) {
    return 'warning';
  }
  return 'info';
}

function issueGroupKey(issue: DashboardIssue, groupBy: IssueTreeGroup): string {
  if (groupBy === 'rule') {
    return issue.ruleName || issue.rule;
  }
  if (groupBy === 'severity') {
    return issue.severity;
  }
  return issue.relativePath;
}
