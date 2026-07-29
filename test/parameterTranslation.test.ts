import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAliasHandlers,
  translateCanonicalParameters
} from '../src/sonarApi/parameterTranslation';

test('normaliza parámetros canónicos con un único pipeline reutilizable', () => {
  const translated = translateCanonicalParameters(
    {
      projectKey: ' project-a ',
      page: ' 2 ',
      empty: '   ',
      passthrough: 'value'
    },
    {
      handlers: createAliasHandlers({
        projectKey: 'project',
        page: 'p'
      })
    }
  );

  assert.equal(translated.toString(), 'project=project-a&p=2&passthrough=value');
});

test('permite desactivar el copiado de parámetros no registrados', () => {
  const translated = translateCanonicalParameters(
    { projectKey: 'project-a', ignored: 'value' },
    {
      handlers: createAliasHandlers({ projectKey: 'project' }),
      copyUnmapped: false
    }
  );

  assert.equal(translated.toString(), 'project=project-a');
});
