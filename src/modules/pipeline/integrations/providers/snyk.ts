import { createNodeToolProvider } from '../nodeToolProvider';

export const snykIntegrationProvider = createNodeToolProvider({
  descriptor: {
    id: 'snyk',
    displayName: 'Snyk',
    description: 'Comprueba vulnerabilidades de dependencias con Snyk.',
    category: 'dependencies-sca',
    failurePolicy: 'continue',
    recommendation: { anyOf: ['node', 'python', 'java', 'dotnet', 'go'], reason: 'Recomendada para el stack de código detectado.', priority: 60 }
  },
  packageName: 'snyk',
  scriptNames: ['snyk', 'security:snyk', 'scan:snyk'],
  configFiles: ['.snyk'],
  executable: 'snyk test',
  binaryName: 'snyk',
  setupHint: 'Añade Snyk al proyecto y autentica el CLI antes de ejecutar análisis.',
  configurationStatus: ({ script, config }) => script || config ? 'configured' : 'unknown'
});
