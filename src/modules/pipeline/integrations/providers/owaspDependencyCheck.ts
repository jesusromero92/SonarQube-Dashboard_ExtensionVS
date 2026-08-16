import * as path from 'node:path';
import type { PipelineIntegrationProvider } from '../contracts';
import {
  buildDetectedIntegration,
  evidence,
  executableForWrapper,
  fileContains,
  firstExisting
} from '../helpers';
import { versionProbe } from '../probe';

const descriptor = {
  id: 'owasp-dependency-check',
  displayName: 'OWASP Dependency-Check',
  description: 'Analiza dependencias conocidas mediante OWASP Dependency-Check.',
  category: 'dependencies-sca' as const,
  failurePolicy: 'continue' as const,
  recommendation: { anyOf: ['java'], reason: 'Recomendada para proyectos Java detectados.', priority: 75 }
};

export const owaspDependencyCheckIntegrationProvider: PipelineIntegrationProvider = {
  descriptor,
  watchFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
  async detect(context) {
    const pomPath = path.join(context.rootPath, 'pom.xml');
    if (await fileContains(pomPath, /dependency-check-maven|org\.owasp/i)) {
      const executable = await executableForWrapper(
        context.rootPath,
        context.platform === 'win32' ? 'mvnw.cmd' : 'mvnw',
        context.platform === 'win32' ? 'mvn.cmd' : 'mvn'
      );
      return buildDetectedIntegration(
        descriptor,
        `${executable} org.owasp:dependency-check-maven:check`,
        [evidence('plugin', 'pom.xml')!],
        'configured'
      );
    }

    const gradleFile = await firstExisting(context.rootPath, ['build.gradle', 'build.gradle.kts']);
    if (!gradleFile || !await fileContains(
      path.join(context.rootPath, gradleFile),
      /org\.owasp\.dependencycheck|dependencyCheck/i
    )) return undefined;

    const executable = await executableForWrapper(
      context.rootPath,
      context.platform === 'win32' ? 'gradlew.bat' : 'gradlew',
      context.platform === 'win32' ? 'gradle.bat' : 'gradle'
    );
    return buildDetectedIntegration(
      descriptor,
      `${executable} dependencyCheckAnalyze`,
      [evidence('plugin', gradleFile)!],
      'configured'
    );
  },
  getProbe(context, integration) {
    const executable = integration.command.trim().split(/\s+/, 1)[0];
    return versionProbe(context.rootPath, context.platform, executable);
  },
  getSetup() {
    return {
      hint: 'Añade OWASP Dependency-Check como plugin de Maven o Gradle en la configuración del proyecto.'
    };
  }
};
