import { parseEslintResult } from '../../results/parsers';
import { createNodeToolProvider } from '../nodeToolProvider';

export const eslintIntegrationProvider = createNodeToolProvider({
  descriptor: {
    id: 'eslint',
    displayName: 'ESLint',
    description: 'Ejecuta el análisis estático de JavaScript y TypeScript.',
    category: 'formatting-lint',
    failurePolicy: 'stop',
    recommendation: { anyOf: ['node', 'javascript', 'typescript', 'react'], reason: 'Recomendada para proyectos Node.js, JavaScript o TypeScript detectados.', priority: 90 }
  },
  packageName: 'eslint',
  scriptNames: ['lint', 'lint:ci', 'eslint'],
  configFiles: [
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs',
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.json',
    '.eslintrc.yml',
    '.eslintrc.yaml'
  ],
  executable: 'eslint . --format json',
  parseResult: parseEslintResult,
  binaryName: 'eslint',
  setupHint: 'Añade ESLint como dependencia de desarrollo y configura un script o eslint.config.*.',
  configurationStatus: ({ script, config }) => script || config ? 'configured' : 'partial'
});
