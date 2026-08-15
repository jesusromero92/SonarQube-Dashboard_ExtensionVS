import type { PipelineFolderConfig } from '../configuration';

export type SonarPropertyPrefix = '-D' | '/d:';

export function normalizeAnalysisPatterns(value: string | undefined): string {
  const patterns = String(value ?? '')
    .split(/[\r\n,]+/)
    .map(pattern => pattern.trim())
    .filter(Boolean);

  return [...new Set(patterns)].join(',');
}

export function hasExplicitAnalysisScope(
  config: Pick<PipelineFolderConfig, 'analysisInclusions' | 'analysisExclusions'>
): boolean {
  return Boolean(
    normalizeAnalysisPatterns(config.analysisInclusions) ||
    normalizeAnalysisPatterns(config.analysisExclusions)
  );
}

export function analysisScopeProperties(
  config: Pick<PipelineFolderConfig, 'analysisInclusions' | 'analysisExclusions'>,
  prefix: SonarPropertyPrefix
): string[] {
  const inclusions = normalizeAnalysisPatterns(config.analysisInclusions);
  const exclusions = normalizeAnalysisPatterns(config.analysisExclusions);
  const properties: string[] = [];

  if (inclusions) {
    properties.push(`${prefix}sonar.inclusions=${inclusions}`);
  }
  if (exclusions) {
    properties.push(`${prefix}sonar.exclusions=${exclusions}`);
  }

  return properties;
}
