import * as vscode from 'vscode';
import { DASHBOARD_CONFIGURATION_SECTION } from '../constants';
import {
  DashboardModuleId,
  MODULE_CONFIGURATION_KEYS,
  MODULE_CONTEXT_KEYS
} from './constants';

export interface DashboardModuleState {
  pipeline: boolean;
  liveRemediation: boolean;
}

export function getDashboardModuleState(): DashboardModuleState {
  const configuration = vscode.workspace.getConfiguration(
    DASHBOARD_CONFIGURATION_SECTION
  );
  return {
    pipeline: configuration.get<boolean>(
      MODULE_CONFIGURATION_KEYS.pipeline,
      true
    ),
    liveRemediation: configuration.get<boolean>(
      MODULE_CONFIGURATION_KEYS.liveRemediation,
      true
    )
  };
}

export function isDashboardModuleEnabled(moduleId: DashboardModuleId): boolean {
  return getDashboardModuleState()[moduleId];
}

export async function setDashboardModuleEnabled(
  moduleId: DashboardModuleId,
  enabled: boolean
): Promise<DashboardModuleState> {
  await vscode.workspace
    .getConfiguration(DASHBOARD_CONFIGURATION_SECTION)
    .update(
      MODULE_CONFIGURATION_KEYS[moduleId],
      enabled,
      vscode.ConfigurationTarget.Global
    );

  const state = getDashboardModuleState();
  await updateDashboardModuleContexts(state);
  return state;
}

export async function updateDashboardModuleContexts(
  state = getDashboardModuleState()
): Promise<void> {
  await Promise.all([
    vscode.commands.executeCommand(
      'setContext',
      MODULE_CONTEXT_KEYS.pipeline,
      state.pipeline
    ),
    vscode.commands.executeCommand(
      'setContext',
      MODULE_CONTEXT_KEYS.liveRemediation,
      state.liveRemediation
    )
  ]);
}
