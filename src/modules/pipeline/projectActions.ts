import { Dirent, promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  createIntegrationDetectionContext,
  detectRegisteredIntegrations,
  getRegisteredIntegrationCatalog,
  getRecommendedIntegrationCatalog,
  packageScriptCommand,
  type DetectedProjectIntegration,
  type IntegrationDetectionContext,
  type NodePackageManager,
  type NodeProjectContext,
  type ProjectIntegrationCatalogItem
} from './integrations';
import {
  executableForWrapper,
  exists,
  firstExisting,
  firstScript
} from './integrations/helpers';
import { detectProjectStack, type ProjectStackSnapshot } from './stackDetection';

export interface DetectedProjectActions {
  buildCommand?: string;
  testCommand?: string;
  evidence?: string;
  packageManager?: NodePackageManager;
  integrations: DetectedProjectIntegration[];
  integrationCatalog: ProjectIntegrationCatalogItem[];
  recommendedIntegrations: ProjectIntegrationCatalogItem[];
  stack: ProjectStackSnapshot;
}

export async function detectProjectActions(rootPath: string): Promise<DetectedProjectActions> {
  const context = await createIntegrationDetectionContext(rootPath);
  const stack = await detectProjectStack(context);
  let detected: Omit<DetectedProjectActions, 'integrations' | 'integrationCatalog' | 'recommendedIntegrations' | 'stack'> = {};

  if (context.node) detected = detectNodeActions(context.node);
  if (!detected.buildCommand && !detected.testCommand) {
    detected = await detectNonNodeActions(rootPath);
  }

  return {
    ...detected,
    packageManager: context.node?.packageManager,
    integrations: await detectRegisteredIntegrations(context),
    integrationCatalog: getRegisteredIntegrationCatalog(context),
    recommendedIntegrations: getRecommendedIntegrationCatalog(context, stack.ids),
    stack
  };
}

/** Compatibility entry point retained for existing callers and tests. */
export async function detectPredefinedIntegrations(
  rootPath: string,
  providedContext?: IntegrationDetectionContext
): Promise<DetectedProjectIntegration[]> {
  const context = providedContext ?? await createIntegrationDetectionContext(rootPath);
  return detectRegisteredIntegrations(context);
}

async function detectNonNodeActions(
  rootPath: string
): Promise<Omit<DetectedProjectActions, 'integrations' | 'integrationCatalog' | 'recommendedIntegrations' | 'stack'>> {
  const detectors = [
    detectDotnetActions,
    detectMavenActions,
    detectGradleActions,
    detectCargoActions,
    detectGoActions,
    detectPythonActions
  ];
  for (const detector of detectors) {
    const detected = await detector(rootPath);
    if (detected) return detected;
  }
  return {};
}

async function detectDotnetActions(
  rootPath: string
): Promise<Omit<DetectedProjectActions, 'integrations' | 'integrationCatalog' | 'recommendedIntegrations' | 'stack'> | undefined> {
  const dotnetTarget = await firstMatchingFile(rootPath, [
    '.sln', '.slnx', '.csproj', '.vbproj', '.fsproj'
  ]);
  if (!dotnetTarget) return undefined;
  const target = quoteShellArgument(path.relative(rootPath, dotnetTarget));
  return {
    buildCommand: `dotnet build ${target} --no-incremental`,
    testCommand: `dotnet test ${target} --no-build`,
    evidence: path.basename(dotnetTarget)
  };
}

async function detectMavenActions(
  rootPath: string
): Promise<Omit<DetectedProjectActions, 'integrations' | 'integrationCatalog' | 'recommendedIntegrations' | 'stack'> | undefined> {
  if (!await exists(path.join(rootPath, 'pom.xml'))) return undefined;
  const executable = await executableForWrapper(
    rootPath,
    process.platform === 'win32' ? 'mvnw.cmd' : 'mvnw',
    process.platform === 'win32' ? 'mvn.cmd' : 'mvn'
  );
  return {
    buildCommand: `${executable} clean package -DskipTests`,
    testCommand: `${executable} test`,
    evidence: 'pom.xml'
  };
}

async function detectGradleActions(
  rootPath: string
): Promise<Omit<DetectedProjectActions, 'integrations' | 'integrationCatalog' | 'recommendedIntegrations' | 'stack'> | undefined> {
  const gradleFile = await firstExisting(rootPath, [
    'build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'
  ]);
  if (!gradleFile) return undefined;
  const executable = await executableForWrapper(
    rootPath,
    process.platform === 'win32' ? 'gradlew.bat' : 'gradlew',
    process.platform === 'win32' ? 'gradle.bat' : 'gradle'
  );
  return {
    buildCommand: `${executable} clean build -x test`,
    testCommand: `${executable} test`,
    evidence: gradleFile
  };
}

async function detectCargoActions(
  rootPath: string
): Promise<Omit<DetectedProjectActions, 'integrations' | 'integrationCatalog' | 'recommendedIntegrations' | 'stack'> | undefined> {
  if (!await exists(path.join(rootPath, 'Cargo.toml'))) return undefined;
  return { buildCommand: 'cargo build', testCommand: 'cargo test', evidence: 'Cargo.toml' };
}

async function detectGoActions(
  rootPath: string
): Promise<Omit<DetectedProjectActions, 'integrations' | 'integrationCatalog' | 'recommendedIntegrations' | 'stack'> | undefined> {
  if (!await exists(path.join(rootPath, 'go.mod'))) return undefined;
  return { buildCommand: 'go build ./...', testCommand: 'go test ./...', evidence: 'go.mod' };
}

async function detectPythonActions(
  rootPath: string
): Promise<Omit<DetectedProjectActions, 'integrations' | 'integrationCatalog' | 'recommendedIntegrations' | 'stack'> | undefined> {
  const evidence = await firstExisting(rootPath, [
    'pyproject.toml', 'pytest.ini', 'setup.cfg', 'requirements.txt'
  ]);
  if (!evidence) return undefined;
  return {
    testCommand: process.platform === 'win32' ? 'py -m pytest' : 'python3 -m pytest',
    evidence
  };
}

function detectNodeActions(
  context: NodeProjectContext
): Omit<DetectedProjectActions, 'integrations' | 'integrationCatalog' | 'recommendedIntegrations' | 'stack'> {
  const scripts = context.packageJson.scripts ?? {};
  const buildScript = firstScript(scripts, ['build', 'compile', 'typecheck']);
  const testScript = firstUsableTestScript(scripts);
  return {
    buildCommand: buildScript ? packageScriptCommand(context.packageManager, buildScript) : undefined,
    testCommand: testScript ? packageScriptCommand(context.packageManager, testScript) : undefined,
    evidence: 'package.json'
  };
}

function firstUsableTestScript(scripts: Record<string, string>): string | undefined {
  for (const candidate of ['test', 'test:unit', 'test:ci']) {
    const command = scripts[candidate]?.trim();
    if (!command || /no test specified/i.test(command)) continue;
    return candidate;
  }
  return undefined;
}

async function firstMatchingFile(
  rootPath: string,
  extensions: string[]
): Promise<string | undefined> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true });
  } catch {
    return undefined;
  }
  return entries
    .filter(entry => entry.isFile())
    .map(entry => path.join(rootPath, entry.name))
    .find(file => extensions.includes(path.extname(file).toLowerCase()));
}

function quoteShellArgument(value: string): string {
  if (!/\s/.test(value)) return value;
  return '"' + value.replaceAll('"', String.raw`\"`) + '"';
}

export type {
  DetectedProjectIntegration,
  NodePackageManager,
  ProjectIntegrationCatalogItem,
  ProjectIntegrationCategory
} from './integrations';
export type { ProjectStackSnapshot, ProjectStackTechnology } from './stackDetection';
