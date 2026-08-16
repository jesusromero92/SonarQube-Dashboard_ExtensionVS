import { createNodeToolProvider } from '../nodeToolProvider';

export const prettierIntegrationProvider = createNodeToolProvider({
  descriptor: {
    id: 'prettier',
    displayName: 'Prettier',
    description: 'Comprueba que el formato del proyecto cumple la configuración de Prettier.',
    category: 'formatting-lint',
    failurePolicy: 'stop',
    recommendation: { anyOf: ['node', 'javascript', 'typescript', 'react'], reason: 'Recomendada para proyectos Node.js, JavaScript o TypeScript detectados.', priority: 50 }
  },
  packageName: 'prettier',
  scriptPattern: /(?:^|\s)prettier(?:\s|$)/i,
  configFiles: [
    '.prettierrc',
    '.prettierrc.json',
    '.prettierrc.yml',
    '.prettierrc.yaml',
    'prettier.config.js',
    'prettier.config.mjs',
    'prettier.config.cjs'
  ],
  executable: 'prettier --check .',
  binaryName: 'prettier',
  setupHint: 'Añade Prettier como dependencia de desarrollo y una configuración o script si lo necesitas.'
});
