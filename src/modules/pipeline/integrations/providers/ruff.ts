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
import { parseRuffResult } from '../../results/parsers';

const descriptor = {
  id: 'ruff',
  displayName: 'Ruff',
  description: 'Ejecuta lint y comprobaciones rápidas de calidad para proyectos Python.',
  category: 'formatting-lint' as const,
  failurePolicy: 'stop' as const,
  recommendation: { anyOf: ['python'], reason: 'Recomendada para proyectos Python detectados.', priority: 95 }
};

export const ruffIntegrationProvider: PipelineIntegrationProvider = {
  descriptor,
  parseResult: parseRuffResult,
  watchFiles: ['ruff.toml', '.ruff.toml', 'pyproject.toml', 'requirements.txt', 'requirements-dev.txt'],
  async detect(context) {
    const config = await firstExisting(context.rootPath, ['ruff.toml', '.ruff.toml']);
    const pyproject = path.join(context.rootPath, 'pyproject.toml');
    const pyprojectConfigured = await fileContains(pyproject, /\[tool\.ruff(?:\.|\])/i);
    const requirements = await firstExisting(context.rootPath, ['requirements.txt', 'requirements-dev.txt']);
    const requirementsConfigured = Boolean(requirements && await fileContains(
      path.join(context.rootPath, requirements), /^\s*ruff(?:[<>=~!]|\s|$)/im
    ));
    const binary = await findExecutable(context.platform, 'ruff', context.rootPath);
    if (!config && !pyprojectConfigured && !requirementsConfigured) return undefined;

    const version = await versionFromRequirements(context.rootPath, requirements, 'ruff');
    return buildDetectedIntegration(
      descriptor,
      context.platform === 'win32'
        ? 'py -m ruff check . --output-format json'
        : 'python3 -m ruff check . --output-format json',
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
      ? versionProbe(context.rootPath, context.platform, 'py', ['-m', 'ruff', '--version'], 'py -m ruff --version')
      : versionProbe(context.rootPath, context.platform, 'python3', ['-m', 'ruff', '--version'], 'python3 -m ruff --version');
  },
  getSetup() {
    return {
      hint: 'Instala Ruff y configúralo en pyproject.toml, ruff.toml o .ruff.toml.',
      command: 'pip install ruff'
    };
  }
};
