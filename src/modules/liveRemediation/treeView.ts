import * as vscode from 'vscode';
import { getDashboardLanguage } from '../../i18n';
import {
  SHOW_LIVE_REMEDIATION_DIFF_COMMAND
} from './constants';
export { LOCALLY_MODIFIED_ISSUES_TREE_VIEW_ID } from './constants';
import { localStateLabel } from './diagnostics';
import { LiveRemediationManager } from './manager';
import {
  LocallyModifiedIssueSummary,
  RemediationValidationEntry,
  RemediationSessionSummary
} from './models';

type LiveRemediationTreeNode =
  | { kind: 'session'; session: RemediationSessionSummary }
  | { kind: 'sessionMetric'; id: string; label: string; value: string; icon: string }
  | { kind: 'analyze' }
  | { kind: 'pendingGroup'; count: number }
  | { kind: 'issue'; issue: LocallyModifiedIssueSummary }
  | { kind: 'afterAnalysisGroup'; confirmed: number; stillDetected: number; validatedAt: string }
  | { kind: 'solvedGroup'; count: number }
  | { kind: 'solved'; entry: RemediationValidationEntry }
  | { kind: 'stillDetectedGroup'; count: number }
  | { kind: 'stillDetected'; entry: RemediationValidationEntry }
  | { kind: 'historyGroup'; count: number }
  | { kind: 'history'; entry: RemediationValidationEntry };

export class LocallyModifiedIssuesTreeProvider
implements vscode.TreeDataProvider<LiveRemediationTreeNode>, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<LiveRemediationTreeNode | undefined | void>();
  private readonly subscription: vscode.Disposable;

  readonly onDidChangeTreeData = this.emitter.event;

  constructor(
    private readonly liveRemediation: LiveRemediationManager,
    private readonly analyzeCommand = 'sonarQubeDashboard.moduleCapability.analyzeRepository'
  ) {
    this.subscription = liveRemediation.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(node: LiveRemediationTreeNode): vscode.TreeItem {
    switch (node.kind) {
      case 'session':
        return this.sessionItem(node.session);
      case 'sessionMetric':
        return this.sessionMetricItem(node);
      case 'analyze':
        return this.analyzeItem();
      case 'pendingGroup':
        return this.groupItem(
          this.text(`Cambios pendientes (${node.count})`, `Pending changes (${node.count})`),
          'edit',
          'liveRemediationPendingGroup'
        );
      case 'issue':
        return this.issueItem(node.issue);
      case 'afterAnalysisGroup':
        return this.afterAnalysisItem(node);
      case 'solvedGroup':
        return this.groupItem(
          this.text(`Solucionados (${node.count})`, `Solved (${node.count})`),
          'pass-filled',
          node.count > 0 ? 'liveRemediationSolvedGroup' : 'liveRemediationSolvedGroupEmpty'
        );
      case 'solved':
        return this.solvedItem(node.entry);
      case 'stillDetectedGroup':
        return this.groupItem(
          this.text(`Siguen detectándose (${node.count})`, `Still detected (${node.count})`),
          'error',
          node.count > 0 ? 'liveRemediationStillDetectedGroup' : 'liveRemediationStillDetectedGroupEmpty'
        );
      case 'stillDetected':
        return this.stillDetectedItem(node.entry);
      case 'historyGroup':
        return this.groupItem(
          this.text(`Historial de solucionados (${node.count})`, `Solved history (${node.count})`),
          'history',
          'liveRemediationHistoryGroup'
        );
      case 'history':
        return this.historyItem(node.entry);
    }
  }

  getChildren(node?: LiveRemediationTreeNode): LiveRemediationTreeNode[] {
    if (!node) return this.rootNodes();
    if (node.kind === 'session') return this.sessionChildren(node.session);
    if (node.kind === 'pendingGroup') {
      return this.liveRemediation.getLocallyModifiedIssues().map(issue => ({ kind: 'issue', issue }));
    }
    if (node.kind === 'afterAnalysisGroup') {
      const children: LiveRemediationTreeNode[] = [
        this.metricNode('lastValidation', this.text('Validado', 'Validated'), this.formatTime(node.validatedAt), 'clock'),
        { kind: 'solvedGroup', count: node.confirmed },
        { kind: 'stillDetectedGroup', count: node.stillDetected }
      ];
      const historyCount = this.liveRemediation.getRemediationHistory().length;
      if (historyCount > node.confirmed) {
        children.push({ kind: 'historyGroup', count: historyCount });
      }
      return children;
    }
    if (node.kind === 'solvedGroup') {
      return this.liveRemediation.getLastConfirmedResults().map(entry => ({ kind: 'solved', entry }));
    }
    if (node.kind === 'stillDetectedGroup') {
      return this.liveRemediation.getStillDetectedHistory().map(entry => ({ kind: 'stillDetected', entry }));
    }
    if (node.kind === 'historyGroup') {
      return this.liveRemediation.getRemediationHistory().map(entry => ({ kind: 'history', entry }));
    }
    return [];
  }

  dispose(): void {
    this.subscription.dispose();
    this.emitter.dispose();
  }

  private rootNodes(): LiveRemediationTreeNode[] {
    const nodes: LiveRemediationTreeNode[] = [];
    const session = this.liveRemediation.getSessionSummary();
    const issues = this.liveRemediation.getLocallyModifiedIssues();
    if (session) nodes.push({ kind: 'session', session });
    if (issues.length > 0) nodes.push({ kind: 'pendingGroup', count: issues.length });
    return nodes;
  }

  private sessionChildren(session: RemediationSessionSummary): LiveRemediationTreeNode[] {
    const children: LiveRemediationTreeNode[] = [
      this.metricNode('start', this.text('Iniciada', 'Started'), this.formatTime(session.startedAt), 'clock'),
      { kind: 'analyze' },
      this.metricNode('modified', this.text('Modificados ahora', 'Currently modified'), String(session.modified), 'edit'),
      this.metricNode('validation', this.text('Pendientes de validación', 'Pending validation'), String(session.pendingValidation), 'diff-modified'),
      this.metricNode('server', this.text('Pendientes de servidor', 'Pending server'), String(session.pendingServer), 'sync')
    ];

    if (session.lastValidationAt) {
      children.push({
        kind: 'afterAnalysisGroup',
        confirmed: session.confirmed,
        stillDetected: session.stillDetected,
        validatedAt: session.lastValidationAt
      });
    }
    return children;
  }

  private sessionItem(session: RemediationSessionSummary): vscode.TreeItem {
    const item = new vscode.TreeItem(
      this.text('Sesión de remediación', 'Remediation Session'),
      vscode.TreeItemCollapsibleState.Expanded
    );
    item.description = session.lastValidationAt
      ? this.text(
        `${session.confirmed} confirmados · ${session.stillDetected} siguen detectándose`,
        `${session.confirmed} confirmed · ${session.stillDetected} still detected`
      )
      : undefined;
    item.iconPath = new vscode.ThemeIcon('pulse');
    item.contextValue = 'liveRemediationSession';
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${this.text('Sesión de remediación', 'Remediation session')}**\n\n`);
    tooltip.appendMarkdown(`${this.text('Iniciada', 'Started')}: ${this.formatDateTime(session.startedAt)}\n\n`);
    tooltip.appendMarkdown(`${this.text('Modificados ahora', 'Currently modified')}: **${session.modified}**`);
    item.tooltip = tooltip;
    return item;
  }

  private sessionMetricItem(node: Extract<LiveRemediationTreeNode, { kind: 'sessionMetric' }>): vscode.TreeItem {
    const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
    item.description = node.value;
    item.iconPath = new vscode.ThemeIcon(node.icon);
    item.contextValue = `liveRemediationSessionMetric.${node.id}`;
    return item;
  }

  private analyzeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(
      this.text('Analizar repositorio', 'Analyze repository'),
      vscode.TreeItemCollapsibleState.None
    );
    item.iconPath = new vscode.ThemeIcon('play');
    item.contextValue = 'liveRemediationAnalyze';
    item.command = {
      command: this.analyzeCommand,
      title: this.text('Analizar repositorio', 'Analyze repository')
    };
    item.tooltip = this.text(
      'Ejecuta el Pipeline para obtener un nuevo snapshot real de SonarQube y validar los cambios pendientes.',
      'Runs the Pipeline to obtain a new real SonarQube snapshot and validate pending changes.'
    );
    return item;
  }

  private issueItem(issue: LocallyModifiedIssueSummary): vscode.TreeItem {
    const label = issue.ruleName || issue.rule || issue.message || issue.key;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.description = `${issue.relativePath}:${issue.line} · ${localStateLabel(issue.state, this.spanish)}`;
    item.iconPath = new vscode.ThemeIcon(
      issue.state === 'awaitingConfirmation' ? 'sync' : 'edit',
      new vscode.ThemeColor('gitDecoration.modifiedResourceForeground')
    );
    item.contextValue = 'sonarLocallyModifiedIssue';
    item.id = `locally-modified:${issue.key}`;
    item.command = {
      command: SHOW_LIVE_REMEDIATION_DIFF_COMMAND,
      title: this.text('Ver cambio', 'View change'),
      arguments: [issue.key]
    };

    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${escapeMarkdown(label)}**\n\n`);
    tooltip.appendMarkdown(`$(edit) ${localStateLabel(issue.state, this.spanish)}\n\n`);
    tooltip.appendMarkdown(issue.state === 'modified'
      ? this.text(
        '_El código ha cambiado desde el último snapshot del servidor. Todavía no se afirma que el issue esté resuelto._\n\n',
        '_The code changed since the latest server snapshot. The issue is not considered resolved yet._\n\n'
      )
      : this.text(
        '_SonarQube for IDE dejó de informar del hallazgo, pero SonarQube Server sigue siendo la única autoridad._\n\n',
        '_SonarQube for IDE stopped reporting the finding, but SonarQube Server remains the only authority._\n\n'
      ));
    tooltip.appendMarkdown(`${this.text('Archivo', 'File')}: \`${escapeMarkdown(issue.relativePath)}:${issue.line}\`\n\n`);
    tooltip.appendMarkdown(`${this.text('Severidad del servidor', 'Server severity')}: ${escapeMarkdown(issue.severity || '—')}\n\n`);
    tooltip.appendMarkdown(`${this.text('Regla', 'Rule')}: \`${escapeMarkdown(issue.rule || '—')}\``);
    item.tooltip = tooltip;
    return item;
  }

  private afterAnalysisItem(
    node: Extract<LiveRemediationTreeNode, { kind: 'afterAnalysisGroup' }>
  ): vscode.TreeItem {
    const item = new vscode.TreeItem(
      this.text('Tras último análisis', 'After latest analysis'),
      vscode.TreeItemCollapsibleState.Expanded
    );
    item.description = this.text(
      `${node.confirmed} solucionados · ${node.stillDetected} siguen detectándose`,
      `${node.confirmed} solved · ${node.stillDetected} still detected`
    );
    item.iconPath = new vscode.ThemeIcon('server-process');
    item.contextValue = 'liveRemediationAfterAnalysisGroup';
    item.tooltip = this.text(
      `Resultados confirmados por SonarQube en la última validación (${this.formatDateTime(node.validatedAt)}).`,
      `Results confirmed by SonarQube in the latest validation (${this.formatDateTime(node.validatedAt)}).`
    );
    return item;
  }

  private solvedItem(entry: RemediationValidationEntry): vscode.TreeItem {
    const label = entry.ruleName || entry.rule || entry.message || entry.issueKey;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.description = `${entry.relativePath}:${entry.line} · ${this.formatTime(entry.validatedAt)}`;
    item.iconPath = new vscode.ThemeIcon(
      'pass-filled',
      new vscode.ThemeColor('testing.iconPassed')
    );
    item.contextValue = 'liveRemediationLatestSolved';
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${escapeMarkdown(label)}**\n\n`);
    tooltip.appendMarkdown(
      `$(pass-filled) **${this.text('Solucionado y confirmado por SonarQube', 'Solved and confirmed by SonarQube')}**\n\n`
    );
    tooltip.appendMarkdown(`${this.text('Validado', 'Validated')}: ${this.formatDateTime(entry.validatedAt)}\n\n`);
    tooltip.appendMarkdown(`${this.text('Archivo', 'File')}: \`${escapeMarkdown(entry.relativePath)}:${entry.line}\``);
    item.tooltip = tooltip;
    return item;
  }

  private stillDetectedItem(entry: RemediationValidationEntry): vscode.TreeItem {
    const label = entry.ruleName || entry.rule || entry.message || entry.issueKey;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.description = `${entry.relativePath}:${entry.line} · ${this.formatTime(entry.validatedAt)}`;
    item.iconPath = new vscode.ThemeIcon(
      'error',
      new vscode.ThemeColor('testing.iconFailed')
    );
    item.contextValue = 'liveRemediationStillDetected';
    const line = Math.max(0, entry.line - 1);
    item.command = {
      command: 'vscode.open',
      title: this.text('Ir al issue', 'Go to issue'),
      arguments: [
        vscode.Uri.parse(entry.fileUri),
        {
          preview: false,
          preserveFocus: false,
          selection: new vscode.Range(line, 0, line, 0)
        }
      ]
    };
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${escapeMarkdown(label)}**\n\n`);
    tooltip.appendMarkdown(
      `$(error) **${this.text('Sigue detectándose en SonarQube', 'Still detected in SonarQube')}**\n\n`
    );
    tooltip.appendMarkdown(`${this.text('Validado', 'Validated')}: ${this.formatDateTime(entry.validatedAt)}\n\n`);
    tooltip.appendMarkdown(`${this.text('Archivo', 'File')}: \`${escapeMarkdown(entry.relativePath)}:${entry.line}\`\n\n`);
    tooltip.appendMarkdown(this.text(
      '_Pulsa para abrir la ubicación devuelta por el último análisis de SonarQube._',
      '_Click to open the location returned by the latest SonarQube analysis._'
    ));
    item.tooltip = tooltip;
    return item;
  }

  private historyItem(entry: RemediationValidationEntry): vscode.TreeItem {
    const label = entry.ruleName || entry.rule || entry.message || entry.issueKey;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.description = `${entry.relativePath}:${entry.line} · ${this.formatTime(entry.validatedAt)}`;
    item.iconPath = new vscode.ThemeIcon(
      'pass-filled',
      new vscode.ThemeColor('testing.iconPassed')
    );
    item.contextValue = 'liveRemediationHistoryConfirmed';
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${escapeMarkdown(label)}**\n\n`);
    tooltip.appendMarkdown(
      `$(pass-filled) **${this.text('Confirmado por SonarQube', 'Confirmed by SonarQube')}**\n\n`
    );
    tooltip.appendMarkdown(`${this.text('Validado', 'Validated')}: ${this.formatDateTime(entry.validatedAt)}\n\n`);
    tooltip.appendMarkdown(`${this.text('Archivo', 'File')}: \`${escapeMarkdown(entry.relativePath)}:${entry.line}\``);
    item.tooltip = tooltip;
    return item;
  }

  private groupItem(label: string, icon: string, contextValue: string): vscode.TreeItem {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
    item.iconPath = new vscode.ThemeIcon(icon);
    item.contextValue = contextValue;
    return item;
  }

  private metricNode(id: string, label: string, value: string, icon: string): LiveRemediationTreeNode {
    return { kind: 'sessionMetric', id, label, value, icon };
  }

  private formatTime(value: string): string {
    return new Date(value).toLocaleTimeString(this.spanish ? 'es-ES' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private formatDateTime(value: string): string {
    return new Date(value).toLocaleString(this.spanish ? 'es-ES' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  private get spanish(): boolean {
    return getDashboardLanguage() === 'es';
  }

  private text(spanishText: string, englishText: string): string {
    return this.spanish ? spanishText : englishText;
  }
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+\-.!|>]/g, String.raw`\$&`);
}
