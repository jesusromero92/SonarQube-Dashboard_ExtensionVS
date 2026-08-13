import type { SonarAnalysisBaselineData } from '../types';
import type {
  AnalysisBaselineComparison,
  AnalysisBaselineSnapshot
} from './types';

export function createAnalysisBaselineSnapshot(
  data: SonarAnalysisBaselineData,
  capturedAt = new Date().toISOString()
): AnalysisBaselineSnapshot {
  return {
    ...data,
    capturedAt
  };
}

export function compareAnalysisBaselines(
  before: AnalysisBaselineSnapshot,
  after: AnalysisBaselineSnapshot,
  context: { projectKey: string; branch?: string; serverUrl: string }
): AnalysisBaselineComparison {
  return {
    projectKey: context.projectKey,
    branch: context.branch?.trim() ?? '',
    serverUrl: context.serverUrl.trim().replace(/\/+$/, ''),
    before,
    after,
    capturedAt: after.capturedAt
  };
}

export function numericBaselineDelta(
  before: number | null,
  after: number | null
): number | null {
  if (before === null || after === null) {
    return null;
  }
  return after - before;
}
