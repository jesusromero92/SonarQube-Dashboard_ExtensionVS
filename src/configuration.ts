import * as vscode from 'vscode';
import { FolderSonarConfig, FolderSonarFormConfig } from './types';

const TOKEN_KEY_PREFIX = 'issueDashboard.sonar.token:';

export function tokenKey(folder: vscode.WorkspaceFolder): string {
  return `${TOKEN_KEY_PREFIX}${folder.uri.toString()}`;
}

export async function getFolderFormConfig(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder
): Promise<FolderSonarFormConfig> {
  const configuration = vscode.workspace.getConfiguration(
    'issueDashboard.sonar',
    folder.uri
  );

  return {
    serverUrl: configuration.get<string>('serverUrl', '').trim(),
    projectKey: configuration.get<string>('projectKey', '').trim(),
    branch: configuration.get<string>('branch', '').trim(),
    baseDir: configuration.get<string>('baseDir', '').trim(),
    hasToken: Boolean(await context.secrets.get(tokenKey(folder)))
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
    branch: form.branch,
    baseDir: form.baseDir,
    token
  };
}

export async function saveFolderConfig(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
  values: {
    serverUrl: string;
    projectKey: string;
    branch: string;
    baseDir: string;
    token?: string;
  }
): Promise<void> {
  const configuration = vscode.workspace.getConfiguration(
    'issueDashboard.sonar',
    folder.uri
  );

  await configuration.update(
    'serverUrl',
    values.serverUrl.trim().replace(/\/+$/, ''),
    vscode.ConfigurationTarget.WorkspaceFolder
  );
  await configuration.update(
    'projectKey',
    values.projectKey.trim(),
    vscode.ConfigurationTarget.WorkspaceFolder
  );
  await configuration.update(
    'branch',
    values.branch.trim(),
    vscode.ConfigurationTarget.WorkspaceFolder
  );
  await configuration.update(
    'baseDir',
    values.baseDir.trim(),
    vscode.ConfigurationTarget.WorkspaceFolder
  );

  if (values.token?.trim()) {
    await context.secrets.store(tokenKey(folder), values.token.trim());
  }
}
