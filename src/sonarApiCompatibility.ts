import type {
  CanonicalParameters,
  LogicalParameter
} from './sonarApi/contracts';
import {
  translateHotspotSearchParameters as translateHotspotParameters,
  translateIssueSearchParameters as translateIssueParameters
} from './sonarApi/searchParameterTranslation';

export {
  translateComponentShowParameters,
  translateProjectAnalysesParameters,
  translateProjectBranchesParameters
} from './sonarApi/searchParameterTranslation';

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

function isConnectionFailure(error: unknown): boolean {
  const message = error instanceof Error
    ? `${error.message} ${String(error.cause ?? '')}`
    : String(error);

  return error instanceof TypeError ||
    /fetch failed|network|enotfound|econnrefused|econnreset|etimedout|certificate|ssl|tls/i.test(
      message
    );
}

function firstConnectionFailure(
  results: readonly PromiseSettledResult<unknown>[]
): unknown | undefined {
  return results
    .filter(
      (result): result is PromiseRejectedResult =>
        result.status === 'rejected'
    )
    .map(result => result.reason)
    .find(isConnectionFailure);
}

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
  ]).then(results => {
    const [statusResult, capabilitiesResult] = results;
    const successfulProbe = results.some(result => result.status === 'fulfilled');
    const connectionFailure = firstConnectionFailure(results);

    if (!successfulProbe && connectionFailure) {
      throw connectionFailure;
    }

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
  value.then(
    compatibility => {
      // Durante un reinicio parcial SonarQube puede servir webservices/list antes
      // que system/status. El perfil provisional permite continuar y listar los
      // proyectos, pero no debe quedar fijado durante el TTL de la caché.
      if (
        compatibility.version.major <= 0 &&
        compatibilityCache.get(cacheKey)?.value === value
      ) {
        compatibilityCache.delete(cacheKey);
      }
    },
    () => undefined
  );
  value.catch(() => {
    if (compatibilityCache.get(cacheKey)?.value === value) {
      compatibilityCache.delete(cacheKey);
    }
  });
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

export function translateIssueSearchParameters(
  profile: SonarApiProfile,
  canonical: CanonicalParameters,
  capabilities: SonarApiCapabilities = UNAVAILABLE_SONAR_CAPABILITIES
): URLSearchParams {
  return translateIssueParameters(profile, canonical, capabilities);
}

export function translateHotspotSearchParameters(
  profile: SonarApiProfile,
  canonical: CanonicalParameters,
  capabilities: SonarApiCapabilities = UNAVAILABLE_SONAR_CAPABILITIES
): URLSearchParams {
  return translateHotspotParameters(profile, canonical, capabilities);
}
