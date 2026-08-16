import { createHash } from 'node:crypto';
import type * as vscode from 'vscode';

const PIPELINE_VARIABLES_STORAGE_PREFIX = 'sonarQubeDashboard.pipeline.variables:';
const PIPELINE_SECRET_NAMES_STORAGE_PREFIX = 'sonarQubeDashboard.pipeline.secretNames:';
const PIPELINE_SECRET_VALUE_PREFIX = 'sonarQubeDashboard.pipeline.secret:';
const PIPELINE_VARIABLE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface PipelineVariableEntry {
  name: string;
  value: string;
}

export interface PipelineVariableState {
  variables: PipelineVariableEntry[];
  secretNames: string[];
}

export function isPipelineVariableName(value: string): boolean {
  return PIPELINE_VARIABLE_NAME.test(value.trim());
}

export function normalizePipelineVariables(
  entries: readonly PipelineVariableEntry[] | undefined
): PipelineVariableEntry[] {
  const normalized: PipelineVariableEntry[] = [];
  const names = new Set<string>();
  for (const entry of entries ?? []) {
    const name = String(entry?.name ?? '').trim();
    if (!name && !String(entry?.value ?? '').trim()) continue;
    if (!isPipelineVariableName(name)) {
      throw new Error(
        `El nombre de variable “${name || '(vacío)'}” no es válido. Usa letras, números y guiones bajos, empezando por una letra o _.`
      );
    }
    if (names.has(name)) {
      throw new Error(`La variable “${name}” está repetida.`);
    }
    names.add(name);
    normalized.push({ name, value: String(entry?.value ?? '') });
  }
  return normalized;
}

export function pipelineVariablesRecord(
  entries: readonly PipelineVariableEntry[]
): Record<string, string> {
  return Object.fromEntries(entries.map(entry => [entry.name, entry.value]));
}

export class PipelineVariableStore {
  constructor(private readonly context: vscode.ExtensionContext) {}

  listVariables(folderUri: string): PipelineVariableEntry[] {
    const saved = this.context.workspaceState.get<PipelineVariableEntry[]>(
      this.variablesKey(folderUri),
      []
    );
    try {
      return normalizePipelineVariables(saved);
    } catch {
      return [];
    }
  }

  async saveVariables(
    folderUri: string,
    entries: readonly PipelineVariableEntry[]
  ): Promise<PipelineVariableEntry[]> {
    const normalized = normalizePipelineVariables(entries);
    await this.context.workspaceState.update(this.variablesKey(folderUri), normalized);
    return normalized;
  }

  listSecretNames(folderUri: string): string[] {
    const names = this.context.workspaceState.get<string[]>(
      this.secretNamesKey(folderUri),
      []
    );
    const unique = new Set<string>();
    for (const value of names) {
      const name = String(value ?? '').trim();
      if (isPipelineVariableName(name)) unique.add(name);
    }
    return [...unique].sort((left, right) => left.localeCompare(right));
  }

  async readSecrets(folderUri: string): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const name of this.listSecretNames(folderUri)) {
      const value = await this.context.secrets.get(this.secretKey(folderUri, name));
      if (value !== undefined) result[name] = value;
    }
    return result;
  }

  async setSecret(folderUri: string, nameValue: string, value: string): Promise<string[]> {
    const name = nameValue.trim();
    if (!isPipelineVariableName(name)) {
      throw new Error(
        'El nombre del secreto no es válido. Usa letras, números y guiones bajos, empezando por una letra o _.'
      );
    }
    if (!value) {
      throw new Error('El secreto no puede estar vacío.');
    }
    await this.context.secrets.store(this.secretKey(folderUri, name), value);
    const names = new Set(this.listSecretNames(folderUri));
    names.add(name);
    const next = [...names].sort((left, right) => left.localeCompare(right));
    await this.context.workspaceState.update(this.secretNamesKey(folderUri), next);
    return next;
  }

  async deleteSecret(folderUri: string, nameValue: string): Promise<string[]> {
    const name = nameValue.trim();
    if (!isPipelineVariableName(name)) return this.listSecretNames(folderUri);
    await this.context.secrets.delete(this.secretKey(folderUri, name));
    const next = this.listSecretNames(folderUri).filter(item => item !== name);
    await this.context.workspaceState.update(this.secretNamesKey(folderUri), next);
    return next;
  }

  state(folderUri: string): PipelineVariableState {
    return {
      variables: this.listVariables(folderUri),
      secretNames: this.listSecretNames(folderUri)
    };
  }

  private variablesKey(folderUri: string): string {
    return `${PIPELINE_VARIABLES_STORAGE_PREFIX}${workspaceDigest(folderUri)}`;
  }

  private secretNamesKey(folderUri: string): string {
    return `${PIPELINE_SECRET_NAMES_STORAGE_PREFIX}${workspaceDigest(folderUri)}`;
  }

  private secretKey(folderUri: string, name: string): string {
    return `${PIPELINE_SECRET_VALUE_PREFIX}${workspaceDigest(folderUri)}:${name}`;
  }
}

function workspaceDigest(folderUri: string): string {
  return createHash('sha256').update(folderUri).digest('hex').slice(0, 24);
}
