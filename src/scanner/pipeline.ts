import { AnalysisFailurePolicy } from './types';

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
    const trailingPolicy = parts[parts.length - 1];
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

export function expandAnalysisPipelineCommand(
  command: string,
  variables: AnalysisPipelineVariables
): string {
  return command
    .replace(/\$\{workspaceFolder\}/g, variables.workspaceFolder)
    .replace(/\$\{projectKey\}/g, variables.projectKey)
    .replace(/\$\{projectName\}/g, variables.projectName)
    .replace(/\$\{serverUrl\}/g, variables.serverUrl)
    .replace(/\$\{branch\}/g, variables.branch);
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'step';
}
