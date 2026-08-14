export const PIPELINE_EXECUTION_TREE_VIEW_ID =
  'sonarQubeDashboard.pipelineExecutions';

export const PIPELINE_COMMANDS = {
  openExecution: 'sonarQubeDashboard.openPipelineExecution'
} as const;

export const PIPELINE_HISTORY_STORAGE_KEY_PREFIX =
  'sonarQubeDashboard.pipelineHistory:';

export const PIPELINE_TEMPLATE_STORAGE_KEY_PREFIX =
  'sonarQubeDashboard.pipelineTemplates:';

export const PIPELINE_HISTORY_LIMIT = 30;
export const PIPELINE_HISTORY_LOG_CHUNK_LIMIT = 4_000;
export const PIPELINE_HISTORY_LOG_CHARACTER_LIMIT = 250_000;
