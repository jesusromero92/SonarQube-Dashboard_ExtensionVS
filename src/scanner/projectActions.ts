import { Dirent, promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface DetectedProjectActions {
  buildCommand?: string;
  testCommand?: string;
  evidence?: string;
}

interface PackageJsonShape {
  scripts?: Record<string, string>;
}

export async function detectProjectActions(
  rootPath: string
): Promise<DetectedProjectActions> {
  const packageJson = path.join(rootPath, 'package.json');
  if (await exists(packageJson)) {
    const detected = await detectNodeActions(rootPath, packageJson);
    if (detected.buildCommand || detected.testCommand) {
      return detected;
    }
  }

  const dotnetTarget = await firstMatchingFile(rootPath, [
    '.sln',
    '.slnx',
    '.csproj',
    '.vbproj',
    '.fsproj'
  ]);
  if (dotnetTarget) {
    const target = quoteShellArgument(path.relative(rootPath, dotnetTarget));
    return {
      buildCommand: `dotnet build ${target} --no-incremental`,
      testCommand: `dotnet test ${target} --no-build`,
      evidence: path.basename(dotnetTarget)
    };
  }

  if (await exists(path.join(rootPath, 'pom.xml'))) {
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

  const gradleFile = await firstExisting(rootPath, [
    'build.gradle',
    'build.gradle.kts',
    'settings.gradle',
    'settings.gradle.kts'
  ]);
  if (gradleFile) {
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

  if (await exists(path.join(rootPath, 'Cargo.toml'))) {
    return {
      buildCommand: 'cargo build',
      testCommand: 'cargo test',
      evidence: 'Cargo.toml'
    };
  }

  if (await exists(path.join(rootPath, 'go.mod'))) {
    return {
      buildCommand: 'go build ./...',
      testCommand: 'go test ./...',
      evidence: 'go.mod'
    };
  }

  const pythonEvidence = await firstExisting(rootPath, [
    'pyproject.toml',
    'pytest.ini',
    'setup.cfg',
    'requirements.txt'
  ]);
  if (pythonEvidence) {
    return {
      testCommand: process.platform === 'win32'
        ? 'py -m pytest'
        : 'python3 -m pytest',
      evidence: pythonEvidence
    };
  }

  return {};
}

async function detectNodeActions(
  rootPath: string,
  packageJsonPath: string
): Promise<DetectedProjectActions> {
  let packageJson: PackageJsonShape;
  try {
    packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as PackageJsonShape;
  } catch {
    return {};
  }

  const scripts = packageJson.scripts ?? {};
  const packageManager = await detectPackageManager(rootPath);
  const buildScript = firstScript(scripts, ['build', 'compile', 'typecheck']);
  const testScript = firstUsableTestScript(scripts);

  return {
    buildCommand: buildScript
      ? packageScriptCommand(packageManager, buildScript)
      : undefined,
    testCommand: testScript
      ? packageScriptCommand(packageManager, testScript)
      : undefined,
    evidence: 'package.json'
  };
}

async function detectPackageManager(rootPath: string): Promise<'npm' | 'pnpm' | 'yarn'> {
  if (await exists(path.join(rootPath, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (await exists(path.join(rootPath, 'yarn.lock'))) {
    return 'yarn';
  }
  return 'npm';
}

function packageScriptCommand(
  packageManager: 'npm' | 'pnpm' | 'yarn',
  script: string
): string {
  if (packageManager === 'npm') {
    return script === 'test' ? 'npm test' : `npm run ${script}`;
  }
  if (packageManager === 'pnpm') {
    return script === 'test' ? 'pnpm test' : `pnpm run ${script}`;
  }
  return `yarn ${script}`;
}

function firstScript(
  scripts: Record<string, string>,
  candidates: string[]
): string | undefined {
  return candidates.find(candidate => Boolean(scripts[candidate]?.trim()));
}

function firstUsableTestScript(
  scripts: Record<string, string>
): string | undefined {
  for (const candidate of ['test', 'test:unit', 'test:ci']) {
    const command = scripts[candidate]?.trim();
    if (!command) {
      continue;
    }
    if (/no test specified/i.test(command)) {
      continue;
    }
    return candidate;
  }
  return undefined;
}

async function executableForWrapper(
  rootPath: string,
  wrapperName: string,
  fallback: string
): Promise<string> {
  if (!(await exists(path.join(rootPath, wrapperName)))) {
    return fallback;
  }
  if (process.platform === 'win32') {
    return wrapperName;
  }
  return `./${wrapperName}`;
}

async function firstExisting(
  rootPath: string,
  candidates: string[]
): Promise<string | undefined> {
  for (const candidate of candidates) {
    if (await exists(path.join(rootPath, candidate))) {
      return candidate;
    }
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
  if (!/\s/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
