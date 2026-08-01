import { createHash } from 'node:crypto';
import type * as vscode from 'vscode';
import {
  AnalysisRequest,
  AnalysisState,
  PipelineRunHistoryEntry,
  PipelineRunHistoryStep
} from './types';

const HISTORY_KEY_PREFIX = 'sonarQubeDashboard.pipelineHistory:';
const HISTORY_LIMIT = 30;
const HISTORY_LOG_LINE_LIMIT = 2_000;
const HISTORY_LOG_CHARACTER_LIMIT = 250_000;

export class PipelineHistoryStore {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async list(rootPath: string): Promise<PipelineRunHistoryEntry[]> {
    return this.context.workspaceState.get<PipelineRunHistoryEntry[]>(
      historyKey(rootPath),
      []
    );
  }

  async record(request: AnalysisRequest, state: AnalysisState): Promise<void> {
    const startedAt = state.startedAt ?? new Date().toISOString();
    const completedAt = state.completedAt ?? new Date().toISOString();
    const steps: PipelineRunHistoryStep[] = state.steps.map(step => ({
      id: step.id,
      name: step.name,
      kind: step.kind,
      command: step.command,
      failurePolicy: step.failurePolicy,
      status: step.status,
      message: step.message,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      durationMs: step.durationMs
    }));
    const status = state.phase === 'cancelled'
      ? 'cancelled'
      : state.phase === 'error'
        ? 'failed'
        : steps.some(step => step.status === 'warning')
          ? 'warning'
          : 'success';
    const entry: PipelineRunHistoryEntry = {
      id: `${Date.now().toString(36)}-${createHash('sha1')
        .update(`${request.rootPath}\0${startedAt}`)
        .digest('hex')
        .slice(0, 8)}`,
      rootPath: request.rootPath,
      projectKey: request.config.projectKey,
      projectName: request.config.projectName || request.config.projectKey,
      branch: request.config.branch ?? '',
      scanner: state.scanner,
      status,
      message: state.message,
      startedAt,
      completedAt,
      durationMs: Math.max(
        0,
        new Date(completedAt).getTime() - new Date(startedAt).getTime()
      ),
      steps,
      log: compactHistoryLog(state.log)
    };
    const previous = await this.list(request.rootPath);
    await this.context.workspaceState.update(
      historyKey(request.rootPath),
      [entry, ...previous].slice(0, HISTORY_LIMIT)
    );
  }

  async clear(rootPath: string): Promise<void> {
    await this.context.workspaceState.update(historyKey(rootPath), undefined);
  }
}

function historyKey(rootPath: string): string {
  const digest = createHash('sha256').update(rootPath).digest('hex').slice(0, 24);
  return `${HISTORY_KEY_PREFIX}${digest}`;
}


function compactHistoryLog(lines: string[]): string[] {
  const selected = lines.slice(-HISTORY_LOG_LINE_LIMIT);
  let remaining = HISTORY_LOG_CHARACTER_LIMIT;
  const result: string[] = [];
  for (let index = selected.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const line = selected[index];
    const value = line.length <= remaining
      ? line
      : line.slice(Math.max(0, line.length - remaining));
    result.unshift(value);
    remaining -= value.length + 1;
  }
  if (result.length < lines.length) {
    result.unshift('[…] El inicio del registro se ha omitido para limitar el historial.');
  }
  return result;
}
