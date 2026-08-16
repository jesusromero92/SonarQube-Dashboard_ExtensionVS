import type { ProjectIntegrationProbe } from './contracts';

const DEFAULT_TIMEOUT_MS = 5000;

export function commandExecutable(platform: NodeJS.Platform, command: string): string {
  if (platform !== 'win32') return command;
  return ['npm', 'pnpm', 'yarn', 'bun', 'npx', 'bunx'].includes(command)
    ? `${command}.cmd`
    : command;
}

export function versionProbe(
  rootPath: string,
  platform: NodeJS.Platform,
  command: string,
  args: readonly string[] = ['--version'],
  displayCommand?: string
): ProjectIntegrationProbe {
  return {
    executable: commandExecutable(platform, command),
    args,
    cwd: rootPath,
    displayCommand: displayCommand ?? [command, ...args].join(' '),
    timeoutMs: DEFAULT_TIMEOUT_MS
  };
}
