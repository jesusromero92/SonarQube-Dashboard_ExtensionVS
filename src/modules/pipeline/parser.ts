import { AnalysisFailurePolicy } from './models';

export interface AnalysisPipelineStage {
  id: string;
  name: string;
  command: string;
  failurePolicy: AnalysisFailurePolicy;
}

export interface AnalysisPipelineVariables {
  workspaceFolder: string;
  projectKey: string;
  projectName: string;
  serverUrl: string;
  branch: string;
  packageManager?: string;
}

export interface AppendAnalysisPipelineStageResult {
  value: string;
  added: boolean;
}

export function parseAnalysisPipeline(
  value: string | undefined,
  fallbackName: string
): AnalysisPipelineStage[] {
  const commands = String(value ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => Boolean(line) && !line.startsWith('#'));

  return commands.map((line, index) => {
    const parts = line.split('::').map(part => part.trim());
    const trailingPolicy = parts.at(-1);
    const failurePolicy: AnalysisFailurePolicy = trailingPolicy === 'continue'
      ? 'continue'
      : 'stop';
    if (trailingPolicy === 'continue' || trailingPolicy === 'stop') {
      parts.pop();
    }

    let name = `${fallbackName} ${index + 1}`;
    let command = line;
    if (parts.length > 1 && parts[0] && parts.slice(1).join('::').trim()) {
      name = parts.shift()!;
      command = parts.join('::').trim();
    } else if (parts.length === 1) {
      command = parts[0];
    }

    return {
      id: `custom-${index + 1}-${slug(name)}`,
      name,
      command,
      failurePolicy
    };
  });
}

export function serializeAnalysisPipeline(stages: AnalysisPipelineStage[]): string {
  return stages
    .filter(stage => stage.command.trim())
    .map(stage => [
      stage.name.trim() || 'Etapa',
      stage.command.trim(),
      stage.failurePolicy
    ].join(' :: '))
    .join('\n');
}

export function appendAnalysisPipelineStage(
  beforeValue: string | undefined,
  afterValue: string | undefined,
  stage: AnalysisPipelineStage
): AppendAnalysisPipelineStageResult {
  const current = [
    ...parseAnalysisPipeline(beforeValue, 'Acción previa'),
    ...parseAnalysisPipeline(afterValue, 'Acción posterior')
  ];
  const commandKey = normalizedCommand(stage.command);
  const alreadyIncluded = current.some(
    item => normalizedCommand(item.command) === commandKey
  );
  return {
    value: serializeAnalysisPipeline(alreadyIncluded ? current : [...current, stage]),
    added: !alreadyIncluded
  };
}

export function expandAnalysisPipelineCommand(
  command: string,
  variables: AnalysisPipelineVariables
): string {
  return command
    .replaceAll('${workspaceFolder}', variables.workspaceFolder)
    .replaceAll('${projectKey}', variables.projectKey)
    .replaceAll('${projectName}', variables.projectName)
    .replaceAll('${serverUrl}', variables.serverUrl)
    .replaceAll('${branch}', variables.branch)
    .replaceAll('${packageManager}', variables.packageManager ?? '');
}

function slug(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  let start = 0;
  let end = normalized.length;
  while (start < end && normalized[start] === '-') start += 1;
  while (end > start && normalized[end - 1] === '-') end -= 1;
  return normalized.slice(start, end) || 'step';
}

function normalizedCommand(command: string | undefined): string {
  return String(command ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}
