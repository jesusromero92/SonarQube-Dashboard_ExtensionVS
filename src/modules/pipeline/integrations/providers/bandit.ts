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
  id: 'bandit',
  displayName: 'Bandit',
  description: 'Busca problemas de seguridad habituales en código Python.',
  category: 'security-sast' as const,
  failurePolicy: 'continue' as const,
  recommendation: { anyOf: ['python'], reason: 'Recomendada para proyectos Python detectados.', priority: 85 }
};

export const banditIntegrationProvider: PipelineIntegrationProvider = {
  descriptor,
  watchFiles: ['.bandit', 'bandit.yaml', 'bandit.yml', 'pyproject.toml', 'requirements.txt', 'requirements-dev.txt'],
  async detect(context) {
    const config = await firstExisting(context.rootPath, ['.bandit', 'bandit.yaml', 'bandit.yml']);
    const pyproject = path.join(context.rootPath, 'pyproject.toml');
    const pyprojectConfigured = await fileContains(pyproject, /\[tool\.bandit(?:\.|\])/i);
    const requirements = await firstExisting(context.rootPath, ['requirements.txt', 'requirements-dev.txt']);
    const requirementsConfigured = Boolean(requirements && await fileContains(
      path.join(context.rootPath, requirements), /^\s*bandit(?:[<>=~!]|\s|$)/im
    ));
    const binary = await findExecutable(context.platform, 'bandit', context.rootPath);
    if (!config && !pyprojectConfigured && !requirementsConfigured) return undefined;

    const version = await versionFromRequirements(context.rootPath, requirements, 'bandit');
    return buildDetectedIntegration(
      descriptor,
      context.platform === 'win32' ? 'py -m bandit -r .' : 'python3 -m bandit -r .',
      compactEvidence(
        evidence('config', config),
        evidence('config', pyprojectConfigured ? 'pyproject.toml' : undefined),
        evidence('dependency', requirementsConfigured ? requirements : undefined),
        evidence('binary', binary)
      ),
      config || pyprojectConfigured || binary ? 'configured' : 'partial',
      version,
      undefined,
      binary ? 'healthy' : 'warning'
    );
  },
  getProbe(context) {
    return context.platform === 'win32'
      ? versionProbe(context.rootPath, context.platform, 'py', ['-m', 'bandit', '--version'], 'py -m bandit --version')
      : versionProbe(context.rootPath, context.platform, 'python3', ['-m', 'bandit', '--version'], 'python3 -m bandit --version');
  },
  getSetup() {
    return {
      hint: 'Instala Bandit y añádelo a requirements o a su configuración del proyecto.',
      command: 'pip install bandit'
    };
  }
};
