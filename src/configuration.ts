import * as vscode from 'vscode';
import {
  SONAR_CONFIGURATION_KEYS,
  SONAR_CONFIGURATION_SECTION,
  SONAR_TOKEN_KEY_PREFIX
} from './constants';
import { FolderSonarConfig, FolderSonarFormConfig, ScannerMode } from './types';

export function tokenKey(folder: vscode.WorkspaceFolder): string {
  return `${SONAR_TOKEN_KEY_PREFIX}${folder.uri.toString()}`;
}

export async function getFolderFormConfig(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder
): Promise<FolderSonarFormConfig> {
  const configuration = vscode.workspace.getConfiguration(
    SONAR_CONFIGURATION_SECTION,
    folder.uri
  );

  return {
    serverUrl: configuration.get<string>(SONAR_CONFIGURATION_KEYS.serverUrl, '').trim(),
    projectKey: configuration.get<string>(SONAR_CONFIGURATION_KEYS.projectKey, '').trim(),
    projectName: configuration.get<string>(SONAR_CONFIGURATION_KEYS.projectName, '').trim(),
    branch: configuration.get<string>(SONAR_CONFIGURATION_KEYS.branch, '').trim(),
    baseDir: configuration.get<string>(SONAR_CONFIGURATION_KEYS.baseDir, '').trim(),
    hasToken: Boolean(await context.secrets.get(tokenKey(folder))),
    scannerMode: configuration.get<ScannerMode>(SONAR_CONFIGURATION_KEYS.scannerMode, 'auto'),
    buildCommand: configuration.get<string>(SONAR_CONFIGURATION_KEYS.buildCommand, '').trim(),
    customScannerCommand: configuration.get<string>(SONAR_CONFIGURATION_KEYS.customScannerCommand, '').trim()
  };
}

export async function getFolderConfig(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder
): Promise<FolderSonarConfig | undefined> {
  const form = await getFolderFormConfig(context, folder);
  const token = await context.secrets.get(tokenKey(folder));

  if (!form.serverUrl || !form.projectKey || !token) {
    return undefined;
  }

  return {
    serverUrl: form.serverUrl,
    projectKey: form.projectKey,
    projectName: form.projectName || form.projectKey,
    branch: form.branch,
    baseDir: form.baseDir,
    token,
    scannerMode: form.scannerMode,
    buildCommand: form.buildCommand,
    customScannerCommand: form.customScannerCommand
  };
}

export async function saveFolderConfig(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
  values: {
    serverUrl: string;
    projectKey: string;
    projectName: string;
    branch: string;
    baseDir: string;
    token?: string;
    scannerMode?: ScannerMode;
    buildCommand?: string;
    customScannerCommand?: string;
  }
): Promise<void> {
  const configuration = vscode.workspace.getConfiguration(
    SONAR_CONFIGURATION_SECTION,
    folder.uri
  );

  await configuration.update(
    SONAR_CONFIGURATION_KEYS.serverUrl,
    values.serverUrl.trim().replace(/\/+$/, ''),
    vscode.ConfigurationTarget.WorkspaceFolder
  );
  await configuration.update(
    SONAR_CONFIGURATION_KEYS.projectKey,
    values.projectKey.trim(),
    vscode.ConfigurationTarget.WorkspaceFolder
  );
  await configuration.update(
    SONAR_CONFIGURATION_KEYS.projectName,
    values.projectName.trim(),
    vscode.ConfigurationTarget.WorkspaceFolder
  );
  await configuration.update(
    SONAR_CONFIGURATION_KEYS.branch,
    values.branch.trim(),
    vscode.ConfigurationTarget.WorkspaceFolder
  );
  await configuration.update(
    SONAR_CONFIGURATION_KEYS.baseDir,
    values.baseDir.trim(),
    vscode.ConfigurationTarget.WorkspaceFolder
  );
  await configuration.update(
    SONAR_CONFIGURATION_KEYS.scannerMode,
    values.scannerMode ?? 'auto',
    vscode.ConfigurationTarget.WorkspaceFolder
  );
  await configuration.update(
    SONAR_CONFIGURATION_KEYS.buildCommand,
    values.buildCommand?.trim() ?? '',
    vscode.ConfigurationTarget.WorkspaceFolder
  );
  await configuration.update(
    SONAR_CONFIGURATION_KEYS.customScannerCommand,
    values.customScannerCommand?.trim() ?? '',
    vscode.ConfigurationTarget.WorkspaceFolder
  );

  if (values.token?.trim()) {
    await context.secrets.store(tokenKey(folder), values.token.trim());
  }
}
