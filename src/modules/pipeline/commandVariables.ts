import { createHash } from 'node:crypto';

export interface PipelineCommandVariableContext {
  readonly values: Readonly<Record<string, string | undefined>>;
  readonly customVariables?: Readonly<Record<string, string>>;
  readonly integrationCommands?: Readonly<Record<string, string>>;
  readonly secrets?: Readonly<Record<string, string>>;
  readonly platform?: NodeJS.Platform;
}

export interface ResolvedPipelineCommand {
  readonly command: string;
  readonly displayCommand: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly sensitiveValues: readonly string[];
}

const CUSTOM_VARIABLE_PATTERN = /\$\{variable\.([A-Za-z_]\w*)\}/g;
const SECRET_PATTERN = /\$\{secret\.([A-Za-z_]\w*)\}/g;
const INTEGRATION_COMMAND_PATTERN = /\$\{integration\.([\w-]+)\.command\}/g;
const BUILTIN_PATTERN = /\$\{([A-Za-z_]\w*)\}/g;

export function resolvePipelineCommand(
  template: string,
  context: PipelineCommandVariableContext
): ResolvedPipelineCommand {
  const environment: Record<string, string> = {};
  const sensitiveValues: string[] = [];
  let command = String(template ?? '');
  let displayCommand = command;

  command = replaceRequired(
    command,
    INTEGRATION_COMMAND_PATTERN,
    integrationId => context.integrationCommands?.[integrationId],
    integrationId => `La integración “${integrationId}” no está disponible para resolver su comando.`
  );
  displayCommand = replaceRequired(
    displayCommand,
    INTEGRATION_COMMAND_PATTERN,
    integrationId => context.integrationCommands?.[integrationId],
    integrationId => `La integración “${integrationId}” no está disponible para resolver su comando.`
  );

  command = replaceRequired(
    command,
    CUSTOM_VARIABLE_PATTERN,
    name => context.customVariables?.[name],
    name => `La variable de Pipeline “${name}” no está definida.`
  );
  displayCommand = replaceRequired(
    displayCommand,
    CUSTOM_VARIABLE_PATTERN,
    name => context.customVariables?.[name],
    name => `La variable de Pipeline “${name}” no está definida.`
  );

  const platform = context.platform ?? process.platform;
  command = command.replace(SECRET_PATTERN, (_match, name: string) => {
    const value = context.secrets?.[name];
    if (value === undefined) {
      throw new Error(`El secreto de Pipeline “${name}” no está configurado.`);
    }
    const environmentName = secretEnvironmentName(name);
    environment[environmentName] = value;
    if (value) sensitiveValues.push(value);
    return platform === 'win32' ? `%${environmentName}%` : `$${environmentName}`;
  });
  displayCommand = displayCommand.replace(SECRET_PATTERN, '********');

  command = replaceBuiltins(command, context.values);
  displayCommand = replaceBuiltins(displayCommand, context.values);

  return {
    command,
    displayCommand,
    environment,
    sensitiveValues: [...new Set(sensitiveValues)].sort((left, right) => right.length - left.length)
  };
}

export function integrationCommandRecord(
  integrations: readonly { id: string; command: string }[]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const integration of integrations) {
    const id = String(integration.id ?? '').trim();
    const command = String(integration.command ?? '').trim();
    if (id && command) result[id] = command;
  }
  return result;
}

function replaceBuiltins(
  value: string,
  variables: Readonly<Record<string, string | undefined>>
): string {
  return value.replace(BUILTIN_PATTERN, (match, name: string) => {
    if (!Object.hasOwn(variables, name)) return match;
    const replacement = variables[name];
    if (replacement === undefined) {
      throw new Error(`La variable dinámica “${name}” no está disponible para este proyecto.`);
    }
    return replacement;
  });
}

function replaceRequired(
  value: string,
  pattern: RegExp,
  resolve: (name: string) => string | undefined,
  missingMessage: (name: string) => string
): string {
  return value.replace(pattern, (_match, name: string) => {
    const replacement = resolve(name);
    if (replacement === undefined) throw new Error(missingMessage(name));
    return replacement;
  });
}

function secretEnvironmentName(name: string): string {
  const digest = createHash('sha256').update(name).digest('hex').slice(0, 12).toUpperCase();
  return `SQD_PIPELINE_SECRET_${digest}`;
}
