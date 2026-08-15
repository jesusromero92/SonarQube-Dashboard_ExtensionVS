import type { SonarAnalysisBaselineData } from '../../types';
import { trimTrailingSlashes } from '../../textUtils';
import type {
  AnalysisBaselineComparison,
  AnalysisBaselineSnapshot
} from './models';

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
    serverUrl: trimTrailingSlashes(context.serverUrl.trim()),
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
