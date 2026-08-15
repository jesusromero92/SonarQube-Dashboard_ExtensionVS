import * as vscode from 'vscode';
import { DASHBOARD_CONFIGURATION_SECTION } from '../constants';
import type { DashboardModuleDefinition, DashboardModuleId } from './contracts';

export type DashboardModuleState = Record<DashboardModuleId, boolean>;

let registeredDefinitions: readonly DashboardModuleDefinition[] = [];

export function registerDashboardModuleDefinitions(
  definitions: readonly DashboardModuleDefinition[]
): void {
  registeredDefinitions = [...definitions];
}

export function getDashboardModuleDefinitions(): readonly DashboardModuleDefinition[] {
  return registeredDefinitions;
}

export function getDashboardModuleState(): DashboardModuleState {
  const configuration = vscode.workspace.getConfiguration(
    DASHBOARD_CONFIGURATION_SECTION
  );
  return Object.fromEntries(registeredDefinitions.map(definition => [
    definition.id,
    configuration.get<boolean>(definition.configurationKey, definition.defaultEnabled)
  ]));
}

function getRegisteredDefinition(
  moduleId: DashboardModuleId
): DashboardModuleDefinition | undefined {
  for (const definition of registeredDefinitions) {
    if (definition.id === moduleId) return definition;
  }
  return undefined;
}

export function isDashboardModuleEnabled(moduleId: DashboardModuleId): boolean {
  const definition = getRegisteredDefinition(moduleId);
  return definition ? getDashboardModuleState()[moduleId] : false;
}

export async function setDashboardModuleEnabled(
  moduleId: DashboardModuleId,
  enabled: boolean
): Promise<DashboardModuleState> {
  const definition = getRegisteredDefinition(moduleId);
  if (!definition) return getDashboardModuleState();

  await vscode.workspace
    .getConfiguration(DASHBOARD_CONFIGURATION_SECTION)
    .update(definition.configurationKey, enabled, vscode.ConfigurationTarget.Global);

  return getDashboardModuleState();
}

export async function updateDashboardModuleContexts(
  state = getDashboardModuleState()
): Promise<void> {
  await Promise.all(registeredDefinitions.map(definition =>
    vscode.commands.executeCommand(
      'setContext',
      definition.contextKey,
      state[definition.id] ?? definition.defaultEnabled
    )
  ));
}
