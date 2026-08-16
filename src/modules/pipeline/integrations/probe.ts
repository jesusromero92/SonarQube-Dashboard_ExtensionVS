import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { ProjectIntegrationProbe, ProjectIntegrationProbeResult } from './contracts';

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_OUTPUT_LENGTH = 16_000;

export class IntegrationProbeRunner {
  private readonly running = new Set<ChildProcessWithoutNullStreams>();
  private disposed = false;

  async run(probe: ProjectIntegrationProbe): Promise<ProjectIntegrationProbeResult> {
    if (this.disposed) throw new Error('El comprobador de integraciones está desactivado.');
    const startedAt = Date.now();
    const child = spawn(probe.executable, [...probe.args], {
      cwd: probe.cwd,
      env: process.env,
      shell: false,
      windowsHide: true
    });
    this.running.add(child);

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const append = (current: string, chunk: Buffer | string): string =>
      (current + String(chunk)).slice(-MAX_OUTPUT_LENGTH);
    child.stdout.on('data', (chunk: Buffer | string) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk: Buffer | string) => { stderr = append(stderr, chunk); });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, probe.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const exitCode = await new Promise<number>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code: number | null) => resolve(code ?? -1));
      });
      const output = firstNonEmptyLine(stdout) ?? firstNonEmptyLine(stderr) ?? '';
      return {
        success: !timedOut && exitCode === 0,
        command: probe.displayCommand,
        output,
        exitCode,
        timedOut,
        durationMs: Math.max(0, Date.now() - startedAt)
      };
    } finally {
      clearTimeout(timeout);
      this.running.delete(child);
    }
  }

  cancelAll(): void {
    for (const child of this.running) child.kill();
    this.running.clear();
  }

  dispose(): void {
    this.disposed = true;
    this.cancelAll();
  }
}

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

function firstNonEmptyLine(value: string): string | undefined {
  return value.split(/\r?\n/).map(line => line.trim()).find(Boolean);
}
