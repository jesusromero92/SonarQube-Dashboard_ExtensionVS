export type DashboardLanguage = 'en' | 'es';

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
