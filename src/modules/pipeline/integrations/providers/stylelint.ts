import { createNodeToolProvider } from '../nodeToolProvider';

export const stylelintIntegrationProvider = createNodeToolProvider({
  descriptor: {
    id: 'stylelint',
    displayName: 'Stylelint',
    description: 'Analiza CSS y preprocesadores compatibles mediante reglas Stylelint.',
    category: 'formatting-lint',
    failurePolicy: 'stop',
    recommendation: { anyOf: ['react'], reason: 'Recomendada para proyectos React detectados.', priority: 55 }
  },
  packageName: 'stylelint',
  scriptPattern: /(?:^|\s)stylelint(?:\s|$)/i,
  configFiles: [
    'stylelint.config.js',
    'stylelint.config.mjs',
    'stylelint.config.cjs',
    '.stylelintrc',
    '.stylelintrc.json',
    '.stylelintrc.yml',
    '.stylelintrc.yaml'
  ],
  executable: 'stylelint "**/*.{css,scss,sass,less}"',
  binaryName: 'stylelint',
  setupHint: 'Añade Stylelint al proyecto y crea una configuración Stylelint.',
  configurationStatus: ({ script, config }) => script || config ? 'configured' : 'partial'
});
