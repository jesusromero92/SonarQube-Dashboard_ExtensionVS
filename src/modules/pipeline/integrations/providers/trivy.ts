import type { PipelineIntegrationProvider } from '../contracts';
import { packageScriptCommand } from '../context';
import {
  buildDetectedIntegration,
  compactEvidence,
  evidence,
  findExecutable,
  firstExisting,
  firstScript
} from '../helpers';

import { versionProbe } from '../probe';

const descriptor = {
  id: 'trivy',
  displayName: 'Trivy',
  description: 'Escanea vulnerabilidades, secretos y configuraciones inseguras.',
  category: 'containers' as const,
  failurePolicy: 'continue' as const,
  recommendation: { anyOf: ['docker'], reason: 'Recomendada para proyectos Docker detectados.', priority: 85 }
};

export const trivyIntegrationProvider: PipelineIntegrationProvider = {
  descriptor,
  watchFiles: ['trivy.yaml', 'trivy.yml', '.trivyignore', 'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'],
  async detect(context) {
    const scripts = context.node?.packageJson.scripts ?? {};
    const script = firstScript(scripts, ['trivy', 'security:trivy', 'scan:trivy']);
    const config = await firstExisting(context.rootPath, ['trivy.yaml', 'trivy.yml', '.trivyignore']);
    const containerFile = await firstExisting(context.rootPath, [
      'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'
    ]);
    const binary = await findExecutable(context.platform, 'trivy', context.rootPath);
    if (!script && !config && !containerFile && !binary) return undefined;

    return buildDetectedIntegration(
      descriptor,
      script && context.node
        ? packageScriptCommand(context.node.packageManager, script)
        : 'trivy fs --scanners vuln,secret,misconfig .',
      compactEvidence(
        evidence('script', script ? `package.json#scripts.${script}` : undefined),
        evidence('config', config),
        evidence('project-file', containerFile),
        evidence('binary', binary)
      ),
      script || config || binary ? 'configured' : 'partial',
      undefined,
      undefined,
      binary ? 'healthy' : 'warning'
    );
  },
  getProbe(context) {
    return versionProbe(context.rootPath, context.platform, 'trivy');
  },
  getSetup() {
    return {
      hint: 'Instala el CLI de Trivy con el método recomendado para tu sistema y añade una configuración, script o archivo de contenedor detectable.'
    };
  }
};
