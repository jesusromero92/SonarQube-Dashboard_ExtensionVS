import type { PipelineFindingInput } from '../fingerprint';
import type { PipelineStructuredResultParser } from '../contracts';
import { createStructuredResult, emptyStructuredResult, relativeFindingFile } from '../fingerprint';
import { cleanOutput, compactMetrics, metric, severityFromText } from './common';

const PARSER_ID = 'react-doctor-text-v1';
const SOURCE_EXTENSION = /\.[cm]?[jt]sx?$/i;
const SEVERITY_WORD = /error|warning|warn|info|low|medium|high/i;

export const parseReactDoctorResult: PipelineStructuredResultParser = output => {
  const clean = cleanOutput(output);
  if (!clean) return emptyStructuredResult(output, PARSER_ID, 'partial', [], 'React Doctor no produjo salida.');

  const findings = clean
    .split(/\r?\n/)
    .map(line => reactDoctorFinding(output.cwd, line))
    .filter((finding): finding is PipelineFindingInput => Boolean(finding));

  const problems = firstLabelCount(clean, ['problems', 'problem', 'issues', 'issue', 'findings', 'finding']) ??
    firstCountBeforeLabel(clean, ['problems', 'problem', 'issues', 'issue', 'findings', 'finding']);
  const errors = firstLabelCount(clean, ['errors', 'error']);
  const warnings = firstLabelCount(clean, ['warnings', 'warning']);
  const metrics = compactMetrics(
    metric('problems', 'Problemas', problems ?? findings.length),
    metric('errors', 'Errores', errors),
    metric('warnings', 'Advertencias', warnings)
  );
  const message = findings.length > 0
    ? undefined
    : 'React Doctor no expone un formato normalizado en este paso; se conservaron las métricas reconocibles de su salida.';

  return createStructuredResult(
    output,
    PARSER_ID,
    findings.length > 0 ? 'parsed' : 'partial',
    findings,
    metrics,
    message
  );
};

function reactDoctorFinding(cwd: string, line: string): PipelineFindingInput | undefined {
  const location = parseLocation(line);
  if (!location) return undefined;
  const message = location.message || 'React Doctor finding';
  return {
    title: message,
    message,
    severity: lineSeverity(line),
    category: 'react-doctor',
    location: {
      file: relativeFindingFile(cwd, location.file),
      line: location.line,
      column: location.column
    }
  };
}

function parseLocation(line: string): {
  file: string;
  line: number;
  column?: number;
  message: string;
} | undefined {
  for (let index = 0; index < line.length; index += 1) {
    if (line.charAt(index) !== ':') continue;
    const lineNumber = readDigits(line, index + 1);
    if (!lineNumber) continue;
    const file = line.slice(0, index).trim();
    if (!SOURCE_EXTENSION.test(file)) continue;

    let cursor = lineNumber.end;
    let column: number | undefined;
    if (line.charAt(cursor) === ':') {
      const columnNumber = readDigits(line, cursor + 1);
      if (columnNumber) {
        column = columnNumber.value;
        cursor = columnNumber.end;
      }
    }
    return {
      file,
      line: lineNumber.value,
      column,
      message: cleanLocationMessage(line.slice(cursor))
    };
  }
  return undefined;
}

function readDigits(value: string, start: number): { value: number; end: number } | undefined {
  let end = start;
  while (end < value.length && value.charAt(end) >= '0' && value.charAt(end) <= '9') end += 1;
  if (end === start) return undefined;
  return { value: Number(value.slice(start, end)), end };
}

function cleanLocationMessage(value: string): string {
  let result = value.trim();
  if (result.startsWith('-') || result.startsWith('–') || result.startsWith(':')) {
    result = result.slice(1).trim();
  }
  return result;
}

function firstLabelCount(value: string, labels: readonly string[]): number | undefined {
  const lower = value.toLowerCase();
  for (const label of labels) {
    let offset = 0;
    while (offset < lower.length) {
      const index = lower.indexOf(label, offset);
      if (index < 0) break;
      const count = readCountAfterLabel(value, index + label.length);
      if (count !== undefined) return count;
      offset = index + label.length;
    }
  }
  return undefined;
}

function firstCountBeforeLabel(value: string, labels: readonly string[]): number | undefined {
  const lower = value.toLowerCase();
  for (const label of labels) {
    let offset = 0;
    while (offset < lower.length) {
      const index = lower.indexOf(label, offset);
      if (index < 0) break;
      const count = readIntegerBefore(value, index);
      if (count !== undefined) return count;
      offset = index + label.length;
    }
  }
  return undefined;
}

function readCountAfterLabel(value: string, start: number): number | undefined {
  let index = start;
  while (index < value.length && isCountSeparator(value.charAt(index))) index += 1;
  const digits = readDigits(value, index);
  return digits?.value;
}

function readIntegerBefore(value: string, end: number): number | undefined {
  let index = end - 1;
  while (index >= 0 && value.charAt(index).trim() === '') index -= 1;
  const numberEnd = index + 1;
  while (index >= 0 && value.charAt(index) >= '0' && value.charAt(index) <= '9') index -= 1;
  if (numberEnd === index + 1) return undefined;
  return Number(value.slice(index + 1, numberEnd));
}

function isCountSeparator(value: string): boolean {
  return value.trim() === '' || value === ':' || value === '=';
}

function lineSeverity(value: string) {
  if (/critical|fatal/i.test(value)) return 'critical' as const;
  const match = SEVERITY_WORD.exec(value);
  const severity = severityFromText(match?.[0]);
  return severity === 'unknown' ? 'medium' as const : severity;
}
