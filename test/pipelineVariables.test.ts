import assert from 'node:assert/strict';
import test from 'node:test';
import type * as vscode from 'vscode';
import {
  integrationCommandRecord,
  resolvePipelineCommand
} from '../src/modules/pipeline/commandVariables';
import {
  normalizePipelineVariables,
  PipelineVariableStore,
  pipelineVariablesRecord
} from '../src/modules/pipeline/variables';

function fakeContext(): vscode.ExtensionContext {
  const workspaceValues = new Map<string, unknown>();
  const secretValues = new Map<string, string>();
  return {
    workspaceState: {
      get<T>(key: string, defaultValue?: T): T | undefined {
        return (workspaceValues.has(key) ? workspaceValues.get(key) : defaultValue) as T | undefined;
      },
      update(key: string, value: unknown): Thenable<void> {
        if (value === undefined) workspaceValues.delete(key);
        else workspaceValues.set(key, value);
        return Promise.resolve();
      },
      keys(): readonly string[] {
        return [...workspaceValues.keys()];
      }
    },
    secrets: {
      get(key: string): Thenable<string | undefined> {
        return Promise.resolve(secretValues.get(key));
      },
      store(key: string, value: string): Thenable<void> {
        secretValues.set(key, value);
        return Promise.resolve();
      },
      delete(key: string): Thenable<void> {
        secretValues.delete(key);
        return Promise.resolve();
      },
      onDidChange: (() => ({ dispose() {} })) as vscode.Event<vscode.SecretStorageChangeEvent>
    },
    __testWorkspaceValues: workspaceValues,
    __testSecretValues: secretValues
  } as unknown as vscode.ExtensionContext;
}

test('normaliza variables de Pipeline y rechaza nombres inválidos o duplicados', () => {
  assert.deepEqual(
    normalizePipelineVariables([
      { name: ' ENVIRONMENT ', value: 'ci' },
      { name: '', value: '' }
    ]),
    [{ name: 'ENVIRONMENT', value: 'ci' }]
  );
  assert.throws(
    () => normalizePipelineVariables([{ name: 'bad-name', value: 'x' }]),
    /no es válido/
  );
  assert.throws(
    () => normalizePipelineVariables([
      { name: 'MODE', value: 'a' },
      { name: 'MODE', value: 'b' }
    ]),
    /repetida/
  );
});

test('resuelve variables dinámicas, personalizadas e integraciones', () => {
  const resolved = resolvePipelineCommand(
    'echo ${packageManager} ${projectKey} ${variable.MODE} && ${integration.eslint.command}',
    {
      values: {
        workspaceFolder: '/repo',
        projectKey: 'demo',
        projectName: 'Demo',
        serverUrl: 'https://sonar.example',
        branch: 'main',
        packageManager: 'pnpm'
      },
      customVariables: { MODE: 'strict' },
      integrationCommands: { eslint: 'pnpm exec eslint .' }
    }
  );
  assert.equal(resolved.command, 'echo pnpm demo strict && pnpm exec eslint .');
  assert.equal(resolved.displayCommand, resolved.command);
  assert.deepEqual(resolved.environment, {});
});

test('inyecta secretos por entorno y no coloca su valor en el comando visible', () => {
  const secret = 'super-secret-value';
  const resolved = resolvePipelineCommand(
    'tool --token ${secret.API_TOKEN}',
    {
      values: {},
      secrets: { API_TOKEN: secret },
      platform: 'linux'
    }
  );
  assert.doesNotMatch(resolved.command, /super-secret-value/);
  assert.equal(resolved.displayCommand, 'tool --token ********');
  assert.equal(Object.values(resolved.environment)[0], secret);
  assert.deepEqual(resolved.sensitiveValues, [secret]);
  assert.throws(
    () => resolvePipelineCommand('tool ${secret.MISSING}', { values: {}, secrets: {} }),
    /no está configurado/
  );
});

test('PipelineVariableStore mantiene valores secretos fuera de workspaceState', async () => {
  const context = fakeContext();
  const store = new PipelineVariableStore(context);
  const folderUri = 'file:///workspace/demo';

  const variables = await store.saveVariables(folderUri, [
    { name: 'MODE', value: 'strict' }
  ]);
  assert.deepEqual(pipelineVariablesRecord(variables), { MODE: 'strict' });

  await store.setSecret(folderUri, 'API_TOKEN', 'private-token-123');
  assert.deepEqual(store.listSecretNames(folderUri), ['API_TOKEN']);
  assert.deepEqual(await store.readSecrets(folderUri), { API_TOKEN: 'private-token-123' });

  const internals = context as unknown as {
    __testWorkspaceValues: Map<string, unknown>;
    __testSecretValues: Map<string, string>;
  };
  assert.doesNotMatch(
    JSON.stringify([...internals.__testWorkspaceValues.entries()]),
    /private-token-123/
  );
  assert.match(
    JSON.stringify([...internals.__testSecretValues.entries()]),
    /private-token-123/
  );

  await store.deleteSecret(folderUri, 'API_TOKEN');
  assert.deepEqual(store.listSecretNames(folderUri), []);
  assert.deepEqual(await store.readSecrets(folderUri), {});
});

test('integrationCommandRecord ignora integraciones sin comando', () => {
  assert.deepEqual(
    integrationCommandRecord([
      { id: 'eslint', command: 'npm exec -- eslint .' },
      { id: 'sonarqube', command: '' }
    ]),
    { eslint: 'npm exec -- eslint .' }
  );
});
