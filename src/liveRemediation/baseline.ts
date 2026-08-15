import * as vscode from 'vscode';
import { IssueBaseline, SerializedRange, TrackedIssue } from './models';
import { clampRangeToDocument } from './rangeTracking';

const DIFF_CONTEXT_LINES = 2;

export async function captureIssueBaseline(
  issue: TrackedIssue
): Promise<IssueBaseline | undefined> {
  const uri = vscode.Uri.parse(issue.issue.fileUri);
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    let text = Buffer.from(bytes).toString('utf8');
    if (text.startsWith('\uFEFF')) text = text.slice(1);
    const languageId = vscode.workspace.textDocuments.find(
      document => document.uri.toString() === uri.toString()
    )?.languageId;
    return createBaseline(text, issue.baselineRange, languageId);
  } catch {
    return undefined;
  }
}

export function createBaseline(
  text: string,
  sourceRange: vscode.Range,
  languageId?: string
): IssueBaseline | undefined {
  const lines = splitLines(text);
  if (lines.length === 0) return undefined;
  const range = clampRangeToLines(sourceRange, lines);
  const blockStartLine = range.start.line;
  const blockEndLine = effectiveEndLine(range);
  const contextStartLine = Math.max(0, blockStartLine - DIFF_CONTEXT_LINES);
  const contextEndLine = Math.min(lines.length - 1, blockEndLine + DIFF_CONTEXT_LINES);

  return {
    range: serializeRange(range),
    blockStartLine,
    blockEndLine,
    blockLines: lines.slice(blockStartLine, blockEndLine + 1),
    contextStartLine,
    contextEndLine,
    contextLines: lines.slice(contextStartLine, contextEndLine + 1),
    beforeAnchor: blockStartLine > 0 ? lines[blockStartLine - 1] : undefined,
    afterAnchor: blockEndLine + 1 < lines.length ? lines[blockEndLine + 1] : undefined,
    languageId
  };
}

export function baselineRange(baseline: IssueBaseline): vscode.Range {
  return deserializeRange(baseline.range);
}

export function serializedRange(range: vscode.Range): SerializedRange {
  return serializeRange(range);
}

export function deserializeRange(range: SerializedRange): vscode.Range {
  return new vscode.Range(
    Math.max(0, range.startLine),
    Math.max(0, range.startCharacter),
    Math.max(0, range.endLine),
    Math.max(0, range.endCharacter)
  );
}

export function issueMatchesBaseline(
  document: vscode.TextDocument,
  tracked: TrackedIssue
): boolean {
  const baseline = tracked.baseline;
  if (!baseline) return false;
  return blockMatches(document, tracked.range, baseline)
    || blockMatches(document, tracked.baselineRange, baseline);
}


export function textMatchesBaseline(text: string, tracked: TrackedIssue): boolean {
  const baseline = tracked.baseline;
  if (!baseline) return false;
  const lines = splitLines(text);
  return textBlockMatches(lines, tracked.range, baseline)
    || textBlockMatches(lines, tracked.baselineRange, baseline);
}

export function currentIssueSnippet(
  document: vscode.TextDocument,
  tracked: TrackedIssue
): string {
  const baseline = tracked.baseline;
  if (!baseline) return '';
  const range = clampRangeToDocument(document, tracked.range);
  const start = Math.max(0, range.start.line - DIFF_CONTEXT_LINES);
  const end = Math.min(document.lineCount - 1, effectiveEndLine(range) + DIFF_CONTEXT_LINES);
  return documentLines(document, start, end).join('\n');
}

export function serverIssueSnippet(baseline: IssueBaseline): string {
  return baseline.contextLines.join('\n');
}

export function safeRevertRange(
  document: vscode.TextDocument,
  tracked: TrackedIssue
): vscode.Range | undefined {
  const baseline = tracked.baseline;
  if (!baseline) return undefined;

  // The live range can move or collapse after edits. Try it first, then the
  // immutable range from the server snapshot. In both cases the surrounding
  // anchors must still match, so falling back never turns into a blind revert.
  const candidates = [tracked.range, tracked.baselineRange];
  const visited = new Set<string>();
  for (const candidate of candidates) {
    const clamped = clampRangeToDocument(document, candidate);
    const id = `${clamped.start.line}:${clamped.start.character}:${clamped.end.line}:${clamped.end.character}`;
    if (visited.has(id)) continue;
    visited.add(id);
    const safe = anchoredReplacementRange(document, clamped, baseline);
    if (safe) return safe;
  }
  return undefined;
}

function anchoredReplacementRange(
  document: vscode.TextDocument,
  current: vscode.Range,
  baseline: IssueBaseline
): vscode.Range | undefined {
  const blockStart = current.start.line;
  const blockEnd = effectiveEndLine(current);
  if (blockStart < 0 || blockEnd >= document.lineCount) return undefined;

  if (baseline.beforeAnchor !== undefined) {
    if (blockStart === 0 || document.lineAt(blockStart - 1).text !== baseline.beforeAnchor) {
      return undefined;
    }
  }
  if (baseline.afterAnchor !== undefined) {
    if (blockEnd + 1 >= document.lineCount || document.lineAt(blockEnd + 1).text !== baseline.afterAnchor) {
      return undefined;
    }
  }

  const start = new vscode.Position(blockStart, 0);
  const endLine = document.lineAt(blockEnd);
  const end = blockEnd + 1 < document.lineCount
    ? new vscode.Position(blockEnd + 1, 0)
    : new vscode.Position(blockEnd, endLine.text.length);
  return new vscode.Range(start, end);
}

export function baselineReplacementText(
  document: vscode.TextDocument,
  baseline: IssueBaseline,
  replacementRange: vscode.Range
): string {
  const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
  const body = baseline.blockLines.join(eol);
  const replacesThroughNextLine = replacementRange.end.line > replacementRange.start.line
    && replacementRange.end.character === 0;
  return replacesThroughNextLine ? `${body}${eol}` : body;
}


function textBlockMatches(
  lines: readonly string[],
  sourceRange: vscode.Range,
  baseline: IssueBaseline
): boolean {
  if (lines.length === 0) return baseline.blockLines.length === 0;
  const start = Math.min(Math.max(0, sourceRange.start.line), lines.length - 1);
  const expectedEnd = start + baseline.blockLines.length - 1;
  if (expectedEnd >= lines.length) return false;
  return arraysEqual(lines.slice(start, expectedEnd + 1), baseline.blockLines);
}

function blockMatches(
  document: vscode.TextDocument,
  sourceRange: vscode.Range,
  baseline: IssueBaseline
): boolean {
  if (document.lineCount === 0) return baseline.blockLines.length === 0;
  const range = clampRangeToDocument(document, sourceRange);
  const start = range.start.line;
  const expectedEnd = start + baseline.blockLines.length - 1;
  if (expectedEnd >= document.lineCount) return false;
  const current = documentLines(document, start, expectedEnd);
  return arraysEqual(current, baseline.blockLines);
}


function effectiveEndLine(range: vscode.Range): number {
  if (range.end.line > range.start.line && range.end.character === 0) {
    return range.end.line - 1;
  }
  return Math.max(range.start.line, range.end.line);
}

function documentLines(document: vscode.TextDocument, start: number, end: number): string[] {
  const result: string[] = [];
  for (let line = start; line <= end; line += 1) result.push(document.lineAt(line).text);
  return result;
}

function clampRangeToLines(range: vscode.Range, lines: readonly string[]): vscode.Range {
  const maxLine = Math.max(0, lines.length - 1);
  const startLine = Math.min(Math.max(0, range.start.line), maxLine);
  const endLine = Math.min(Math.max(startLine, range.end.line), maxLine);
  const startCharacter = Math.min(Math.max(0, range.start.character), lines[startLine].length);
  const endCharacter = Math.min(Math.max(0, range.end.character), lines[endLine].length);
  return new vscode.Range(startLine, startCharacter, endLine, endCharacter);
}

function splitLines(text: string): string[] {
  return text.replaceAll('\r\n', '\n').split('\n');
}

function serializeRange(range: vscode.Range): SerializedRange {
  return {
    startLine: range.start.line,
    startCharacter: range.start.character,
    endLine: range.end.line,
    endCharacter: range.end.character
  };
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
