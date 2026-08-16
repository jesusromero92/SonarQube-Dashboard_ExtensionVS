import type {
  PipelineFindingSeverity,
  PipelineResultMetric,
  PipelineToolOutput
} from '../contracts';
import {
  emptyStructuredResult,
  finiteNumber,
  parseJsonValue,
  stripAnsi
} from '../fingerprint';

export function parserErrorResult(
  output: PipelineToolOutput,
  parserId: string,
  error: unknown
) {
  return emptyStructuredResult(
    output,
    parserId,
    'error',
    [],
    errorMessage(error)
  );
}

export function severityFromText(value: unknown): PipelineFindingSeverity {
  const normalized = scalarString(value)?.trim().toLowerCase() ?? '';
  if (normalized === 'critical' || normalized === 'blocker') return 'critical';
  if (normalized === 'high' || normalized === 'error' || normalized === 'major') return 'high';
  if (normalized === 'medium' || normalized === 'moderate' || normalized === 'warning' || normalized === 'warn') return 'medium';
  if (normalized === 'low' || normalized === 'minor') return 'low';
  if (normalized === 'info' || normalized === 'informational' || normalized === 'note') return 'info';
  return 'unknown';
}

export function metric(
  key: string,
  label: string,
  value: unknown,
  unit?: string
): PipelineResultMetric | undefined {
  const number = finiteNumber(value);
  return number === undefined ? undefined : { key, label, value: number, unit };
}

export function compactMetrics(
  ...metrics: Array<PipelineResultMetric | undefined>
): PipelineResultMetric[] {
  return metrics.filter((item): item is PipelineResultMetric => Boolean(item));
}

export function cleanOutput(output: PipelineToolOutput): string {
  return stripAnsi(output.output).trim();
}

export function jsonOutput(output: PipelineToolOutput): unknown {
  return parseJsonValue(cleanOutput(output));
}

export function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function scalarString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return scalarString(error) ?? 'Unknown parser error';
}
