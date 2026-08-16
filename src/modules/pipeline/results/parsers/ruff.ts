import type { PipelineFindingInput } from '../fingerprint';
import type { PipelineStructuredResultParser } from '../contracts';
import { createStructuredResult, emptyStructuredResult, relativeFindingFile } from '../fingerprint';
import { arrayValue, compactMetrics, jsonOutput, metric, recordValue, stringValue } from './common';

const PARSER_ID = 'ruff-json-v1';

export const parseRuffResult: PipelineStructuredResultParser = output => {
  const payload = jsonOutput(output);
  if (!Array.isArray(payload)) return emptyStructuredResult(output, PARSER_ID, 'partial', [], 'Ruff no produjo JSON.');
  const findings: PipelineFindingInput[] = [];
  let fixable = 0;
  for (const rawItem of arrayValue(payload)) {
    const item = recordValue(rawItem);
    if (!item) continue;
    const location = recordValue(item.location);
    const endLocation = recordValue(item.end_location);
    const fix = recordValue(item.fix);
    if (fix) fixable += 1;
    const ruleId = stringValue(item.code);
    const message = stringValue(item.message) ?? ruleId ?? 'Ruff finding';
    findings.push({
      ruleId,
      title: ruleId ? `${ruleId}: ${message}` : message,
      message,
      severity: 'medium',
      category: 'lint',
      location: {
        file: relativeFindingFile(output.cwd, stringValue(item.filename)),
        line: Number(location?.row) || undefined,
        column: Number(location?.column) || undefined,
        endLine: Number(endLocation?.row) || undefined,
        endColumn: Number(endLocation?.column) || undefined
      }
    });
  }
  return createStructuredResult(
    output,
    PARSER_ID,
    'parsed',
    findings,
    compactMetrics(
      metric('findings', 'Hallazgos', findings.length),
      metric('fixable', 'Corregibles', fixable)
    )
  );
};
