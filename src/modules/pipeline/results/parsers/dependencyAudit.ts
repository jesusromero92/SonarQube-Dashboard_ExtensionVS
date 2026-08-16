import type { PipelineFindingInput } from '../fingerprint';
import type { PipelineStructuredResultParser, PipelineToolOutput } from '../contracts';
import {
  createStructuredResult,
  emptyStructuredResult
} from '../fingerprint';
import {
  arrayValue,
  cleanOutput,
  compactMetrics,
  jsonOutput,
  metric,
  recordValue,
  scalarString,
  severityFromText,
  stringValue
} from './common';

const PARSER_ID = 'node-audit-v1';
const AUDIT_SEVERITIES = ['low', 'moderate', 'medium', 'high', 'critical'] as const;
const YARN_SUMMARY_LABELS = [
  ['info', 'Info'],
  ['low', 'Bajas'],
  ['moderate', 'Moderadas'],
  ['high', 'Altas'],
  ['critical', 'Críticas']
] as const;

export const parseDependencyAuditResult: PipelineStructuredResultParser = output => {
  const payload = jsonOutput(output);
  const object = recordValue(payload);
  if (object) {
    if (recordValue(object.vulnerabilities)) return parseNpmAudit(output, object);
    if (object.type === 'auditAdvisory') return parseYarnAuditLines(output);
  }

  const yarn = parseYarnAuditLines(output);
  if (yarn.summary.total > 0 || yarn.metrics.length > 0) return yarn;

  const counts = parseTextSeverityCounts(cleanOutput(output));
  if (counts.length > 0) {
    return emptyStructuredResult(
      output,
      PARSER_ID,
      'partial',
      counts,
      'La auditoría no produjo un formato estructurado completo.'
    );
  }
  return emptyStructuredResult(output, PARSER_ID, 'partial', [], 'No se pudo interpretar la salida de la auditoría.');
};

function parseNpmAudit(
  output: PipelineToolOutput,
  payload: Record<string, unknown>
) {
  const vulnerabilities = recordValue(payload.vulnerabilities) ?? {};
  const findings = Object.entries(vulnerabilities).flatMap(([packageName, rawVulnerability]) =>
    npmVulnerabilityFindings(packageName, rawVulnerability)
  );
  const metadata = recordValue(payload.metadata);
  const counts = recordValue(metadata?.vulnerabilities);
  return createStructuredResult(
    output,
    PARSER_ID,
    'parsed',
    findings,
    compactMetrics(
      metric('vulnerabilities.total', 'Vulnerabilidades totales', counts?.total ?? findings.length),
      metric('vulnerabilities.low', 'Bajas', counts?.low),
      metric('vulnerabilities.medium', 'Moderadas', counts?.moderate ?? counts?.medium),
      metric('vulnerabilities.high', 'Altas', counts?.high),
      metric('vulnerabilities.critical', 'Críticas', counts?.critical)
    )
  );
}

function npmVulnerabilityFindings(
  packageName: string,
  rawVulnerability: unknown
): PipelineFindingInput[] {
  const vulnerability = recordValue(rawVulnerability);
  if (!vulnerability) return [];

  const packageSeverity = severityFromText(vulnerability.severity);
  const advisories = arrayValue(vulnerability.via)
    .map(recordValue)
    .filter((value): value is Record<string, unknown> => Boolean(value));

  if (advisories.length === 0) {
    return [{
      ruleId: packageName,
      title: `${packageName}: vulnerable dependency`,
      severity: packageSeverity,
      category: 'dependency-vulnerability',
      message: stringValue(vulnerability.range)
    }];
  }

  return advisories.map(advisory => npmAdvisoryFinding(packageName, vulnerability, advisory, packageSeverity));
}

function npmAdvisoryFinding(
  packageName: string,
  vulnerability: Record<string, unknown>,
  advisory: Record<string, unknown>,
  packageSeverity: PipelineFindingInput['severity']
): PipelineFindingInput {
  const source = scalarString(advisory.source);
  const advisorySeverity = severityFromText(advisory.severity);
  return {
    fingerprint: source ? `npm-advisory:${source}` : undefined,
    ruleId: source ?? packageName,
    title: stringValue(advisory.title) ?? `${packageName}: vulnerable dependency`,
    message: stringValue(advisory.range) ?? stringValue(vulnerability.range),
    severity: advisorySeverity === 'unknown' ? packageSeverity : advisorySeverity,
    category: 'dependency-vulnerability',
    helpUrl: stringValue(advisory.url)
  };
}

function parseYarnAuditLines(output: PipelineToolOutput) {
  const findings: PipelineFindingInput[] = [];
  const metrics: ReturnType<typeof compactMetrics> = [];
  for (const line of cleanOutput(output).split(/\r?\n/)) {
    const record = parseJsonRecordLine(line);
    if (!record) continue;
    appendYarnAdvisory(findings, record);
    appendYarnSummaryMetrics(metrics, record);
  }
  return createStructuredResult(output, PARSER_ID, findings.length > 0 ? 'parsed' : 'partial', findings, metrics);
}

function parseJsonRecordLine(line: string): Record<string, unknown> | undefined {
  if (!line.trim().startsWith('{')) return undefined;
  try {
    return recordValue(JSON.parse(line));
  } catch {
    return undefined;
  }
}

function appendYarnAdvisory(
  findings: PipelineFindingInput[],
  record: Record<string, unknown>
): void {
  if (record.type !== 'auditAdvisory') return;
  const data = recordValue(record.data);
  const advisory = recordValue(data?.advisory);
  if (!advisory) return;
  const id = scalarString(advisory.id);
  findings.push({
    fingerprint: id ? `yarn-advisory:${id}` : undefined,
    ruleId: id ?? stringValue(advisory.module_name),
    title: stringValue(advisory.title) ?? 'Dependency vulnerability',
    message: stringValue(advisory.vulnerable_versions),
    severity: severityFromText(advisory.severity),
    category: 'dependency-vulnerability',
    helpUrl: stringValue(advisory.url)
  });
}

function appendYarnSummaryMetrics(
  metrics: ReturnType<typeof compactMetrics>,
  record: Record<string, unknown>
): void {
  if (record.type !== 'auditSummary') return;
  const data = recordValue(record.data);
  const vulnerabilities = recordValue(data?.vulnerabilities);
  for (const [key, label] of YARN_SUMMARY_LABELS) {
    const item = metric(`vulnerabilities.${key}`, label, vulnerabilities?.[key]);
    if (item) metrics.push(item);
  }
}

function parseTextSeverityCounts(clean: string) {
  return AUDIT_SEVERITIES.flatMap(severity => {
    const count = countAfterLabel(clean, severity);
    if (count === undefined) return [];
    return [{
      key: `severity.${severity}`,
      label: severity,
      value: count
    }];
  });
}

function countAfterLabel(value: string, label: string): number | undefined {
  const lower = value.toLowerCase();
  let offset = 0;
  while (offset < lower.length) {
    const index = lower.indexOf(label, offset);
    if (index < 0) return undefined;
    if (isWordBoundary(lower, index - 1) && isWordBoundary(lower, index + label.length)) {
      const count = readAuditCount(value, index + label.length);
      if (count !== undefined) return count;
    }
    offset = index + label.length;
  }
  return undefined;
}

function readAuditCount(value: string, start: number): number | undefined {
  let index = skipWhitespace(value, start);
  if (value.charAt(index) === ':' || value.charAt(index) === '|') index += 1;
  index = skipWhitespace(value, index);
  const numberStart = index;
  while (index < value.length && isDigit(value.charAt(index))) index += 1;
  if (numberStart === index) return undefined;
  return Number(value.slice(numberStart, index));
}

function skipWhitespace(value: string, start: number): number {
  let index = start;
  while (index < value.length && value.charAt(index).trim() === '') index += 1;
  return index;
}

function isWordBoundary(value: string, index: number): boolean {
  if (index < 0 || index >= value.length) return true;
  const character = value.charAt(index);
  return !/\w/.test(character);
}

function isDigit(value: string): boolean {
  return value >= '0' && value <= '9';
}
