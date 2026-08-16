import type { PipelineIntegrationProvider } from '../contracts';
import { buildDetectedIntegration, evidence, findExecutable, firstExisting } from '../helpers';

import { versionProbe } from '../probe';

const descriptor = {
  id: 'golangci-lint',
  displayName: 'golangci-lint',
  description: 'Ejecuta una colección de linters sobre proyectos Go.',
  category: 'formatting-lint' as const,
  failurePolicy: 'stop' as const,
  recommendation: { anyOf: ['go'], reason: 'Recomendada para proyectos Go detectados.', priority: 95 }
};

export const golangciLintIntegrationProvider: PipelineIntegrationProvider = {
  descriptor,
  watchFiles: ['.golangci.yml', '.golangci.yaml', '.golangci.toml', '.golangci.json'],
  async detect(context) {
    const config = await firstExisting(context.rootPath, [
      '.golangci.yml', '.golangci.yaml', '.golangci.toml', '.golangci.json'
    ]);
    if (!config) return undefined;
    const binary = await findExecutable(context.platform, 'golangci-lint', context.rootPath);
    return buildDetectedIntegration(
      descriptor,
      'golangci-lint run',
      [evidence('config', config)!, ...(binary ? [evidence('binary', binary)!] : [])],
      'configured',
      undefined,
      undefined,
      binary ? 'healthy' : 'warning'
    );
  },
  getProbe(context) {
    return versionProbe(context.rootPath, context.platform, 'golangci-lint');
  },
  getSetup() {
    return {
      hint: 'Instala golangci-lint con el método recomendado para tu entorno y añade un archivo .golangci.* al proyecto.'
    };
  }
};
