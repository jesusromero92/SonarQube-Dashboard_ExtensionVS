import { createHash } from 'node:crypto';
import {
  SONAR_COVERAGE_METRICS,
  SONAR_EVOLUTION_METRICS,
  SONAR_MODE_SETTING_KEY,
  SONAR_PAGE_SIZE,
  SONAR_SUMMARY_METRICS
} from './constants';
import {
  candidateProfiles,
  resolveSonarCompatibility,
  SONAR_API_PROFILES,
  SonarApiProfile,
  SonarCompatibility,
  SonarCompatibilityInfo,
  sonarCompatibilityInfo,
  translateHotspotSearchParameters,
  translateIssueSearchParameters
} from './sonarApiCompatibility';
import {
  AnalysisPermissionStatus,
  FolderSonarConfig,
  EvolutionPoint,
  LoadedIssues,
  SonarInstanceMode,
  SonarIssue,
  SonarIssuesResponse,
  SonarCurrentMeasure,
  SonarComponent,
  SonarHistoryMeasure,
  SonarHotspot,
  SonarHotspotDetailResponse,
  SonarHotspotsResponse,
  SonarMeasuresHistoryResponse,
  SonarMeasuresComponentResponse,
  SonarProject,
  SonarProjectsResponse,
  SonarCreationCapabilities,
  SonarCurrentUserResponse,
  SonarNavigationGlobalResponse,
  SonarCreatedComponentResponse,
  CreateSonarComponentRequest,
  SonarQualityGateResponse,
  SonarRuleResponse,
  SonarSettingsResponse,
  QualityGateStatus,
  QualityGateSummary,
  DashboardHotspotDetail,
  DashboardRuleDetail,
  DefectTypeSummary,
  RatingGrade,
  RatingsSummary,
  CoverageTotals,
  DashboardIssue,
  DuplicationGroup,
  DuplicationLocation,
  FileCoverageDetail,
  IssueComment,
  IssueHistoryItem,
  IssueLifecycleDetail,
  IssueMutationRequest,
  IssueTransition,
  RemoteCoverageData,
  RemoteCoverageFile,
  SonarDuplicationFile,
  SonarDuplicationsResponse,
  SonarIssueChangelogResponse,
  SonarMeasureComponent,
  SonarMeasuresComponentTreeResponse,
  SonarSourceLinesResponse,
  SonarUser,
  SonarUsersResponse
} from './types';

export interface SonarRequestFailure {
  method: 'GET' | 'POST';
  endpoint: string;
  occurredAt: string;
  status?: number;
  message: string;
}

export interface SonarServerProbe {
  durationMs: number;
  status: string;
}

let lastSonarRequestFailure: SonarRequestFailure | undefined;

export function getLastSonarRequestFailure(): SonarRequestFailure | undefined {
  return lastSonarRequestFailure ? { ...lastSonarRequestFailure } : undefined;
}

function rememberSonarRequestFailure(
  method: 'GET' | 'POST',
  url: URL,
  error: unknown,
  status?: number
): void {
  lastSonarRequestFailure = {
    method,
    endpoint: url.pathname,
    occurredAt: new Date().toISOString(),
    status,
    message: error instanceof Error ? error.message : String(error)
  };
}

function normalizeServerUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, '');
}

function getTotal(response: SonarIssuesResponse): number {
  return response.paging?.total ?? response.total ?? response.issues.length;
}

async function requestJson<T>(
  url: URL,
  token: string,
  signal?: AbortSignal
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      },
      signal
    });
  } catch (error) {
    rememberSonarRequestFailure('GET', url, error);
    throw error;
  }

  if (!response.ok) {
    const body = await response.text();
    const detail = body.trim().slice(0, 500);
    const error = new SonarHttpError(
      response.status,
      `SonarQube respondió ${response.status} ${response.statusText}` +
        (detail ? `: ${detail}` : ''),
      detail
    );
    rememberSonarRequestFailure('GET', url, error, response.status);
    throw error;
  }

  return (await response.json()) as T;
}

async function requestForm<T>(
  url: URL,
  token: string,
  values: Record<string, string>,
  signal?: AbortSignal
): Promise<T> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== '') {
      body.set(key, value);
    }
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body,
      signal
    });
  } catch (error) {
    rememberSonarRequestFailure('POST', url, error);
    throw error;
  }
  if (!response.ok) {
    const detail = (await response.text()).trim().slice(0, 500);
    const error = new SonarHttpError(
      response.status,
      `SonarQube respondió ${response.status} ${response.statusText}` +
        (detail ? `: ${detail}` : ''),
      detail
    );
    rememberSonarRequestFailure('POST', url, error, response.status);
    throw error;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

class SonarHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body = ''
  ) {
    super(message);
    this.name = 'SonarHttpError';
  }
}

type CompatibleSearchEndpoint = 'issues.search' | 'hotspots.search';

const apiProfileOverrides = new Map<string, SonarApiProfile['id']>();

function isCompatibilityParameterError(error: unknown): boolean {
  if (!(error instanceof SonarHttpError)) {
    return false;
  }
  const detail = error.body.toLowerCase();
  if (error.status === 400) {
    return detail.includes('parameter') ||
      detail.includes('possible value') ||
      detail.includes('must be one of') ||
      detail.includes('not available') ||
      detail.includes('unknown') ||
      detail.includes('cannot be used');
  }
  if (error.status === 404 || error.status === 405) {
    return detail.includes('endpoint') ||
      detail.includes('web service') ||
      detail.includes('action') ||
      detail.includes('method not allowed') ||
      detail.includes('not found');
  }
  return false;
}

async function getSonarCompatibility(config: FolderSonarConfig): Promise<SonarCompatibility> {
  return resolveCompatibility(config.serverUrl, config.token);
}

async function resolveCompatibility(
  rawServerUrl: string,
  token: string
): Promise<SonarCompatibility> {
  const serverUrl = normalizeServerUrl(rawServerUrl);
  const credentialFingerprint = createHash('sha256')
    .update(token)
    .digest('hex');
  return resolveSonarCompatibility(
    `${serverUrl}\u0000${credentialFingerprint}`,
    endpoint => requestJson(new URL(`${serverUrl}${endpoint}`), token)
  );
}

export async function fetchSonarCompatibilityInfo(
  serverUrl: string,
  token: string
): Promise<SonarCompatibilityInfo> {
  const compatibility = await resolveCompatibility(serverUrl, token);
  const info = sonarCompatibilityInfo(compatibility);
  const overridePrefix = `${normalizeServerUrl(serverUrl)}|`;
  const overrideProfiles = [...apiProfileOverrides.entries()]
    .filter(([key]) => key.startsWith(overridePrefix))
    .map(([, profile]) => profile);
  const appliedProfiles = [...new Set([info.profile, ...overrideProfiles])];
  return {
    ...info,
    appliedProfiles,
    fallbackApplied: appliedProfiles.some(profile => profile !== info.profile)
  };
}

export async function probeSonarServer(
  serverUrl: string,
  token: string,
  signal?: AbortSignal
): Promise<SonarServerProbe> {
  const url = new URL(`${normalizeServerUrl(serverUrl)}/api/system/status`);
  const startedAt = Date.now();
  const payload = await requestJson<{ status?: string }>(url, token, signal);
  return {
    durationMs: Math.max(0, Date.now() - startedAt),
    status: payload.status ?? 'UP'
  };
}


async function requestCompatibleSearch<T>(
  config: FolderSonarConfig,
  compatibility: SonarCompatibility,
  endpoint: CompatibleSearchEndpoint,
  canonicalParameters: Readonly<Record<string, string | undefined>>,
  translate: (
    profile: SonarApiProfile,
    canonical: Readonly<Record<string, string | undefined>>,
    capabilities: SonarCompatibility['capabilities']
  ) => URLSearchParams,
  signal?: AbortSignal
): Promise<T> {
  const signature = Object.keys(canonicalParameters).sort().join(',');
  const overrideKey = [
    normalizeServerUrl(config.serverUrl),
    endpoint,
    signature
  ].join('|');
  const overrideId = apiProfileOverrides.get(overrideKey);
  const preferred = SONAR_API_PROFILES.find(profile => profile.id === overrideId) ??
    compatibility.selection.profile;
  const attempted = new Set<string>();
  let firstError: unknown;

  for (const profile of candidateProfiles(preferred)) {
    const parameters = translate(profile, canonicalParameters, compatibility.capabilities);
    const serialized = parameters.toString();
    if (attempted.has(serialized)) {
      continue;
    }
    attempted.add(serialized);

    const url = new URL(
      `${normalizeServerUrl(config.serverUrl)}${profile.endpoints[endpoint]}`
    );
    url.search = serialized;
    try {
      const response = await requestJson<T>(url, config.token, signal);
      apiProfileOverrides.set(overrideKey, profile.id);
      return response;
    } catch (error) {
      firstError ??= error;
      if (!isCompatibilityParameterError(error)) {
        throw error;
      }
    }
  }

  throw firstError ?? new Error(
    `No se pudo consultar ${endpoint} con ningún perfil compatible.`
  );
}

export async function checkAnalysisPermission(
  config: FolderSonarConfig,
  signal?: AbortSignal
): Promise<AnalysisPermissionStatus> {
  const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/analysis_cache/get`);
  url.searchParams.set('project', config.projectKey);
  if (config.branch?.trim()) {
    url.searchParams.set('branch', config.branch.trim());
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/octet-stream',
        Authorization: `Bearer ${config.token}`
      },
      signal
    });

    if (response.ok) {
      // La respuesta puede contener una caché grande. Para validar el permiso
      // solo necesitamos el status HTTP, no descargarla.
      await response.body?.cancel();
      return 'allowed';
    }

    const detail = (await response.text()).trim();
    if (
      response.status === 404 &&
      /no cache|cache (?:data )?is (?:empty|not available)|no cached data/i.test(detail)
    ) {
      // No tener caché es normal en el primer análisis; llegar a esta respuesta
      // confirma que SonarQube aceptó el permiso Execute Analysis.
      return 'allowed';
    }

    const error = new SonarHttpError(
      response.status,
      `SonarQube respondió ${response.status} ${response.statusText}` +
        (detail ? `: ${detail.slice(0, 500)}` : ''),
      detail.slice(0, 500)
    );
    rememberSonarRequestFailure('GET', url, error, response.status);
    if (response.status === 401 || response.status === 403) {
      return 'denied';
    }
    if (/not authorized|not authorised|unauthorized|forbidden|insufficient privileges/i.test(detail)) {
      return 'denied';
    }
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    rememberSonarRequestFailure('GET', url, error);
  }

  // SonarQube anterior a 9.4, proxies o endpoints deshabilitados no deben
  // producir un falso negativo. El scanner realizará la comprobación final.
  return 'unknown';
}

async function fetchProjectPages(
  serverUrl: string,
  token: string,
  endpoint: 'projects' | 'components',
  signal?: AbortSignal
): Promise<SonarProject[]> {
  const projects: SonarProject[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (projects.length < total) {
    const path = endpoint === 'projects'
      ? '/api/projects/search'
      : '/api/components/search';
    const url = new URL(`${normalizeServerUrl(serverUrl)}${path}`);
    url.searchParams.set('p', String(page));
    url.searchParams.set('ps', String(SONAR_PAGE_SIZE));

    if (endpoint === 'components') {
      url.searchParams.set('qualifiers', 'TRK,APP');
    }

    const payload = await requestJson<SonarProjectsResponse>(url, token, signal);
    const pageProjects = payload.components ?? payload.projects ?? [];
    projects.push(...pageProjects);
    total = payload.paging?.total ?? projects.length;

    if (pageProjects.length === 0) {
      break;
    }

    page += 1;
  }

  return projects;
}

export async function fetchVisibleProjects(
  serverUrl: string,
  token: string,
  signal?: AbortSignal
): Promise<SonarProject[]> {
  let projects: SonarProject[];

  try {
    projects = await fetchProjectPages(serverUrl, token, 'components', signal);
  } catch (error) {
    if (!(error instanceof SonarHttpError) || ![400, 404].includes(error.status)) {
      throw error;
    }
    projects = await fetchProjectPages(serverUrl, token, 'projects', signal);
  }

  const unique = new Map<string, SonarProject>();
  for (const project of projects) {
    if (project.key) {
      unique.set(project.key, {
        key: project.key,
        name: project.name || project.key,
        qualifier: project.qualifier,
        visibility: project.visibility
      });
    }
  }

  return [...unique.values()].sort((left, right) =>
    left.name.localeCompare(right.name, 'es', { sensitivity: 'base' })
  );
}


export async function fetchCreationCapabilities(
  serverUrl: string,
  token: string,
  signal?: AbortSignal
): Promise<SonarCreationCapabilities> {
  const unavailable: SonarCreationCapabilities = {
    canCreateProjects: false,
    canCreateApplications: false
  };

  try {
    const [currentUser, navigation] = await Promise.all([
      requestJson<SonarCurrentUserResponse>(
        new URL(`${normalizeServerUrl(serverUrl)}/api/users/current`),
        token,
        signal
      ),
      requestJson<SonarNavigationGlobalResponse>(
        new URL(`${normalizeServerUrl(serverUrl)}/api/navigation/global`),
        token,
        signal
      ).catch(() => ({ qualifiers: [] }))
    ]);

    const globalPermissions = new Set(
      (currentUser.permissions?.global ?? []).map(permission =>
        permission.toLowerCase()
      )
    );
    const isSystemAdministrator = globalPermissions.has('admin');
    const supportsApplications = (navigation.qualifiers ?? []).includes('APP');

    return {
      canCreateProjects:
        isSystemAdministrator || globalPermissions.has('provisioning'),
      canCreateApplications:
        supportsApplications &&
        (isSystemAdministrator || globalPermissions.has('applicationcreator'))
    };
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    if (
      error instanceof SonarHttpError &&
      [400, 401, 403, 404].includes(error.status)
    ) {
      return unavailable;
    }
    throw error;
  }
}

export async function createSonarComponent(
  serverUrl: string,
  token: string,
  request: CreateSonarComponentRequest,
  signal?: AbortSignal
): Promise<SonarProject> {
  const endpoint = request.kind === 'application'
    ? '/api/applications/create'
    : '/api/projects/create';
  const url = new URL(`${normalizeServerUrl(serverUrl)}${endpoint}`);
  const values: Record<string, string> = request.kind === 'application'
    ? {
        key: request.key,
        name: request.name,
        description: request.description ?? '',
        visibility: request.visibility ?? 'private'
      }
    : {
        project: request.key,
        name: request.name,
        visibility: request.visibility ?? 'private'
      };

  const payload = await requestForm<SonarCreatedComponentResponse>(
    url,
    token,
    values,
    signal
  );
  const component = request.kind === 'application'
    ? payload.application
    : payload.project;

  return component ?? {
    key: request.key,
    name: request.name,
    qualifier: request.kind === 'application' ? 'APP' : 'TRK',
    visibility: request.visibility
  };
}

export async function validateSonarToken(
  serverUrl: string,
  token: string,
  signal?: AbortSignal
): Promise<void> {
  const url = new URL(
    `${normalizeServerUrl(serverUrl)}/api/authentication/validate`
  );
  const payload = await requestJson<{ valid?: boolean }>(url, token, signal);
  if (payload.valid !== true) {
    throw new Error('El token de SonarQube no es válido.');
  }
}

async function fetchInstanceMode(
  config: FolderSonarConfig,
  signal?: AbortSignal
): Promise<SonarInstanceMode> {
  const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/settings/values`);
  url.searchParams.set('keys', SONAR_MODE_SETTING_KEY);

  try {
    const payload = await requestJson<SonarSettingsResponse>(url, config.token, signal);
    const setting = payload.settings?.find(item => item.key === SONAR_MODE_SETTING_KEY);
    const value = setting?.value ?? setting?.parentValue;

    if (value === 'true') {
      return 'MQR';
    }
    if (value === 'false') {
      return 'STANDARD';
    }
  } catch (error) {
    if (
      !(error instanceof SonarHttpError) ||
      ![400, 401, 403, 404].includes(error.status)
    ) {
      throw error;
    }
  }

  return 'UNKNOWN';
}

function inferInstanceMode(
  configuredMode: SonarInstanceMode,
  issues: SonarIssue[]
): SonarInstanceMode {
  if (configuredMode !== 'UNKNOWN') {
    return configuredMode;
  }

  const impactSeverities = new Set(
    issues.flatMap(issue =>
      (issue.impacts ?? []).map(impact => impact.severity?.toUpperCase())
    )
  );

  if (
    impactSeverities.has('HIGH') ||
    impactSeverities.has('MEDIUM') ||
    impactSeverities.has('LOW')
  ) {
    return 'MQR';
  }

  return 'STANDARD';
}

async function fetchRuleNames(
  config: FolderSonarConfig,
  ruleKeys: string[],
  signal?: AbortSignal
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < ruleKeys.length) {
      const ruleKey = ruleKeys[nextIndex++];
      const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/rules/show`);
      url.searchParams.set('key', ruleKey);

      try {
        const payload = await requestJson<SonarRuleResponse>(url, config.token, signal);
        const name = payload.rule?.name?.trim();
        if (name) {
          names.set(ruleKey, name);
        }
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }
        // La sincronización puede continuar mostrando el ruleKey como respaldo.
      }
    }
  }

  const workerCount = Math.min(6, ruleKeys.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return names;
}

function evolutionMetricProperty(metric: string): keyof Omit<EvolutionPoint, 'date' | 'label'> | undefined {
  const properties: Record<string, keyof Omit<EvolutionPoint, 'date' | 'label'>> = {
    bugs: 'bugs',
    code_smells: 'codeSmells',
    vulnerabilities: 'vulnerabilities',
    security_hotspots: 'securityHotspots',
    blocker_violations: 'blockerViolations',
    critical_violations: 'criticalViolations',
    major_violations: 'majorViolations',
    minor_violations: 'minorViolations',
    info_violations: 'infoViolations',
    new_bugs: 'newBugs',
    new_code_smells: 'newCodeSmells',
    new_vulnerabilities: 'newVulnerabilities',
    new_security_hotspots: 'newSecurityHotspots',
    new_blocker_violations: 'newBlockerViolations',
    new_critical_violations: 'newCriticalViolations',
    new_major_violations: 'newMajorViolations',
    new_minor_violations: 'newMinorViolations',
    new_info_violations: 'newInfoViolations',
    coverage: 'coverage',
    new_coverage: 'newCoverage',
    duplicated_lines_density: 'duplicatedLinesDensity',
    new_duplicated_lines_density: 'newDuplicatedLinesDensity'
  };
  return properties[metric];
}

function emptyEvolutionPoint(date: string): EvolutionPoint {
  return {
    date,
    label: date.slice(0, 10),
    bugs: 0,
    codeSmells: 0,
    vulnerabilities: 0,
    securityHotspots: 0,
    blockerViolations: 0,
    criticalViolations: 0,
    majorViolations: 0,
    minorViolations: 0,
    infoViolations: 0,
    newBugs: 0,
    newCodeSmells: 0,
    newVulnerabilities: 0,
    newSecurityHotspots: 0,
    newBlockerViolations: 0,
    newCriticalViolations: 0,
    newMajorViolations: 0,
    newMinorViolations: 0,
    newInfoViolations: 0,
    coverage: null,
    newCoverage: null,
    duplicatedLinesDensity: null,
    newDuplicatedLinesDensity: null
  };
}

export function buildEvolution(measures: SonarHistoryMeasure[]): EvolutionPoint[] {
  const byDate = new Map<string, EvolutionPoint>();

  for (const measure of measures) {
    const property = evolutionMetricProperty(measure.metric);
    if (!property) {
      continue;
    }
    for (const history of measure.history ?? []) {
      const point = byDate.get(history.date) ?? emptyEvolutionPoint(history.date);
      const parsedValue = Number(history.value);
      if (!Number.isFinite(parsedValue)) {
        continue;
      }
      point[property] = parsedValue;
      byDate.set(history.date, point);
    }
  }

  // Preserve every analysis. Charts apply their own day/week/month grouping,
  // while the summary cards always compare the two latest analyses.
  return [...byDate.values()].sort((left, right) =>
    Date.parse(left.date) - Date.parse(right.date)
  );
}

async function fetchAnalysisAvailability(
  config: FolderSonarConfig,
  signal?: AbortSignal
): Promise<boolean | null> {
  const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/project_analyses/search`);
  url.searchParams.set('project', config.projectKey);
  url.searchParams.set('ps', '1');
  if (config.branch?.trim()) {
    url.searchParams.set('branch', config.branch.trim());
  }

  try {
    const payload = await requestJson<{ analyses?: unknown[] }>(url, config.token, signal);
    return (payload.analyses?.length ?? 0) > 0;
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    return null;
  }
}

async function fetchEvolution(
  config: FolderSonarConfig,
  signal?: AbortSignal
): Promise<EvolutionPoint[]> {
  const requestMetrics = async (metrics: readonly string[]): Promise<SonarHistoryMeasure[]> => {
    const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/measures/search_history`);
    url.searchParams.set('component', config.projectKey);
    url.searchParams.set('metrics', metrics.join(','));
    url.searchParams.set('ps', String(SONAR_PAGE_SIZE));
    if (config.branch?.trim()) {
      url.searchParams.set('branch', config.branch.trim());
    }
    const payload = await requestJson<SonarMeasuresHistoryResponse>(url, config.token, signal);
    return payload.measures ?? [];
  };

  try {
    return buildEvolution(await requestMetrics(SONAR_EVOLUTION_METRICS));
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    const measures: Array<SonarHistoryMeasure | undefined> =
      new Array(SONAR_EVOLUTION_METRICS.length);
    let nextMetricIndex = 0;
    const worker = async (): Promise<void> => {
      while (nextMetricIndex < SONAR_EVOLUTION_METRICS.length) {
        const metricIndex = nextMetricIndex++;
        const metric = SONAR_EVOLUTION_METRICS[metricIndex];
        try {
          measures[metricIndex] = (await requestMetrics([metric]))[0];
        } catch (metricError) {
          if (signal?.aborted) {
            throw metricError;
          }
        }
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(4, SONAR_EVOLUTION_METRICS.length) },
        () => worker()
      )
    );
    return buildEvolution(measures.filter((measure): measure is SonarHistoryMeasure => Boolean(measure)));
  }
}

function normalizeQualityGateStatus(status?: string): QualityGateStatus {
  const normalized = status?.toUpperCase();
  if (normalized === 'OK' || normalized === 'WARN' || normalized === 'ERROR') {
    return normalized;
  }
  return 'NONE';
}

async function fetchQualityGate(
  config: FolderSonarConfig,
  signal?: AbortSignal
): Promise<QualityGateSummary> {
  const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/qualitygates/project_status`);
  url.searchParams.set('projectKey', config.projectKey);
  if (config.branch?.trim()) {
    url.searchParams.set('branch', config.branch.trim());
  }

  try {
    const payload = await requestJson<SonarQualityGateResponse>(url, config.token, signal);
    return {
      status: normalizeQualityGateStatus(payload.projectStatus?.status),
      conditions: (payload.projectStatus?.conditions ?? []).map(condition => ({
        status: normalizeQualityGateStatus(condition.status),
        metricKey: condition.metricKey ?? '',
        comparator: condition.comparator ?? '',
        errorThreshold: condition.errorThreshold ?? '',
        actualValue: condition.actualValue ?? '',
        scope: condition.periodIndex !== undefined || condition.metricKey?.startsWith('new_')
          ? 'newCode'
          : 'overall',
        projectKey: config.projectKey
      }))
    };
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    return { status: 'NONE', conditions: [] };
  }
}

function normalizeRating(value?: string): RatingGrade {
  const normalized = value?.trim().toUpperCase();
  const map: Record<string, RatingGrade> = {
    '1': 'A',
    '1.0': 'A',
    '2': 'B',
    '2.0': 'B',
    '3': 'C',
    '3.0': 'C',
    '4': 'D',
    '4.0': 'D',
    '5': 'E',
    '5.0': 'E',
    A: 'A',
    B: 'B',
    C: 'C',
    D: 'D',
    E: 'E'
  };
  return normalized ? map[normalized] ?? 'NONE' : 'NONE';
}

async function fetchSummaryMetrics(
  config: FolderSonarConfig,
  signal?: AbortSignal
): Promise<{
  ratings: RatingsSummary;
  types: DefectTypeSummary;
  newTypes: DefectTypeSummary;
}> {
  const requestMetrics = async (metrics: readonly string[]): Promise<SonarMeasuresComponentResponse> => {
    const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/measures/component`);
    url.searchParams.set('component', config.projectKey);
    url.searchParams.set('metricKeys', metrics.join(','));
    if (config.branch?.trim()) {
      url.searchParams.set('branch', config.branch.trim());
    }
    return requestJson<SonarMeasuresComponentResponse>(url, config.token, signal);
  };

  let measures: SonarCurrentMeasure[] = [];
  try {
    measures = (await requestMetrics(SONAR_SUMMARY_METRICS)).component?.measures ?? [];
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    const responses = await Promise.all(
      SONAR_SUMMARY_METRICS.map(async metric => {
        try {
          return (await requestMetrics([metric])).component?.measures?.[0];
        } catch (metricError) {
          if (signal?.aborted) {
            throw metricError;
          }
          return undefined;
        }
      })
    );
    measures = responses.filter(
      (measure): measure is NonNullable<typeof measure> => Boolean(measure)
    );
  }

  const values = new Map(
    measures.map(measure => [
      measure.metric,
      measure.value ?? measure.period?.value
    ])
  );
  return {
    ratings: {
      overall: {
        maintainability: normalizeRating(values.get('sqale_rating')),
        reliability: normalizeRating(values.get('reliability_rating')),
        security: normalizeRating(values.get('security_rating')),
        securityReview: normalizeRating(values.get('security_review_rating'))
      },
      newCode: {
        maintainability: normalizeRating(values.get('new_maintainability_rating')),
        reliability: normalizeRating(values.get('new_reliability_rating')),
        security: normalizeRating(values.get('new_security_rating')),
        securityReview: normalizeRating(values.get('new_security_review_rating'))
      }
    },
    types: {
      bugs: Number(values.get('bugs')) || 0,
      codeSmells: Number(values.get('code_smells')) || 0,
      vulnerabilities: Number(values.get('vulnerabilities')) || 0,
      securityHotspots: Number(values.get('security_hotspots')) || 0
    },
    newTypes: {
      bugs: Number(values.get('new_bugs')) || 0,
      codeSmells: Number(values.get('new_code_smells')) || 0,
      vulnerabilities: Number(values.get('new_vulnerabilities')) || 0,
      securityHotspots: Number(values.get('new_security_hotspots')) || 0
    }
  };
}


function numberMeasure(measures: readonly SonarCurrentMeasure[] | undefined, key: string): number | null {
  const measure = measures?.find(item => item.metric === key);
  const raw = measure?.value ?? measure?.period?.value;
  if (raw === undefined || raw === '') {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function integerMeasure(measures: readonly SonarCurrentMeasure[] | undefined, key: string): number {
  return Math.max(0, Math.round(numberMeasure(measures, key) ?? 0));
}

function coverageTotals(measures: readonly SonarCurrentMeasure[] | undefined, newCode: boolean): CoverageTotals {
  const prefix = newCode ? 'new_' : '';
  return {
    coverage: numberMeasure(measures, `${prefix}coverage`),
    lineCoverage: numberMeasure(measures, `${prefix}line_coverage`),
    branchCoverage: numberMeasure(measures, `${prefix}branch_coverage`),
    linesToCover: integerMeasure(measures, `${prefix}lines_to_cover`),
    uncoveredLines: integerMeasure(measures, `${prefix}uncovered_lines`),
    duplicatedLinesDensity: numberMeasure(measures, `${prefix}duplicated_lines_density`),
    duplicatedBlocks: newCode ? 0 : integerMeasure(measures, 'duplicated_blocks'),
    duplicatedLines: newCode ? 0 : integerMeasure(measures, 'duplicated_lines')
  };
}

function remoteCoverageFile(component: SonarMeasureComponent): RemoteCoverageFile | undefined {
  const path = component.path?.trim();
  if (!path) {
    return undefined;
  }
  const measures = component.measures ?? [];
  return {
    component: component.key,
    path,
    name: component.name ?? path.split('/').pop() ?? path,
    coverage: numberMeasure(measures, 'coverage'),
    newCoverage: numberMeasure(measures, 'new_coverage'),
    lineCoverage: numberMeasure(measures, 'line_coverage'),
    newLineCoverage: numberMeasure(measures, 'new_line_coverage'),
    branchCoverage: numberMeasure(measures, 'branch_coverage'),
    newBranchCoverage: numberMeasure(measures, 'new_branch_coverage'),
    linesToCover: integerMeasure(measures, 'lines_to_cover'),
    newLinesToCover: integerMeasure(measures, 'new_lines_to_cover'),
    uncoveredLines: integerMeasure(measures, 'uncovered_lines'),
    newUncoveredLines: integerMeasure(measures, 'new_uncovered_lines'),
    duplicatedLinesDensity: numberMeasure(measures, 'duplicated_lines_density'),
    newDuplicatedLinesDensity: numberMeasure(measures, 'new_duplicated_lines_density'),
    duplicatedBlocks: integerMeasure(measures, 'duplicated_blocks'),
    duplicatedLines: integerMeasure(measures, 'duplicated_lines')
  };
}

async function fetchCoverageData(
  config: FolderSonarConfig,
  signal?: AbortSignal
): Promise<RemoteCoverageData> {
  const projectUrl = new URL(`${normalizeServerUrl(config.serverUrl)}/api/measures/component`);
  projectUrl.searchParams.set('component', config.projectKey);
  projectUrl.searchParams.set('metricKeys', SONAR_COVERAGE_METRICS.join(','));
  if (config.branch?.trim()) {
    projectUrl.searchParams.set('branch', config.branch.trim());
  }

  const projectPayload = await requestJson<SonarMeasuresComponentResponse>(
    projectUrl,
    config.token,
    signal
  ).catch(() => ({ component: { measures: [] } }));
  const projectMeasures = projectPayload.component?.measures ?? [];
  const files: RemoteCoverageFile[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (files.length < total) {
    const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/measures/component_tree`);
    url.searchParams.set('component', config.projectKey);
    url.searchParams.set('metricKeys', SONAR_COVERAGE_METRICS.join(','));
    url.searchParams.set('qualifiers', 'FIL');
    url.searchParams.set('strategy', 'leaves');
    url.searchParams.set('p', String(page));
    url.searchParams.set('ps', String(SONAR_PAGE_SIZE));
    if (config.branch?.trim()) {
      url.searchParams.set('branch', config.branch.trim());
    }
    try {
      const payload = await requestJson<SonarMeasuresComponentTreeResponse>(url, config.token, signal);
      const pageFiles = (payload.components ?? [])
        .map(remoteCoverageFile)
        .filter((item): item is RemoteCoverageFile => Boolean(item));
      files.push(...pageFiles);
      total = payload.paging?.total ?? files.length;
      if ((payload.components ?? []).length === 0) {
        break;
      }
      page += 1;
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      break;
    }
  }

  return {
    overall: coverageTotals(projectMeasures, false),
    newCode: coverageTotals(projectMeasures, true),
    files
  };
}

function createIssueSearchParameters(
  config: FolderSonarConfig,
  onlyNewCode: boolean,
  page: number
): Readonly<Record<string, string | undefined>> {
  return {
    componentKeys: config.projectKey,
    resolved: 'false',
    additionalFields: '_all',
    p: String(page),
    ps: String(SONAR_PAGE_SIZE),
    inNewCodePeriod: onlyNewCode ? 'true' : undefined,
    branch: config.branch?.trim() || undefined
  };
}

function collectIssueComponents(
  target: Map<string, SonarComponent>,
  source: readonly SonarComponent[] | undefined
): void {
  for (const component of source ?? []) {
    target.set(component.key, component);
  }
}

async function fetchIssueSet(
  config: FolderSonarConfig,
  compatibility: SonarCompatibility,
  onlyNewCode: boolean,
  signal?: AbortSignal
): Promise<{ issues: SonarIssue[]; components: SonarComponent[] }> {
  const issues: SonarIssue[] = [];
  const components = new Map<string, SonarComponent>();
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (issues.length < total) {
    const payload = await requestCompatibleSearch<SonarIssuesResponse>(
      config,
      compatibility,
      'issues.search',
      createIssueSearchParameters(config, onlyNewCode, page),
      translateIssueSearchParameters,
      signal
    );

    total = getTotal(payload);
    issues.push(...payload.issues);
    collectIssueComponents(components, payload.components);
    if (payload.issues.length === 0) {
      break;
    }
    page += 1;
  }

  return { issues, components: [...components.values()] };
}

async function fetchNewIssueSet(
  config: FolderSonarConfig,
  compatibility: SonarCompatibility,
  signal?: AbortSignal
): Promise<{ issues: SonarIssue[]; components: SonarComponent[] }> {
  try {
    return await fetchIssueSet(config, compatibility, true, signal);
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    return { issues: [], components: [] };
  }
}

function hotspotItems(payload: SonarHotspotsResponse): SonarHotspot[] {
  return payload.hotspots ?? payload.issues ?? payload.items ?? [];
}

async function fetchHotspotSet(
  config: FolderSonarConfig,
  compatibility: SonarCompatibility,
  onlyNewCode: boolean,
  signal?: AbortSignal
): Promise<SonarHotspot[]> {
  const hotspots: SonarHotspot[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  try {
    while (hotspots.length < total) {
      const payload = await requestCompatibleSearch<SonarHotspotsResponse>(
        config,
        compatibility,
        'hotspots.search',
        {
          projectKey: config.projectKey,
          p: String(page),
          ps: String(SONAR_PAGE_SIZE),
          inNewCodePeriod: onlyNewCode ? 'true' : undefined,
          branch: config.branch?.trim() || undefined
        },
        translateHotspotSearchParameters,
        signal
      );
      const pageItems = hotspotItems(payload);
      hotspots.push(...pageItems);
      total = payload.paging?.total ?? hotspots.length;
      if (pageItems.length === 0) {
        break;
      }
      page += 1;
    }
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
  }

  return hotspots;
}

export async function fetchHotspotDetail(
  config: FolderSonarConfig,
  hotspotKey: string,
  signal?: AbortSignal
): Promise<DashboardHotspotDetail> {
  const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/hotspots/show`);
  url.searchParams.set('hotspot', hotspotKey);
  const payload = await requestJson<SonarHotspotDetailResponse>(
    url,
    config.token,
    signal
  );
  const rule = payload.rule ?? {};
  return {
    key: payload.key ?? hotspotKey,
    ruleKey: rule.key ?? '',
    ruleName: rule.name ?? rule.key ?? 'Security Hotspot',
    message: payload.message ?? '',
    status: payload.status ?? '',
    resolution: payload.resolution ?? '',
    priority: payload.vulnerabilityProbability ?? '',
    riskDescription: rule.riskDescription ?? '',
    vulnerabilityDescription: rule.vulnerabilityDescription ?? '',
    fixRecommendations: rule.fixRecommendations ?? ''
  };
}


function firstDefinedText(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) {
      return normalized;
    }
  }
  return '';
}

function ruleRemediation(rule: NonNullable<SonarRuleResponse['rule']>): DashboardRuleDetail['remediation'] {
  return {
    functionType: firstDefinedText(
      rule.remFnType,
      rule.debtRemFnType,
      rule.defaultRemFnType,
      rule.defaultDebtRemFnType
    ),
    baseEffort: firstDefinedText(
      rule.remFnBaseEffort,
      rule.debtRemFnBaseEffort,
      rule.defaultRemFnBaseEffort,
      rule.defaultDebtRemFnBaseEffort
    ),
    gapMultiplier: firstDefinedText(
      rule.remFnGapMultiplier,
      rule.debtRemFnGapMultiplier,
      rule.defaultRemFnGapMultiplier,
      rule.defaultDebtRemFnGapMultiplier
    ),
    gapDescription: rule.gapDescription?.trim() ?? ''
  };
}

export async function fetchRuleDetail(
  config: FolderSonarConfig,
  ruleKey: string,
  signal?: AbortSignal
): Promise<DashboardRuleDetail> {
  const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/rules/show`);
  url.searchParams.set('key', ruleKey);
  url.searchParams.set('actives', 'true');

  const payload = await requestJson<SonarRuleResponse>(
    url,
    config.token,
    signal
  );
  const rule = payload.rule;

  if (!rule) {
    throw new Error(`SonarQube no devolvió información para la regla ${ruleKey}.`);
  }

  const tags = [
    ...(rule.tags ?? []),
    ...(rule.sysTags ?? [])
  ]
    .map(tag => tag.trim())
    .filter(Boolean);

  return {
    key: firstDefinedText(rule.key, ruleKey),
    repository: rule.repo?.trim() ?? '',
    name: firstDefinedText(rule.name, rule.key, ruleKey),
    language: rule.lang?.trim() ?? '',
    languageName: rule.langName?.trim() ?? '',
    status: rule.status?.trim() ?? '',
    type: rule.type?.trim() ?? '',
    severity: rule.severity?.trim() ?? '',
    scope: rule.scope?.trim() ?? '',
    description: firstDefinedText(rule.htmlDesc, rule.mdDesc),
    note: firstDefinedText(rule.htmlNote, rule.mdNote),
    cleanCodeAttribute: rule.cleanCodeAttribute?.trim() ?? '',
    cleanCodeAttributeCategory:
      rule.cleanCodeAttributeCategory?.trim() ?? '',
    impacts: rule.impacts ?? [],
    remediation: ruleRemediation(rule),
    parameters: (rule.params ?? []).map(parameter => ({
      key: parameter.key,
      description: parameter.htmlDesc?.trim() ?? '',
      defaultValue: parameter.defaultValue?.trim() ?? '',
      type: parameter.type?.trim() ?? ''
    })),
    tags: [...new Set(tags)],
    activeProfiles: (payload.actives ?? []).map(active => ({
      profile: active.qProfile?.trim() ?? '',
      inheritance: active.inherit?.trim() ?? '',
      severity: active.severity?.trim() ?? ''
    })),
    isTemplate: rule.isTemplate === true,
    templateKey: rule.templateKey?.trim() ?? '',
    isExternal: (rule.external ?? rule.isExternal) === true,
    createdAt: rule.createdAt?.trim() ?? '',
    updatedAt: rule.updatedAt?.trim() ?? ''
  };
}

export async function fetchAllIssues(
  config: FolderSonarConfig,
  signal?: AbortSignal
): Promise<LoadedIssues> {
  const componentPaths = new Map<string, string>();
  const compatibility = await getSonarCompatibility(config);
  const [
    configuredMode,
    overallResult,
    newCodeResult,
    hotspots,
    newHotspots,
    coverage
  ] = await Promise.all([
    fetchInstanceMode(config, signal),
    fetchIssueSet(config, compatibility, false, signal),
    fetchNewIssueSet(config, compatibility, signal),
    fetchHotspotSet(config, compatibility, false, signal),
    fetchHotspotSet(config, compatibility, true, signal),
    fetchCoverageData(config, signal)
  ]);
  for (const component of [...overallResult.components, ...newCodeResult.components]) {
    if (component.path) {
      componentPaths.set(component.key, component.path);
    }
  }

  const allIssues = [...overallResult.issues, ...newCodeResult.issues];
  const ruleKeys = [...new Set(allIssues.map(issue => issue.rule).filter(Boolean))];
  const ruleNames = await fetchRuleNames(config, ruleKeys, signal);
  for (const issue of allIssues) {
    issue.ruleName = ruleNames.get(issue.rule);
  }
  const [evolution, qualityGate, summaryMetrics, analysisAvailability] = await Promise.all([
    fetchEvolution(config, signal),
    fetchQualityGate(config, signal),
    fetchSummaryMetrics(config, signal),
    fetchAnalysisAvailability(config, signal)
  ]);

  return {
    issues: overallResult.issues,
    newIssues: newCodeResult.issues,
    hotspots,
    newHotspots,
    componentPaths,
    instanceMode: inferInstanceMode(configuredMode, overallResult.issues),
    hasAnalysis: analysisAvailability === true || evolution.length > 0,
    evolution,
    qualityGate,
    ratings: summaryMetrics.ratings,
    types: summaryMetrics.types,
    newTypes: summaryMetrics.newTypes,
    coverage
  };
}

function dashboardIssueFromSearch(issue: SonarIssue, fallback: DashboardIssue): DashboardIssue {
  return {
    ...fallback,
    status: issue.issueStatus ?? issue.status ?? fallback.status,
    resolution: issue.resolution ?? fallback.resolution,
    assignee: issue.assignee ?? fallback.assignee,
    author: issue.author ?? fallback.author,
    creationDate: issue.creationDate ?? fallback.creationDate,
    updateDate: issue.updateDate ?? fallback.updateDate
  };
}

async function fetchActiveUsers(
  config: FolderSonarConfig,
  signal?: AbortSignal
): Promise<SonarUser[]> {
  const users: SonarUser[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (users.length < total) {
    const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/users/search`);
    url.searchParams.set('p', String(page));
    url.searchParams.set('ps', String(SONAR_PAGE_SIZE));
    const payload = await requestJson<SonarUsersResponse>(url, config.token, signal);
    const pageUsers = (payload.users ?? []).filter(user => user.active !== false);
    users.push(...pageUsers);
    total = payload.paging?.total ?? users.length;
    if ((payload.users ?? []).length === 0) {
      break;
    }
    page += 1;
  }
  return users.sort((left, right) =>
    (left.name ?? left.login).localeCompare(right.name ?? right.login)
  );
}


export async function fetchCurrentUser(
  config: FolderSonarConfig,
  signal?: AbortSignal
): Promise<SonarUser> {
  const payload = await requestJson<SonarCurrentUserResponse>(
    new URL(`${normalizeServerUrl(config.serverUrl)}/api/users/current`),
    config.token,
    signal
  );
  const login = payload.login?.trim();
  if (!login) {
    throw new Error('SonarQube no devolvió el usuario autenticado para este token.');
  }
  return {
    login,
    name: payload.name?.trim() || login,
    active: payload.active
  };
}

export async function fetchIssueLifecycle(
  config: FolderSonarConfig,
  issue: DashboardIssue,
  signal?: AbortSignal
): Promise<IssueLifecycleDetail> {
  const searchUrl = new URL(`${normalizeServerUrl(config.serverUrl)}/api/issues/search`);
  searchUrl.searchParams.set('issues', issue.key);
  searchUrl.searchParams.set('additionalFields', '_all');
  const [search, changelog, users] = await Promise.all([
    requestJson<SonarIssuesResponse>(searchUrl, config.token, signal),
    (() => {
      const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/issues/changelog`);
      url.searchParams.set('issue', issue.key);
      return requestJson<SonarIssueChangelogResponse>(url, config.token, signal)
        .catch(() => ({ changelog: [] }));
    })(),
    fetchActiveUsers(config, signal).catch(() => [])
  ]);

  const current = search.issues[0];
  const comments: IssueComment[] = (current?.comments ?? []).map(comment => ({
    key: comment.key ?? '',
    user: comment.login ?? '',
    text: comment.markdown ?? comment.htmlText ?? '',
    createdAt: comment.createdAt ?? ''
  }));
  const history: IssueHistoryItem[] = (changelog.changelog ?? []).map(entry => ({
    date: entry.creationDate ?? '',
    user: entry.userName ?? entry.user ?? '',
    changes: (entry.diffs ?? []).map(diff => ({
      field: diff.key ?? '',
      oldValue: diff.oldValue ?? '',
      newValue: diff.newValue ?? ''
    }))
  }));
  const transitionItems: IssueTransition[] = (current?.transitions ?? []).map(key => ({
    key,
    name: key
  }));
  const availableActions = new Set(
    (current?.actions ?? []).map(action => action.trim().toLowerCase())
  );
  const actionMetadataAvailable = current?.actions !== undefined;
  const assignableUsers = users;
  return {
    issue: current ? dashboardIssueFromSearch(current, issue) : issue,
    transitions: transitionItems,
    comments,
    history,
    users: assignableUsers,
    canComment: actionMetadataAvailable
      ? availableActions.has('comment')
      : false,
    canAssign: actionMetadataAvailable
      ? availableActions.has('assign')
      : false
  };
}

export async function mutateIssue(
  config: FolderSonarConfig,
  request: IssueMutationRequest,
  signal?: AbortSignal
): Promise<void> {
  const base = normalizeServerUrl(config.serverUrl);
  if (request.kind === 'transition') {
    if (!request.transition) {
      throw new Error('No se indicó la transición del defecto.');
    }
    await requestForm(
      new URL(`${base}/api/issues/do_transition`),
      config.token,
      { issue: request.issueKey, transition: request.transition },
      signal
    );
    if (request.comment?.trim()) {
      await requestForm(
        new URL(`${base}/api/issues/add_comment`),
        config.token,
        { issue: request.issueKey, text: request.comment.trim() },
        signal
      );
    }
    return;
  }
  if (request.kind === 'assign') {
    await requestForm(
      new URL(`${base}/api/issues/assign`),
      config.token,
      { issue: request.issueKey, assignee: request.assignee ?? '' },
      signal
    );
    return;
  }
  if (!request.comment?.trim()) {
    throw new Error('El comentario no puede estar vacío.');
  }
  await requestForm(
    new URL(`${base}/api/issues/add_comment`),
    config.token,
    { issue: request.issueKey, text: request.comment.trim() },
    signal
  );
}

function lineStatus(lineHits: number | undefined, conditions: number, coveredConditions: number): 'covered' | 'partial' | 'uncovered' | 'none' {
  if (lineHits === undefined && conditions === 0) {
    return 'none';
  }
  if ((lineHits ?? 0) <= 0) {
    return 'uncovered';
  }
  if (conditions > 0 && coveredConditions < conditions) {
    return 'partial';
  }
  return 'covered';
}

export async function fetchFileCoverageDetail(
  config: FolderSonarConfig,
  file: import('./types').CoverageFileSummary,
  signal?: AbortSignal
): Promise<FileCoverageDetail> {
  const sourceUrl = new URL(`${normalizeServerUrl(config.serverUrl)}/api/sources/lines`);
  sourceUrl.searchParams.set('key', file.component);
  sourceUrl.searchParams.set('from', '1');
  sourceUrl.searchParams.set('to', '100000');
  if (config.branch?.trim()) {
    sourceUrl.searchParams.set('branch', config.branch.trim());
  }
  const source = await requestJson<SonarSourceLinesResponse>(sourceUrl, config.token, signal)
    .catch(() => ({ sources: [] }));

  const duplicationUrl = new URL(`${normalizeServerUrl(config.serverUrl)}/api/duplications/show`);
  duplicationUrl.searchParams.set('key', file.component);
  if (config.branch?.trim()) {
    duplicationUrl.searchParams.set('branch', config.branch.trim());
  }
  const duplication = await requestJson<SonarDuplicationsResponse>(duplicationUrl, config.token, signal)
    .catch(() => ({ duplications: [], files: {} }));
  const fileRefs: Record<string, SonarDuplicationFile> = duplication.files ?? {};
  const groups: DuplicationGroup[] = (duplication.duplications ?? []).map(group => ({
    locations: (group.blocks ?? []).map(block => {
      const referenced = block._ref ? fileRefs[block._ref] : undefined;
      const component = referenced?.key ?? file.component;
      const isCurrentFile = !block._ref || component === file.component;
      return {
        component,
        relativePath: isCurrentFile ? file.relativePath : referenced?.name ?? component,
        fileUri: isCurrentFile ? file.fileUri : '',
        from: block.from,
        size: block.size,
        isCurrentFile
      } satisfies DuplicationLocation;
    })
  }));
  return {
    file,
    lines: (source.sources ?? []).map(line => ({
      line: line.line,
      hits: line.lineHits ?? null,
      conditions: line.conditions ?? 0,
      coveredConditions: line.coveredConditions ?? 0,
      duplicated: Boolean(line.duplicated),
      status: lineStatus(line.lineHits, line.conditions ?? 0, line.coveredConditions ?? 0)
    })),
    duplications: groups
  };
}
