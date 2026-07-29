import type {
  SonarApiCapabilities,
  SonarApiProfile
} from '../sonarApiCompatibility';
import type {
  CanonicalParameters,
  LogicalParameter
} from './contracts';
import {
  createAliasHandlers,
  ignoreParameter,
  type ParameterTranslationHandlers,
  translateCanonicalParameters
} from './parameterTranslation';

const PARAMETER_ALTERNATIVES: Readonly<
  Partial<Record<LogicalParameter, readonly string[]>>
> = {
  'issues.projectKeys': ['components', 'componentKeys'],
  'issues.types': ['impactSoftwareQualities', 'types'],
  'issues.severities': ['impactSeverities', 'severities'],
  'issues.statuses': ['issueStatuses', 'statuses'],
  'issues.resolved': ['resolved'],
  'hotspots.projectKey': ['project', 'projectKey']
};

function mapCsv(csv: string, mapper: (value: string) => string): string {
  return [...new Set(
    csv
      .split(',')
      .map(value => mapper(value.trim()))
      .filter(Boolean)
  )].join(',');
}

function mergeCsv(left: string | null | undefined, right: string): string {
  return [...new Set(
    [left ?? '', right]
      .flatMap(csv => csv.split(','))
      .map(value => value.trim())
      .filter(Boolean)
  )].join(',');
}

function toSoftwareQualities(csv: string): string {
  return mapCsv(csv, value => {
    const normalized = value.toUpperCase().replace(/[- ]/g, '_');
    if (normalized === 'CODE_SMELL' || normalized === 'SMELL') return 'MAINTAINABILITY';
    if (normalized === 'BUG') return 'RELIABILITY';
    if (normalized === 'VULNERABILITY') return 'SECURITY';
    return normalized;
  });
}

function toImpactSeverities(csv: string): string {
  return mapCsv(csv, value => {
    const normalized = value.toUpperCase();
    if (normalized === 'CRITICAL') return 'HIGH';
    if (normalized === 'MAJOR') return 'MEDIUM';
    if (normalized === 'MINOR' || normalized === 'TRIVIAL') return 'LOW';
    return normalized;
  });
}

function toIssueStatuses(csv: string): string {
  const result = new Set<string>();
  for (const value of csv.split(',')) {
    const normalized = value.trim().toUpperCase().replace(/-/g, '_');
    if (normalized === 'REOPENED') {
      result.add('OPEN');
    } else if (normalized === 'RESOLVED') {
      result.add('ACCEPTED');
      result.add('FALSE_POSITIVE');
      result.add('FIXED');
    } else if (normalized === 'WONTFIX') {
      result.add('ACCEPTED');
    } else if (normalized === 'CLOSED' || normalized === 'REMOVED') {
      result.add('FIXED');
    } else if (normalized) {
      result.add(normalized);
    }
  }
  return [...result].join(',');
}

function toModernFacets(csv: string): string {
  return mapCsv(csv, value => {
    if (value === 'types') return 'impactSoftwareQualities';
    if (value === 'severities') return 'impactSeverities';
    if (value === 'statuses') return 'issueStatuses';
    return value;
  });
}

function setParameter(target: URLSearchParams, key: string, value: string): void {
  if (key && value) {
    target.set(key, value);
  }
}

function effectiveParameter(
  capabilities: SonarApiCapabilities,
  endpoint: string,
  profile: SonarApiProfile,
  logicalName: LogicalParameter
): string {
  return capabilities.chooseParameter(
    endpoint,
    profile.parameters[logicalName],
    PARAMETER_ALTERNATIVES[logicalName] ?? []
  );
}

interface IssueTranslationContext {
  readonly profile: SonarApiProfile;
  readonly capabilities: SonarApiCapabilities;
  readonly endpoint: string;
}

function issueParameter(
  context: IssueTranslationContext,
  logicalName: LogicalParameter
): string {
  return effectiveParameter(
    context.capabilities,
    context.endpoint,
    context.profile,
    logicalName
  );
}

function setIssueParameter(
  target: URLSearchParams,
  value: string,
  context: IssueTranslationContext,
  logicalName: LogicalParameter
): void {
  setParameter(target, issueParameter(context, logicalName), value);
}

function transformedIssueValue(
  profile: SonarApiProfile,
  value: string,
  modernTransform: (input: string) => string
): string {
  return profile.cleanCodeParameters ? modernTransform(value) : value;
}

function applyIssueStatuses(
  target: URLSearchParams,
  value: string,
  context: IssueTranslationContext
): void {
  const parameter = issueParameter(context, 'issues.statuses');
  const canonicalValue = transformedIssueValue(
    context.profile,
    value,
    toIssueStatuses
  );
  setParameter(
    target,
    parameter,
    context.capabilities.filterValues(
      context.endpoint,
      parameter,
      canonicalValue
    )
  );
}

function statusesForResolvedValue(
  profile: SonarApiProfile,
  normalizedValue: string
): readonly string[] {
  return normalizedValue === 'false'
    ? profile.values['issues.openStatuses']
    : profile.values['issues.closedStatuses'];
}

function applyResolvedFilter(
  target: URLSearchParams,
  value: string,
  context: IssueTranslationContext
): void {
  const resolvedParameter = issueParameter(context, 'issues.resolved');
  if (!context.profile.cleanCodeParameters && resolvedParameter) {
    target.set(resolvedParameter, value);
    return;
  }

  const normalizedValue = value.toLowerCase();
  const isBooleanFilter = normalizedValue === 'false' || normalizedValue === 'true';
  if (context.profile.cleanCodeParameters && !isBooleanFilter) {
    return;
  }

  const statusParameter = issueParameter(context, 'issues.statuses');
  const filteredStatuses = context.capabilities.filterValues(
    context.endpoint,
    statusParameter,
    statusesForResolvedValue(context.profile, normalizedValue).join(',')
  );
  if (filteredStatuses) {
    setParameter(target, statusParameter, filteredStatuses);
  } else {
    setParameter(target, resolvedParameter, value);
  }
}

function createIssueTranslationHandlers(
  context: IssueTranslationContext
): ParameterTranslationHandlers {
  const { profile } = context;
  return {
    componentKeys: ({ target, value }) => {
      setIssueParameter(target, value, context, 'issues.projectKeys');
    },
    p: ({ target, value }) => {
      target.set(profile.parameters['issues.page'], value);
    },
    ps: ({ target, value }) => {
      target.set(profile.parameters['issues.pageSize'], value);
    },
    types: ({ target, value }) => {
      setIssueParameter(
        target,
        transformedIssueValue(profile, value, toSoftwareQualities),
        context,
        'issues.types'
      );
    },
    severities: ({ target, value }) => {
      setIssueParameter(
        target,
        transformedIssueValue(profile, value, toImpactSeverities),
        context,
        'issues.severities'
      );
    },
    statuses: ({ target, value }) => {
      applyIssueStatuses(target, value, context);
    },
    resolved: ({ target, value }) => {
      applyResolvedFilter(target, value, context);
    },
    inNewCodePeriod: ({ target, value }) => {
      target.set(profile.parameters['issues.newCode'], value);
    },
    facets: ({ target, value }) => {
      target.set(
        profile.parameters['issues.facets'],
        transformedIssueValue(profile, value, toModernFacets)
      );
    },
    searchText: ({ target, value }) => {
      target.set(profile.parameters['issues.searchText'], value);
    },
    resolutions: ignoreParameter
  };
}

function appendIssueResolutions(
  target: URLSearchParams,
  canonical: CanonicalParameters,
  context: IssueTranslationContext
): void {
  const resolutions = canonical.resolutions?.trim() ?? '';
  if (!resolutions) {
    return;
  }

  if (!context.profile.cleanCodeParameters) {
    target.set('resolutions', resolutions);
    return;
  }

  const statusParameter = issueParameter(context, 'issues.statuses');
  const statuses = context.capabilities.filterValues(
    context.endpoint,
    statusParameter,
    mergeCsv(target.get(statusParameter), toIssueStatuses(resolutions))
  );
  setParameter(target, statusParameter, statuses);
}

export function translateIssueSearchParameters(
  profile: SonarApiProfile,
  canonical: CanonicalParameters,
  capabilities: SonarApiCapabilities
): URLSearchParams {
  const context: IssueTranslationContext = {
    profile,
    capabilities,
    endpoint: profile.endpoints['issues.search']
  };
  const result = translateCanonicalParameters(canonical, {
    handlers: createIssueTranslationHandlers(context)
  });
  appendIssueResolutions(result, canonical, context);
  return result;
}

interface HotspotTranslationContext {
  readonly profile: SonarApiProfile;
  readonly capabilities: SonarApiCapabilities;
  readonly endpoint: string;
}

function createHotspotTranslationHandlers(
  context: HotspotTranslationContext
): ParameterTranslationHandlers {
  const { profile, capabilities, endpoint } = context;
  return {
    projectKey: ({ target, value }) => {
      setParameter(
        target,
        effectiveParameter(
          capabilities,
          endpoint,
          profile,
          'hotspots.projectKey'
        ),
        value
      );
    },
    p: ({ target, value }) => {
      target.set(profile.parameters['hotspots.page'], value);
    },
    ps: ({ target, value }) => {
      target.set(profile.parameters['hotspots.pageSize'], value);
    },
    inNewCodePeriod: ({ target, value }) => {
      target.set(profile.parameters['hotspots.newCode'], value);
    }
  };
}

export function translateHotspotSearchParameters(
  profile: SonarApiProfile,
  canonical: CanonicalParameters,
  capabilities: SonarApiCapabilities
): URLSearchParams {
  return translateCanonicalParameters(canonical, {
    handlers: createHotspotTranslationHandlers({
      profile,
      capabilities,
      endpoint: profile.endpoints['hotspots.search']
    })
  });
}

function translateSimpleParameters(
  canonical: CanonicalParameters,
  aliases: Readonly<Record<string, string>>
): URLSearchParams {
  return translateCanonicalParameters(canonical, {
    handlers: createAliasHandlers(aliases)
  });
}

export function translateComponentShowParameters(
  profile: SonarApiProfile,
  canonical: CanonicalParameters
): URLSearchParams {
  return translateSimpleParameters(canonical, {
    component: profile.parameters['componentsShow.component']
  });
}

export function translateProjectAnalysesParameters(
  profile: SonarApiProfile,
  canonical: CanonicalParameters
): URLSearchParams {
  return translateSimpleParameters(canonical, {
    project: profile.parameters['projectAnalyses.project'],
    p: profile.parameters['projectAnalyses.page'],
    ps: profile.parameters['projectAnalyses.pageSize']
  });
}

export function translateProjectBranchesParameters(
  profile: SonarApiProfile,
  canonical: CanonicalParameters
): URLSearchParams {
  return translateSimpleParameters(canonical, {
    project: profile.parameters['projectBranches.project']
  });
}
