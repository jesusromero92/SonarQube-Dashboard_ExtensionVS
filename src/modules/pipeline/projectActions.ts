import { Dirent, promises as fs } from 'node:fs';
import * as path from 'node:path';

export type ProjectIntegrationCategory = 'quality' | 'security';

export interface DetectedProjectIntegration {
  id: string;
  name: string;
  description: string;
  command: string;
  evidence: string;
  category: ProjectIntegrationCategory;
  failurePolicy: 'stop' | 'continue';
}

export interface DetectedProjectActions {
  buildCommand?: string;
  testCommand?: string;
  evidence?: string;
  packageManager?: NodePackageManager;
  integrations: DetectedProjectIntegration[];
}

interface PackageJsonShape {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packageManager?: string;
}

export type NodePackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

interface NodeProjectContext {
  packageJson: PackageJsonShape;
  packageManager: NodePackageManager;
}

export async function detectProjectActions(
  rootPath: string
): Promise<DetectedProjectActions> {
  const packageJsonPath = path.join(rootPath, 'package.json');
  const nodeContext = await readNodeProject(rootPath, packageJsonPath);
  let detected: Omit<DetectedProjectActions, 'integrations'> = {};

  if (nodeContext) {
    detected = detectNodeActions(nodeContext);
  }

  if (!detected.buildCommand && !detected.testCommand) {
    detected = await detectNonNodeActions(rootPath);
  }

  return {
    ...detected,
    packageManager: nodeContext?.packageManager,
    integrations: await detectPredefinedIntegrations(rootPath, nodeContext)
  };
}

export async function detectPredefinedIntegrations(
  rootPath: string,
  providedNodeContext?: NodeProjectContext
): Promise<DetectedProjectIntegration[]> {
  const packageJsonPath = path.join(rootPath, 'package.json');
  const nodeContext = providedNodeContext ?? await readNodeProject(rootPath, packageJsonPath);
  const candidates = [
    await detectDependencyAuditIntegration(rootPath, nodeContext),
    await detectEslintIntegration(rootPath, nodeContext),
    await detectReactDoctorIntegration(rootPath, nodeContext),
    await detectBiomeIntegration(rootPath, nodeContext),
    await detectStylelintIntegration(rootPath, nodeContext),
    await detectPrettierIntegration(rootPath, nodeContext),
    await detectSemgrepIntegration(rootPath, nodeContext),
    await detectSnykIntegration(rootPath, nodeContext),
    await detectTrivyIntegration(rootPath, nodeContext),
    await detectMavenOwaspIntegration(rootPath),
    await detectGradleOwaspIntegration(rootPath),
    await detectRuffIntegration(rootPath),
    await detectBanditIntegration(rootPath),
    await detectCheckovIntegration(rootPath),
    await detectGolangciLintIntegration(rootPath)
  ];

  return uniqueIntegrations(
    candidates.filter((item): item is DetectedProjectIntegration => item !== undefined)
  );
}

async function detectDependencyAuditIntegration(
  rootPath: string,
  nodeContext: NodeProjectContext | undefined
): Promise<DetectedProjectIntegration | undefined> {
  if (!nodeContext) return undefined;
  const lockFile = await firstExisting(
    rootPath,
    packageManagerLockFiles(nodeContext.packageManager)
  );
  if (!lockFile) return undefined;

  return {
    id: 'dependency-audit',
    name: nodeContext.packageManager === 'npm'
      ? 'npm audit'
      : `${nodeContext.packageManager} audit`,
    description: 'Audita las dependencias conocidas del proyecto.',
    command: dependencyAuditCommand(nodeContext.packageManager),
    evidence: lockFile,
    category: 'security',
    failurePolicy: 'continue'
  };
}

function nodeDependencies(nodeContext: NodeProjectContext): Record<string, string> {
  return {
    ...nodeContext.packageJson.dependencies,
    ...nodeContext.packageJson.devDependencies
  };
}

async function detectEslintIntegration(
  rootPath: string,
  nodeContext: NodeProjectContext | undefined
): Promise<DetectedProjectIntegration | undefined> {
  if (!nodeContext) return undefined;
  const scripts = nodeContext.packageJson.scripts ?? {};
  const dependencies = nodeDependencies(nodeContext);
  const lintScript = firstScript(scripts, ['lint', 'lint:ci', 'eslint']);
  const eslintConfig = await firstExisting(rootPath, [
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs',
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.json',
    '.eslintrc.yml',
    '.eslintrc.yaml'
  ]);
  if (!lintScript && !dependencies.eslint && !eslintConfig) return undefined;

  return {
    id: 'eslint',
    name: 'ESLint',
    description: 'Ejecuta el análisis estático de JavaScript y TypeScript.',
    command: lintScript
      ? packageScriptCommand(nodeContext.packageManager, lintScript)
      : packageExecutableCommand(nodeContext.packageManager, 'eslint .'),
    evidence: lintScript ? `package.json#${lintScript}` : eslintConfig ?? 'package.json#eslint',
    category: 'quality',
    failurePolicy: 'stop'
  };
}

async function detectReactDoctorIntegration(
  rootPath: string,
  nodeContext: NodeProjectContext | undefined
): Promise<DetectedProjectIntegration | undefined> {
  if (!nodeContext) return undefined;
  const scripts = nodeContext.packageJson.scripts ?? {};
  const dependencies = nodeDependencies(nodeContext);
  const script = firstScriptContaining(scripts, /(?:^|\s|[/\\])react-doctor(?:@|\s|$)/i);
  const config = await firstExisting(rootPath, ['doctor.config.ts']);
  if (!script && !dependencies['react-doctor'] && !config) return undefined;

  return {
    id: 'react-doctor',
    name: 'React Doctor',
    description: 'Revisa proyectos React para detectar problemas de rendimiento, seguridad, corrección y arquitectura.',
    command: script
      ? packageScriptCommand(nodeContext.packageManager, script)
      : packageExecutableCommand(nodeContext.packageManager, 'react-doctor'),
    evidence: script ? `package.json#${script}` : config ?? 'package.json#react-doctor',
    category: 'quality',
    failurePolicy: 'continue'
  };
}

async function detectBiomeIntegration(
  rootPath: string,
  nodeContext: NodeProjectContext | undefined
): Promise<DetectedProjectIntegration | undefined> {
  if (!nodeContext) return undefined;
  const scripts = nodeContext.packageJson.scripts ?? {};
  const dependencies = nodeDependencies(nodeContext);
  const script = firstScriptContaining(scripts, /(?:^|\s)(?:biome|@biomejs\/biome)(?:\s|$)/i);
  const config = await firstExisting(rootPath, ['biome.json', 'biome.jsonc']);
  if (!script && !dependencies['@biomejs/biome'] && !config) return undefined;

  return {
    id: 'biome',
    name: 'Biome',
    description: 'Comprueba formato, lint y calidad de código JavaScript y TypeScript con Biome.',
    command: script
      ? packageScriptCommand(nodeContext.packageManager, script)
      : packageExecutableCommand(nodeContext.packageManager, 'biome check .'),
    evidence: script ? `package.json#${script}` : config ?? 'package.json#@biomejs/biome',
    category: 'quality',
    failurePolicy: 'stop'
  };
}

async function detectStylelintIntegration(
  rootPath: string,
  nodeContext: NodeProjectContext | undefined
): Promise<DetectedProjectIntegration | undefined> {
  if (!nodeContext) return undefined;
  const scripts = nodeContext.packageJson.scripts ?? {};
  const dependencies = nodeDependencies(nodeContext);
  const script = firstScriptContaining(scripts, /(?:^|\s)stylelint(?:\s|$)/i);
  const config = await firstExisting(rootPath, [
    'stylelint.config.js',
    'stylelint.config.mjs',
    'stylelint.config.cjs',
    '.stylelintrc',
    '.stylelintrc.json',
    '.stylelintrc.yml',
    '.stylelintrc.yaml'
  ]);
  if (!script && !dependencies.stylelint && !config) return undefined;

  return {
    id: 'stylelint',
    name: 'Stylelint',
    description: 'Analiza CSS y preprocesadores compatibles mediante reglas Stylelint.',
    command: script
      ? packageScriptCommand(nodeContext.packageManager, script)
      : packageExecutableCommand(nodeContext.packageManager, 'stylelint "**/*.{css,scss,sass,less}"'),
    evidence: script ? `package.json#${script}` : config ?? 'package.json#stylelint',
    category: 'quality',
    failurePolicy: 'stop'
  };
}

async function detectPrettierIntegration(
  rootPath: string,
  nodeContext: NodeProjectContext | undefined
): Promise<DetectedProjectIntegration | undefined> {
  if (!nodeContext) return undefined;
  const scripts = nodeContext.packageJson.scripts ?? {};
  const dependencies = nodeDependencies(nodeContext);
  const script = firstScriptContaining(scripts, /(?:^|\s)prettier(?:\s|$)/i);
  const config = await firstExisting(rootPath, [
    '.prettierrc',
    '.prettierrc.json',
    '.prettierrc.yml',
    '.prettierrc.yaml',
    'prettier.config.js',
    'prettier.config.mjs',
    'prettier.config.cjs'
  ]);
  if (!script && !dependencies.prettier && !config) return undefined;

  return {
    id: 'prettier',
    name: 'Prettier',
    description: 'Comprueba que el formato del proyecto cumple la configuración de Prettier.',
    command: script
      ? packageScriptCommand(nodeContext.packageManager, script)
      : packageExecutableCommand(nodeContext.packageManager, 'prettier --check .'),
    evidence: script ? `package.json#${script}` : config ?? 'package.json#prettier',
    category: 'quality',
    failurePolicy: 'stop'
  };
}

async function detectSemgrepIntegration(
  rootPath: string,
  nodeContext: NodeProjectContext | undefined
): Promise<DetectedProjectIntegration | undefined> {
  const semgrepConfig = await firstExisting(rootPath, [
    '.semgrep.yml',
    '.semgrep.yaml',
    'semgrep.yml',
    'semgrep.yaml'
  ]);
  if (!nodeContext) {
    return semgrepConfig ? semgrepConfigIntegration(semgrepConfig) : undefined;
  }

  const scripts = nodeContext.packageJson.scripts ?? {};
  const dependencies = nodeDependencies(nodeContext);
  const semgrepScript = firstScript(scripts, ['semgrep', 'security:semgrep', 'scan:semgrep']);
  if (!semgrepScript && !dependencies.semgrep && !semgrepConfig) return undefined;

  return {
    id: 'semgrep',
    name: 'Semgrep',
    description: 'Busca patrones de seguridad y calidad mediante reglas Semgrep.',
    command: semgrepScript
      ? packageScriptCommand(nodeContext.packageManager, semgrepScript)
      : 'semgrep scan --config auto .',
    evidence: semgrepScript ? `package.json#${semgrepScript}` : semgrepConfig ?? 'package.json#semgrep',
    category: 'security',
    failurePolicy: 'continue'
  };
}

function semgrepConfigIntegration(config: string): DetectedProjectIntegration {
  return {
    id: 'semgrep',
    name: 'Semgrep',
    description: 'Busca patrones de seguridad y calidad mediante reglas Semgrep.',
    command: 'semgrep scan --config auto .',
    evidence: config,
    category: 'security',
    failurePolicy: 'continue'
  };
}

async function detectSnykIntegration(
  rootPath: string,
  nodeContext: NodeProjectContext | undefined
): Promise<DetectedProjectIntegration | undefined> {
  if (!nodeContext) return undefined;
  const scripts = nodeContext.packageJson.scripts ?? {};
  const dependencies = nodeDependencies(nodeContext);
  const snykScript = firstScript(scripts, ['snyk', 'security:snyk', 'scan:snyk']);
  const snykConfig = await firstExisting(rootPath, ['.snyk']);
  if (!snykScript && !dependencies.snyk && !snykConfig) return undefined;

  return {
    id: 'snyk',
    name: 'Snyk',
    description: 'Comprueba vulnerabilidades de dependencias con Snyk.',
    command: snykScript
      ? packageScriptCommand(nodeContext.packageManager, snykScript)
      : packageExecutableCommand(nodeContext.packageManager, 'snyk test'),
    evidence: snykScript ? `package.json#${snykScript}` : snykConfig ?? 'package.json#snyk',
    category: 'security',
    failurePolicy: 'continue'
  };
}

async function detectTrivyIntegration(
  rootPath: string,
  nodeContext: NodeProjectContext | undefined
): Promise<DetectedProjectIntegration | undefined> {
  const trivyEvidence = await firstExisting(rootPath, [
    'trivy.yaml',
    'trivy.yml',
    '.trivyignore',
    'Dockerfile',
    'docker-compose.yml',
    'docker-compose.yaml'
  ]);
  const scripts = nodeContext?.packageJson.scripts ?? {};
  const trivyScript = firstScript(scripts, ['trivy', 'security:trivy', 'scan:trivy']);
  if (!trivyScript && !trivyEvidence) return undefined;

  return {
    id: 'trivy',
    name: 'Trivy',
    description: 'Escanea vulnerabilidades, secretos y configuraciones inseguras.',
    command: trivyScript && nodeContext
      ? packageScriptCommand(nodeContext.packageManager, trivyScript)
      : 'trivy fs --scanners vuln,secret,misconfig .',
    evidence: trivyScript ? `package.json#${trivyScript}` : trivyEvidence!,
    category: 'security',
    failurePolicy: 'continue'
  };
}

async function detectMavenOwaspIntegration(
  rootPath: string
): Promise<DetectedProjectIntegration | undefined> {
  const pomPath = path.join(rootPath, 'pom.xml');
  if (!await fileContains(pomPath, /dependency-check-maven|org\.owasp/i)) return undefined;
  const executable = await executableForWrapper(
    rootPath,
    process.platform === 'win32' ? 'mvnw.cmd' : 'mvnw',
    process.platform === 'win32' ? 'mvn.cmd' : 'mvn'
  );
  return {
    id: 'owasp-dependency-check',
    name: 'OWASP Dependency-Check',
    description: 'Analiza dependencias conocidas mediante OWASP Dependency-Check.',
    command: `${executable} org.owasp:dependency-check-maven:check`,
    evidence: 'pom.xml',
    category: 'security',
    failurePolicy: 'continue'
  };
}

async function detectGradleOwaspIntegration(
  rootPath: string
): Promise<DetectedProjectIntegration | undefined> {
  const gradleFile = await firstExisting(rootPath, ['build.gradle', 'build.gradle.kts']);
  if (!gradleFile) return undefined;
  const hasPlugin = await fileContains(
    path.join(rootPath, gradleFile),
    /org\.owasp\.dependencycheck|dependencyCheck/i
  );
  if (!hasPlugin) return undefined;

  const executable = await executableForWrapper(
    rootPath,
    process.platform === 'win32' ? 'gradlew.bat' : 'gradlew',
    process.platform === 'win32' ? 'gradle.bat' : 'gradle'
  );
  return {
    id: 'owasp-dependency-check',
    name: 'OWASP Dependency-Check',
    description: 'Analiza dependencias conocidas mediante OWASP Dependency-Check.',
    command: `${executable} dependencyCheckAnalyze`,
    evidence: gradleFile,
    category: 'security',
    failurePolicy: 'continue'
  };
}

async function detectRuffIntegration(
  rootPath: string
): Promise<DetectedProjectIntegration | undefined> {
  const config = await firstExisting(rootPath, ['ruff.toml', '.ruff.toml']);
  const pyproject = path.join(rootPath, 'pyproject.toml');
  const requirements = await firstExisting(rootPath, ['requirements.txt', 'requirements-dev.txt']);
  const configured = Boolean(config) ||
    await fileContains(pyproject, /\[tool\.ruff(?:\.|\])/i) ||
    Boolean(requirements && await fileContains(path.join(rootPath, requirements), /^\s*ruff(?:[<>=~!]|\s|$)/im));
  if (!configured) return undefined;

  return {
    id: 'ruff',
    name: 'Ruff',
    description: 'Ejecuta lint y comprobaciones rápidas de calidad para proyectos Python.',
    command: process.platform === 'win32' ? 'py -m ruff check .' : 'python3 -m ruff check .',
    evidence: config ?? (await fileContains(pyproject, /\[tool\.ruff(?:\.|\])/i) ? 'pyproject.toml' : requirements!),
    category: 'quality',
    failurePolicy: 'stop'
  };
}

async function detectBanditIntegration(
  rootPath: string
): Promise<DetectedProjectIntegration | undefined> {
  const config = await firstExisting(rootPath, ['.bandit', 'bandit.yaml', 'bandit.yml']);
  const pyproject = path.join(rootPath, 'pyproject.toml');
  const requirements = await firstExisting(rootPath, ['requirements.txt', 'requirements-dev.txt']);
  const configured = Boolean(config) ||
    await fileContains(pyproject, /\[tool\.bandit(?:\.|\])/i) ||
    Boolean(requirements && await fileContains(path.join(rootPath, requirements), /^\s*bandit(?:[<>=~!]|\s|$)/im));
  if (!configured) return undefined;

  return {
    id: 'bandit',
    name: 'Bandit',
    description: 'Busca problemas de seguridad habituales en código Python.',
    command: process.platform === 'win32' ? 'py -m bandit -r .' : 'python3 -m bandit -r .',
    evidence: config ?? (await fileContains(pyproject, /\[tool\.bandit(?:\.|\])/i) ? 'pyproject.toml' : requirements!),
    category: 'security',
    failurePolicy: 'continue'
  };
}

async function detectCheckovIntegration(
  rootPath: string
): Promise<DetectedProjectIntegration | undefined> {
  const config = await firstExisting(rootPath, ['.checkov.yml', '.checkov.yaml', 'checkov.yml', 'checkov.yaml']);
  const requirements = await firstExisting(rootPath, ['requirements.txt', 'requirements-dev.txt']);
  const configured = Boolean(config) ||
    Boolean(requirements && await fileContains(path.join(rootPath, requirements), /^\s*checkov(?:[<>=~!]|\s|$)/im));
  if (!configured) return undefined;

  return {
    id: 'checkov',
    name: 'Checkov',
    description: 'Analiza infraestructura como código y configuraciones cloud en busca de riesgos.',
    command: 'checkov -d .',
    evidence: config ?? requirements!,
    category: 'security',
    failurePolicy: 'continue'
  };
}

async function detectGolangciLintIntegration(
  rootPath: string
): Promise<DetectedProjectIntegration | undefined> {
  const config = await firstExisting(rootPath, [
    '.golangci.yml',
    '.golangci.yaml',
    '.golangci.toml',
    '.golangci.json'
  ]);
  if (!config) return undefined;

  return {
    id: 'golangci-lint',
    name: 'golangci-lint',
    description: 'Ejecuta una colección de linters sobre proyectos Go.',
    command: 'golangci-lint run',
    evidence: config,
    category: 'quality',
    failurePolicy: 'stop'
  };
}

async function detectNonNodeActions(
  rootPath: string
): Promise<Omit<DetectedProjectActions, 'integrations'>> {
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
): Promise<Omit<DetectedProjectActions, 'integrations'> | undefined> {
  const dotnetTarget = await firstMatchingFile(rootPath, [
    '.sln',
    '.slnx',
    '.csproj',
    '.vbproj',
    '.fsproj'
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
): Promise<Omit<DetectedProjectActions, 'integrations'> | undefined> {
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
): Promise<Omit<DetectedProjectActions, 'integrations'> | undefined> {
  const gradleFile = await firstExisting(rootPath, [
    'build.gradle',
    'build.gradle.kts',
    'settings.gradle',
    'settings.gradle.kts'
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
): Promise<Omit<DetectedProjectActions, 'integrations'> | undefined> {
  if (!await exists(path.join(rootPath, 'Cargo.toml'))) return undefined;
  return {
    buildCommand: 'cargo build',
    testCommand: 'cargo test',
    evidence: 'Cargo.toml'
  };
}

async function detectGoActions(
  rootPath: string
): Promise<Omit<DetectedProjectActions, 'integrations'> | undefined> {
  if (!await exists(path.join(rootPath, 'go.mod'))) return undefined;
  return {
    buildCommand: 'go build ./...',
    testCommand: 'go test ./...',
    evidence: 'go.mod'
  };
}

async function detectPythonActions(
  rootPath: string
): Promise<Omit<DetectedProjectActions, 'integrations'> | undefined> {
  const evidence = await firstExisting(rootPath, [
    'pyproject.toml',
    'pytest.ini',
    'setup.cfg',
    'requirements.txt'
  ]);
  if (!evidence) return undefined;
  return {
    testCommand: process.platform === 'win32' ? 'py -m pytest' : 'python3 -m pytest',
    evidence
  };
}

async function readNodeProject(
  rootPath: string,
  packageJsonPath: string
): Promise<NodeProjectContext | undefined> {
  if (!(await exists(packageJsonPath))) {
    return undefined;
  }
  try {
    const packageJson = JSON.parse(
      await fs.readFile(packageJsonPath, 'utf8')
    ) as PackageJsonShape;
    return {
      packageJson,
      packageManager: await detectNodePackageManager(rootPath, packageJson.packageManager)
    };
  } catch {
    return undefined;
  }
}

function detectNodeActions(
  context: NodeProjectContext
): Omit<DetectedProjectActions, 'integrations'> {
  const scripts = context.packageJson.scripts ?? {};
  const buildScript = firstScript(scripts, ['build', 'compile', 'typecheck']);
  const testScript = firstUsableTestScript(scripts);

  return {
    buildCommand: buildScript
      ? packageScriptCommand(context.packageManager, buildScript)
      : undefined,
    testCommand: testScript
      ? packageScriptCommand(context.packageManager, testScript)
      : undefined,
    evidence: 'package.json'
  };
}

async function detectNodePackageManager(
  rootPath: string,
  declaredPackageManager?: string
): Promise<NodePackageManager> {
  const declared = normalizeNodePackageManager(declaredPackageManager);
  if (declared) {
    return declared;
  }

  const lockfiles: Array<[string, NodePackageManager]> = [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm'],
    ['npm-shrinkwrap.json', 'npm']
  ];
  for (const [lockfile, packageManager] of lockfiles) {
    if (await exists(path.join(rootPath, lockfile))) {
      return packageManager;
    }
  }
  return 'npm';
}

function normalizeNodePackageManager(value: string | undefined): NodePackageManager | undefined {
  const name = value?.trim().toLowerCase().split('@', 1)[0];
  if (name === 'npm' || name === 'pnpm' || name === 'yarn' || name === 'bun') {
    return name;
  }
  return undefined;
}

function packageManagerLockFiles(packageManager: NodePackageManager): string[] {
  if (packageManager === 'npm') return ['package-lock.json', 'npm-shrinkwrap.json'];
  if (packageManager === 'pnpm') return ['pnpm-lock.yaml'];
  if (packageManager === 'yarn') return ['yarn.lock'];
  return ['bun.lock', 'bun.lockb'];
}

function dependencyAuditCommand(packageManager: NodePackageManager): string {
  if (packageManager === 'npm') return 'npm audit --audit-level=high';
  if (packageManager === 'pnpm') return 'pnpm audit --audit-level=high';
  if (packageManager === 'bun') return 'bun audit --audit-level=high';
  return 'yarn audit --level high';
}

function packageScriptCommand(
  packageManager: NodePackageManager,
  script: string
): string {
  if (packageManager === 'npm') {
    return script === 'test' ? 'npm test' : `npm run ${script}`;
  }
  if (packageManager === 'pnpm') {
    return script === 'test' ? 'pnpm test' : `pnpm run ${script}`;
  }
  if (packageManager === 'bun') {
    return `bun run ${script}`;
  }
  return `yarn ${script}`;
}

function packageExecutableCommand(
  packageManager: NodePackageManager,
  command: string
): string {
  if (packageManager === 'npm') {
    return `npm exec -- ${command}`;
  }
  if (packageManager === 'pnpm') {
    return `pnpm exec ${command}`;
  }
  if (packageManager === 'bun') {
    return `bunx ${command}`;
  }
  return `yarn ${command}`;
}

function firstScript(
  scripts: Record<string, string>,
  candidates: string[]
): string | undefined {
  return candidates.find(candidate => Boolean(scripts[candidate]?.trim()));
}

function firstScriptContaining(
  scripts: Record<string, string>,
  pattern: RegExp
): string | undefined {
  return Object.entries(scripts).find(([, command]) => pattern.test(command))?.[0];
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

async function fileContains(file: string, pattern: RegExp): Promise<boolean> {
  try {
    return pattern.test(await fs.readFile(file, 'utf8'));
  } catch {
    return false;
  }
}

function uniqueIntegrations(
  integrations: DetectedProjectIntegration[]
): DetectedProjectIntegration[] {
  const byId = new Map<string, DetectedProjectIntegration>();
  for (const integration of integrations) {
    if (!byId.has(integration.id)) {
      byId.set(integration.id, integration);
    }
  }
  return [...byId.values()].sort((left, right) =>
    left.category.localeCompare(right.category) || left.name.localeCompare(right.name)
  );
}

function quoteShellArgument(value: string): string {
  if (!/\s/.test(value)) {
    return value;
  }
  return '"' + value.replaceAll('"', String.raw`\"`) + '"';
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
