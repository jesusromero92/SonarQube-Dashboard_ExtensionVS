import * as vscode from 'vscode';
import { DASHBOARD_COMMANDS } from './constants';
import { getDashboardLanguage } from './i18n';
import { DashboardIssue } from './types';

export class IssueNavigationManager implements vscode.Disposable {
  private issues: DashboardIssue[] = [];
  private lastIssueKey: string | undefined;
  private currentFileOnly = false;
  private readonly statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    90
  );
  private readonly changedEmitter = new vscode.EventEmitter<void>();
  private readonly disposables: vscode.Disposable[] = [];

  readonly onDidChange = this.changedEmitter.event;

  constructor() {
    this.statusBar.command = DASHBOARD_COMMANDS.nextIssue;
    this.statusBar.name = 'SonarQube issue navigation';
    this.disposables.push(
      this.statusBar,
      this.changedEmitter,
      vscode.window.onDidChangeActiveTextEditor(() => this.updateStatus()),
      vscode.window.onDidChangeTextEditorSelection(() => this.updateStatus())
    );
    this.updateStatus();
  }

  setIssues(issues: readonly DashboardIssue[]): void {
    this.issues = [...issues].sort((left, right) =>
      left.fileUri.localeCompare(right.fileUri) ||
      left.line - right.line ||
      right.severityRank - left.severityRank
    );
    if (this.lastIssueKey && !this.issues.some(issue => issue.key === this.lastIssueKey)) {
      this.lastIssueKey = undefined;
    }
    this.changedEmitter.fire();
    this.updateStatus();
  }

  clear(): void {
    this.issues = [];
    this.lastIssueKey = undefined;
    this.changedEmitter.fire();
    this.updateStatus();
  }

  getIssues(): DashboardIssue[] {
    return [...this.filteredIssues()];
  }

  isCurrentFileOnly(): boolean {
    return this.currentFileOnly;
  }

  toggleCurrentFileOnly(): boolean {
    this.currentFileOnly = !this.currentFileOnly;
    this.changedEmitter.fire();
    this.updateStatus();
    return this.currentFileOnly;
  }

  async next(): Promise<void> {
    await this.move(1, () => true);
  }

  async previous(): Promise<void> {
    await this.move(-1, () => true);
  }

  async nextSameType(): Promise<void> {
    const current = this.currentIssue();
    if (!current) {
      await this.next();
      return;
    }
    await this.move(1, issue => issue.type === current.type);
  }

  async nextCritical(): Promise<void> {
    await this.move(1, issue =>
      ['BLOCKER', 'CRITICAL', 'HIGH'].includes(issue.severity.toUpperCase())
    );
  }

  async open(issue: DashboardIssue): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(issue.fileUri));
      const editor = await vscode.window.showTextDocument(document, {
        preview: false,
        preserveFocus: false
      });
      const line = Math.min(
        Math.max(0, issue.line - 1),
        Math.max(0, document.lineCount - 1)
      );
      const position = new vscode.Position(line, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenterIfOutsideViewport
      );
      this.lastIssueKey = issue.key;
      this.updateStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await vscode.window.showErrorMessage(message);
    }
  }

  find(key: string): DashboardIssue | undefined {
    return this.issues.find(issue => issue.key === key);
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private filteredIssues(): DashboardIssue[] {
    if (!this.currentFileOnly) {
      return this.issues;
    }
    const uri = vscode.window.activeTextEditor?.document.uri.toString();
    return uri ? this.issues.filter(issue => issue.fileUri === uri) : [];
  }

  private currentIssue(): DashboardIssue | undefined {
    const issues = this.filteredIssues();
    if (issues.length === 0) {
      return undefined;
    }
    if (this.lastIssueKey) {
      const remembered = issues.find(issue => issue.key === this.lastIssueKey);
      if (remembered) {
        return remembered;
      }
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return issues[0];
    }
    const uri = editor.document.uri.toString();
    const line = editor.selection.active.line + 1;
    const sameFile = issues.filter(issue => issue.fileUri === uri);
    return sameFile.find(issue => issue.line >= line) ?? sameFile.at(-1) ?? issues[0];
  }

  private async move(
    direction: 1 | -1,
    predicate: (issue: DashboardIssue) => boolean
  ): Promise<void> {
    const issues = this.filteredIssues().filter(predicate);
    if (issues.length === 0) {
      const spanish = getDashboardLanguage() === 'es';
      await vscode.window.showInformationMessage(
        spanish ? 'No hay defectos que coincidan con este filtro.' : 'No issues match this filter.'
      );
      return;
    }
    const current = this.currentIssue();
    const index = current ? issues.findIndex(issue => issue.key === current.key) : -1;
    const targetIndex = index < 0
      ? (direction > 0 ? 0 : issues.length - 1)
      : (index + direction + issues.length) % issues.length;
    await this.open(issues[targetIndex]);
  }

  private updateStatus(): void {
    const spanish = getDashboardLanguage() === 'es';
    const issues = this.filteredIssues();
    if (issues.length === 0) {
      this.statusBar.hide();
      return;
    }
    const current = this.currentIssue();
    const index = current ? Math.max(0, issues.findIndex(issue => issue.key === current.key)) : 0;
    this.statusBar.text = `$(issues) ${index + 1}/${issues.length}`;
    this.statusBar.tooltip = this.currentFileOnly
      ? (spanish ? 'Defectos del archivo actual · clic para ir al siguiente' : 'Current-file issues · click to go to the next issue')
      : (spanish ? 'Defectos de SonarQube · clic para ir al siguiente' : 'SonarQube issues · click to go to the next issue');
    this.statusBar.show();
  }
}
