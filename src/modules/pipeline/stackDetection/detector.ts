import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { IntegrationDetectionContext } from '../integrations/contracts';
import { exists, fileContains, firstExisting } from '../integrations/helpers';
import type { ProjectStackSnapshot, ProjectStackTechnology } from './contracts';

interface StackSignal {
  id: string;
  displayName: string;
  category: ProjectStackTechnology['category'];
  evidences: string[];
}

export async function detectProjectStack(
  context: IntegrationDetectionContext
): Promise<ProjectStackSnapshot> {
  const detected = new Map<string, StackSignal>();
  const rootFiles = await listRootFiles(context.rootPath);

  if (context.node) {
    add(detected, 'node', 'Node.js', 'runtime', 'package.json');
    add(detected, 'javascript', 'JavaScript', 'language', 'package.json');
    detectNodeTechnologies(context, detected);
    const tsconfig = [...rootFiles].find(file => /^tsconfig(?:\..+)?\.json$/i.test(file));
    if (tsconfig) add(detected, 'typescript', 'TypeScript', 'language', tsconfig);
  }

  await detectPython(context.rootPath, rootFiles, detected);
  await detectJava(context.rootPath, rootFiles, detected);
  detectDotnet(rootFiles, detected);
  detectGo(rootFiles, detected);
  detectTerraform(rootFiles, detected);
  detectDocker(rootFiles, detected);

  const technologies = [...detected.values()]
    .map(item => ({ ...item, evidences: [...new Set(item.evidences)].sort((a, b) => a.localeCompare(b)) }))
    .sort((left, right) => left.category.localeCompare(right.category) || left.displayName.localeCompare(right.displayName));

  return {
    technologies,
    ids: technologies.map(item => item.id)
  };
}

function detectNodeTechnologies(
  context: IntegrationDetectionContext,
  detected: Map<string, StackSignal>
): void {
  const packageJson = context.node?.packageJson;
  if (!packageJson) return;
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
  const scripts = packageJson.scripts ?? {};

  if (dependencies.typescript || dependencies['@types/node']) {
    add(detected, 'typescript', 'TypeScript', 'language', dependencyEvidence(packageJson, 'typescript') ?? 'package.json');
  }
  if (dependencies.react || dependencies['react-dom'] || dependencies.next || dependencies['@remix-run/react']) {
    add(detected, 'react', 'React', 'framework', dependencyEvidence(packageJson, 'react') ?? 'package.json');
  }
  if (dependencies.vitest || Object.values(scripts).some(command => /(?:^|\s)vitest(?:\s|$)/i.test(command))) {
    add(detected, 'vitest', 'Vitest', 'tests', dependencyEvidence(packageJson, 'vitest') ?? 'package.json#scripts');
  }
  if (dependencies.jest || Object.values(scripts).some(command => /(?:^|\s)jest(?:\s|$)/i.test(command))) {
    add(detected, 'jest', 'Jest', 'tests', dependencyEvidence(packageJson, 'jest') ?? 'package.json#scripts');
  }
}

async function detectPython(
  rootPath: string,
  rootFiles: Set<string>,
  detected: Map<string, StackSignal>
): Promise<void> {
  const evidence = await firstExisting(rootPath, [
    'pyproject.toml', 'requirements.txt', 'requirements-dev.txt', 'setup.py', 'setup.cfg', 'Pipfile'
  ]);
  if (evidence || hasExtension(rootFiles, '.py')) {
    add(detected, 'python', 'Python', 'language', evidence ?? 'archivo *.py');
  }

  const pytestConfig = await firstExisting(rootPath, ['pytest.ini', 'tox.ini']);
  const pyprojectHasPytest = await fileContains(path.join(rootPath, 'pyproject.toml'), /\[(?:tool\.)?pytest(?:\.|\])/i);
  const requirementsHasPytest = await requirementsContain(rootPath, ['requirements.txt', 'requirements-dev.txt'], 'pytest');
  if (pytestConfig || pyprojectHasPytest || requirementsHasPytest) {
    add(detected, 'pytest', 'pytest', 'tests', pytestConfig ?? (pyprojectHasPytest ? 'pyproject.toml' : requirementsHasPytest!));
  }
}

async function detectJava(
  rootPath: string,
  rootFiles: Set<string>,
  detected: Map<string, StackSignal>
): Promise<void> {
  if (rootFiles.has('pom.xml')) {
    add(detected, 'java', 'Java', 'language', 'pom.xml');
    add(detected, 'maven', 'Maven', 'build', 'pom.xml');
    return;
  }
  const gradle = ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts']
    .find(file => rootFiles.has(file));
  if (gradle) {
    add(detected, 'java', 'Java', 'language', gradle);
    add(detected, 'gradle', 'Gradle', 'build', gradle);
    return;
  }
  if (hasExtension(rootFiles, '.java')) add(detected, 'java', 'Java', 'language', 'archivo *.java');
}

function detectDotnet(rootFiles: Set<string>, detected: Map<string, StackSignal>): void {
  const evidence = [...rootFiles].find(file => /\.(?:sln|slnx|csproj|vbproj|fsproj)$/i.test(file));
  if (!evidence) return;
  add(detected, 'dotnet', '.NET', 'runtime', evidence);
  if (/\.csproj$/i.test(evidence) || [...rootFiles].some(file => /\.cs$/i.test(file))) {
    add(detected, 'csharp', 'C#', 'language', evidence);
  }
}

function detectGo(rootFiles: Set<string>, detected: Map<string, StackSignal>): void {
  if (rootFiles.has('go.mod') || hasExtension(rootFiles, '.go')) {
    add(detected, 'go', 'Go', 'language', rootFiles.has('go.mod') ? 'go.mod' : 'archivo *.go');
  }
}

function detectTerraform(rootFiles: Set<string>, detected: Map<string, StackSignal>): void {
  const evidence = [...rootFiles].find(file => file.endsWith('.tf')) ??
    (rootFiles.has('.terraform.lock.hcl') ? '.terraform.lock.hcl' : undefined);
  if (evidence) add(detected, 'terraform', 'Terraform', 'infrastructure', evidence);
}

function detectDocker(rootFiles: Set<string>, detected: Map<string, StackSignal>): void {
  const evidence = [...rootFiles].find(file => /^Dockerfile(?:\..+)?$/i.test(file)) ??
    ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'].find(file => rootFiles.has(file));
  if (evidence) add(detected, 'docker', 'Docker', 'container', evidence);
}

async function listRootFiles(rootPath: string): Promise<Set<string>> {
  try {
    const entries = await fs.readdir(rootPath, { withFileTypes: true });
    return new Set(entries.filter(entry => entry.isFile()).map(entry => entry.name));
  } catch {
    return new Set();
  }
}

function hasExtension(files: Set<string>, extension: string): boolean {
  return [...files].some(file => path.extname(file).toLowerCase() === extension);
}

function add(
  detected: Map<string, StackSignal>,
  id: string,
  displayName: string,
  category: ProjectStackTechnology['category'],
  evidence: string
): void {
  const current = detected.get(id);
  if (current) {
    current.evidences.push(evidence);
    return;
  }
  detected.set(id, { id, displayName, category, evidences: [evidence] });
}

function dependencyEvidence(
  packageJson: NonNullable<IntegrationDetectionContext['node']>['packageJson'],
  packageName: string
): string | undefined {
  if (packageJson.dependencies?.[packageName]) return `package.json#dependencies.${packageName}`;
  if (packageJson.devDependencies?.[packageName]) return `package.json#devDependencies.${packageName}`;
  return undefined;
}

async function requirementsContain(
  rootPath: string,
  files: readonly string[],
  packageName: string
): Promise<string | undefined> {
  for (const file of files) {
    if (!await exists(path.join(rootPath, file))) continue;
    if (await fileContains(path.join(rootPath, file), new RegExp(`^\\s*${packageName}(?:[<>=~!\\s]|$)`, 'im'))) {
      return file;
    }
  }
  return undefined;
}
