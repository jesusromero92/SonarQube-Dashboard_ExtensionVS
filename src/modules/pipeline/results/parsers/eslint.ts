import type { PipelineFindingInput } from '../fingerprint';
import type { PipelineStructuredResultParser, PipelineToolOutput } from '../contracts';
import {
  createStructuredResult,
  emptyStructuredResult,
  relativeFindingFile
} from '../fingerprint';
import {
  arrayValue,
  cleanOutput,
  compactMetrics,
  jsonOutput,
  metric,
  recordValue,
  stringValue
} from './common';

const PARSER_ID = 'eslint-json-v1';
interface EslintCounters {
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
}

export const parseEslintResult: PipelineStructuredResultParser = output => {
  const payload = jsonOutput(output);
  if (Array.isArray(payload)) return parseEslintJson(output, payload);

  const summary = parseTextSummary(cleanOutput(output));
  if (summary) {
    return emptyStructuredResult(
      output,
      PARSER_ID,
      'partial',
      compactMetrics(
        metric('total', 'Problemas', summary.total),
        metric('errors', 'Errores', summary.errors),
        metric('warnings', 'Advertencias', summary.warnings)
      ),
      'ESLint no produjo JSON; se conservaron únicamente las métricas del resumen.'
    );
  }
  return emptyStructuredResult(output, PARSER_ID, 'partial', [], 'No se pudo interpretar la salida de ESLint.');
};

function parseEslintJson(output: PipelineToolOutput, payload: unknown[]) {
  const findings: PipelineFindingInput[] = [];
  const counters = emptyCounters();

  for (const rawFile of payload) {
    const file = recordValue(rawFile);
    if (!file) continue;
    accumulateCounters(counters, file);
    appendFileFindings(output, findings, file);
  }

  return createStructuredResult(
    output,
    PARSER_ID,
    'parsed',
    findings,
    compactMetrics(
      metric('errors', 'Errores', counters.errorCount),
      metric('warnings', 'Advertencias', counters.warningCount),
      metric('fixableErrors', 'Errores corregibles', counters.fixableErrorCount),
      metric('fixableWarnings', 'Advertencias corregibles', counters.fixableWarningCount)
    )
  );
}

function appendFileFindings(
  output: PipelineToolOutput,
  findings: PipelineFindingInput[],
  file: Record<string, unknown>
): void {
  const filePath = relativeFindingFile(output.cwd, stringValue(file.filePath));
  for (const rawMessage of arrayValue(file.messages)) {
    const message = recordValue(rawMessage);
    if (!message) continue;
    findings.push(eslintFinding(filePath, message));
  }
}

function eslintFinding(
  filePath: string | undefined,
  message: Record<string, unknown>
): PipelineFindingInput {
  const text = stringValue(message.message) ?? 'ESLint finding';
  const ruleId = stringValue(message.ruleId);
  return {
    ruleId,
    title: ruleId ? `${ruleId}: ${text}` : text,
    message: text,
    severity: eslintSeverity(message.severity),
    category: 'lint',
    location: {
      file: filePath,
      line: positiveNumber(message.line),
      column: positiveNumber(message.column),
      endLine: positiveNumber(message.endLine),
      endColumn: positiveNumber(message.endColumn)
    }
  };
}

function eslintSeverity(value: unknown): PipelineFindingInput['severity'] {
  const severity = Number(value);
  if (severity === 2) return 'high';
  if (severity === 1) return 'medium';
  return 'unknown';
}

function positiveNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function emptyCounters(): EslintCounters {
  return {
    errorCount: 0,
    warningCount: 0,
    fixableErrorCount: 0,
    fixableWarningCount: 0
  };
}

function accumulateCounters(counters: EslintCounters, file: Record<string, unknown>): void {
  counters.errorCount += Number(file.errorCount) || 0;
  counters.warningCount += Number(file.warningCount) || 0;
  counters.fixableErrorCount += Number(file.fixableErrorCount) || 0;
  counters.fixableWarningCount += Number(file.fixableWarningCount) || 0;
}

function parseTextSummary(clean: string): { total: number; errors: number; warnings: number } | undefined {
  const normalized = clean.replace(/\s+/g, ' ');
  const lower = normalized.toLocaleLowerCase();
  const marker = findProblemMarker(lower);
  if (!marker) return undefined;

  const total = readIntegerBefore(normalized, marker.index);
  const errors = readIntegerForward(normalized, marker.index + marker.value.length);
  const commaIndex = normalized.indexOf(',', marker.index + marker.value.length);
  const warnings = commaIndex >= 0 ? readIntegerForward(normalized, commaIndex + 1) : undefined;
  if (total === undefined || errors === undefined || warnings === undefined) return undefined;

  const errorLabelStart = skipAsciiDigitsAndSpaces(normalized, marker.index + marker.value.length);
  const errorLabelEnd = commaIndex;
  const warningNumberStart = skipSpaces(normalized, commaIndex + 1);
  const warningLabelStart = skipAsciiDigitsAndSpaces(normalized, warningNumberStart);
  const closingIndex = normalized.indexOf(')', warningLabelStart);
  if (errorLabelEnd < 0 || closingIndex < 0) return undefined;

  const errorLabel = lower.slice(errorLabelStart, errorLabelEnd).trim();
  const warningLabel = lower.slice(warningLabelStart, closingIndex).trim();
  if (!isCountLabel(errorLabel, 'error') || !isCountLabel(warningLabel, 'warning')) return undefined;

  return { total, errors, warnings };
}

function findProblemMarker(value: string): { index: number; value: string } | undefined {
  for (const marker of [' problems (', ' problem (']) {
    const index = value.indexOf(marker);
    if (index >= 0) return { index, value: marker };
  }
  return undefined;
}

function readIntegerBefore(value: string, end: number): number | undefined {
  let index = end - 1;
  while (index >= 0 && value[index] === ' ') index -= 1;
  const digitEnd = index + 1;
  while (index >= 0 && isAsciiDigit(value[index])) index -= 1;
  if (digitEnd === index + 1) return undefined;
  return Number(value.slice(index + 1, digitEnd));
}

function readIntegerForward(value: string, start: number): number | undefined {
  let index = skipSpaces(value, start);
  const digitStart = index;
  while (index < value.length && isAsciiDigit(value[index])) index += 1;
  if (index === digitStart) return undefined;
  return Number(value.slice(digitStart, index));
}

function skipSpaces(value: string, start: number): number {
  let index = start;
  while (index < value.length && value[index] === ' ') index += 1;
  return index;
}

function skipAsciiDigitsAndSpaces(value: string, start: number): number {
  let index = skipSpaces(value, start);
  while (index < value.length && isAsciiDigit(value[index])) index += 1;
  return skipSpaces(value, index);
}

function isAsciiDigit(value: string | undefined): boolean {
  return value !== undefined && value >= '0' && value <= '9';
}

function isCountLabel(value: string, singular: string): boolean {
  return value === singular || value === `${singular}s`;
}
