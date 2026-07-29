/** Canonical parameters used by the extension before API-profile translation. */
export type CanonicalParameters = Readonly<Record<string, string | undefined>>;

/** Logical parameter names shared by SonarQube API profiles and translators. */
export type LogicalParameter =
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
