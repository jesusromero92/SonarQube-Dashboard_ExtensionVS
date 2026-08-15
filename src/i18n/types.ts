export type DashboardLanguage = 'en' | 'es';

export interface LocalizationBundle {
  readonly source: Readonly<Record<string, string>>;
  readonly en: Readonly<Record<string, string>>;
  readonly es: Readonly<Record<string, string>>;
}

export interface LocalizedAnalysisState {
  running: boolean;
  phase: string;
  message: string;
  scanner: string;
  startedAt?: string;
  completedAt?: string;
  canCancel: boolean;
  log: string[];
  steps?: Array<{ name: string; message?: string }>;
}
