import * as vscode from 'vscode';
import { DASHBOARD_COLORS, DASHBOARD_COMMANDS } from './constants';
import { getDashboardLanguage } from './i18n';
import { DashboardIssue, DashboardIssueLocation, IssueFlowRole } from './types';

function roleLabel(role: IssueFlowRole): string {
  const spanish = getDashboardLanguage() === 'es';
  switch (role) {
    case 'source': return spanish ? 'Origen' : 'Source';
    case 'sink': return 'Sink';
    case 'intermediate': return spanish ? 'Paso intermedio' : 'Intermediate step';
    default: return spanish ? 'Ubicación relacionada' : 'Related location';
  }
}

export class IssueFlowController implements vscode.CodeLensProvider, vscode.Disposable {
  private issue: DashboardIssue | undefined;
  private flowIndex = 0;
  private locationIndex = 0;
  private readonly codeLensEmitter = new vscode.EventEmitter<void>();
  private readonly decorationTypes = new Map<IssueFlowRole, vscode.TextEditorDecorationType>();
  private readonly disposables: vscode.Disposable[] = [];
  readonly onDidChangeCodeLenses = this.codeLensEmitter.event;

  constructor() {
    for (const role of ['source', 'intermediate', 'sink', 'related'] as const) {
      const color = DASHBOARD_COLORS.flows[role];
      this.decorationTypes.set(role, vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        borderStyle: 'dashed',
        borderWidth: '0 0 1px 0',
        borderColor: color,
        overviewRulerColor: color,
        overviewRulerLane: vscode.OverviewRulerLane.Center,
        after: {
          contentText: `  ${roleLabel(role)}`,
          color,
          fontStyle: 'italic'
        }
      }));
    }
    this.disposables.push(
      this.codeLensEmitter,
      vscode.window.onDidChangeVisibleTextEditors(() => this.refreshDecorations())
    );
  }

  setIssue(issue: DashboardIssue | undefined, flowIndex = 0): void {
    this.issue = issue;
    this.flowIndex = Math.max(0, Math.min(flowIndex, Math.max(0, (issue?.flows.length ?? 1) - 1)));
    this.locationIndex = 0;
    this.codeLensEmitter.fire();
    this.refreshDecorations();
  }

  getIssue(): DashboardIssue | undefined {
    return this.issue;
  }

  select(flowIndex: number, locationIndex: number): void {
    if (!this.issue) return;
    this.flowIndex = Math.max(0, Math.min(flowIndex, this.issue.flows.length - 1));
    const locations = this.currentLocations();
    this.locationIndex = Math.max(0, Math.min(locationIndex, Math.max(0, locations.length - 1)));
    this.codeLensEmitter.fire();
    this.refreshDecorations();
  }

  async next(): Promise<void> {
    await this.move(1);
  }

  async previous(): Promise<void> {
    await this.move(-1);
  }

  async openLocation(location: DashboardIssueLocation): Promise<void> {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(location.fileUri));
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    const line = Math.min(Math.max(0, location.line - 1), Math.max(0, document.lineCount - 1));
    const position = new vscode.Position(line, 0);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const locations = this.currentLocations();
    return locations
      .map((location, index) => ({ location, index }))
      .filter(item => item.location.fileUri === document.uri.toString())
      .map(({ location, index }) => {
        const line = Math.min(Math.max(0, location.line - 1), Math.max(0, document.lineCount - 1));
        const total = locations.length;
        return new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
          command: DASHBOARD_COMMANDS.openFlowLocation,
          title: `$(debug-step-over) ${roleLabel(location.role)} ${index + 1}/${total}${location.message ? ` · ${location.message}` : ''}`,
          arguments: [this.flowIndex, index]
        });
      });
  }

  clear(): void {
    this.setIssue(undefined);
  }

  dispose(): void {
    this.clear();
    for (const disposable of this.disposables) disposable.dispose();
    for (const decoration of this.decorationTypes.values()) decoration.dispose();
  }

  private currentLocations(): DashboardIssueLocation[] {
    if (!this.issue) return [];
    return this.issue.flows[this.flowIndex]?.locations ?? this.issue.secondaryLocations;
  }

  private async move(direction: 1 | -1): Promise<void> {
    const locations = this.currentLocations();
    if (locations.length === 0) {
      await vscode.window.showInformationMessage(
        getDashboardLanguage() === 'es'
          ? 'Este defecto no contiene un flujo de ejecución local.'
          : 'This issue has no local execution flow.'
      );
      return;
    }
    this.locationIndex = (this.locationIndex + direction + locations.length) % locations.length;
    this.refreshDecorations();
    this.codeLensEmitter.fire();
    await this.openLocation(locations[this.locationIndex]);
  }

  private refreshDecorations(): void {
    const locations = this.currentLocations();
    for (const editor of vscode.window.visibleTextEditors) {
      for (const role of ['source', 'intermediate', 'sink', 'related'] as const) {
        const options = locations
          .filter(location => location.role === role && location.fileUri === editor.document.uri.toString())
          .map(location => {
            const line = Math.min(Math.max(0, location.line - 1), Math.max(0, editor.document.lineCount - 1));
            return {
              range: editor.document.lineAt(line).range,
              hoverMessage: location.message || roleLabel(role)
            } satisfies vscode.DecorationOptions;
          });
        const decoration = this.decorationTypes.get(role);
        if (decoration) editor.setDecorations(decoration, options);
      }
    }
  }
}
