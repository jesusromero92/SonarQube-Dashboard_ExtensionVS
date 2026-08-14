import { ChildProcess, spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import * as path from 'node:path';
import { ProcessResult, ProcessSpec } from './types';

export class ProcessRunner {
  private child: ChildProcess | undefined;

  async run(
    spec: ProcessSpec,
    signal: AbortSignal,
    onOutput: (chunk: string) => void
  ): Promise<ProcessResult> {
    if (signal.aborted) {
      throw new Error('Análisis cancelado.');
    }

    const launch = spec.shellCommand
      ? this.shellLaunch(spec.shellCommand)
      : this.executableLaunch(spec.command, spec.args);

    const output: string[] = [];

    return new Promise<ProcessResult>((resolve, reject) => {
      let settled = false;
      const stdoutDecoder = new StringDecoder('utf8');
      const stderrDecoder = new StringDecoder('utf8');

      const child = spawn(launch.command, launch.args, {
        cwd: spec.cwd,
        env: this.terminalEnvironment(spec.env),
        windowsHide: true,
        windowsVerbatimArguments: process.platform === 'win32'
          && /(?:^|[\\/])cmd\.exe$/i.test(launch.command),
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe']
      });
      this.child = child;

      const emit = (chunk: string): void => {
        if (!chunk) {
          return;
        }
        output.push(chunk);
        onOutput(chunk);
      };

      child.stdout?.on('data', (chunk: Buffer) => emit(stdoutDecoder.write(chunk)));
      child.stderr?.on('data', (chunk: Buffer) => emit(stderrDecoder.write(chunk)));

      const abortHandler = (): void => {
        this.cancel();
      };
      signal.addEventListener('abort', abortHandler, { once: true });
      const timeout = spec.timeoutMs
        ? setTimeout(() => {
            if (settled) {
              return;
            }
            settled = true;
            signal.removeEventListener('abort', abortHandler);
            this.terminate(child);
            this.child = undefined;
            reject(new Error(
              `El proceso superó el tiempo máximo de ${Math.ceil(spec.timeoutMs! / 60_000)} minutos.`
            ));
          }, spec.timeoutMs)
        : undefined;

      child.once('error', (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeout) clearTimeout(timeout);
        signal.removeEventListener('abort', abortHandler);
        this.child = undefined;
        reject(error);
      });

      child.once('close', (code: number | null) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeout) clearTimeout(timeout);
        signal.removeEventListener('abort', abortHandler);
        this.child = undefined;
        emit(stdoutDecoder.end());
        emit(stderrDecoder.end());

        if (signal.aborted) {
          reject(new Error('Análisis cancelado.'));
          return;
        }

        resolve({ exitCode: code ?? 1, output });
      });
    });
  }

  cancel(): void {
    const child = this.child;
    if (!child?.pid) {
      return;
    }
    this.terminate(child);
  }

  private terminate(child: ChildProcess): void {
    if (!child.pid) {
      return;
    }
    if (process.platform === 'win32') {
      const taskkill = path.join(process.env.SystemRoot ?? String.raw`C:\Windows`, 'System32', 'taskkill.exe');
      const killer = spawn(taskkill, ['/pid', String(child.pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore'
      });
      killer.unref();
      return;
    }

    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }

  private terminalEnvironment(environment?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const env = { ...process.env, ...environment };
    // La salida se muestra dentro de un emulador ANSI del webview. Estas
    // variables permiten que CLIs genéricas con soporte de color/Unicode no
    // degraden innecesariamente su salida solo porque stdout está capturado.
    if (!env.TERM || env.TERM === 'dumb') {
      env.TERM = 'xterm-256color';
    }
    if (!env.COLORTERM) {
      env.COLORTERM = 'truecolor';
    }
    if (!env.NO_COLOR && env.FORCE_COLOR === undefined) {
      env.FORCE_COLOR = '1';
    }
    if (!env.NO_COLOR && env.CLICOLOR_FORCE === undefined) {
      env.CLICOLOR_FORCE = '1';
    }
    return env;
  }

  private shellLaunch(commandLine: string): { command: string; args: string[] } {
    return process.platform === 'win32'
      ? { command: 'cmd.exe', args: ['/d', '/s', '/c', commandLine] }
      : { command: '/bin/sh', args: ['-lc', commandLine] };
  }

  private executableLaunch(command: string, args: string[]): { command: string; args: string[] } {
    if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(command)) {
      return {
        command: 'cmd.exe',
        args: ['/d', '/s', '/c', this.windowsCommandLine(command, args)]
      };
    }

    return { command, args };
  }

  private windowsCommandLine(command: string, args: string[]): string {
    const quote = (value: string): string => `"${value.replaceAll('"', '""')}"`;
    const executable = /[\s&()^|<>]/.test(command) ? quote(command) : command;
    const commandLine = [executable, ...args.map(quote)].join(' ');

    // Con `cmd.exe /s /c`, una ruta de ejecutable entrecomillada necesita un
    // segundo par de comillas que delimite la orden completa. Los comandos
    // sencillos como `npx.cmd` deben permanecer sin comillas; de lo contrario
    // cmd puede intentar ejecutar literalmente `"npx.cmd"`.
    return executable === command ? commandLine : `"${commandLine}"`;
  }
}
