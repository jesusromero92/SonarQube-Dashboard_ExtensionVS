import { createHash } from 'node:crypto';
import type * as vscode from 'vscode';
import type { FolderSonarConfig } from '../types';
import {
  PIPELINE_HISTORY_LIMIT,
  PIPELINE_HISTORY_LOG_CHARACTER_LIMIT,
  PIPELINE_HISTORY_LOG_CHUNK_LIMIT,
  PIPELINE_HISTORY_STORAGE_KEY_PREFIX
} from './constants';
import {
  AnalysisBaselineComparison,
  AnalysisRequest,
  AnalysisState,
  PipelineRunHistoryEntry,
  PipelineRunHistoryStep
} from './models';

function historyStatus(
  state: AnalysisState,
  steps: readonly PipelineRunHistoryStep[]
): PipelineRunHistoryEntry['status'] {
  if (state.phase === 'cancelled') return 'cancelled';
  if (state.phase === 'error') return 'failed';
  if (steps.some(step => step.status === 'warning')) return 'warning';
  return 'success';
}

type PipelineHistoryProjectConfig = Pick<
  FolderSonarConfig,
  'projectKey' | 'projectName' | 'branch'
>;

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
    const status = historyStatus(state, steps);
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
      log: compactHistoryLog(state.log),
      comparison: state.comparison
    };
    const previous = await this.list(request.rootPath);
    await this.context.workspaceState.update(
      historyKey(request.rootPath),
      [entry, ...previous].slice(0, PIPELINE_HISTORY_LIMIT)
    );
  }

  async updateComparison(
    rootPath: string,
    startedAt: string | undefined,
    comparison: AnalysisBaselineComparison,
    log?: string[]
  ): Promise<void> {
    if (!startedAt) {
      return;
    }
    const entries = await this.list(rootPath);
    const index = entries.findIndex(entry => entry.startedAt === startedAt);
    if (index < 0) {
      return;
    }
    const updated = [...entries];
    updated[index] = {
      ...updated[index],
      comparison,
      log: log ? compactHistoryLog(log) : updated[index].log
    };
    await this.context.workspaceState.update(historyKey(rootPath), updated);
  }

  async clear(rootPath: string): Promise<void> {
    await this.context.workspaceState.update(historyKey(rootPath), undefined);
  }
}

function historyKey(rootPath: string): string {
  const digest = createHash('sha256').update(rootPath).digest('hex').slice(0, 24);
  return `${PIPELINE_HISTORY_STORAGE_KEY_PREFIX}${digest}`;
}


function compactHistoryLog(chunks: string[]): string[] {
  const selected = chunks.slice(-PIPELINE_HISTORY_LOG_CHUNK_LIMIT);
  let remaining = PIPELINE_HISTORY_LOG_CHARACTER_LIMIT;
  const result: string[] = [];
  for (let index = selected.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const chunk = selected[index];
    if (chunk.length > remaining) {
      // No se corta un chunk por la mitad: podría partir una secuencia ANSI,
      // un carácter UTF-8 ya decodificado o una orden de control de terminal.
      break;
    }
    result.unshift(chunk);
    remaining -= chunk.length;
  }
  if (result.length < chunks.length) {
    result.unshift('[…] El inicio del registro se ha omitido para limitar el historial.\n');
  }
  return result;
}


export function createRunningPipelineHistoryEntry(
  rootPath: string,
  config: PipelineHistoryProjectConfig,
  fallbackProjectName: string,
  state: AnalysisState,
  now = Date.now()
): PipelineRunHistoryEntry {
  const startedAt = state.startedAt ?? new Date(now).toISOString();
  return {
    id: 'running-analysis',
    rootPath,
    projectKey: config.projectKey,
    projectName: config.projectName || config.projectKey || fallbackProjectName,
    branch: config.branch ?? '',
    scanner: state.scanner,
    status: 'running',
    message: state.message,
    startedAt,
    completedAt: '',
    durationMs: Math.max(0, now - new Date(startedAt).getTime()),
    steps: state.steps.map(step => ({ ...step })),
    log: [...state.log],
    comparison: state.comparison
  };
}
