import type { PipelineAnalysisConfig } from './configuration';
import type {
  AnalysisExecutionStep
} from './models';
import { parseAnalysisPipeline } from './parser';
import type { DetectedProjectIntegration } from './integrations';

const MAX_PIPELINE_STEPS = 50;
const MAX_STEP_ID_LENGTH = 120;
const MAX_STEP_NAME_LENGTH = 160;
const MAX_STEP_COMMAND_LENGTH = 8_000;

export function normalizeRequestedPipelineSteps(
  steps: AnalysisExecutionStep[] | undefined
): AnalysisExecutionStep[] {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps.slice(0, MAX_PIPELINE_STEPS).map((step, index) => {
    const kind = ['build', 'test', 'custom', 'sonar'].includes(step?.kind)
      ? step.kind
      : 'custom';
    const failurePolicy = step?.kind === 'sonar' ||
      step?.failurePolicy !== 'continue'
      ? 'stop'
      : 'continue';

    return {
      id: firstNonEmpty(step?.id, `step-${index + 1}`)
        .slice(0, MAX_STEP_ID_LENGTH),
      name: firstNonEmpty(step?.name, `Paso ${index + 1}`)
        .trim()
        .slice(0, MAX_STEP_NAME_LENGTH),
      kind,
      command: typeof step?.command === 'string'
        ? step.command.trim().slice(0, MAX_STEP_COMMAND_LENGTH)
        : undefined,
      failurePolicy,
      enabled: step?.enabled !== false,
      integrationId: cleanIntegrationId(step?.integrationId)
    };
  });
}

export function createDefaultPipelineSteps(
  config: PipelineAnalysisConfig,
  buildCommand: string,
  testCommand: string
): AnalysisExecutionStep[] {
  const before = parseAnalysisPipeline(
    config.preAnalysisCommands,
    'Acción previa'
  );
  const after = parseAnalysisPipeline(
    config.postAnalysisCommands,
    'Acción posterior'
  );

  return [
    ...(buildCommand ? [{
      id: 'build',
      name: 'Compilar el proyecto',
      kind: 'build' as const,
      command: buildCommand,
      failurePolicy: 'stop' as const,
      enabled: true
    }] : []),
    ...(testCommand ? [{
      id: 'tests',
      name: 'Ejecutar tests',
      kind: 'test' as const,
      command: testCommand,
      failurePolicy: 'stop' as const,
      enabled: true
    }] : []),
    ...before.map(stage => ({
      ...stage,
      kind: 'custom' as const,
      enabled: true
    })),
    {
      id: 'sonarqube-analysis',
      name: 'Análisis SonarQube',
      kind: 'sonar' as const,
      failurePolicy: 'stop' as const,
      enabled: true
    },
    ...after.map(stage => ({
      ...stage,
      id: `post-${stage.id}`,
      kind: 'custom' as const,
      enabled: true
    }))
  ];
}

export function associatePipelineStepsWithIntegrations(
  steps: readonly AnalysisExecutionStep[],
  integrations: readonly DetectedProjectIntegration[]
): AnalysisExecutionStep[] {
  return steps.map(step => {
    const matched = integrationForStep(step, integrations);
    return matched ? { ...step, integrationId: matched.id } : { ...step };
  });
}

function integrationForStep(
  step: AnalysisExecutionStep,
  integrations: readonly DetectedProjectIntegration[]
): DetectedProjectIntegration | undefined {
  const explicit = cleanIntegrationId(step.integrationId);
  if (explicit) {
    const matched = integrations.find(integration => integration.id === explicit);
    if (matched) return matched;
  }

  const id = step.id?.trim();
  if (id?.startsWith('integration-')) {
    const integrationId = id.slice('integration-'.length);
    const matched = integrations.find(integration => integration.id === integrationId);
    if (matched) return matched;
  }

  const command = normalizedCommand(step.command);
  if (!command) return undefined;
  return integrations.find(integration =>
    normalizedCommand(integration.command) === command ||
    command.includes(`\${integration.${integration.id}.command}`.toLowerCase())
  );
}

function normalizedCommand(command: string | undefined): string {
  return String(command ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function cleanIntegrationId(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 120) : undefined;
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value) {
      return value;
    }
  }
  return '';
}
