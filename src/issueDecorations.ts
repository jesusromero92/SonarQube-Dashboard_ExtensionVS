import * as vscode from 'vscode';
import {
  DASHBOARD_COLORS,
  DASHBOARD_COMMANDS,
  DASHBOARD_TYPE_ICON_FILES
} from './constants';
import { getDashboardLanguage } from './i18n';
import { DashboardHotspot, DashboardIssue, IssueLocalRemediationState } from './types';

type DecoratedIssueType =
  | 'BUG'
  | 'CODE_SMELL'
  | 'VULNERABILITY'
  | 'SECURITY_HOTSPOT';

const DECORATED_ISSUE_TYPES: readonly DecoratedIssueType[] = [
  'BUG',
  'CODE_SMELL',
  'VULNERABILITY',
  'SECURITY_HOTSPOT'
];

function normalizedIssueType(type: string): DecoratedIssueType | undefined {
  const normalized = type.trim().toUpperCase();
  return DECORATED_ISSUE_TYPES.find(candidate => candidate === normalized);
}

function transparent(color: string): string {
  return `${color}1f`;
}

function locallyFixedLabel(spanish: boolean): string {
  return spanish
    ? '✓ Corregido localmente · pendiente de confirmación de SonarQube'
    : '✓ Fixed locally · awaiting SonarQube confirmation';
}

function typeLabel(type: DecoratedIssueType, spanish: boolean): string {
  switch (type) {
    case 'BUG':
      return 'Bug';
    case 'CODE_SMELL':
      return 'Code Smell';
    case 'VULNERABILITY':
      return spanish ? 'Vulnerabilidad' : 'Vulnerability';
    case 'SECURITY_HOTSPOT':
      return 'Security Hotspot';
  }
}

function appendHoverField(
  hover: vscode.MarkdownString,
  label: string,
  value: string | number | undefined
): void {
  if (value === undefined || value === '') {
    return;
  }
  hover.appendMarkdown(`**${label}:** `);
  hover.appendText(String(value));
  hover.appendMarkdown('  \n');
}

function issueHover(
  issue: DashboardIssue,
  type: DecoratedIssueType,
  localState: IssueLocalRemediationState = 'server'
): vscode.MarkdownString {
  const spanish = getDashboardLanguage() === 'es';
  const hover = new vscode.MarkdownString(undefined, true);
  hover.isTrusted = {
    enabledCommands: [DASHBOARD_COMMANDS.showIssueDetail]
  };
  hover.appendMarkdown(`**${issue.ruleName || issue.rule}**\n\n`);
  hover.appendMarkdown(`**${spanish ? 'Descripción' : 'Description'}**\n\n`);
  hover.appendText(issue.message || (spanish ? 'Sin descripción.' : 'No description.'));
  hover.appendMarkdown('\n\n---\n\n');
  appendHoverField(hover, spanish ? 'Tipo' : 'Type', typeLabel(type, spanish));
  appendHoverField(hover, spanish ? 'Severidad' : 'Severity', issue.severity);
  appendHoverField(hover, spanish ? 'Estado' : 'Status', issue.status);
  if (localState !== 'server') {
    appendHoverField(
      hover,
      spanish ? 'Estado local' : 'Local state',
      localState === 'locallyFixed'
        ? locallyFixedLabel(spanish).replace(/^✓\s*/, '')
        : (spanish ? 'Modificado localmente · pendiente de validación' : 'Modified locally · pending validation')
    );
  }
  appendHoverField(hover, spanish ? 'Archivo' : 'File', issue.relativePath);
  appendHoverField(hover, spanish ? 'Línea' : 'Line', issue.line);
  appendHoverField(hover, spanish ? 'Regla' : 'Rule', issue.rule);
  appendHoverField(hover, spanish ? 'Proyecto' : 'Project', issue.project);
  appendHoverField(hover, spanish ? 'Componente' : 'Component', issue.component);
  appendHoverField(hover, 'Issue key', issue.key);
  if (issue.impacts.length > 0) {
    appendHoverField(
      hover,
      spanish ? 'Impactos' : 'Impacts',
      issue.impacts
        .map(impact => `${impact.softwareQuality}: ${impact.severity}`)
        .join(', ')
    );
  }
  const commandArguments = encodeURIComponent(JSON.stringify([issue.key]));
  hover.appendMarkdown(
    `\n\n[${
      spanish ? 'Gestionar defecto en SonarQube Dashboard' : 'Manage issue in SonarQube Dashboard'
    }](command:${DASHBOARD_COMMANDS.showIssueDetail}?${commandArguments})`
  );
  return hover;
}

function hotspotHover(hotspot: DashboardHotspot): vscode.MarkdownString {
  const spanish = getDashboardLanguage() === 'es';
  const hover = new vscode.MarkdownString(undefined, true);
  hover.isTrusted = {
    enabledCommands: [DASHBOARD_COMMANDS.showHotspotDetail]
  };
  hover.appendMarkdown(`**${hotspot.message || hotspot.ruleKey || 'Security Hotspot'}**\n\n`);
  hover.appendMarkdown(`**${spanish ? 'Descripción' : 'Description'}**\n\n`);
  hover.appendText(hotspot.message || (spanish ? 'Sin descripción.' : 'No description.'));
  hover.appendMarkdown('\n\n---\n\n');
  appendHoverField(hover, spanish ? 'Tipo' : 'Type', 'Security Hotspot');
  appendHoverField(hover, spanish ? 'Prioridad' : 'Priority', hotspot.priority || 'UNKNOWN');
  appendHoverField(hover, spanish ? 'Estado' : 'Status', hotspot.status || 'TO_REVIEW');
  appendHoverField(hover, spanish ? 'Resolución' : 'Resolution', hotspot.resolution);
  appendHoverField(hover, spanish ? 'Archivo' : 'File', hotspot.relativePath);
  appendHoverField(hover, spanish ? 'Línea' : 'Line', hotspot.line);
  appendHoverField(hover, spanish ? 'Regla' : 'Rule', hotspot.ruleKey);
  appendHoverField(hover, spanish ? 'Proyecto' : 'Project', hotspot.project);
  appendHoverField(hover, spanish ? 'Componente' : 'Component', hotspot.component);
  appendHoverField(hover, 'Hotspot key', hotspot.key);
  const commandArguments = encodeURIComponent(JSON.stringify([hotspot.key]));
  hover.appendMarkdown(
    `[${
      spanish ? 'Ver detalle en SonarQube Dashboard' : 'View details in SonarQube Dashboard'
    }](command:${DASHBOARD_COMMANDS.showHotspotDetail}?${commandArguments})`
  );
  return hover;
}

export class IssueDecorationManager implements vscode.Disposable {
  private readonly decorationTypes = new Map<
    DecoratedIssueType,
    vscode.TextEditorDecorationType
  >();
  private readonly issuesByUri = new Map<string, DashboardIssue[]>();
  private readonly issuesByKey = new Map<string, DashboardIssue>();
  private readonly hotspotsByUri = new Map<string, DashboardHotspot[]>();
  private readonly hotspotsByKey = new Map<string, DashboardHotspot>();
  private readonly localStates = new Map<string, IssueLocalRemediationState>();
  private readonly localRanges = new Map<string, vscode.Range>();
  private readonly modifiedDecorationType: vscode.TextEditorDecorationType;
  private readonly locallyFixedDecorationType: vscode.TextEditorDecorationType;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly dataChangedEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeData = this.dataChangedEmitter.event;

  constructor(extensionUri: vscode.Uri) {
    this.modifiedDecorationType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: transparent(DASHBOARD_COLORS.types.CODE_SMELL),
      borderColor: DASHBOARD_COLORS.types.CODE_SMELL,
      borderStyle: 'solid',
      borderWidth: '0 0 0 3px',
      overviewRulerColor: DASHBOARD_COLORS.types.CODE_SMELL,
      overviewRulerLane: vscode.OverviewRulerLane.Right
    });
    this.locallyFixedDecorationType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
      backgroundColor: transparent(DASHBOARD_COLORS.qualityGate.OK),
      borderColor: DASHBOARD_COLORS.qualityGate.OK,
      borderStyle: 'solid',
      borderWidth: '0 0 0 3px',
      overviewRulerColor: DASHBOARD_COLORS.qualityGate.OK,
      overviewRulerLane: vscode.OverviewRulerLane.Right
    });

    for (const type of DECORATED_ISSUE_TYPES) {
      const color = DASHBOARD_COLORS.types[type];
      this.decorationTypes.set(
        type,
        vscode.window.createTextEditorDecorationType({
          isWholeLine: true,
          backgroundColor: transparent(color),
          borderColor: color,
          borderStyle: 'solid',
          borderWidth: '0 0 0 3px',
          overviewRulerColor: color,
          overviewRulerLane: vscode.OverviewRulerLane.Right,
          gutterIconPath: vscode.Uri.joinPath(
            extensionUri,
            'assets',
            DASHBOARD_TYPE_ICON_FILES[type]
          ),
          gutterIconSize: '12px'
        })
      );
    }

    this.disposables.push(
      vscode.window.onDidChangeVisibleTextEditors(editors => {
        for (const editor of editors) {
          this.decorate(editor);
        }
      })
    );
  }

  setIssues(
    issues: readonly DashboardIssue[],
    hotspots: readonly DashboardHotspot[] = []
  ): void {
    this.issuesByUri.clear();
    this.issuesByKey.clear();
    this.hotspotsByUri.clear();
    this.hotspotsByKey.clear();

    for (const issue of issues) {
      const current = this.issuesByUri.get(issue.fileUri) ?? [];
      current.push(issue);
      this.issuesByUri.set(issue.fileUri, current);
      this.issuesByKey.set(issue.key, issue);
    }

    for (const hotspot of hotspots) {
      const current = this.hotspotsByUri.get(hotspot.fileUri) ?? [];
      current.push(hotspot);
      this.hotspotsByUri.set(hotspot.fileUri, current);
      this.hotspotsByKey.set(hotspot.key, hotspot);
    }

    this.refreshVisibleEditors();
    this.dataChangedEmitter.fire();
  }

  setLocalRemediation(
    states: ReadonlyMap<string, IssueLocalRemediationState>,
    ranges: ReadonlyMap<string, vscode.Range>
  ): void {
    this.localStates.clear();
    this.localRanges.clear();
    for (const [key, state] of states) this.localStates.set(key, state);
    for (const [key, range] of ranges) this.localRanges.set(key, range);
    this.refreshVisibleEditors();
    this.dataChangedEmitter.fire();
  }

  getLocalState(key: string): IssueLocalRemediationState {
    return this.localStates.get(key) ?? 'server';
  }

  getIssueRange(key: string, document: vscode.TextDocument): vscode.Range | undefined {
    const range = this.localRanges.get(key);
    if (!range) return undefined;
    const maxLine = Math.max(0, document.lineCount - 1);
    const startLine = Math.min(range.start.line, maxLine);
    const endLine = Math.min(range.end.line, maxLine);
    const start = new vscode.Position(startLine, Math.min(range.start.character, document.lineAt(startLine).text.length));
    const end = new vscode.Position(endLine, Math.min(range.end.character, document.lineAt(endLine).text.length));
    return new vscode.Range(start, end.isBefore(start) ? start : end);
  }

  getIssue(key: string): DashboardIssue | undefined {
    return this.issuesByKey.get(key);
  }

  getHotspot(key: string): DashboardHotspot | undefined {
    return this.hotspotsByKey.get(key);
  }

  getIssuesForUri(uri: vscode.Uri): readonly DashboardIssue[] {
    return this.issuesByUri.get(uri.toString()) ?? [];
  }

  getHotspotsForUri(uri: vscode.Uri): readonly DashboardHotspot[] {
    return this.hotspotsByUri.get(uri.toString()) ?? [];
  }

  getHotspotsAt(
    uri: vscode.Uri,
    range: vscode.Range | vscode.Selection
  ): DashboardHotspot[] {
    return (this.hotspotsByUri.get(uri.toString()) ?? []).filter(hotspot => {
      const line = Math.max(0, hotspot.line - 1);
      return line >= range.start.line && line <= range.end.line;
    });
  }

  clear(): void {
    this.issuesByUri.clear();
    this.issuesByKey.clear();
    this.hotspotsByUri.clear();
    this.hotspotsByKey.clear();
    this.localStates.clear();
    this.localRanges.clear();
    this.refreshVisibleEditors();
    this.dataChangedEmitter.fire();
  }

  refreshLanguage(): void {
    this.refreshVisibleEditors();
    this.dataChangedEmitter.fire();
  }

  dispose(): void {
    this.clear();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
    this.modifiedDecorationType.dispose();
    this.locallyFixedDecorationType.dispose();
    this.dataChangedEmitter.dispose();
  }

  private refreshVisibleEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.decorate(editor);
    }
  }

  private decorate(editor: vscode.TextEditor): void {
    const grouped = new Map<DecoratedIssueType, vscode.DecorationOptions[]>(
      DECORATED_ISSUE_TYPES.map(type => [type, []])
    );
    const modified: vscode.DecorationOptions[] = [];
    const locallyFixed: vscode.DecorationOptions[] = [];
    const issues = this.issuesByUri.get(editor.document.uri.toString()) ?? [];
    const hotspots = this.hotspotsByUri.get(editor.document.uri.toString()) ?? [];
    for (const issue of issues) {
      const type = normalizedIssueType(issue.type);
      if (!type) {
        continue;
      }
      const localState = this.getLocalState(issue.key);
      const trackedRange = this.getIssueRange(issue.key, editor.document);
      const line = Math.min(
        Math.max(0, issue.line - 1),
        Math.max(0, editor.document.lineCount - 1)
      );
      const decoration: vscode.DecorationOptions = {
        range: trackedRange ?? editor.document.lineAt(line).range,
        hoverMessage: issueHover(issue, type, localState),
        renderOptions: localState === 'locallyFixed'
          ? {
              after: {
                contentText: `  ${locallyFixedLabel(getDashboardLanguage() === 'es')}`,
                color: new vscode.ThemeColor('testing.iconPassed'),
                margin: '0 0 0 0.75rem'
              }
            }
          : undefined
      };
      if (localState === 'locallyFixed') {
        locallyFixed.push(decoration);
      } else if (localState === 'modified') {
        modified.push(decoration);
      } else {
        grouped.get(type)?.push(decoration);
      }
    }

    for (const hotspot of hotspots) {
      const type: DecoratedIssueType = 'SECURITY_HOTSPOT';
      const line = Math.min(
        Math.max(0, hotspot.line - 1),
        Math.max(0, editor.document.lineCount - 1)
      );
      const decoration: vscode.DecorationOptions = {
        range: editor.document.lineAt(line).range,
        hoverMessage: hotspotHover(hotspot)
      };
      grouped.get(type)?.push(decoration);
    }

    for (const type of DECORATED_ISSUE_TYPES) {
      const decorationType = this.decorationTypes.get(type);
      if (decorationType) {
        editor.setDecorations(decorationType, grouped.get(type) ?? []);
      }
    }
    editor.setDecorations(this.modifiedDecorationType, modified);
    editor.setDecorations(this.locallyFixedDecorationType, locallyFixed);
  }
}


export class SonarIssueCodeLensProvider
implements vscode.CodeLensProvider, vscode.Disposable {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private readonly subscription: vscode.Disposable;
  readonly onDidChangeCodeLenses = this.changeEmitter.event;

  constructor(private readonly decorations: IssueDecorationManager) {
    this.subscription = decorations.onDidChangeData(() => {
      this.changeEmitter.fire();
    });
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    for (const issue of this.decorations.getIssuesForUri(document.uri)) {
      const localState = this.decorations.getLocalState(issue.key);
      const trackedRange = this.decorations.getIssueRange(issue.key, document);
      const line = trackedRange?.start.line ?? clampLine(document, issue.line);
      const spanish = getDashboardLanguage() === 'es';
      const title = localState === 'locallyFixed'
        ? `$(pass-filled) ${locallyFixedLabel(spanish).replace(/^✓\s*/, '')}`
        : localState === 'modified'
          ? `$(edit) ${spanish ? 'Modificado localmente · pendiente de validación' : 'Modified locally · pending validation'}`
          : `${severityCodicon(issue.severity)} ${issue.severity} · ${issue.ruleName || issue.rule}`;
      const lens = new vscode.CodeLens(
        new vscode.Range(line, 0, line, 0),
        {
          command: DASHBOARD_COMMANDS.showIssueDetail,
          title,
          tooltip: issue.message,
          arguments: [issue.key]
        }
      );
      lenses.push(lens);
    }

    for (const hotspot of this.decorations.getHotspotsForUri(document.uri)) {
      const line = clampLine(document, hotspot.line);
      const priority = hotspot.priority || 'UNKNOWN';
      lenses.push(new vscode.CodeLens(
        new vscode.Range(line, 0, line, 0),
        {
          command: DASHBOARD_COMMANDS.showHotspotDetail,
          title: `$(flame) ${priority} · Security Hotspot`,
          tooltip: hotspot.message,
          arguments: [hotspot.key]
        }
      ));
    }

    return lenses.sort((left, right) =>
      left.range.start.line - right.range.start.line
    );
  }

  dispose(): void {
    this.subscription.dispose();
    this.changeEmitter.dispose();
  }
}

function clampLine(document: vscode.TextDocument, oneBasedLine: number): number {
  return Math.min(
    Math.max(0, oneBasedLine - 1),
    Math.max(0, document.lineCount - 1)
  );
}

function severityCodicon(severity: string): string {
  switch (severity.trim().toUpperCase()) {
    case 'BLOCKER':
    case 'CRITICAL':
      return '$(error)';
    case 'MAJOR':
      return '$(warning)';
    case 'MINOR':
    case 'INFO':
      return '$(info)';
    default:
      return '$(circle-outline)';
  }
}

export class SonarIssueCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  constructor(private readonly decorations: IssueDecorationManager) {}

  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): Promise<vscode.CodeAction[]> {
    const spanish = getDashboardLanguage() === 'es';
    const diagnosticsByIssue = new Map<string, vscode.Diagnostic>();

    for (const diagnostic of context.diagnostics) {
      if (
        diagnostic.source === 'SonarQube Dashboard' &&
        typeof diagnostic.code === 'string'
      ) {
        diagnosticsByIssue.set(diagnostic.code, diagnostic);
      }
    }

    const issueActions = [...diagnosticsByIssue.entries()].flatMap(
      ([issueKey, diagnostic]) => {
        const issue = this.decorations.getIssue(issueKey);
        if (!issue) {
          return [];
        }

        const actions: vscode.CodeAction[] = [
          issueCodeAction(
            spanish ? 'SonarQube: Ver regla' : 'SonarQube: View rule',
            DASHBOARD_COMMANDS.showRuleDetail,
            issue.key,
            diagnostic
          ),
          issueCodeAction(
            spanish ? 'SonarQube: Marcar como aceptado' : 'SonarQube: Mark as accepted',
            DASHBOARD_COMMANDS.acceptIssue,
            issue.key,
            diagnostic
          ),
          issueCodeAction(
            spanish ? 'SonarQube: Asignarme issue' : 'SonarQube: Assign issue to me',
            DASHBOARD_COMMANDS.assignIssueToMe,
            issue.key,
            diagnostic
          ),
          issueCodeAction(
            spanish ? 'SonarQube: Abrir en SonarQube' : 'SonarQube: Open in SonarQube',
            DASHBOARD_COMMANDS.openIssueInSonarQube,
            issue.key,
            diagnostic
          ),
          issueCodeAction(
            spanish
              ? 'SonarQube: Gestionar defecto en Dashboard'
              : 'SonarQube: Manage issue in Dashboard',
            DASHBOARD_COMMANDS.showIssueDetail,
            issue.key,
            diagnostic
          )
        ];


        return actions;
      }
    );

    const hotspotActions = this.decorations
      .getHotspotsAt(document.uri, range)
      .map(hotspot => {
        const action = new vscode.CodeAction(
          spanish
            ? 'SonarQube: Ver detalle del Security Hotspot'
            : 'SonarQube: View Security Hotspot details',
          vscode.CodeActionKind.QuickFix
        );
        action.command = {
          command: DASHBOARD_COMMANDS.showHotspotDetail,
          title: action.title,
          arguments: [hotspot.key]
        };
        return action;
      });

    return [...issueActions, ...hotspotActions];
  }
}

function issueCodeAction(
  title: string,
  command: string,
  issueKey: string,
  diagnostic: vscode.Diagnostic
): vscode.CodeAction {
  const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
  action.diagnostics = [diagnostic];
  action.command = {
    command,
    title,
    arguments: [issueKey]
  };
  return action;
}
