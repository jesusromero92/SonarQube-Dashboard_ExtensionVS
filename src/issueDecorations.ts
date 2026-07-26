import * as vscode from 'vscode';
import {
  DASHBOARD_COLORS,
  DASHBOARD_COMMANDS,
  DASHBOARD_TYPE_ICON_FILES
} from './constants';
import { getDashboardLanguage } from './i18n';
import { DashboardHotspot, DashboardIssue } from './types';

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

function issueHover(issue: DashboardIssue, type: DecoratedIssueType): vscode.MarkdownString {
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
  private readonly disposables: vscode.Disposable[] = [];

  constructor(extensionUri: vscode.Uri) {
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
  }

  getIssue(key: string): DashboardIssue | undefined {
    return this.issuesByKey.get(key);
  }

  getHotspot(key: string): DashboardHotspot | undefined {
    return this.hotspotsByKey.get(key);
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
    this.refreshVisibleEditors();
  }

  refreshLanguage(): void {
    this.refreshVisibleEditors();
  }

  dispose(): void {
    this.clear();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }
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
    const issues = this.issuesByUri.get(editor.document.uri.toString()) ?? [];
    const hotspots = this.hotspotsByUri.get(editor.document.uri.toString()) ?? [];
    for (const issue of issues) {
      const type = normalizedIssueType(issue.type);
      if (!type) {
        continue;
      }
      const line = Math.min(
        Math.max(0, issue.line - 1),
        Math.max(0, editor.document.lineCount - 1)
      );
      const decoration: vscode.DecorationOptions = {
        range: editor.document.lineAt(line).range,
        hoverMessage: issueHover(issue, type)
      };
      grouped.get(type)?.push(decoration);
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
  }
}

export class SonarIssueCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  constructor(private readonly decorations: IssueDecorationManager) {}

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const spanish = getDashboardLanguage() === 'es';
    const issueActions = context.diagnostics
      .filter(diagnostic =>
        diagnostic.source === 'SonarQube Dashboard' &&
        typeof diagnostic.code === 'string'
      )
      .map(diagnostic => {
        const action = new vscode.CodeAction(
          spanish
            ? 'Gestionar defecto en SonarQube Dashboard'
            : 'Manage issue in SonarQube Dashboard',
          vscode.CodeActionKind.QuickFix
        );
        action.diagnostics = [diagnostic];
        action.command = {
          command: DASHBOARD_COMMANDS.showIssueDetail,
          title: action.title,
          arguments: [diagnostic.code]
        };
        return action;
      });
    const hotspotActions = this.decorations
      .getHotspotsAt(document.uri, range)
      .map(hotspot => {
        const action = new vscode.CodeAction(
          spanish
            ? 'Ver detalle del Security Hotspot'
            : 'View Security Hotspot details',
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
