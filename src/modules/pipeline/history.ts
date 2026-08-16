import { createHash } from 'node:crypto';
import type * as vscode from 'vscode';
import type { FolderSonarConfig } from '../../types';
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
import { diffStructuredResults } from './results';

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
    const previous = await this.list(request.rootPath);
    const rawSteps: PipelineRunHistoryStep[] = state.steps.map(step => ({
      id: step.id,
      name: step.name,
      kind: step.kind,
      command: step.command,
      failurePolicy: step.failurePolicy,
      integrationId: step.integrationId,
      status: step.status,
      message: step.message,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      durationMs: step.durationMs,
      result: step.result
    }));
    const steps = attachStructuredResultDiffsFromHistory(
      rawSteps,
      previous,
      request.config.projectKey,
      request.config.branch ?? ''
    );
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
    if (!startedAt) return;
    const entries = await this.list(rootPath);
    const index = entries.findIndex(entry => entry.startedAt === startedAt);
    if (index < 0) return;
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
      // No se corta un chunk por la mitad: podría partir una secuencia ANSI
      // o una orden de control de terminal.
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

export interface PipelineStepTimingStatistics {
  id: string;
  name: string;
  kind: PipelineRunHistoryStep['kind'];
  command?: string;
  samples: number;
  lastDurationMs: number;
  averageDurationMs: number;
  medianDurationMs: number;
}

export function calculatePipelineStepTimingStatistics(
  entries: readonly PipelineRunHistoryEntry[],
  sampleLimit = 20
): PipelineStepTimingStatistics[] {
  const samples = new Map<
    string,
    Array<{ step: PipelineRunHistoryStep; durationMs: number }>
  >();
  const limit = Math.max(1, Math.floor(sampleLimit));
  for (const entry of entries) {
    if (entry.status === 'running') continue;
    for (const step of entry.steps) {
      const durationMs = Number(step.durationMs);
      if (!Number.isFinite(durationMs) || durationMs < 0) continue;
      const key = timingKey(step);
      const values = samples.get(key) ?? [];
      if (values.length < limit) values.push({ step, durationMs });
      samples.set(key, values);
    }
  }

  return [...samples.values()].map(values => {
    const latest = values[0];
    const durations = values.map(value => value.durationMs);
    const sorted = [...durations].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
    return {
      id: latest.step.id,
      name: latest.step.name,
      kind: latest.step.kind,
      command: latest.step.command,
      samples: durations.length,
      lastDurationMs: latest.durationMs,
      averageDurationMs: Math.round(
        durations.reduce((sum, duration) => sum + duration, 0) / durations.length
      ),
      medianDurationMs: Math.round(median)
    };
  });
}

function timingKey(
  step: Pick<PipelineRunHistoryStep, 'id' | 'kind' | 'command'>
): string {
  if (step.kind === 'sonar') return 'kind:sonar';
  const command = step.command?.trim().replace(/\s+/g, ' ').toLowerCase();
  return command ? `command:${command}` : `id:${step.id}`;
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

/**
 * Añade el diff estructurado contra una ejecución de referencia. La identidad
 * de una integración se toma primero de integrationId y, para historiales
 * antiguos, del toolId del resultado estructurado.
 */
export function attachStructuredResultDiffs(
  steps: readonly PipelineRunHistoryStep[],
  baseline: PipelineRunHistoryEntry
): PipelineRunHistoryStep[] {
  return steps.map(step => {
    if (!step.result) return { ...step, resultDiff: undefined };
    const previousStep = findComparableStep(step, baseline.steps);
    if (!previousStep?.result) return { ...step, resultDiff: undefined };
    return {
      ...step,
      resultDiff: diffStructuredResults(step.result, previousStep.result, baseline.id)
    };
  });
}

function attachStructuredResultDiffsFromHistory(
  steps: readonly PipelineRunHistoryStep[],
  history: readonly PipelineRunHistoryEntry[],
  projectKey: string,
  branch: string
): PipelineRunHistoryStep[] {
  const compatibleHistory = history.filter(entry =>
    entry.status !== 'running' &&
    entry.projectKey === projectKey &&
    entry.branch === branch
  );

  return steps.map(step => {
    if (!step.result) return { ...step, resultDiff: undefined };
    for (const entry of compatibleHistory) {
      const previousStep = findComparableStep(step, entry.steps);
      if (!previousStep?.result) continue;
      const resultDiff = diffStructuredResults(step.result, previousStep.result, entry.id);
      if (resultDiff) return { ...step, resultDiff };
    }
    return { ...step, resultDiff: undefined };
  });
}

function findComparableStep(
  current: PipelineRunHistoryStep,
  candidates: readonly PipelineRunHistoryStep[]
): PipelineRunHistoryStep | undefined {
  const identity = structuredStepIdentity(current);
  return candidates.find(candidate =>
    candidate.result && structuredStepIdentity(candidate) === identity
  );
}

function structuredStepIdentity(step: PipelineRunHistoryStep): string {
  return step.integrationId?.trim() || step.result?.toolId || '';
}
