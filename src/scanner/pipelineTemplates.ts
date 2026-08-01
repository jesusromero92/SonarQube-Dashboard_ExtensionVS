import type * as vscode from 'vscode';
import { DetectedProjectActions } from './projectActions';
import { AnalysisExecutionStep } from './types';

const TEMPLATE_KEY_PREFIX = 'sonarQubeDashboard.pipelineTemplates:';

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  builtin: boolean;
  customized?: boolean;
  steps: AnalysisExecutionStep[];
}

export class PipelineTemplateStore {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async list(folderUri: string): Promise<PipelineTemplate[]> {
    return this.context.workspaceState.get<PipelineTemplate[]>(
      templateKey(folderUri),
      []
    );
  }

  async save(folderUri: string, template: PipelineTemplate): Promise<PipelineTemplate[]> {
    const current = await this.list(folderUri);
    const normalized: PipelineTemplate = {
      ...template,
      id: template.id || `custom-${Date.now().toString(36)}`,
      name: template.name.trim() || 'Pipeline',
      description: template.description?.trim() || '',
      builtin: template.builtin === true || template.id.startsWith('builtin-'),
      steps: normalizeTemplateSteps(template.steps)
    };
    const next = [normalized, ...current.filter(item => item.id !== normalized.id)];
    await this.context.workspaceState.update(templateKey(folderUri), next);
    return next;
  }

  async delete(folderUri: string, templateId: string): Promise<PipelineTemplate[]> {
    const current = await this.list(folderUri);
    const next = current.filter(item => item.id !== templateId);
    await this.context.workspaceState.update(templateKey(folderUri), next);
    return next;
  }
}

export function mergePipelineTemplates(
  builtinTemplates: PipelineTemplate[],
  savedTemplates: PipelineTemplate[]
): PipelineTemplate[] {
  const savedById = new Map(savedTemplates.map(template => [template.id, template]));
  const mergedBuiltins = builtinTemplates.map(template => {
    const override = savedById.get(template.id);
    if (!override) return template;
    return {
      ...override,
      id: template.id,
      builtin: true,
      customized: true,
      steps: normalizeTemplateSteps(override.steps)
    };
  });
  const customTemplates = savedTemplates
    .filter(template => !template.id.startsWith('builtin-'))
    .map(template => ({ ...template, customized: true }));
  return [
    ...mergedBuiltins.map(template => ({
      ...template,
      customized: template.customized === true
    })),
    ...customTemplates
  ];
}

export function createBuiltinPipelineTemplates(
  actions: DetectedProjectActions,
  buildCommand: string,
  testCommand: string
): PipelineTemplate[] {
  const sonar = sonarStep();
  const build = buildCommand.trim()
    ? step('build', 'Compilar el proyecto', 'build', buildCommand, 'stop')
    : undefined;
  const tests = testCommand.trim()
    ? step('tests', 'Ejecutar tests', 'test', testCommand, 'stop')
    : undefined;
  const integrations = actions.integrations.map(integration =>
    step(
      `integration-${integration.id}`,
      integration.name,
      'custom',
      integration.command,
      integration.failurePolicy
    )
  );
  const audit = integrations.find(item => item.id === 'integration-dependency-audit');
  const security = integrations.filter(item => {
    const source = actions.integrations.find(
      integration => `integration-${integration.id}` === item.id
    );
    return source?.category === 'security';
  });

  return [
    {
      id: 'builtin-quick',
      name: 'Rápido',
      description: 'Compilación y análisis SonarQube.',
      builtin: true,
      steps: compact([build, sonar])
    },
    {
      id: 'builtin-complete',
      name: 'Completo',
      description: 'Compilación, tests, auditoría de dependencias y SonarQube.',
      builtin: true,
      steps: compact([build, tests, audit, sonar])
    },
    {
      id: 'builtin-security',
      name: 'Seguridad',
      description: 'Herramientas de seguridad detectadas y SonarQube.',
      builtin: true,
      steps: compact([...security, sonar])
    },
    {
      id: 'builtin-release',
      name: 'Release',
      description: 'Pipeline completo con política estricta.',
      builtin: true,
      steps: compact([
        build,
        tests,
        ...integrations.map(item => ({ ...item, failurePolicy: 'stop' as const })),
        sonar
      ])
    }
  ].map(template => ({
    ...template,
    steps: normalizeTemplateSteps(template.steps)
  }));
}

export function serializePipelineTemplateYaml(template: PipelineTemplate): string {
  const lines = [
    'version: 1',
    `name: ${yamlScalar(template.name)}`,
    `description: ${yamlScalar(template.description)}`,
    'steps:'
  ];
  for (const item of normalizeTemplateSteps(template.steps)) {
    lines.push(
      `  - id: ${yamlScalar(item.id)}`,
      `    name: ${yamlScalar(item.name)}`,
      `    kind: ${item.kind}`,
      `    command: ${yamlScalar(item.command ?? '')}`,
      `    failurePolicy: ${item.failurePolicy}`,
      `    enabled: ${item.enabled !== false}`
    );
  }
  return `${lines.join('\n')}\n`;
}

export function parsePipelineTemplateYaml(value: string): PipelineTemplate {
  const lines = value.split(/\r?\n/);
  let version = 0;
  let name = '';
  let description = '';
  const steps: AnalysisExecutionStep[] = [];
  let current: Partial<AnalysisExecutionStep> | undefined;

  const flush = (): void => {
    if (!current) return;
    steps.push({
      id: String(current.id ?? `step-${steps.length + 1}`),
      name: String(current.name ?? `Paso ${steps.length + 1}`),
      kind: current.kind === 'build' || current.kind === 'test' || current.kind === 'sonar'
        ? current.kind
        : 'custom',
      command: current.command ? String(current.command) : undefined,
      failurePolicy: current.failurePolicy === 'continue' ? 'continue' : 'stop',
      enabled: current.enabled !== false
    });
    current = undefined;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line === 'steps:') continue;
    if (line.startsWith('version:')) {
      version = Number(parseYamlScalar(line.slice('version:'.length)));
      continue;
    }
    if (line.startsWith('name:') && !current) {
      name = String(parseYamlScalar(line.slice('name:'.length)));
      continue;
    }
    if (line.startsWith('description:') && !current) {
      description = String(parseYamlScalar(line.slice('description:'.length)));
      continue;
    }
    if (line.startsWith('- id:')) {
      flush();
      current = { id: String(parseYamlScalar(line.slice('- id:'.length))) };
      continue;
    }
    if (!current) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const parsed = parseYamlScalar(line.slice(separator + 1));
    if (key === 'name') current.name = String(parsed);
    else if (key === 'kind') current.kind = String(parsed) as AnalysisExecutionStep['kind'];
    else if (key === 'command') current.command = String(parsed);
    else if (key === 'failurePolicy') current.failurePolicy = String(parsed) as AnalysisExecutionStep['failurePolicy'];
    else if (key === 'enabled') current.enabled = parsed !== false && parsed !== 'false';
  }
  flush();

  if (version !== 1) {
    throw new Error('La plantilla debe usar version: 1.');
  }
  if (!name.trim()) {
    throw new Error('La plantilla no contiene un nombre.');
  }
  return {
    id: `custom-${Date.now().toString(36)}`,
    name: name.trim(),
    description: description.trim(),
    builtin: false,
    steps: normalizeTemplateSteps(steps)
  };
}

function normalizeTemplateSteps(steps: AnalysisExecutionStep[]): AnalysisExecutionStep[] {
  const result: AnalysisExecutionStep[] = steps
    .filter(item => item.enabled !== false)
    .map((item, index) => ({
      ...item,
      id: item.id || `step-${index + 1}`,
      name: item.name?.trim() || `Paso ${index + 1}`,
      command: item.command?.trim() || undefined,
      failurePolicy: item.kind === 'sonar' || item.failurePolicy !== 'continue'
        ? 'stop' as const
        : 'continue' as const,
      enabled: true
    }));
  const sonarIndex = result.findIndex(item => item.kind === 'sonar');
  if (sonarIndex < 0) {
    result.push(sonarStep());
  } else {
    result[sonarIndex] = {
      ...result[sonarIndex],
      command: undefined,
      failurePolicy: 'stop',
      enabled: true
    };
  }
  return result.filter(
    (item, index) => item.kind !== 'sonar' || index === sonarIndex || sonarIndex < 0
  );
}

function step(
  id: string,
  name: string,
  kind: AnalysisExecutionStep['kind'],
  command: string,
  failurePolicy: AnalysisExecutionStep['failurePolicy']
): AnalysisExecutionStep {
  return { id, name, kind, command, failurePolicy, enabled: true };
}

function sonarStep(): AnalysisExecutionStep {
  return {
    id: 'sonarqube-analysis',
    name: 'Análisis SonarQube',
    kind: 'sonar',
    failurePolicy: 'stop',
    enabled: true
  };
}

function compact(values: Array<AnalysisExecutionStep | undefined>): AnalysisExecutionStep[] {
  return values.filter((value): value is AnalysisExecutionStep => Boolean(value));
}

function templateKey(folderUri: string): string {
  return `${TEMPLATE_KEY_PREFIX}${folderUri}`;
}

function yamlScalar(value: string): string {
  return JSON.stringify(value ?? '');
}

function parseYamlScalar(value: string): string | number | boolean {
  const trimmed = value.trim();
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === 'true';
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    if (trimmed.startsWith('"')) return JSON.parse(trimmed);
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}
