import { createNodeToolProvider } from '../nodeToolProvider';

export const biomeIntegrationProvider = createNodeToolProvider({
  descriptor: {
    id: 'biome',
    displayName: 'Biome',
    description: 'Comprueba formato, lint y calidad de código JavaScript y TypeScript con Biome.',
    category: 'formatting-lint',
    failurePolicy: 'stop',
    recommendation: { anyOf: ['node', 'javascript', 'typescript', 'react'], reason: 'Recomendada para proyectos Node.js, JavaScript o TypeScript detectados.', priority: 70 }
  },
  packageName: '@biomejs/biome',
  scriptPattern: /(?:^|\s)(?:biome|@biomejs\/biome)(?:\s|$)/i,
  configFiles: ['biome.json', 'biome.jsonc'],
  executable: 'biome check .',
  binaryName: 'biome',
  setupHint: 'Añade Biome al proyecto y crea biome.json o biome.jsonc.'
});
