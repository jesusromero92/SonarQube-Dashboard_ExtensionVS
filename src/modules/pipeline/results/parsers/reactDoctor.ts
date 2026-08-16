import type { PipelineFindingInput } from '../fingerprint';
import type { PipelineStructuredResultParser } from '../contracts';
import { createStructuredResult, emptyStructuredResult, relativeFindingFile } from '../fingerprint';
import { cleanOutput, compactMetrics, metric, severityFromText } from './common';

const PARSER_ID = 'react-doctor-text-v1';
const LOCATION_LINE = /(?:^|\s)([^\s:][^:]*\.(?:[cm]?[jt]sx?)):(\d+)(?::(\d+))?\s*[-–:]?\s*(.*)$/i;

export const parseReactDoctorResult: PipelineStructuredResultParser = output => {
  const clean = cleanOutput(output);
  if (!clean) return emptyStructuredResult(output, PARSER_ID, 'partial', [], 'React Doctor no produjo salida.');

  const findings: PipelineFindingInput[] = [];
  for (const line of clean.split(/\r?\n/)) {
    const match = line.match(LOCATION_LINE);
    if (!match) continue;
    const message = match[4].trim() || 'React Doctor finding';
    findings.push({
      title: message,
      message,
      severity: lineSeverity(line),
      category: 'react-doctor',
      location: {
        file: relativeFindingFile(output.cwd, match[1]),
        line: Number(match[2]),
        column: Number(match[3]) || undefined
      }
    });
  }

  const problems = firstCount(clean, /(?:problems?|issues?|findings?)\s*[:=]?\s*(\d+)/i) ??
    firstCount(clean, /(\d+)\s+(?:problems?|issues?|findings?)/i);
  const errors = firstCount(clean, /(?:errors?)\s*[:=]?\s*(\d+)/i);
  const warnings = firstCount(clean, /(?:warnings?)\s*[:=]?\s*(\d+)/i);
  const metrics = compactMetrics(
    metric('problems', 'Problemas', problems ?? findings.length),
    metric('errors', 'Errores', errors),
    metric('warnings', 'Advertencias', warnings)
  );

  return createStructuredResult(
    output,
    PARSER_ID,
    findings.length > 0 ? 'parsed' : 'partial',
    findings,
    metrics,
    findings.length > 0
      ? undefined
      : 'React Doctor no expone un formato normalizado en este paso; se conservaron las métricas reconocibles de su salida.'
  );
};

function firstCount(value: string, pattern: RegExp): number | undefined {
  const match = value.match(pattern);
  if (!match) return undefined;
  const number = Number(match[1]);
  return Number.isFinite(number) ? number : undefined;
}

function lineSeverity(value: string) {
  if (/critical|fatal/i.test(value)) return 'critical' as const;
  const severity = severityFromText(value.match(/error|warning|warn|info|low|medium|high/i)?.[0]);
  return severity === 'unknown' ? 'medium' as const : severity;
}
