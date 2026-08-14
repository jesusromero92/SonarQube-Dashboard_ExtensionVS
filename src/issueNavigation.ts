import * as vscode from 'vscode';
import { DASHBOARD_COMMANDS } from './constants';
import { getDashboardLanguage } from './i18n';
import { DashboardIssue } from './types';

export class IssueNavigationManager implements vscode.Disposable {
  private issues: DashboardIssue[] = [];
  private overallIssues: DashboardIssue[] = [];
  private newCodeIssues: DashboardIssue[] = [];
  private scope: 'overall' | 'newCode' = 'overall';
  private lastIssueKey: string | undefined;
  private currentFileOnly = false;
  private activeEditorEntryUri: string | undefined;
  private revealedForActiveEditorUri: string | undefined;
  private explicitNavigation = false;
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
      vscode.window.onDidChangeActiveTextEditor(editor => {
        this.activeEditorEntryUri = editor?.document.uri.toString();
        this.revealedForActiveEditorUri = undefined;
        this.updateStatus();
        if (editor) {
          this.revealFirstSonarProblem(editor);
        }
      }),
      vscode.window.onDidChangeTextEditorSelection(() => this.updateStatus()),
      vscode.languages.onDidChangeDiagnostics(event => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          return;
        }
        const activeUri = editor.document.uri.toString();
        if (event.uris.some(uri => uri.toString() === activeUri)) {
          this.revealFirstSonarProblem(editor);
        }
      })
    );
    this.updateStatus();
  }

  setIssues(
    overallIssues: readonly DashboardIssue[],
    newCodeIssues: readonly DashboardIssue[] = []
  ): void {
    const sortIssues = (issues: readonly DashboardIssue[]) => [...issues].sort((left, right) =>
      left.fileUri.localeCompare(right.fileUri) ||
      left.line - right.line ||
      right.severityRank - left.severityRank
    );
    this.overallIssues = sortIssues(overallIssues);
    this.newCodeIssues = sortIssues(newCodeIssues);
    this.issues = this.scope === 'newCode' ? this.newCodeIssues : this.overallIssues;
    if (this.lastIssueKey && !this.issues.some(issue => issue.key === this.lastIssueKey)) {
      this.lastIssueKey = undefined;
    }
    this.changedEmitter.fire();
    this.updateStatus();
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      this.revealFirstSonarProblem(editor);
    }
  }

  clear(): void {
    this.overallIssues = [];
    this.newCodeIssues = [];
    this.issues = [];
    this.lastIssueKey = undefined;
    this.changedEmitter.fire();
    this.updateStatus();
  }

  getIssues(): DashboardIssue[] {
    return [...this.filteredIssues()];
  }

  setScope(scope: 'overall' | 'newCode'): void {
    if (this.scope === scope) {
      return;
    }
    this.scope = scope;
    this.issues = scope === 'newCode' ? this.newCodeIssues : this.overallIssues;
    if (this.lastIssueKey && !this.issues.some(issue => issue.key === this.lastIssueKey)) {
      this.lastIssueKey = undefined;
    }
    this.changedEmitter.fire();
    this.updateStatus();
  }

  refreshLanguage(): void {
    this.changedEmitter.fire();
    this.updateStatus();
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
    this.explicitNavigation = true;
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
      this.activeEditorEntryUri = issue.fileUri;
      this.revealedForActiveEditorUri = issue.fileUri;
      this.updateStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await vscode.window.showErrorMessage(message);
    } finally {
      this.explicitNavigation = false;
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

  private revealFirstSonarProblem(editor: vscode.TextEditor): void {
    if (this.explicitNavigation || editor.document.uri.scheme !== 'file') {
      return;
    }

    const uri = editor.document.uri.toString();
    if (this.activeEditorEntryUri !== uri) {
      this.activeEditorEntryUri = uri;
      this.revealedForActiveEditorUri = undefined;
    }
    if (this.revealedForActiveEditorUri === uri) {
      return;
    }

    const diagnostics = vscode.languages.getDiagnostics(editor.document.uri)
      .filter(diagnostic => diagnostic.source === 'SonarQube Dashboard')
      .sort(compareDiagnosticPosition);
    const first = diagnostics[0];
    if (!first || vscode.window.activeTextEditor !== editor) {
      return;
    }

    const position = first.range.start;
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(
      first.range,
      vscode.TextEditorRevealType.InCenterIfOutsideViewport
    );
    this.revealedForActiveEditorUri = uri;

    const issueKey = diagnosticCode(first);
    if (issueKey && this.overallIssues.some(issue => issue.key === issueKey)) {
      this.lastIssueKey = issueKey;
      this.updateStatus();
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
      ? initialIssueIndex(direction, issues.length)
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
    this.statusBar.tooltip = issueNavigationTooltip(spanish, this.currentFileOnly);
    this.statusBar.show();
  }
}

function compareDiagnosticPosition(
  left: vscode.Diagnostic,
  right: vscode.Diagnostic
): number {
  return left.range.start.line - right.range.start.line
    || left.range.start.character - right.range.start.character
    || left.severity - right.severity;
}

function diagnosticCode(diagnostic: vscode.Diagnostic): string | undefined {
  if (typeof diagnostic.code === 'string') {
    return diagnostic.code;
  }
  if (typeof diagnostic.code === 'number') {
    return String(diagnostic.code);
  }
  return diagnostic.code?.value === undefined
    ? undefined
    : String(diagnostic.code.value);
}

function initialIssueIndex(direction: 1 | -1, issueCount: number): number {
  return direction > 0 ? 0 : issueCount - 1;
}

function issueNavigationTooltip(spanish: boolean, currentFileOnly: boolean): string {
  if (spanish) {
    return currentFileOnly
      ? 'Defectos del archivo actual · clic para ir al siguiente'
      : 'Defectos de SonarQube · clic para ir al siguiente';
  }
  return currentFileOnly
    ? 'Current-file issues · click to go to the next issue'
    : 'SonarQube issues · click to go to the next issue';
}
