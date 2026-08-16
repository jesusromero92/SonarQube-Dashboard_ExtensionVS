import { parseReactDoctorResult } from '../../results/parsers';
import { createNodeToolProvider } from '../nodeToolProvider';

export const reactDoctorIntegrationProvider = createNodeToolProvider({
  descriptor: {
    id: 'react-doctor',
    displayName: 'React Doctor',
    description: 'Revisa proyectos React para detectar problemas de rendimiento, seguridad, corrección y arquitectura.',
    category: 'quality',
    failurePolicy: 'continue',
    recommendation: { anyOf: ['react'], reason: 'Recomendada para proyectos React detectados.', priority: 100 }
  },
  packageName: 'react-doctor',
  scriptPattern: /(?:^|\s|[/\\])react-doctor(?:@|\s|$)/i,
  configFiles: ['doctor.config.ts'],
  executable: 'react-doctor',
  binaryName: 'react-doctor',
  parseResult: parseReactDoctorResult,
  setupHint: 'Ejecuta React Doctor desde la raíz del proyecto o añádelo a un script de package.json.'
});
