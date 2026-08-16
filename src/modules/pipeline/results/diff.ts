import type {
  PipelineFinding,
  PipelineStructuredResult,
  PipelineStructuredResultDiff
} from './contracts';

const MAX_DIFF_FINDINGS = 100;

export function diffStructuredResults(
  current: PipelineStructuredResult,
  previous: PipelineStructuredResult,
  baselineEntryId: string
): PipelineStructuredResultDiff | undefined {
  if (current.toolId !== previous.toolId) return undefined;
  if (current.parserId !== previous.parserId) return undefined;
  if (!isDiffable(current) || !isDiffable(previous)) return undefined;

  const currentByFingerprint = new Map(
    current.findings.map(finding => [finding.fingerprint, finding] as const)
  );
  const previousByFingerprint = new Map(
    previous.findings.map(finding => [finding.fingerprint, finding] as const)
  );
  const newFindings: PipelineFinding[] = [];
  const resolvedFindings: PipelineFinding[] = [];
  let persistentCount = 0;

  for (const [fingerprint, finding] of currentByFingerprint) {
    if (previousByFingerprint.has(fingerprint)) persistentCount += 1;
    else if (newFindings.length < MAX_DIFF_FINDINGS) newFindings.push(finding);
  }
  for (const [fingerprint, finding] of previousByFingerprint) {
    if (!currentByFingerprint.has(fingerprint) && resolvedFindings.length < MAX_DIFF_FINDINGS) {
      resolvedFindings.push(finding);
    }
  }

  return {
    baselineEntryId,
    newCount: countMissing(currentByFingerprint, previousByFingerprint),
    resolvedCount: countMissing(previousByFingerprint, currentByFingerprint),
    persistentCount,
    newFindings,
    resolvedFindings,
    reliable: !current.truncated && !previous.truncated
  };
}

function isDiffable(result: PipelineStructuredResult): boolean {
  return result.status === 'parsed';
}

function countMissing(
  source: ReadonlyMap<string, PipelineFinding>,
  target: ReadonlyMap<string, PipelineFinding>
): number {
  let count = 0;
  for (const fingerprint of source.keys()) {
    if (!target.has(fingerprint)) count += 1;
  }
  return count;
}
