import { RefreshSummary } from '../types';

export function createEmptyRefreshSummary(): RefreshSummary {
  return {
    configuredFolders: 0,
    published: 0,
    newPublished: 0,
    skipped: 0,
    errors: [],
    issues: [],
    newIssues: [],
    hotspots: [],
    newHotspots: [],
    severity: [],
    newSeverity: [],
    evolution: [],
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
    }
  };
}
