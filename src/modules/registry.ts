import type { IssueDiagnosticManager } from '../issueDiagnostics';
import type * as vscode from 'vscode';
import { ANALYZE_REPOSITORY_CAPABILITY_COMMAND } from './constants';
import type { DashboardModule } from './contracts';
import { LiveRemediationModule } from './liveRemediation/module';
import { PipelineModule } from './pipeline/module';
import { DashboardModuleRuntime } from './runtime';

export function createDashboardModuleRuntime(
  context: vscode.ExtensionContext,
  issueDiagnostics: IssueDiagnosticManager,
  onIssueOverlayChanged: () => void
): DashboardModuleRuntime {
  const modules: readonly DashboardModule[] = [
    new PipelineModule(context),
    new LiveRemediationModule(
      context,
      issueDiagnostics,
      ANALYZE_REPOSITORY_CAPABILITY_COMMAND,
      onIssueOverlayChanged
    )
  ];

  return new DashboardModuleRuntime(
    modules,
    issueDiagnostics,
    onIssueOverlayChanged
  );
}
