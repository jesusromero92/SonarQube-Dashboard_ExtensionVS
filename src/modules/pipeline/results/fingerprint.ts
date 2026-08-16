import { createHash } from 'node:crypto';
import * as path from 'node:path';
import type {
  PipelineFinding,
  PipelineFindingLocation,
  PipelineFindingSeverity,
  PipelineResultMetric,
  PipelineStructuredResult,
  PipelineStructuredResultStatus,
  PipelineToolOutput
} from './contracts';

export const MAX_STRUCTURED_FINDINGS = 500;

export interface PipelineFindingInput {
  fingerprint?: string;
  ruleId?: string;
  title: string;
  message?: string;
  severity?: PipelineFindingSeverity;
  category?: string;
  location?: PipelineFindingLocation;
  helpUrl?: string;
}

export function createStructuredResult(
  output: PipelineToolOutput,
  parserId: string,
  status: PipelineStructuredResultStatus,
  findings: readonly PipelineFindingInput[],
  metrics: readonly PipelineResultMetric[] = [],
  message?: string
): PipelineStructuredResult {
  const normalized = findings
    .map(finding => normalizeFinding(output, finding))
    .filter((finding, index, values) =>
      values.findIndex(candidate => candidate.fingerprint === finding.fingerprint) === index
    );
  const truncated = normalized.length > MAX_STRUCTURED_FINDINGS;
  const selected = normalized.slice(0, MAX_STRUCTURED_FINDINGS);
  return {
    schemaVersion: 1,
    toolId: output.toolId,
    toolName: output.toolName,
    parserId,
    status,
    summary: summarizeFindings(normalized),
    findings: selected,
    metrics: normalizeMetrics(metrics),
    truncated: truncated || undefined,
    message
  };
}

export function emptyStructuredResult(
  output: PipelineToolOutput,
  parserId: string,
  status: PipelineStructuredResultStatus,
  metrics: readonly PipelineResultMetric[] = [],
  message?: string
): PipelineStructuredResult {
  return createStructuredResult(output, parserId, status, [], metrics, message);
}

export function relativeFindingFile(cwd: string, file: string | undefined): string | undefined {
  const value = file?.trim();
  if (!value) return undefined;
  if (!path.isAbsolute(value)) return normalizeFile(value);
  const relative = path.relative(cwd, value);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return normalizeFile(value);
  }
  return normalizeFile(relative);
}

export function stripAnsi(value: string): string {
  return value.replace(/\u001B(?:\[[0-?]*[ -\/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g, '');
}

export function parseJsonValue(value: string): unknown {
  const clean = stripAnsi(value).trim();
  if (!clean) return undefined;
  try {
    return JSON.parse(clean);
  } catch {
    const candidates = [
      [clean.indexOf('['), clean.lastIndexOf(']')],
      [clean.indexOf('{'), clean.lastIndexOf('}')]
    ] as const;
    for (const [start, end] of candidates) {
      if (start < 0 || end <= start) continue;
      try {
        return JSON.parse(clean.slice(start, end + 1));
      } catch {
        // Continue trying the next JSON shape.
      }
    }
    return undefined;
  }
}

export function finiteNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function positiveInteger(value: unknown): number | undefined {
  const number = finiteNumber(value);
  if (number === undefined || number <= 0) return undefined;
  return Math.floor(number);
}

function normalizeFinding(
  output: PipelineToolOutput,
  finding: PipelineFindingInput
): PipelineFinding {
  const normalized: Omit<PipelineFinding, 'fingerprint'> = {
    ruleId: cleanOptional(finding.ruleId),
    title: finding.title.trim() || cleanOptional(finding.ruleId) || 'Finding',
    message: cleanOptional(finding.message),
    severity: finding.severity ?? 'unknown',
    category: cleanOptional(finding.category),
    location: normalizeLocation(finding.location),
    helpUrl: cleanOptional(finding.helpUrl)
  };
  return {
    ...normalized,
    fingerprint: cleanOptional(finding.fingerprint) ?? createFindingFingerprint(output.toolId, normalized)
  };
}

function createFindingFingerprint(
  toolId: string,
  finding: Omit<PipelineFinding, 'fingerprint'>
): string {
  const location = finding.location;
  const source = [
    toolId,
    finding.ruleId ?? '',
    location?.file ?? '',
    location?.line ?? '',
    location?.column ?? '',
    normalizeMessage(finding.message ?? finding.title)
  ].join('\0');
  return createHash('sha256').update(source).digest('hex').slice(0, 32);
}

function summarizeFindings(findings: readonly PipelineFinding[]): PipelineStructuredResult['summary'] {
  const summary: PipelineStructuredResult['summary'] = {
    total: findings.length,
    info: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
    unknown: 0
  };
  for (const finding of findings) summary[finding.severity] += 1;
  return summary;
}

function normalizeMetrics(metrics: readonly PipelineResultMetric[]): PipelineResultMetric[] {
  const result: PipelineResultMetric[] = [];
  const seen = new Set<string>();
  for (const metric of metrics) {
    const key = metric.key.trim();
    const label = metric.label.trim();
    if (!key || !label || seen.has(key) || !Number.isFinite(metric.value)) continue;
    seen.add(key);
    result.push({
      key,
      label,
      value: metric.value,
      unit: cleanOptional(metric.unit)
    });
  }
  return result;
}

function normalizeLocation(location: PipelineFindingLocation | undefined): PipelineFindingLocation | undefined {
  if (!location) return undefined;
  const normalized: PipelineFindingLocation = {
    file: cleanOptional(location.file),
    line: positiveInteger(location.line),
    column: positiveInteger(location.column),
    endLine: positiveInteger(location.endLine),
    endColumn: positiveInteger(location.endColumn)
  };
  return Object.values(normalized).some(value => value !== undefined) ? normalized : undefined;
}

function normalizeMessage(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function normalizeFile(value: string): string {
  return value.replaceAll('\\', '/');
}

function cleanOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}
