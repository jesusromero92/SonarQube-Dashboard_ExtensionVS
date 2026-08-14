import * as vscode from 'vscode';
import { getDashboardLanguage } from '../i18n';
import { OPEN_LOCALLY_MODIFIED_ISSUE_COMMAND } from './constants';
export { LOCALLY_MODIFIED_ISSUES_TREE_VIEW_ID } from './constants';
import { localStateLabel } from './diagnostics';
import { LiveRemediationManager } from './manager';
import { LocallyModifiedIssueSummary } from './models';


export class LocallyModifiedIssuesTreeProvider
implements vscode.TreeDataProvider<LocallyModifiedIssueSummary>, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<LocallyModifiedIssueSummary | undefined | void>();
  private readonly subscription: vscode.Disposable;

  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly liveRemediation: LiveRemediationManager) {
    this.subscription = liveRemediation.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(issue: LocallyModifiedIssueSummary): vscode.TreeItem {
    const spanish = getDashboardLanguage() === 'es';
    const label = issue.ruleName || issue.rule || issue.message || issue.key;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);

    item.description = `${issue.relativePath}:${issue.line}`;
    item.iconPath = new vscode.ThemeIcon(
      'edit',
      new vscode.ThemeColor('gitDecoration.modifiedResourceForeground')
    );
    item.contextValue = 'sonarLocallyModifiedIssue';
    item.id = `locally-modified:${issue.key}`;
    item.command = {
      command: OPEN_LOCALLY_MODIFIED_ISSUE_COMMAND,
      title: spanish ? 'Abrir issue modificado localmente' : 'Open locally modified issue',
      arguments: [issue.key]
    };

    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${escapeMarkdown(label)}**\n\n`);
    tooltip.appendMarkdown(`$(edit) ${localStateLabel(issue.state, spanish)}\n\n`);
    if (issue.state === 'awaitingConfirmation') {
      tooltip.appendMarkdown(spanish
        ? '_SonarQube for IDE ya no informa de este hallazgo, pero el análisis del servidor sigue siendo autoritativo._\n\n'
        : '_SonarQube for IDE no longer reports this finding, but server analysis remains authoritative._\n\n');
    }
    tooltip.appendMarkdown(`${spanish ? 'Archivo' : 'File'}: \`${escapeMarkdown(issue.relativePath)}:${issue.line}\`\n\n`);
    tooltip.appendMarkdown(`${spanish ? 'Severidad del servidor' : 'Server severity'}: ${escapeMarkdown(issue.severity || '—')}\n\n`);
    tooltip.appendMarkdown(`${spanish ? 'Regla' : 'Rule'}: \`${escapeMarkdown(issue.rule || '—')}\``);
    item.tooltip = tooltip;

    return item;
  }

  getChildren(element?: LocallyModifiedIssueSummary): LocallyModifiedIssueSummary[] {
    if (element) return [];
    return this.liveRemediation.getLocallyModifiedIssues();
  }

  dispose(): void {
    this.subscription.dispose();
    this.emitter.dispose();
  }
}

function escapeMarkdown(value: string): string {
  return String(value).replace(/[\\`*_{}[\]()#+\-.!|>]/g, String.raw`\$&`);
}
