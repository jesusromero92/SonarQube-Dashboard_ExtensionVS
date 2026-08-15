import type { IssueDiagnosticManager } from '../issueDiagnostics';
import type * as vscode from 'vscode';
import { ANALYZE_REPOSITORY_CAPABILITY_COMMAND } from './constants';
import { defineLiveRemediationModule } from './liveRemediation/definition';
import { definePipelineModule } from './pipeline/definition';
import { DashboardModuleRuntime } from './runtime';

export function createDashboardModuleRuntime(
  context: vscode.ExtensionContext,
  issueDiagnostics: IssueDiagnosticManager,
  onIssueOverlayChanged: () => void
): DashboardModuleRuntime {
  const definitions = [
    definePipelineModule(context),
    defineLiveRemediationModule(
      context,
      issueDiagnostics,
      ANALYZE_REPOSITORY_CAPABILITY_COMMAND,
      onIssueOverlayChanged
    )
  ];

  return new DashboardModuleRuntime(
    definitions,
    issueDiagnostics,
    onIssueOverlayChanged
  );
}
