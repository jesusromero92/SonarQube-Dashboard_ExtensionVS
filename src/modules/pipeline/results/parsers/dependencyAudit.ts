import type { PipelineFindingInput } from '../fingerprint';
import type { PipelineStructuredResultParser } from '../contracts';
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
  severityFromText,
  stringValue
} from './common';

const PARSER_ID = 'node-audit-v1';

export const parseDependencyAuditResult: PipelineStructuredResultParser = output => {
  const payload = jsonOutput(output);
  const object = recordValue(payload);
  if (object) {
    if (recordValue(object.vulnerabilities)) return parseNpmAudit(output, object);
    if (object.type === 'auditAdvisory') return parseYarnAuditLines(output);
  }

  const yarn = parseYarnAuditLines(output);
  if (yarn.summary.total > 0 || yarn.metrics.length > 0) return yarn;

  const clean = cleanOutput(output);
  const counts = [...clean.matchAll(/(low|moderate|medium|high|critical)\s*[:|]?\s*(\d+)/gi)];
  if (counts.length > 0) {
    return emptyStructuredResult(
      output,
      PARSER_ID,
      'partial',
      counts.map(match => ({
        key: `severity.${match[1].toLowerCase()}`,
        label: match[1],
        value: Number(match[2])
      })),
      'La auditoría no produjo un formato estructurado completo.'
    );
  }
  return emptyStructuredResult(output, PARSER_ID, 'partial', [], 'No se pudo interpretar la salida de la auditoría.');
};

function parseNpmAudit(
  output: Parameters<PipelineStructuredResultParser>[0],
  payload: Record<string, unknown>
) {
  const vulnerabilities = recordValue(payload.vulnerabilities) ?? {};
  const findings: PipelineFindingInput[] = [];
  for (const [packageName, rawVulnerability] of Object.entries(vulnerabilities)) {
    const vulnerability = recordValue(rawVulnerability);
    if (!vulnerability) continue;
    const packageSeverity = severityFromText(vulnerability.severity);
    const via = arrayValue(vulnerability.via);
    const advisories = via.map(recordValue).filter((value): value is Record<string, unknown> => Boolean(value));
    if (advisories.length === 0) {
      findings.push({
        ruleId: packageName,
        title: `${packageName}: vulnerable dependency`,
        severity: packageSeverity,
        category: 'dependency-vulnerability',
        message: stringValue(vulnerability.range)
      });
      continue;
    }
    for (const advisory of advisories) {
      const title = stringValue(advisory.title) ?? `${packageName}: vulnerable dependency`;
      findings.push({
        fingerprint: advisory.source !== undefined ? `npm-advisory:${String(advisory.source)}` : undefined,
        ruleId: advisory.source !== undefined ? String(advisory.source) : packageName,
        title,
        message: stringValue(advisory.range) ?? stringValue(vulnerability.range),
        severity: severityFromText(advisory.severity) === 'unknown'
          ? packageSeverity
          : severityFromText(advisory.severity),
        category: 'dependency-vulnerability',
        helpUrl: stringValue(advisory.url)
      });
    }
  }

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

function parseYarnAuditLines(output: Parameters<PipelineStructuredResultParser>[0]) {
  const findings: PipelineFindingInput[] = [];
  const metrics: ReturnType<typeof compactMetrics> = [];
  for (const line of cleanOutput(output).split(/\r?\n/)) {
    if (!line.trim().startsWith('{')) continue;
    let parsed: unknown;
    try { parsed = JSON.parse(line); } catch { continue; }
    const record = recordValue(parsed);
    if (!record) continue;
    if (record.type === 'auditAdvisory') {
      const data = recordValue(record.data);
      const advisory = recordValue(data?.advisory);
      if (!advisory) continue;
      findings.push({
        fingerprint: advisory.id !== undefined ? `yarn-advisory:${String(advisory.id)}` : undefined,
        ruleId: advisory.id !== undefined ? String(advisory.id) : stringValue(advisory.module_name),
        title: stringValue(advisory.title) ?? 'Dependency vulnerability',
        message: stringValue(advisory.vulnerable_versions),
        severity: severityFromText(advisory.severity),
        category: 'dependency-vulnerability',
        helpUrl: stringValue(advisory.url)
      });
    }
    if (record.type === 'auditSummary') {
      const data = recordValue(record.data);
      const vulnerabilities = recordValue(data?.vulnerabilities);
      for (const [key, label] of [
        ['info', 'Info'], ['low', 'Bajas'], ['moderate', 'Moderadas'], ['high', 'Altas'], ['critical', 'Críticas']
      ] as const) {
        const item = metric(`vulnerabilities.${key}`, label, vulnerabilities?.[key]);
        if (item) metrics.push(item);
      }
    }
  }
  return createStructuredResult(output, PARSER_ID, findings.length > 0 ? 'parsed' : 'partial', findings, metrics);
}
