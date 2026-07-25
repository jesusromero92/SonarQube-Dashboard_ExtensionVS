import {
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
  RatingsSummary
} from './types';

const PAGE_SIZE = 500;
const MODE_SETTING_KEY = 'sonar.multi-quality-mode.enabled';
const EVOLUTION_LIMIT = 15;
const EVOLUTION_METRICS = [
  'bugs',
  'code_smells',
  'vulnerabilities',
  'security_hotspots',
  'blocker_violations',
  'critical_violations',
  'major_violations',
  'minor_violations',
  'info_violations',
  'new_bugs',
  'new_code_smells',
  'new_vulnerabilities',
  'new_security_hotspots',
  'new_blocker_violations',
  'new_critical_violations',
  'new_major_violations',
  'new_minor_violations',
  'new_info_violations'
] as const;
const SUMMARY_METRICS = [
  'sqale_rating',
  'reliability_rating',
  'security_rating',
  'security_review_rating',
  'new_maintainability_rating',
  'new_reliability_rating',
  'new_security_rating',
  'new_security_review_rating',
  'bugs',
  'code_smells',
  'vulnerabilities',
  'security_hotspots',
  'new_bugs',
  'new_code_smells',
  'new_vulnerabilities',
  'new_security_hotspots'
] as const;

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

class SonarHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'SonarHttpError';
  }
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
    url.searchParams.set('ps', String(PAGE_SIZE));

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
  url.searchParams.set('keys', MODE_SETTING_KEY);

  try {
    const payload = await requestJson<SonarSettingsResponse>(url, config.token, signal);
    const setting = payload.settings?.find(item => item.key === MODE_SETTING_KEY);
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
    new_info_violations: 'newInfoViolations'
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
    newInfoViolations: 0
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

  return [...byWeek.values()].slice(-EVOLUTION_LIMIT);
}

async function fetchEvolution(
  config: FolderSonarConfig,
  signal?: AbortSignal
): Promise<EvolutionPoint[]> {
  const requestMetrics = async (metrics: readonly string[]): Promise<SonarHistoryMeasure[]> => {
    const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/measures/search_history`);
    url.searchParams.set('component', config.projectKey);
    url.searchParams.set('metrics', metrics.join(','));
    url.searchParams.set('ps', String(PAGE_SIZE));
    if (config.branch?.trim()) {
      url.searchParams.set('branch', config.branch.trim());
    }
    const payload = await requestJson<SonarMeasuresHistoryResponse>(url, config.token, signal);
    return payload.measures ?? [];
  };

  try {
    return buildEvolution(await requestMetrics(EVOLUTION_METRICS));
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    const measures: Array<SonarHistoryMeasure | undefined> =
      new Array(EVOLUTION_METRICS.length);
    let nextMetricIndex = 0;
    const worker = async (): Promise<void> => {
      while (nextMetricIndex < EVOLUTION_METRICS.length) {
        const metricIndex = nextMetricIndex++;
        const metric = EVOLUTION_METRICS[metricIndex];
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
        { length: Math.min(4, EVOLUTION_METRICS.length) },
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
    measures = (await requestMetrics(SUMMARY_METRICS)).component?.measures ?? [];
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    const responses = await Promise.all(
      SUMMARY_METRICS.map(async metric => {
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
    url.searchParams.set('p', String(page));
    url.searchParams.set('ps', String(PAGE_SIZE));
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
      url.searchParams.set('ps', String(PAGE_SIZE));
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
    newHotspots
  ] = await Promise.all([
    fetchInstanceMode(config, signal),
    fetchIssueSet(config, false, signal),
    fetchNewIssueSet(config, signal),
    fetchHotspotSet(config, false, signal),
    fetchHotspotSet(config, true, signal)
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
    newTypes: summaryMetrics.newTypes
  };
}
