export const SCANNER_MODES = [
  { value: 'auto', label: 'Automático (recomendado)' },
  { value: 'maven', label: 'Maven · Java / Kotlin' },
  { value: 'gradle', label: 'Gradle · Java / Kotlin / Android' },
  { value: 'dotnet', label: '.NET · C# / VB.NET / F#' },
  { value: 'npm', label: 'Genérico NPM · JavaScript / TypeScript / React / Python y otros' },
  { value: 'docker', label: 'Docker · SonarScanner CLI' },
  { value: 'custom', label: 'Comando personalizado' }
] as const;

export const PIPELINE_EXECUTION_TREE_VIEW_ID =
  'sonarQubeDashboard.pipelineExecutions';

export const PIPELINE_COMMANDS = {
  analyze: 'sonarQubeDashboard.analyze',
  cancelAnalysis: 'sonarQubeDashboard.cancelAnalysis',
  openExecution: 'sonarQubeDashboard.openPipelineExecution'
} as const;

export const PIPELINE_HISTORY_STORAGE_KEY_PREFIX =
  'sonarQubeDashboard.pipelineHistory:';

export const PIPELINE_TEMPLATE_STORAGE_KEY_PREFIX =
  'sonarQubeDashboard.pipelineTemplates:';

export const PIPELINE_HISTORY_LIMIT = 30;
export const PIPELINE_HISTORY_LOG_CHUNK_LIMIT = 4_000;
export const PIPELINE_HISTORY_LOG_CHARACTER_LIMIT = 250_000;
