import {
  SONAR_COVERAGE_METRICS,
  SONAR_EVOLUTION_LIMIT,
  SONAR_EVOLUTION_METRICS,
  SONAR_MODE_SETTING_KEY,
  SONAR_PAGE_SIZE,
  SONAR_SUMMARY_METRICS
} from './constants';
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
  SonarQualityGateResponse,
  SonarRuleResponse,
  SonarSettingsResponse,
  QualityGateStatus,
  QualityGateSummary,
  DashboardHotspotDetail,
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
  SonarIssueTransitionsResponse,
  SonarMeasureComponent,
  SonarMeasuresComponentTreeResponse,
  SonarSourceLinesResponse,
  SonarUser,
  SonarUsersResponse
} from './types';

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
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
    signal
  });

  if (!response.ok) {
    const body = await response.text();
    const detail = body.trim().slice(0, 500);
    throw new SonarHttpError(
      response.status,
      `SonarQube respondió ${response.status} ${response.statusText}` +
        (detail ? `: ${detail}` : '')
    );
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
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body,
    signal
  });
  if (!response.ok) {
    const detail = (await response.text()).trim().slice(0, 500);
    throw new SonarHttpError(
      response.status,
      `SonarQube respondió ${response.status} ${response.statusText}` +
        (detail ? `: ${detail}` : '')
    );
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

class SonarHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'SonarHttpError';
  }
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
    if (response.status === 401 || response.status === 403) {
      return 'denied';
    }
    if (/not authorized|not authorised|unauthorized|forbidden|insufficient privileges/i.test(detail)) {
      return 'denied';
    }
    if (
      response.status === 404 &&
      /no cache|cache (?:data )?is (?:empty|not available)|no cached data/i.test(detail)
    ) {
      // No tener caché es normal en el primer análisis; llegar a esta respuesta
      // confirma que SonarQube aceptó el permiso Execute Analysis.
      return 'allowed';
    }
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
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
    coverage: 0,
    newCoverage: 0,
    duplicatedLinesDensity: 0,
    newDuplicatedLinesDensity: 0
  };
}

function weekBucket(date: string): string {
  const parsed = new Date(date);
  if (!Number.isFinite(parsed.getTime())) {
    return date.slice(0, 10);
  }
  const day = parsed.getUTCDay() || 7;
  parsed.setUTCDate(parsed.getUTCDate() - day + 1);
  return parsed.toISOString().slice(0, 10);
}

function buildEvolution(measures: SonarHistoryMeasure[]): EvolutionPoint[] {
  const byDate = new Map<string, EvolutionPoint>();

  for (const measure of measures) {
    const property = evolutionMetricProperty(measure.metric);
    if (!property) {
      continue;
    }
    for (const history of measure.history ?? []) {
      const point = byDate.get(history.date) ?? emptyEvolutionPoint(history.date);
      point[property] = Number(history.value) || 0;
      byDate.set(history.date, point);
    }
  }

  const byWeek = new Map<string, EvolutionPoint>();
  for (const point of [...byDate.values()].sort((left, right) =>
    Date.parse(left.date) - Date.parse(right.date)
  )) {
    const bucket = weekBucket(point.date);
    byWeek.set(bucket, { ...point, label: bucket });
  }

  return [...byWeek.values()].slice(-SONAR_EVOLUTION_LIMIT);
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

async function fetchIssueSet(
  config: FolderSonarConfig,
  onlyNewCode: boolean,
  signal?: AbortSignal
): Promise<{ issues: SonarIssue[]; components: SonarComponent[] }> {
  const issues: SonarIssue[] = [];
  const components = new Map<string, SonarComponent>();
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (issues.length < total) {
    const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/issues/search`);
    url.searchParams.set('componentKeys', config.projectKey);
    url.searchParams.set('resolved', 'false');
    url.searchParams.set('additionalFields', '_all');
    url.searchParams.set('p', String(page));
    url.searchParams.set('ps', String(SONAR_PAGE_SIZE));
    if (onlyNewCode) {
      url.searchParams.set('inNewCodePeriod', 'true');
    }
    if (config.branch?.trim()) {
      url.searchParams.set('branch', config.branch.trim());
    }

    const payload = await requestJson<SonarIssuesResponse>(url, config.token, signal);
    total = getTotal(payload);
    issues.push(...payload.issues);
    for (const component of payload.components ?? []) {
      components.set(component.key, component);
    }
    if (payload.issues.length === 0) {
      break;
    }
    page += 1;
  }

  return { issues, components: [...components.values()] };
}

async function fetchNewIssueSet(
  config: FolderSonarConfig,
  signal?: AbortSignal
): Promise<{ issues: SonarIssue[]; components: SonarComponent[] }> {
  try {
    return await fetchIssueSet(config, true, signal);
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
  onlyNewCode: boolean,
  signal?: AbortSignal
): Promise<SonarHotspot[]> {
  const hotspots: SonarHotspot[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  try {
    while (hotspots.length < total) {
      const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/hotspots/search`);
      url.searchParams.set('projectKey', config.projectKey);
      url.searchParams.set('p', String(page));
      url.searchParams.set('ps', String(SONAR_PAGE_SIZE));
      if (onlyNewCode) {
        url.searchParams.set('inNewCodePeriod', 'true');
      }
      if (config.branch?.trim()) {
        url.searchParams.set('branch', config.branch.trim());
      }
      const payload = await requestJson<SonarHotspotsResponse>(url, config.token, signal);
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

export async function fetchAllIssues(
  config: FolderSonarConfig,
  signal?: AbortSignal
): Promise<LoadedIssues> {
  const componentPaths = new Map<string, string>();
  const [
    configuredMode,
    overallResult,
    newCodeResult,
    hotspots,
    newHotspots,
    coverage
  ] = await Promise.all([
    fetchInstanceMode(config, signal),
    fetchIssueSet(config, false, signal),
    fetchNewIssueSet(config, signal),
    fetchHotspotSet(config, false, signal),
    fetchHotspotSet(config, true, signal),
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
  const [evolution, qualityGate, summaryMetrics] = await Promise.all([
    fetchEvolution(config, signal),
    fetchQualityGate(config, signal),
    fetchSummaryMetrics(config, signal)
  ]);

  return {
    issues: overallResult.issues,
    newIssues: newCodeResult.issues,
    hotspots,
    newHotspots,
    componentPaths,
    instanceMode: inferInstanceMode(configuredMode, overallResult.issues),
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
    status: issue.status || fallback.status,
    resolution: issue.resolution ?? fallback.resolution,
    assignee: issue.assignee ?? fallback.assignee,
    author: issue.author ?? fallback.author,
    creationDate: issue.creationDate ?? fallback.creationDate,
    updateDate: issue.updateDate ?? fallback.updateDate
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
  const [search, transitions, changelog, users] = await Promise.all([
    requestJson<SonarIssuesResponse>(searchUrl, config.token, signal).catch(() => ({ total: 0, issues: [] })),
    (() => {
      const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/issues/transitions`);
      url.searchParams.set('issue', issue.key);
      return requestJson<SonarIssueTransitionsResponse>(url, config.token, signal)
        .catch(() => ({ transitions: [] }));
    })(),
    (() => {
      const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/issues/changelog`);
      url.searchParams.set('issue', issue.key);
      return requestJson<SonarIssueChangelogResponse>(url, config.token, signal)
        .catch(() => ({ changelog: [] }));
    })(),
    (() => {
      const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/users/search`);
      url.searchParams.set('ps', '100');
      return requestJson<SonarUsersResponse>(url, config.token, signal)
        .catch(() => ({ users: [] }));
    })()
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
  const transitionItems: IssueTransition[] = (transitions.transitions ?? []).map(item => ({
    key: item.key,
    name: item.name ?? item.key
  }));
  const availableActions = new Set(
    (current?.actions ?? []).map(action => action.trim().toLowerCase())
  );
  const actionMetadataAvailable = current?.actions !== undefined;
  const hasBrowsePermission = Boolean(current);
  const assignableUsers = (users.users ?? []).filter(user => user.active !== false);
  return {
    issue: current ? dashboardIssueFromSearch(current, issue) : issue,
    transitions: transitionItems,
    comments,
    history,
    users: assignableUsers,
    canComment: actionMetadataAvailable
      ? availableActions.has('comment')
      : hasBrowsePermission,
    canAssign: (actionMetadataAvailable
      ? availableActions.has('assign')
      : hasBrowsePermission) && assignableUsers.length > 0
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

