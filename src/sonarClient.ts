import {
  FolderSonarConfig,
  LoadedIssues,
  SonarInstanceMode,
  SonarIssue,
  SonarIssuesResponse,
  SonarProject,
  SonarProjectsResponse,
  SonarSettingsResponse
} from './types';

const PAGE_SIZE = 500;
const MODE_SETTING_KEY = 'sonar.multi-quality-mode.enabled';

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

export async function fetchAllIssues(
  config: FolderSonarConfig,
  signal?: AbortSignal
): Promise<LoadedIssues> {
  const issues: SonarIssue[] = [];
  const componentPaths = new Map<string, string>();
  const configuredMode = await fetchInstanceMode(config, signal);
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (issues.length < total) {
    const url = new URL(`${normalizeServerUrl(config.serverUrl)}/api/issues/search`);
    url.searchParams.set('componentKeys', config.projectKey);
    url.searchParams.set('resolved', 'false');
    url.searchParams.set('p', String(page));
    url.searchParams.set('ps', String(PAGE_SIZE));

    if (config.branch?.trim()) {
      url.searchParams.set('branch', config.branch.trim());
    }

    const payload = await requestJson<SonarIssuesResponse>(url, config.token, signal);
    total = getTotal(payload);
    issues.push(...payload.issues);

    for (const component of payload.components ?? []) {
      if (component.path) {
        componentPaths.set(component.key, component.path);
      }
    }

    if (payload.issues.length === 0) {
      break;
    }

    page += 1;
  }

  return {
    issues,
    componentPaths,
    instanceMode: inferInstanceMode(configuredMode, issues)
  };
}
