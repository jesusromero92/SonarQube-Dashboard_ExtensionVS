export const SONAR_API_ENDPOINTS = {
  systemStatus: '/api/system/status',
  webServicesList: '/api/webservices/list',
  issuesSearch: '/api/issues/search',
  hotspotsSearch: '/api/hotspots/search',
  componentsShow: '/api/components/show',
  projectAnalysesSearch: '/api/project_analyses/search',
  projectBranchesList: '/api/project_branches/list'
} as const;

type VersionedEndpoint =
  | 'issues.search'
  | 'hotspots.search'
  | 'components.show'
  | 'projectAnalyses.search'
  | 'projectBranches.list';

type LogicalParameter =
  | 'issues.projectKeys'
  | 'issues.page'
  | 'issues.pageSize'
  | 'issues.types'
  | 'issues.severities'
  | 'issues.statuses'
  | 'issues.resolved'
  | 'issues.newCode'
  | 'issues.facets'
  | 'issues.searchText'
  | 'hotspots.projectKey'
  | 'hotspots.page'
  | 'hotspots.pageSize'
  | 'hotspots.newCode'
  | 'projectAnalyses.project'
  | 'projectAnalyses.page'
  | 'projectAnalyses.pageSize'
  | 'projectBranches.project'
  | 'componentsShow.component';

export interface SonarApiProfile {
  readonly id: string;
  readonly generation: string;
  readonly minMajor: number;
  readonly maxMajor: number;
  readonly cleanCodeParameters: boolean;
  readonly endpoints: Readonly<Record<VersionedEndpoint, string>>;
  readonly parameters: Readonly<Record<LogicalParameter, string>>;
  readonly values: Readonly<{
    'issues.openStatuses': readonly string[];
    'issues.closedStatuses': readonly string[];
  }>;
  readonly requestTransforms: Readonly<Record<string, string>>;
  readonly responseNormalization: Readonly<Record<string, string>>;
}

export interface SonarVersion {
  readonly raw: string;
  readonly major: number;
  readonly minor: number;
}

export interface SonarApiProfileSelection {
  readonly profile: SonarApiProfile;
  readonly provisional: boolean;
  readonly warning: string;
}

interface WebServiceParameter {
  readonly key?: string;
  readonly possibleValues?: readonly string[];
}

interface WebServiceAction {
  readonly key?: string;
  readonly params?: readonly WebServiceParameter[];
}

interface WebService {
  readonly path?: string;
  readonly actions?: readonly WebServiceAction[];
}

export interface SonarWebServicesResponse {
  readonly webServices?: readonly WebService[];
}

export interface SonarSystemStatusResponse {
  readonly version?: string;
}

interface EndpointCapabilities {
  readonly parameters: ReadonlyMap<string, readonly string[]>;
}

export interface SonarApiCapabilities {
  readonly available: boolean;
  readonly endpoints: ReadonlyMap<string, EndpointCapabilities>;
  chooseParameter(endpoint: string, preferred: string, alternatives: readonly string[]): string;
  filterValues(endpoint: string, parameter: string, csv: string): string;
}

export interface SonarCompatibility {
  readonly version: SonarVersion;
  readonly selection: SonarApiProfileSelection;
  readonly capabilities: SonarApiCapabilities;
}

export interface SonarCompatibilityInfo {
  readonly version: string;
  readonly major: number;
  readonly minor: number;
  readonly profile: string;
  readonly profileGeneration: string;
  readonly appliedProfiles: readonly string[];
  readonly fallbackApplied: boolean;
  readonly provisional: boolean;
  readonly warning: string;
  readonly cleanCodeParameters: boolean;
  readonly capabilitiesAvailable: boolean;
}

type CanonicalParameters = Readonly<Record<string, string | undefined>>;

const VERSION_PATTERN = /(\d+)(?:\.(\d+))?/;
const COMPATIBILITY_CACHE_TTL_MS = 5 * 60 * 1000;
const TRACKED_ENDPOINTS = new Set<string>([
  SONAR_API_ENDPOINTS.issuesSearch,
  SONAR_API_ENDPOINTS.hotspotsSearch,
  SONAR_API_ENDPOINTS.componentsShow,
  SONAR_API_ENDPOINTS.projectAnalysesSearch,
  SONAR_API_ENDPOINTS.projectBranchesList
]);

const COMMON_ENDPOINTS: Readonly<Record<VersionedEndpoint, string>> = {
  'issues.search': SONAR_API_ENDPOINTS.issuesSearch,
  'hotspots.search': SONAR_API_ENDPOINTS.hotspotsSearch,
  'components.show': SONAR_API_ENDPOINTS.componentsShow,
  'projectAnalyses.search': SONAR_API_ENDPOINTS.projectAnalysesSearch,
  'projectBranches.list': SONAR_API_ENDPOINTS.projectBranchesList
};

const COMMON_PARAMETERS = {
  'issues.page': 'p',
  'issues.pageSize': 'ps',
  'issues.newCode': 'inNewCodePeriod',
  'issues.facets': 'facets',
  'issues.searchText': 'searchText',
  'hotspots.page': 'p',
  'hotspots.pageSize': 'ps',
  'hotspots.newCode': 'inNewCodePeriod',
  'projectAnalyses.project': 'project',
  'projectAnalyses.page': 'p',
  'projectAnalyses.pageSize': 'ps',
  'projectBranches.project': 'project',
  'componentsShow.component': 'component'
} as const;

const RESPONSE_NORMALIZATION = {
  'issue.type': 'canonicalIssueType',
  'issue.severity': 'canonicalSeverity',
  'issue.status': 'canonicalStatus',
  'issue.resolution': 'canonicalResolution',
  facets: 'canonicalIssueFacets'
} as const;

export const SONAR_API_PROFILES: readonly SonarApiProfile[] = [
  {
    id: '25x',
    generation: 'V25',
    minMajor: 25,
    maxMajor: 25,
    cleanCodeParameters: false,
    endpoints: COMMON_ENDPOINTS,
    parameters: {
      ...COMMON_PARAMETERS,
      'issues.projectKeys': 'componentKeys',
      'issues.types': 'types',
      'issues.severities': 'severities',
      'issues.statuses': 'statuses',
      'issues.resolved': 'resolved',
      'hotspots.projectKey': 'projectKey'
    },
    values: {
      'issues.openStatuses': ['OPEN', 'REOPENED'],
      'issues.closedStatuses': ['RESOLVED', 'CLOSED']
    },
    requestTransforms: {
      'issues.types': 'identity',
      'issues.severities': 'identity',
      'issues.statuses': 'identity',
      'issues.facets': 'identity'
    },
    responseNormalization: RESPONSE_NORMALIZATION
  },
  {
    id: '26x',
    generation: 'V26',
    minMajor: 26,
    maxMajor: 26,
    cleanCodeParameters: true,
    endpoints: COMMON_ENDPOINTS,
    parameters: {
      ...COMMON_PARAMETERS,
      'issues.projectKeys': 'components',
      'issues.types': 'impactSoftwareQualities',
      'issues.severities': 'impactSeverities',
      'issues.statuses': 'issueStatuses',
      'issues.resolved': '',
      'hotspots.projectKey': 'project'
    },
    values: {
      'issues.openStatuses': ['OPEN', 'CONFIRMED', 'IN_SANDBOX'],
      'issues.closedStatuses': ['ACCEPTED', 'FALSE_POSITIVE', 'FIXED']
    },
    requestTransforms: {
      'issues.types': 'canonicalTypesToSoftwareQualities',
      'issues.severities': 'canonicalSeveritiesToImpactSeverities',
      'issues.statuses': 'canonicalStatusesToIssueStatuses',
      'issues.facets': 'canonicalFacetsToImpactFacets'
    },
    responseNormalization: RESPONSE_NORMALIZATION
  }
];

const PARAMETER_ALTERNATIVES: Readonly<Partial<Record<LogicalParameter, readonly string[]>>> = {
  'issues.projectKeys': ['components', 'componentKeys'],
  'issues.types': ['impactSoftwareQualities', 'types'],
  'issues.severities': ['impactSeverities', 'severities'],
  'issues.statuses': ['issueStatuses', 'statuses'],
  'issues.resolved': ['resolved'],
  'hotspots.projectKey': ['project', 'projectKey']
};

class DiscoveredCapabilities implements SonarApiCapabilities {
  constructor(
    public readonly available: boolean,
    public readonly endpoints: ReadonlyMap<string, EndpointCapabilities>
  ) {}

  chooseParameter(endpoint: string, preferred: string, alternatives: readonly string[]): string {
    const capability = this.endpoints.get(endpoint);
    if (!this.available || !capability) {
      return preferred;
    }
    if (preferred && capability.parameters.has(preferred)) {
      return preferred;
    }
    return alternatives.find(candidate => capability.parameters.has(candidate)) ?? '';
  }

  filterValues(endpoint: string, parameter: string, csv: string): string {
    if (!csv.trim()) {
      return '';
    }
    const possibleValues = this.endpoints.get(endpoint)?.parameters.get(parameter) ?? [];
    if (!this.available || possibleValues.length === 0) {
      return csv;
    }
    const accepted = new Set(possibleValues.map(value => value.toUpperCase()));
    return csv
      .split(',')
      .map(value => value.trim())
      .filter(value => accepted.has(value.toUpperCase()))
      .join(',');
  }
}

export const UNAVAILABLE_SONAR_CAPABILITIES: SonarApiCapabilities =
  new DiscoveredCapabilities(false, new Map());

interface CachedCompatibility {
  readonly loadedAt: number;
  readonly value: Promise<SonarCompatibility>;
}

const compatibilityCache = new Map<string, CachedCompatibility>();

export function parseSonarVersion(rawVersion: string | null | undefined): SonarVersion {
  const raw = rawVersion?.trim() ?? '';
  const match = VERSION_PATTERN.exec(raw);
  if (!match) {
    return { raw, major: 0, minor: 0 };
  }
  let major = Number.parseInt(match[1], 10) || 0;
  const minor = Number.parseInt(match[2] ?? '', 10) || 0;
  // La documentación puede usar 2025.x/2026.x y la instalación devolver 25.x/26.x.
  if (major >= 2000 && major <= 2099) {
    major -= 2000;
  }
  return { raw, major, minor };
}

function profileDistance(major: number, profile: SonarApiProfile): number {
  if (major < profile.minMajor) {
    return profile.minMajor - major;
  }
  if (major > profile.maxMajor) {
    return major - profile.maxMajor;
  }
  return 0;
}

export function selectSonarApiProfile(
  rawVersion: string | null | undefined
): SonarApiProfileSelection {
  const version = parseSonarVersion(rawVersion);
  const exact = SONAR_API_PROFILES.find(
    profile => version.major >= profile.minMajor && version.major <= profile.maxMajor
  );
  if (exact) {
    return { profile: exact, provisional: false, warning: '' };
  }

  const profile = version.major <= 0
    ? SONAR_API_PROFILES[0]
    : [...SONAR_API_PROFILES].sort(
        (left, right) =>
          profileDistance(version.major, left) - profileDistance(version.major, right)
      )[0];
  const warning = version.major <= 0
    ? `No se pudo determinar la versión de SonarQube; se usará el perfil ${profile.id}.`
    : `La versión ${version.raw} no tiene un perfil exacto; se usará ${profile.id} provisionalmente.`;
  return { profile, provisional: true, warning };
}

export function candidateProfiles(preferred: SonarApiProfile): readonly SonarApiProfile[] {
  return [
    preferred,
    ...SONAR_API_PROFILES.filter(profile => profile.id !== preferred.id)
  ];
}

function normalizeEndpoint(servicePath: string | undefined, actionKey: string | undefined): string {
  let service = servicePath?.trim() ?? '';
  if (!service.startsWith('/')) {
    service = `/${service}`;
  }
  if (!service.startsWith('/api/')) {
    service = `/api${service}`;
  }
  return actionKey?.trim() ? `${service}/${actionKey.trim()}` : service;
}

export function discoverSonarApiCapabilities(
  payload: SonarWebServicesResponse
): SonarApiCapabilities {
  const endpoints = new Map<string, EndpointCapabilities>();
  for (const service of payload.webServices ?? []) {
    for (const action of service.actions ?? []) {
      const endpoint = normalizeEndpoint(service.path, action.key);
      if (!TRACKED_ENDPOINTS.has(endpoint)) {
        continue;
      }
      const parameters = new Map<string, readonly string[]>();
      for (const parameter of action.params ?? []) {
        const key = parameter.key?.trim();
        if (key) {
          parameters.set(key, [...(parameter.possibleValues ?? [])]);
        }
      }
      endpoints.set(endpoint, { parameters });
    }
  }
  return new DiscoveredCapabilities(true, endpoints);
}

export async function resolveSonarCompatibility(
  cacheKey: string,
  request: <T>(endpoint: string) => Promise<T>
): Promise<SonarCompatibility> {
  const now = Date.now();
  const cached = compatibilityCache.get(cacheKey);
  if (cached && now - cached.loadedAt < COMPATIBILITY_CACHE_TTL_MS) {
    return cached.value;
  }

  const value = Promise.allSettled([
    request<SonarSystemStatusResponse>(SONAR_API_ENDPOINTS.systemStatus),
    request<SonarWebServicesResponse>(SONAR_API_ENDPOINTS.webServicesList)
  ]).then(([statusResult, capabilitiesResult]) => {
    const rawVersion = statusResult.status === 'fulfilled'
      ? statusResult.value.version ?? ''
      : '';
    return {
      version: parseSonarVersion(rawVersion),
      selection: selectSonarApiProfile(rawVersion),
      capabilities: capabilitiesResult.status === 'fulfilled'
        ? discoverSonarApiCapabilities(capabilitiesResult.value)
        : UNAVAILABLE_SONAR_CAPABILITIES
    };
  });
  compatibilityCache.set(cacheKey, { loadedAt: now, value });
  return value;
}

export function sonarCompatibilityInfo(
  compatibility: SonarCompatibility
): SonarCompatibilityInfo {
  return {
    version: compatibility.version.raw,
    major: compatibility.version.major,
    minor: compatibility.version.minor,
    profile: compatibility.selection.profile.id,
    profileGeneration: compatibility.selection.profile.generation,
    appliedProfiles: [compatibility.selection.profile.id],
    fallbackApplied: false,
    provisional: compatibility.selection.provisional,
    warning: compatibility.selection.warning,
    cleanCodeParameters: compatibility.selection.profile.cleanCodeParameters,
    capabilitiesAvailable: compatibility.capabilities.available
  };
}

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

export function translateIssueSearchParameters(
  profile: SonarApiProfile,
  canonical: CanonicalParameters,
  capabilities: SonarApiCapabilities = UNAVAILABLE_SONAR_CAPABILITIES
): URLSearchParams {
  const result = new URLSearchParams();
  const endpoint = profile.endpoints['issues.search'];

  for (const [key, rawValue] of Object.entries(canonical)) {
    const value = rawValue?.trim() ?? '';
    if (!key || !value) {
      continue;
    }
    if (key === 'componentKeys') {
      setParameter(
        result,
        effectiveParameter(capabilities, endpoint, profile, 'issues.projectKeys'),
        value
      );
    } else if (key === 'p') {
      result.set(profile.parameters['issues.page'], value);
    } else if (key === 'ps') {
      result.set(profile.parameters['issues.pageSize'], value);
    } else if (key === 'types') {
      setParameter(
        result,
        effectiveParameter(capabilities, endpoint, profile, 'issues.types'),
        profile.cleanCodeParameters ? toSoftwareQualities(value) : value
      );
    } else if (key === 'severities') {
      setParameter(
        result,
        effectiveParameter(capabilities, endpoint, profile, 'issues.severities'),
        profile.cleanCodeParameters ? toImpactSeverities(value) : value
      );
    } else if (key === 'statuses') {
      const parameter = effectiveParameter(
        capabilities,
        endpoint,
        profile,
        'issues.statuses'
      );
      setParameter(
        result,
        parameter,
        capabilities.filterValues(
          endpoint,
          parameter,
          profile.cleanCodeParameters ? toIssueStatuses(value) : value
        )
      );
    } else if (key === 'resolved') {
      const resolvedParameter = effectiveParameter(
        capabilities,
        endpoint,
        profile,
        'issues.resolved'
      );
      if (!profile.cleanCodeParameters && resolvedParameter) {
        result.set(resolvedParameter, value);
      } else if (
        !profile.cleanCodeParameters ||
        value.toLowerCase() === 'false' ||
        value.toLowerCase() === 'true'
      ) {
        const statusParameter = effectiveParameter(
          capabilities,
          endpoint,
          profile,
          'issues.statuses'
        );
        const statuses = value.toLowerCase() === 'false'
          ? profile.values['issues.openStatuses']
          : profile.values['issues.closedStatuses'];
        const filteredStatuses = capabilities.filterValues(
          endpoint,
          statusParameter,
          statuses.join(',')
        );
        if (filteredStatuses) {
          setParameter(result, statusParameter, filteredStatuses);
        } else {
          setParameter(result, resolvedParameter, value);
        }
      }
    } else if (key === 'inNewCodePeriod') {
      result.set(profile.parameters['issues.newCode'], value);
    } else if (key === 'facets') {
      result.set(
        profile.parameters['issues.facets'],
        profile.cleanCodeParameters ? toModernFacets(value) : value
      );
    } else if (key === 'searchText') {
      result.set(profile.parameters['issues.searchText'], value);
    } else if (key === 'resolutions') {
      continue;
    } else {
      result.set(key, value);
    }
  }

  const resolutions = canonical.resolutions?.trim() ?? '';
  if (resolutions) {
    if (profile.cleanCodeParameters) {
      const statusParameter = effectiveParameter(
        capabilities,
        endpoint,
        profile,
        'issues.statuses'
      );
      const statuses = capabilities.filterValues(
        endpoint,
        statusParameter,
        mergeCsv(result.get(statusParameter), toIssueStatuses(resolutions))
      );
      setParameter(result, statusParameter, statuses);
    } else {
      result.set('resolutions', resolutions);
    }
  }
  return result;
}

export function translateHotspotSearchParameters(
  profile: SonarApiProfile,
  canonical: CanonicalParameters,
  capabilities: SonarApiCapabilities = UNAVAILABLE_SONAR_CAPABILITIES
): URLSearchParams {
  const result = new URLSearchParams();
  const endpoint = profile.endpoints['hotspots.search'];
  for (const [key, rawValue] of Object.entries(canonical)) {
    const value = rawValue?.trim() ?? '';
    if (!key || !value) {
      continue;
    }
    if (key === 'projectKey') {
      setParameter(
        result,
        effectiveParameter(capabilities, endpoint, profile, 'hotspots.projectKey'),
        value
      );
    } else if (key === 'p') {
      result.set(profile.parameters['hotspots.page'], value);
    } else if (key === 'ps') {
      result.set(profile.parameters['hotspots.pageSize'], value);
    } else if (key === 'inNewCodePeriod') {
      result.set(profile.parameters['hotspots.newCode'], value);
    } else {
      result.set(key, value);
    }
  }
  return result;
}

function translateSimpleParameters(
  canonical: CanonicalParameters,
  aliases: Readonly<Record<string, string>>
): URLSearchParams {
  const result = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(canonical)) {
    const value = rawValue?.trim() ?? '';
    if (key && value) {
      result.set(aliases[key] ?? key, value);
    }
  }
  return result;
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
