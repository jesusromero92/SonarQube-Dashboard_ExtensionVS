import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  DashboardIssue,
  DashboardSeverity,
  LoadedIssues,
  PublishResult,
  SonarImpact,
  SonarInstanceMode,
  SonarIssue
} from './types';

const SEVERITY_RANKS: Record<string, number> = {
  BLOCKER: 100,
  CRITICAL: 90,
  HIGH: 90,
  MAJOR: 70,
  MEDIUM: 70,
  MINOR: 50,
  LOW: 50,
  INFO: 30,
  UNKNOWN: 0
};

function highestImpact(impacts: SonarImpact[] | undefined): string | undefined {
  return [...(impacts ?? [])]
    .map(impact => impact.severity?.trim().toUpperCase())
    .filter((severity): severity is string => Boolean(severity))
    .sort((left, right) => issueSeverityRank(right) - issueSeverityRank(left))[0];
}

export function issueSeverityLabel(
  issue: SonarIssue,
  instanceMode: SonarInstanceMode
): DashboardSeverity {
  const standardSeverity = issue.severity?.trim().toUpperCase();
  const impactSeverity = highestImpact(issue.impacts);

  if (instanceMode === 'MQR') {
    return impactSeverity || standardSeverity || 'UNKNOWN';
  }

  if (instanceMode === 'STANDARD') {
    return standardSeverity || impactSeverity || 'UNKNOWN';
  }

  return impactSeverity || standardSeverity || 'UNKNOWN';
}

export function issueSeverityRank(severity: DashboardSeverity): number {
  return SEVERITY_RANKS[severity.toUpperCase()] ?? 10;
}

function vscodeSeverity(
  issue: SonarIssue,
  instanceMode: SonarInstanceMode
): vscode.DiagnosticSeverity {
  const severity = issueSeverityLabel(issue, instanceMode).toUpperCase();

  switch (severity) {
    case 'BLOCKER':
    case 'CRITICAL':
    case 'HIGH':
      return vscode.DiagnosticSeverity.Error;
    case 'MAJOR':
    case 'MEDIUM':
      return vscode.DiagnosticSeverity.Warning;
    case 'MINOR':
    case 'LOW':
      return vscode.DiagnosticSeverity.Information;
    default:
      return vscode.DiagnosticSeverity.Hint;
  }
}

function issueRange(issue: SonarIssue): vscode.Range {
  if (issue.textRange) {
    const startLine = Math.max(0, issue.textRange.startLine - 1);
    const endLine = Math.max(startLine, issue.textRange.endLine - 1);
    const startCharacter = Math.max(0, issue.textRange.startOffset);
    const endCharacter =
      endLine === startLine
        ? Math.max(startCharacter + 1, issue.textRange.endOffset)
        : Math.max(0, issue.textRange.endOffset);

    return new vscode.Range(
      startLine,
      startCharacter,
      endLine,
      endCharacter
    );
  }

  const line = Math.max(0, (issue.line ?? 1) - 1);
  return new vscode.Range(line, 0, line, 1);
}

function normalizeRelativePath(candidate: string): string | undefined {
  const unixPath = candidate.replace(/\\/g, '/').replace(/^\/+/, '');
  const normalized = path.posix.normalize(unixPath);

  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized)
  ) {
    return undefined;
  }

  return normalized;
}

function resolveIssuePath(
  issue: SonarIssue,
  projectKey: string,
  componentPaths: Map<string, string>
): string | undefined {
  const componentPath = componentPaths.get(issue.component);
  if (componentPath) {
    return normalizeRelativePath(componentPath);
  }

  const prefix = `${projectKey}:`;
  if (issue.component.startsWith(prefix)) {
    return normalizeRelativePath(issue.component.slice(prefix.length));
  }

  return undefined;
}

async function isFile(uri: vscode.Uri): Promise<boolean> {
  try {
    const stat = await vscode.workspace.fs.stat(uri);
    return (stat.type & vscode.FileType.File) !== 0;
  } catch {
    return false;
  }
}

export async function publishFolderDiagnostics(
  collection: vscode.DiagnosticCollection,
  folder: vscode.WorkspaceFolder,
  projectKey: string,
  baseDir: string | undefined,
  loaded: LoadedIssues
): Promise<PublishResult> {
  const diagnosticsByUri = new Map<string, vscode.Diagnostic[]>();
  const baseSegments = normalizeRelativePath(baseDir?.trim() || '')?.split('/') ?? [];
  const dashboardIssues: DashboardIssue[] = [];
  let published = 0;
  let skipped = 0;

  for (const issue of loaded.issues) {
    const relativePath = resolveIssuePath(
      issue,
      projectKey,
      loaded.componentPaths
    );

    if (!relativePath) {
      skipped += 1;
      continue;
    }

    const uri = vscode.Uri.joinPath(
      folder.uri,
      ...baseSegments,
      ...relativePath.split('/')
    );

    if (vscode.workspace.getWorkspaceFolder(uri)?.uri.toString() !== folder.uri.toString()) {
      skipped += 1;
      continue;
    }

    if (!(await isFile(uri))) {
      skipped += 1;
      continue;
    }

    const severity = issueSeverityLabel(issue, loaded.instanceMode);
    const diagnostic = new vscode.Diagnostic(
      issueRange(issue),
      `[${issue.rule}] ${issue.message}`,
      vscodeSeverity(issue, loaded.instanceMode)
    );

    diagnostic.source = 'Issue Dashboard';
    diagnostic.code = issue.key;

    const uriString = uri.toString();
    const current = diagnosticsByUri.get(uriString) ?? [];
    current.push(diagnostic);
    diagnosticsByUri.set(uriString, current);

    dashboardIssues.push({
      key: issue.key,
      rule: issue.rule,
      severity,
      severityRank: issueSeverityRank(severity),
      type: issue.type || 'ISSUE',
      message: issue.message,
      relativePath: [...baseSegments, ...relativePath.split('/')].join('/'),
      fileUri: uriString,
      line: Math.max(1, issue.textRange?.startLine ?? issue.line ?? 1)
    });

    published += 1;
  }

  for (const [uriString, fileDiagnostics] of diagnosticsByUri) {
    collection.set(vscode.Uri.parse(uriString), fileDiagnostics);
  }

  return { published, skipped, issues: dashboardIssues };
}
