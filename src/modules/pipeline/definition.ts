import type { DashboardModuleDefinition } from '../contracts';
import { PIPELINE_DESCRIPTOR_LOCALIZATION } from './i18n/descriptor';

export function definePipelineModule(
  context: import('vscode').ExtensionContext
): DashboardModuleDefinition {
  return {
    id: 'pipeline',
    displayName: 'Pipeline',
    configurationKey: 'modules.pipeline.enabled',
    contextKey: 'sonarQubeDashboard.module.pipeline.enabled',
    defaultEnabled: true,
    description: 'Análisis del repositorio, pasos y plantillas, integraciones, historial de ejecuciones y comparación antes/después.',
    localization: PIPELINE_DESCRIPTOR_LOCALIZATION,
    async create() {
      const { PipelineModule } = await import('./module');
      return new PipelineModule(context);
    }
  };
}
