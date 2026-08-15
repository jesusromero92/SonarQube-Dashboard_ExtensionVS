import * as vscode from 'vscode';
import { getFolderConfig } from '../../configuration';
import type { FolderSonarConfig } from '../../types';
import { SCANNER_MODES } from './constants';

export const PIPELINE_CONFIGURATION_SECTION = 'sonarQubeDashboard.pipeline';

export type ScannerMode =
  | 'auto'
  | 'maven'
  | 'gradle'
  | 'dotnet'
  | 'npm'
  | 'docker'
  | 'custom';

export const PIPELINE_CONFIGURATION_KEYS = {
  scannerMode: 'scannerMode',
  analysisInclusions: 'analysisInclusions',
  analysisExclusions: 'analysisExclusions',
  buildCommand: 'buildCommand',
  customScannerCommand: 'customScannerCommand',
  preAnalysisCommands: 'preAnalysisCommands',
  postAnalysisCommands: 'postAnalysisCommands'
} as const;



export interface PipelineFolderConfig {
  scannerMode: ScannerMode;
  analysisInclusions: string;
  analysisExclusions: string;
  buildCommand: string;
  testCommand: string;
  customScannerCommand: string;
  preAnalysisCommands: string;
  postAnalysisCommands: string;
}

export type PipelineAnalysisConfig = FolderSonarConfig & PipelineFolderConfig;

function testCommandKey(folder: vscode.WorkspaceFolder): string {
  return `sonarQubeDashboard.pipeline.testCommand:${folder.uri.toString()}`;
}

export async function getPipelineFolderConfig(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder
): Promise<PipelineFolderConfig> {
  const configuration = vscode.workspace.getConfiguration(
    PIPELINE_CONFIGURATION_SECTION,
    folder.uri
  );

  return {
    scannerMode: configuration.get<ScannerMode>(
      PIPELINE_CONFIGURATION_KEYS.scannerMode,
      'auto'
    ),
    analysisInclusions: configuration.get<string>(
      PIPELINE_CONFIGURATION_KEYS.analysisInclusions,
      ''
    ).trim(),
    analysisExclusions: configuration.get<string>(
      PIPELINE_CONFIGURATION_KEYS.analysisExclusions,
      ''
    ).trim(),
    buildCommand: configuration.get<string>(
      PIPELINE_CONFIGURATION_KEYS.buildCommand,
      ''
    ).trim(),
    testCommand: (
      context.workspaceState.get<string>(testCommandKey(folder), '')
    ).trim(),
    customScannerCommand: configuration.get<string>(
      PIPELINE_CONFIGURATION_KEYS.customScannerCommand,
      ''
    ).trim(),
    preAnalysisCommands: configuration.get<string>(
      PIPELINE_CONFIGURATION_KEYS.preAnalysisCommands,
      ''
    ).trim(),
    postAnalysisCommands: configuration.get<string>(
      PIPELINE_CONFIGURATION_KEYS.postAnalysisCommands,
      ''
    ).trim()
  };
}

export async function getPipelineAnalysisConfig(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder
): Promise<PipelineAnalysisConfig | undefined> {
  const sonar = await getFolderConfig(context, folder);
  if (!sonar) return undefined;
  return {
    ...sonar,
    ...(await getPipelineFolderConfig(context, folder))
  };
}

export async function savePipelineFolderConfig(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
  values: Partial<PipelineFolderConfig>
): Promise<void> {
  const current = await getPipelineFolderConfig(context, folder);
  const next: PipelineFolderConfig = { ...current, ...values };
  const configuration = vscode.workspace.getConfiguration(
    PIPELINE_CONFIGURATION_SECTION,
    folder.uri
  );

  await Promise.all([
    configuration.update(
      PIPELINE_CONFIGURATION_KEYS.scannerMode,
      next.scannerMode,
      vscode.ConfigurationTarget.WorkspaceFolder
    ),
    configuration.update(
      PIPELINE_CONFIGURATION_KEYS.analysisInclusions,
      next.analysisInclusions.trim(),
      vscode.ConfigurationTarget.WorkspaceFolder
    ),
    configuration.update(
      PIPELINE_CONFIGURATION_KEYS.analysisExclusions,
      next.analysisExclusions.trim(),
      vscode.ConfigurationTarget.WorkspaceFolder
    ),
    configuration.update(
      PIPELINE_CONFIGURATION_KEYS.buildCommand,
      next.buildCommand.trim(),
      vscode.ConfigurationTarget.WorkspaceFolder
    ),
    context.workspaceState.update(
      testCommandKey(folder),
      next.testCommand.trim()
    ),
    configuration.update(
      PIPELINE_CONFIGURATION_KEYS.customScannerCommand,
      next.customScannerCommand.trim(),
      vscode.ConfigurationTarget.WorkspaceFolder
    ),
    configuration.update(
      PIPELINE_CONFIGURATION_KEYS.preAnalysisCommands,
      next.preAnalysisCommands.trim(),
      vscode.ConfigurationTarget.WorkspaceFolder
    ),
    configuration.update(
      PIPELINE_CONFIGURATION_KEYS.postAnalysisCommands,
      next.postAnalysisCommands.trim(),
      vscode.ConfigurationTarget.WorkspaceFolder
    )
  ]);
}



export function normalizeScannerMode(value: unknown): ScannerMode {
  return SCANNER_MODES.some(item => item.value === value)
    ? value as ScannerMode
    : 'auto';
}
