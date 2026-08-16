import type { PipelineFindingInput } from '../fingerprint';
import type { PipelineStructuredResultParser } from '../contracts';
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

export const parseEslintResult: PipelineStructuredResultParser = output => {
  const payload = jsonOutput(output);
  if (Array.isArray(payload)) {
    const findings: PipelineFindingInput[] = [];
    let errorCount = 0;
    let warningCount = 0;
    let fixableErrorCount = 0;
    let fixableWarningCount = 0;

    for (const rawFile of payload) {
      const file = recordValue(rawFile);
      if (!file) continue;
      const filePath = relativeFindingFile(output.cwd, stringValue(file.filePath));
      errorCount += Number(file.errorCount) || 0;
      warningCount += Number(file.warningCount) || 0;
      fixableErrorCount += Number(file.fixableErrorCount) || 0;
      fixableWarningCount += Number(file.fixableWarningCount) || 0;
      for (const rawMessage of arrayValue(file.messages)) {
        const message = recordValue(rawMessage);
        if (!message) continue;
        const severity = Number(message.severity) === 2 ? 'high' :
          Number(message.severity) === 1 ? 'medium' : 'unknown';
        const text = stringValue(message.message) ?? 'ESLint finding';
        const ruleId = stringValue(message.ruleId) ?? undefined;
        findings.push({
          ruleId,
          title: ruleId ? `${ruleId}: ${text}` : text,
          message: text,
          severity,
          category: 'lint',
          location: {
            file: filePath,
            line: Number(message.line) || undefined,
            column: Number(message.column) || undefined,
            endLine: Number(message.endLine) || undefined,
            endColumn: Number(message.endColumn) || undefined
          }
        });
      }
    }

    return createStructuredResult(
      output,
      PARSER_ID,
      'parsed',
      findings,
      compactMetrics(
        metric('errors', 'Errores', errorCount),
        metric('warnings', 'Advertencias', warningCount),
        metric('fixableErrors', 'Errores corregibles', fixableErrorCount),
        metric('fixableWarnings', 'Advertencias corregibles', fixableWarningCount)
      )
    );
  }

  const clean = cleanOutput(output);
  const summary = clean.match(/(\d+)\s+problems?\s*\((\d+)\s+errors?,\s*(\d+)\s+warnings?\)/i);
  if (summary) {
    return emptyStructuredResult(
      output,
      PARSER_ID,
      'partial',
      compactMetrics(
        metric('total', 'Problemas', summary[1]),
        metric('errors', 'Errores', summary[2]),
        metric('warnings', 'Advertencias', summary[3])
      ),
      'ESLint no produjo JSON; se conservaron únicamente las métricas del resumen.'
    );
  }
  return emptyStructuredResult(output, PARSER_ID, 'partial', [], 'No se pudo interpretar la salida de ESLint.');
};
