import * as vscode from 'vscode';
import {
  DASHBOARD_COMMANDS,
  LOCALLY_FIXED_ISSUES_TREE_VIEW_ID
} from './constants';
import { getDashboardLanguage } from './i18n';
import {
  LiveRemediationManager,
  LocallyFixedIssueSummary
} from './liveRemediation';

export { LOCALLY_FIXED_ISSUES_TREE_VIEW_ID };

export class LocallyFixedIssuesTreeProvider
implements vscode.TreeDataProvider<LocallyFixedIssueSummary>, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<LocallyFixedIssueSummary | undefined | void>();
  private readonly subscription: vscode.Disposable;

  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly liveRemediation: LiveRemediationManager) {
    this.subscription = liveRemediation.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(issue: LocallyFixedIssueSummary): vscode.TreeItem {
    const spanish = getDashboardLanguage() === 'es';
    const label = issue.ruleName || issue.rule || issue.message || issue.key;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);

    item.description = `${issue.relativePath}:${issue.line}`;
    item.iconPath = new vscode.ThemeIcon(
      'pass-filled',
      new vscode.ThemeColor('testing.iconPassed')
    );
    item.contextValue = 'sonarLocallyFixedIssue';
    item.id = `locally-fixed:${issue.key}`;
    item.command = {
      command: DASHBOARD_COMMANDS.openLocallyFixedIssue,
      title: spanish ? 'Abrir issue corregido localmente' : 'Open locally fixed issue',
      arguments: [issue.key]
    };

    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${escapeMarkdown(label)}**\n\n`);
    tooltip.appendMarkdown(`$(pass-filled) ${spanish
      ? 'Corregido localmente · pendiente de confirmación de SonarQube'
      : 'Fixed locally · awaiting SonarQube confirmation'}\n\n`);
    tooltip.appendMarkdown(`${spanish ? 'Archivo' : 'File'}: \`${escapeMarkdown(issue.relativePath)}:${issue.line}\`\n\n`);
    tooltip.appendMarkdown(`${spanish ? 'Severidad' : 'Severity'}: ${escapeMarkdown(issue.severity || '—')}\n\n`);
    tooltip.appendMarkdown(`${spanish ? 'Regla' : 'Rule'}: \`${escapeMarkdown(issue.rule || '—')}\``);
    item.tooltip = tooltip;

    return item;
  }

  getChildren(element?: LocallyFixedIssueSummary): LocallyFixedIssueSummary[] {
    if (element) return [];
    return this.liveRemediation.getLocallyFixedIssues();
  }

  dispose(): void {
    this.subscription.dispose();
    this.emitter.dispose();
  }
}

function escapeMarkdown(value: string): string {
  return String(value).replace(/[\\`*_{}[\]()#+\-.!|>]/g, '\\$&');
}
