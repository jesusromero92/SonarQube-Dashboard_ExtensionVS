import * as path from 'node:path';
import type { PipelineIntegrationProvider } from '../contracts';
import {
  buildDetectedIntegration,
  compactEvidence,
  evidence,
  findExecutable,
  fileContains,
  firstExisting,
  versionFromRequirements
} from '../helpers';

import { versionProbe } from '../probe';

const descriptor = {
  id: 'checkov',
  displayName: 'Checkov',
  description: 'Analiza infraestructura como código y configuraciones cloud en busca de riesgos.',
  category: 'iac' as const,
  failurePolicy: 'continue' as const,
  recommendation: { anyOf: ['terraform'], reason: 'Recomendada para proyectos Terraform detectados.', priority: 95 }
};

export const checkovIntegrationProvider: PipelineIntegrationProvider = {
  descriptor,
  watchFiles: ['.checkov.yml', '.checkov.yaml', 'checkov.yml', 'checkov.yaml', 'requirements.txt', 'requirements-dev.txt'],
  async detect(context) {
    const config = await firstExisting(context.rootPath, [
      '.checkov.yml', '.checkov.yaml', 'checkov.yml', 'checkov.yaml'
    ]);
    const requirements = await firstExisting(context.rootPath, ['requirements.txt', 'requirements-dev.txt']);
    const requirementsConfigured = Boolean(requirements && await fileContains(
      path.join(context.rootPath, requirements), /^\s*checkov(?:[<>=~!]|\s|$)/im
    ));
    const binary = await findExecutable(context.platform, 'checkov', context.rootPath);
    if (!config && !requirementsConfigured) return undefined;

    const version = await versionFromRequirements(context.rootPath, requirements, 'checkov');
    return buildDetectedIntegration(
      descriptor,
      'checkov -d .',
      compactEvidence(
        evidence('config', config),
        evidence('dependency', requirementsConfigured ? requirements : undefined),
        evidence('binary', binary)
      ),
      config || binary ? 'configured' : 'partial',
      version,
      undefined,
      binary ? 'healthy' : 'warning'
    );
  },
  getProbe(context) {
    return context.platform === 'win32'
      ? versionProbe(context.rootPath, context.platform, 'py', ['-m', 'checkov', '--version'], 'py -m checkov --version')
      : versionProbe(context.rootPath, context.platform, 'python3', ['-m', 'checkov', '--version'], 'python3 -m checkov --version');
  },
  getSetup() {
    return {
      hint: 'Instala Checkov y añade una configuración .checkov.yml/.yaml o una dependencia de proyecto.',
      command: 'pip install checkov'
    };
  }
};
