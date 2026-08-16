import type { PipelineIntegrationProvider } from '../contracts';
import { packageScriptCommand } from '../context';
import {
  buildDetectedIntegration,
  compactEvidence,
  evidence,
  findExecutable,
  firstExisting,
  firstScript,
  nodeDependency,
  resolveNodePackageVersion
} from '../helpers';

import { versionProbe } from '../probe';
import { parseSemgrepResult } from '../../results/parsers';

const descriptor = {
  id: 'semgrep',
  displayName: 'Semgrep',
  description: 'Busca patrones de seguridad y calidad mediante reglas Semgrep.',
  category: 'security-sast' as const,
  failurePolicy: 'continue' as const,
  recommendation: { anyOf: ['node', 'javascript', 'typescript', 'react', 'python', 'java', 'dotnet', 'go'], reason: 'Recomendada para el stack de código detectado.', priority: 65 }
};

export const semgrepIntegrationProvider: PipelineIntegrationProvider = {
  descriptor,
  parseResult: parseSemgrepResult,
  watchFiles: ['.semgrep.yml', '.semgrep.yaml', 'semgrep.yml', 'semgrep.yaml'],
  async detect(context) {
    const config = await firstExisting(context.rootPath, [
      '.semgrep.yml', '.semgrep.yaml', 'semgrep.yml', 'semgrep.yaml'
    ]);
    const scripts = context.node?.packageJson.scripts ?? {};
    const script = firstScript(scripts, ['semgrep', 'security:semgrep', 'scan:semgrep']);
    const dependency = nodeDependency(context.node, 'semgrep');
    const binary = await findExecutable(context.platform, 'semgrep', context.rootPath);
    if (!config && !script && !dependency && !binary) return undefined;

    const version = dependency ? await resolveNodePackageVersion(context, 'semgrep') : undefined;
    return buildDetectedIntegration(
      descriptor,
      script && context.node
        ? packageScriptCommand(context.node.packageManager, script)
        : 'semgrep scan --config auto --json .',
      compactEvidence(
        evidence('script', script ? `package.json#scripts.${script}` : undefined),
        evidence('config', config),
        dependency,
        evidence('binary', binary)
      ),
      config || script || binary ? 'configured' : 'partial',
      version,
      undefined,
      binary || version?.source === 'installed' ? 'healthy' : 'warning'
    );
  },
  getProbe(context) {
    return versionProbe(context.rootPath, context.platform, 'semgrep');
  },
  getSetup() {
    return {
      hint: 'Instala el CLI de Semgrep y añade una configuración o script de análisis al proyecto.',
      command: 'pipx install semgrep'
    };
  }
};
