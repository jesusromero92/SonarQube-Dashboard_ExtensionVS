import * as vscode from 'vscode';

export function comparePositions(left: vscode.Position, right: vscode.Position): number {
  return left.line - right.line || left.character - right.character;
}

export function changeTouchesRange(
  change: vscode.TextDocumentContentChangeEvent,
  range: vscode.Range
): boolean {
  if (Boolean(range.intersection(change.range))
    || change.range.contains(range.start)
    || change.range.contains(range.end)) {
    return true;
  }

  // Sonar diagnostics can target only the offending token. VS Code may then
  // report a one-character insertion immediately before/after that range.
  return horizontalGap(change.range, range) <= 2;
}

function horizontalGap(left: vscode.Range, right: vscode.Range): number {
  if (left.end.line === right.start.line && left.end.character <= right.start.character) {
    return right.start.character - left.end.character;
  }
  if (right.end.line === left.start.line && right.end.character <= left.start.character) {
    return left.start.character - right.end.character;
  }
  return Number.POSITIVE_INFINITY;
}

export function transformRangeAfterChange(
  range: vscode.Range,
  change: Pick<vscode.TextDocumentContentChangeEvent, 'range' | 'text'>
): vscode.Range {
  const start = transformPositionAfterChange(range.start, change);
  const end = transformPositionAfterChange(range.end, change);
  return new vscode.Range(start, end.isBefore(start) ? start : end);
}

function transformPositionAfterChange(
  position: vscode.Position,
  change: Pick<vscode.TextDocumentContentChangeEvent, 'range' | 'text'>
): vscode.Position {
  const changedRange = change.range;
  if (position.isBefore(changedRange.start)) {
    return position;
  }

  const insertedEnd = insertedTextEnd(changedRange.start, change.text);
  if (changedRange.contains(position)) {
    return insertedEnd;
  }

  if (position.isEqual(changedRange.end) && !changedRange.isEmpty) {
    return insertedEnd;
  }

  const removedLines = changedRange.end.line - changedRange.start.line;
  const insertedLines = insertedEnd.line - changedRange.start.line;
  const lineDelta = insertedLines - removedLines;

  if (position.line > changedRange.end.line) {
    return new vscode.Position(position.line + lineDelta, position.character);
  }

  if (position.line === changedRange.end.line) {
    if (insertedLines === 0) {
      const removedCharacters = changedRange.end.character - changedRange.start.character;
      const insertedCharacters = insertedEnd.character - changedRange.start.character;
      return new vscode.Position(
        position.line + lineDelta,
        Math.max(0, position.character + insertedCharacters - removedCharacters)
      );
    }
    return new vscode.Position(
      position.line + lineDelta,
      Math.max(0, insertedEnd.character + (position.character - changedRange.end.character))
    );
  }

  return new vscode.Position(Math.max(0, position.line + lineDelta), position.character);
}

function insertedTextEnd(start: vscode.Position, text: string): vscode.Position {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length === 1) {
    return new vscode.Position(start.line, start.character + lines[0].length);
  }
  return new vscode.Position(start.line + lines.length - 1, lines.at(-1)?.length ?? 0);
}

export function clampRangeToDocument(
  document: vscode.TextDocument,
  range: vscode.Range
): vscode.Range {
  const maxLine = Math.max(0, document.lineCount - 1);
  const clampPosition = (position: vscode.Position): vscode.Position => {
    const line = Math.min(Math.max(0, position.line), maxLine);
    const maxCharacter = document.lineAt(line).text.length;
    return new vscode.Position(line, Math.min(Math.max(0, position.character), maxCharacter));
  };
  const start = clampPosition(range.start);
  const end = clampPosition(range.end);
  return new vscode.Range(start, end.isBefore(start) ? start : end);
}
