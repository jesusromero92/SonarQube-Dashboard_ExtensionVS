export type ProjectStackCategory =
  | 'runtime'
  | 'language'
  | 'framework'
  | 'build'
  | 'tests'
  | 'infrastructure'
  | 'container';

export interface ProjectStackTechnology {
  readonly id: string;
  readonly displayName: string;
  readonly category: ProjectStackCategory;
  readonly evidences: readonly string[];
}

export interface ProjectStackSnapshot {
  readonly technologies: readonly ProjectStackTechnology[];
  readonly ids: readonly string[];
}
