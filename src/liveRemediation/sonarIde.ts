import * as vscode from 'vscode';
import { SONARQUBE_FOR_IDE_EXTENSION_ID } from './constants';
import {
  diagnosticCode,
  externalDiagnosticsSignature,
  isExternalSonarDiagnostic,
  normalizedRuleCandidates
} from './diagnostics';
import { TrackedIssue } from './models';

export class SonarIdeDiagnosticsObserver {
  private readonly lastSignatureByUri = new Map<string, string>();

  isActive(): boolean {
    return vscode.extensions.getExtension(SONARQUBE_FOR_IDE_EXTENSION_ID)?.isActive === true;
  }

  getExternalDiagnostics(uri: vscode.Uri): vscode.Diagnostic[] {
    return vscode.languages.getDiagnostics(uri).filter(isExternalSonarDiagnostic);
  }

  /**
   * Returns true only when the external Sonar diagnostics changed since the last
   * observation. Dashboard-owned marker updates therefore do not trigger a new
   * delayed evaluation cycle.
   */
  hasExternalSnapshotChanged(uri: vscode.Uri): boolean {
    if (!this.isActive()) return false;
    const diagnostics = this.getExternalDiagnostics(uri);
    const signature = externalDiagnosticsSignature(diagnostics);
    const key = uri.toString();
    if (this.lastSignatureByUri.get(key) === signature) {
      return false;
    }
    this.lastSignatureByUri.set(key, signature);
    return true;
  }

  rememberCurrentSnapshot(uri: vscode.Uri): vscode.Diagnostic[] {
    const diagnostics = this.getExternalDiagnostics(uri);
    this.lastSignatureByUri.set(uri.toString(), externalDiagnosticsSignature(diagnostics));
    return diagnostics;
  }

  forget(): void {
    this.lastSignatureByUri.clear();
  }
}

/**
 * Matches external Sonar diagnostics one-to-one with synchronized server issues.
 * Greedy matching by rule and nearest position avoids assigning the same IDE
 * diagnostic to two adjacent findings of the same rule.
 */
export function matchExternalDiagnostics(
  trackedIssues: readonly TrackedIssue[],
  diagnostics: readonly vscode.Diagnostic[],
  toleranceLines = 3
): Map<string, vscode.Diagnostic> {
  const candidates: Array<{
    tracked: TrackedIssue;
    diagnostic: vscode.Diagnostic;
    score: number;
  }> = [];

  for (const tracked of trackedIssues) {
    const ruleCandidates = normalizedRuleCandidates(tracked.issue.rule);
    for (const diagnostic of diagnostics) {
      const code = diagnosticCode(diagnostic);
      if (!code) continue;
      const matchesRule = [...normalizedRuleCandidates(code)]
        .some(candidate => ruleCandidates.has(candidate));
      if (!matchesRule) continue;

      const score = rangeDistance(tracked.range, diagnostic.range);
      if (score > toleranceLines * 10000 + 9999) continue;
      candidates.push({ tracked, diagnostic, score });
    }
  }

  candidates.sort((left, right) => left.score - right.score);
  const result = new Map<string, vscode.Diagnostic>();
  const usedDiagnostics = new Set<vscode.Diagnostic>();

  for (const candidate of candidates) {
    if (result.has(candidate.tracked.issue.key) || usedDiagnostics.has(candidate.diagnostic)) {
      continue;
    }
    result.set(candidate.tracked.issue.key, candidate.diagnostic);
    usedDiagnostics.add(candidate.diagnostic);
  }

  return result;
}

function rangeDistance(left: vscode.Range, right: vscode.Range): number {
  if (left.intersection(right)) return 0;
  const lineDistance = Math.abs(left.start.line - right.start.line);
  const characterDistance = left.start.line === right.start.line
    ? Math.abs(left.start.character - right.start.character)
    : 0;
  return lineDistance * 10000 + Math.min(characterDistance, 9999);
}
