import type { IssueDiagnosticPresentation } from '../../issueDiagnostics';
import type { DashboardModuleDefinition } from '../contracts';
import { LIVE_REMEDIATION_DESCRIPTOR_LOCALIZATION } from './i18n/descriptor';

export function defineLiveRemediationModule(
  context: import('vscode').ExtensionContext,
  diagnostics: IssueDiagnosticPresentation,
  analyzeCapabilityCommand: string,
  onOverlayChanged: () => void
): DashboardModuleDefinition {
  return {
    id: 'liveRemediation',
    displayName: 'Live Remediation',
    configurationKey: 'modules.liveRemediation.enabled',
    contextKey: 'sonarQubeDashboard.module.liveRemediation.enabled',
    defaultEnabled: true,
    description: 'Seguimiento de cambios locales sobre issues sincronizados, validación opcional con SonarQube for IDE y vista de issues modificados localmente.',
    localization: LIVE_REMEDIATION_DESCRIPTOR_LOCALIZATION,
    async create() {
      const { LiveRemediationModule } = await import('./module');
      return new LiveRemediationModule(
        context,
        diagnostics,
        analyzeCapabilityCommand,
        onOverlayChanged
      );
    }
  };
}
