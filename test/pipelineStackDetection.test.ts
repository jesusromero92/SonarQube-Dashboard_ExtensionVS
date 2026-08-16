import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';
import { detectProjectActions } from '../src/modules/pipeline/projectActions';

async function tempProject(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test('detecta stack React + TypeScript + Vitest y recomienda solo integraciones relevantes', async () => {
  const root = await tempProject('sonar-stack-react-');
  try {
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({
      packageManager: 'npm@11.0.0',
      scripts: { test: 'vitest run' },
      dependencies: { react: '^19.0.0' },
      devDependencies: { typescript: '^5.9.0', vitest: '^3.0.0' }
    }));
    await fs.writeFile(path.join(root, 'tsconfig.json'), '{}');

    const actions = await detectProjectActions(root);
    assert.deepEqual(
      new Set(actions.stack.ids),
      new Set(['node', 'javascript', 'typescript', 'react', 'vitest'])
    );
    const recommended = actions.recommendedIntegrations.map(item => item.id);
    assert.ok(recommended.includes('react-doctor'));
    assert.ok(recommended.includes('eslint'));
    assert.ok(recommended.includes('dependency-audit'));
    assert.ok(recommended.includes('semgrep'));
    assert.equal(recommended.includes('ruff'), false);
    assert.equal(recommended.includes('checkov'), false);
    assert.equal(recommended.includes('golangci-lint'), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('detecta Python y recomienda Ruff/Bandit sin herramientas de otros stacks', async () => {
  const root = await tempProject('sonar-stack-python-');
  try {
    await fs.writeFile(path.join(root, 'pyproject.toml'), '[project]\nname = "demo"\n');
    const actions = await detectProjectActions(root);
    assert.ok(actions.stack.ids.includes('python'));
    const recommended = actions.recommendedIntegrations.map(item => item.id);
    assert.ok(recommended.includes('ruff'));
    assert.ok(recommended.includes('bandit'));
    assert.ok(recommended.includes('semgrep'));
    assert.equal(recommended.includes('react-doctor'), false);
    assert.equal(recommended.includes('golangci-lint'), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('detecta Terraform y Docker y prioriza Checkov y Trivy', async () => {
  const root = await tempProject('sonar-stack-infra-');
  try {
    await fs.writeFile(path.join(root, 'main.tf'), 'terraform {}\n');
    await fs.writeFile(path.join(root, 'Dockerfile'), 'FROM alpine:3.20\n');
    const actions = await detectProjectActions(root);
    assert.ok(actions.stack.ids.includes('terraform'));
    assert.ok(actions.stack.ids.includes('docker'));
    const recommended = actions.recommendedIntegrations.map(item => item.id);
    assert.ok(recommended.includes('checkov'));
    assert.ok(recommended.includes('trivy'));
    assert.equal(recommended.includes('ruff'), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('detecta Java, .NET y Go mediante archivos raíz sin acoplarlos al core', async () => {
  const javaRoot = await tempProject('sonar-stack-java-');
  const dotnetRoot = await tempProject('sonar-stack-dotnet-');
  const goRoot = await tempProject('sonar-stack-go-');
  try {
    await fs.writeFile(path.join(javaRoot, 'pom.xml'), '<project/>');
    await fs.writeFile(path.join(dotnetRoot, 'Demo.csproj'), '<Project/>');
    await fs.writeFile(path.join(goRoot, 'go.mod'), 'module example.test/demo\n');

    const java = await detectProjectActions(javaRoot);
    const dotnet = await detectProjectActions(dotnetRoot);
    const go = await detectProjectActions(goRoot);

    assert.ok(java.stack.ids.includes('java'));
    assert.ok(java.stack.ids.includes('maven'));
    assert.ok(java.recommendedIntegrations.some(item => item.id === 'owasp-dependency-check'));
    assert.ok(dotnet.stack.ids.includes('dotnet'));
    assert.ok(dotnet.recommendedIntegrations.some(item => item.id === 'semgrep'));
    assert.ok(go.stack.ids.includes('go'));
    assert.ok(go.recommendedIntegrations.some(item => item.id === 'golangci-lint'));
  } finally {
    await Promise.all([
      fs.rm(javaRoot, { recursive: true, force: true }),
      fs.rm(dotnetRoot, { recursive: true, force: true }),
      fs.rm(goRoot, { recursive: true, force: true })
    ]);
  }
});
