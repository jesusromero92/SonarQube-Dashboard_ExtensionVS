import * as vscode from 'vscode';
import { getDashboardLanguage } from '../i18n';
import { localIssueStateLabel } from '../issueLocalState';
import type { IssueDiagnosticSnapshot } from '../issueDiagnostics';
import { DASHBOARD_DIAGNOSTIC_SOURCE } from './constants';
import { TrackedIssue } from './models';

export function collectDiagnosticsByIssueKey(
  snapshot: IssueDiagnosticSnapshot
): Map<string, vscode.Diagnostic> {
  const result = new Map<string, vscode.Diagnostic>();
  for (const diagnostics of snapshot.values()) {
    for (const diagnostic of diagnostics) {
      const key = diagnosticCode(diagnostic);
      if (key) result.set(key, diagnostic);
    }
  }
  return result;
}

export function localStateLabel(
  state: Exclude<TrackedIssue['state'], 'server'>,
  spanish = getDashboardLanguage() === 'es'
): string {
  return localIssueStateLabel(state, spanish);
}

export function diagnosticMessage(tracked: TrackedIssue): string {
  if (tracked.state === 'server') {
    return tracked.serverMessage;
  }
  return `[${localStateLabel(tracked.state)}] ${tracked.serverMessage}`;
}

export function compareDiagnosticPosition(
  left: vscode.Diagnostic,
  right: vscode.Diagnostic
): number {
  return left.range.start.line - right.range.start.line
    || left.range.start.character - right.range.start.character
    || left.severity - right.severity;
}

export function isExternalSonarDiagnostic(diagnostic: vscode.Diagnostic): boolean {
  const source = diagnostic.source?.trim().toLowerCase() ?? '';
  return source !== DASHBOARD_DIAGNOSTIC_SOURCE.toLowerCase()
    && (source.includes('sonar') || source.includes('sonarlint'));
}

export function diagnosticCode(diagnostic: vscode.Diagnostic): string | undefined {
  if (typeof diagnostic.code === 'string' || typeof diagnostic.code === 'number') {
    return String(diagnostic.code);
  }
  return diagnostic.code?.value === undefined
    ? undefined
    : String(diagnostic.code.value);
}

export function normalizedRuleCandidates(value: string): Set<string> {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '');
  const result = new Set<string>();
  if (!normalized) return result;
  result.add(normalized);
  const suffix = normalized.split(':').at(-1);
  if (suffix) result.add(suffix);
  return result;
}

export function externalDiagnosticsSignature(diagnostics: readonly vscode.Diagnostic[]): string {
  return diagnostics
    .filter(isExternalSonarDiagnostic)
    .map(diagnostic => {
      const code = diagnosticCode(diagnostic) ?? '';
      const range = diagnostic.range;
      return `${diagnostic.source ?? ''}|${code}|${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
    })
    .sort((left, right) => left.localeCompare(right))
    .join('\n');
}
