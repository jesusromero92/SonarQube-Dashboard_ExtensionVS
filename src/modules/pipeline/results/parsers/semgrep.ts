import type { PipelineFindingInput } from '../fingerprint';
import type { PipelineStructuredResultParser } from '../contracts';
import { createStructuredResult, emptyStructuredResult, relativeFindingFile } from '../fingerprint';
import { arrayValue, compactMetrics, jsonOutput, metric, recordValue, severityFromText, stringValue } from './common';

const PARSER_ID = 'semgrep-json-v1';

export const parseSemgrepResult: PipelineStructuredResultParser = output => {
  const payload = recordValue(jsonOutput(output));
  if (!payload) return emptyStructuredResult(output, PARSER_ID, 'partial', [], 'Semgrep no produjo JSON.');
  const findings: PipelineFindingInput[] = [];
  for (const rawResult of arrayValue(payload.results)) {
    const result = recordValue(rawResult);
    if (!result) continue;
    const extra = recordValue(result.extra);
    const start = recordValue(result.start);
    const end = recordValue(result.end);
    const ruleId = stringValue(result.check_id);
    const message = stringValue(extra?.message) ?? ruleId ?? 'Semgrep finding';
    findings.push({
      fingerprint: stringValue(extra?.fingerprint),
      ruleId,
      title: ruleId ? `${ruleId}: ${message}` : message,
      message,
      severity: severityFromText(extra?.severity),
      category: 'sast',
      location: {
        file: relativeFindingFile(output.cwd, stringValue(result.path)),
        line: Number(start?.line) || undefined,
        column: Number(start?.col) || undefined,
        endLine: Number(end?.line) || undefined,
        endColumn: Number(end?.col) || undefined
      }
    });
  }
  const errors = arrayValue(payload.errors).length;
  return createStructuredResult(
    output,
    PARSER_ID,
    'parsed',
    findings,
    compactMetrics(
      metric('findings', 'Hallazgos', findings.length),
      metric('parserErrors', 'Errores del parser', errors)
    )
  );
};
