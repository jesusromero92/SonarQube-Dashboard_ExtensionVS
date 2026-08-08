import { RefreshSummary } from '../types';

export function createEmptyRefreshSummary(): RefreshSummary {
  return {
    syncStatus: 'idle',
    hasSuccessfulSync: false,
    lastSuccessfulAt: null,
    configuredFolders: 0,
    published: 0,
    newPublished: 0,
    skipped: 0,
    errors: [],
    issues: [],
    newIssues: [],
    hotspots: [],
    newHotspots: [],
    hasAnalysis: false,
    severity: [],
    newSeverity: [],
    evolution: [],
    latestAnalysis: null,
    previousAnalysis: null,
    analysisComparisonAvailable: true,
    qualityGate: { status: 'NONE', conditions: [] },
    ratings: {
      overall: {
        maintainability: 'NONE',
        reliability: 'NONE',
        security: 'NONE',
        securityReview: 'NONE'
      },
      newCode: {
        maintainability: 'NONE',
        reliability: 'NONE',
        security: 'NONE',
        securityReview: 'NONE'
      }
    },
    types: {
      bugs: 0,
      codeSmells: 0,
      vulnerabilities: 0,
      securityHotspots: 0
    },
    newTypes: {
      bugs: 0,
      codeSmells: 0,
      vulnerabilities: 0,
      securityHotspots: 0
    },
    coverage: {
      overall: {
        coverage: null,
        lineCoverage: null,
        branchCoverage: null,
        linesToCover: 0,
        uncoveredLines: 0,
        duplicatedLinesDensity: null,
        duplicatedBlocks: 0,
        duplicatedLines: 0
      },
      newCode: {
        coverage: null,
        lineCoverage: null,
        branchCoverage: null,
        linesToCover: 0,
        uncoveredLines: 0,
        duplicatedLinesDensity: null,
        duplicatedBlocks: 0,
        duplicatedLines: 0
      },
      files: []
    }
  };
}

export function preserveRefreshSummaryAfterErrors(
  previous: RefreshSummary,
  attempted: RefreshSummary
): RefreshSummary {
  return {
    ...previous,
    syncStatus: 'error',
    configuredFolders: attempted.configuredFolders,
    errors: [...attempted.errors]
  };
}
