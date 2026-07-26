import { Dirent, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { ScannerMode } from './types';
import { DetectedScanner } from './types';

const IGNORED_DIRECTORIES = new Set([
  '.git', '.idea', '.scannerwork', '.sonarqube', '.vscode',
  'bin', 'build', 'coverage', 'dist', 'node_modules', 'obj', 'out', 'target'
]);

interface Discovery {
  files: string[];
  byName: Map<string, string[]>;
}

export async function detectScanner(rootPath: string, mode: ScannerMode): Promise<DetectedScanner> {
  const discovery = await discoverFiles(rootPath, 3);

  if (mode !== 'auto') {
    return await forcedScanner(rootPath, mode, discovery);
  }

  const dotnetTarget = firstByExtensions(discovery.files, ['.sln', '.slnx'])
    ?? firstByExtensions(discovery.files, ['.csproj', '.vbproj', '.fsproj']);
  if (dotnetTarget) {
    return {
      kind: 'dotnet',
      label: 'SonarScanner for .NET',
      rootPath,
      evidence: relative(rootPath, dotnetTarget),
      buildTarget: dotnetTarget
    };
  }

  const pom = firstNamed(discovery, 'pom.xml');
  if (pom) {
    return {
      kind: 'maven',
      label: 'SonarScanner for Maven',
      rootPath: path.dirname(pom),
      evidence: relative(rootPath, pom)
    };
  }

  const gradle = firstNamed(discovery, 'build.gradle')
    ?? firstNamed(discovery, 'build.gradle.kts')
    ?? firstNamed(discovery, 'settings.gradle')
    ?? firstNamed(discovery, 'settings.gradle.kts');
  if (gradle) {
    return {
      kind: 'gradle',
      label: 'SonarScanner for Gradle',
      rootPath: path.dirname(gradle),
      evidence: relative(rootPath, gradle),
      gradleSonarConfigured: await hasGradleSonarPlugin(path.dirname(gradle), discovery)
    };
  }

  const packageJson = firstNamed(discovery, 'package.json');
  const sonarProperties = firstNamed(discovery, 'sonar-project.properties');
  if (!packageJson) {
    return {
      kind: 'docker',
      label: 'SonarScanner CLI en Docker',
      rootPath,
      evidence: sonarProperties
        ? `${relative(rootPath, sonarProperties)} sin package.json`
        : 'proyecto genérico sin package.json'
    };
  }

  return {
    kind: 'npm',
    label: 'SonarScanner genérico (NPM)',
    rootPath,
    evidence: relative(rootPath, packageJson)
  };
}

async function discoverFiles(rootPath: string, maxDepth: number): Promise<Discovery> {
  const files: string[] = [];
  const byName = new Map<string, string[]>();

  const visit = async (directory: string, depth: number): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (depth < maxDepth && !IGNORED_DIRECTORIES.has(entry.name)) {
          await visit(fullPath, depth + 1);
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      files.push(fullPath);
      const list = byName.get(entry.name.toLowerCase()) ?? [];
      list.push(fullPath);
      byName.set(entry.name.toLowerCase(), list);
    }
  };

  await visit(rootPath, 0);
  files.sort((left, right) => depth(left) - depth(right) || left.localeCompare(right));
  for (const values of byName.values()) {
    values.sort((left, right) => depth(left) - depth(right) || left.localeCompare(right));
  }
  return { files, byName };
}

async function forcedScanner(rootPath: string, mode: Exclude<ScannerMode, 'auto'>, discovery: Discovery): Promise<DetectedScanner> {
  switch (mode) {
    case 'dotnet': {
      const target = firstByExtensions(discovery.files, ['.sln', '.slnx', '.csproj', '.vbproj', '.fsproj']);
      return {
        kind: mode,
        label: 'SonarScanner for .NET',
        rootPath,
        evidence: target ? relative(rootPath, target) : 'selección manual',
        buildTarget: target
      };
    }
    case 'maven': {
      const pom = firstNamed(discovery, 'pom.xml');
      return {
        kind: mode,
        label: 'SonarScanner for Maven',
        rootPath: pom ? path.dirname(pom) : rootPath,
        evidence: pom ? relative(rootPath, pom) : 'selección manual'
      };
    }
    case 'gradle': {
      const gradle = firstNamed(discovery, 'build.gradle') ?? firstNamed(discovery, 'build.gradle.kts');
      return {
        kind: mode,
        label: 'SonarScanner for Gradle',
        rootPath: gradle ? path.dirname(gradle) : rootPath,
        evidence: gradle ? relative(rootPath, gradle) : 'selección manual',
        gradleSonarConfigured: gradle ? await hasGradleSonarPlugin(path.dirname(gradle), discovery) : false
      };
    }
    case 'docker':
      return { kind: mode, label: 'SonarScanner CLI en Docker', rootPath, evidence: 'selección manual' };
    case 'custom':
      return { kind: mode, label: 'Comando personalizado', rootPath, evidence: 'selección manual' };
    default:
      return { kind: 'npm', label: 'SonarScanner genérico (NPM)', rootPath, evidence: 'selección manual' };
  }
}

async function hasGradleSonarPlugin(rootPath: string, discovery: Discovery): Promise<boolean> {
  const candidates = [
    ...(discovery.byName.get('build.gradle') ?? []),
    ...(discovery.byName.get('build.gradle.kts') ?? []),
    ...(discovery.byName.get('settings.gradle') ?? []),
    ...(discovery.byName.get('settings.gradle.kts') ?? [])
  ].filter(file => file.startsWith(rootPath));

  for (const file of candidates) {
    try {
      const content = await fs.readFile(file, 'utf8');
      if (/org\.sonarqube|sonarqube-gradle-plugin|\bsonar\s*\{/i.test(content)) {
        return true;
      }
    } catch {
      // Se probará la estrategia genérica si el archivo no puede leerse.
    }
  }
  return false;
}

function firstNamed(discovery: Discovery, name: string): string | undefined {
  return discovery.byName.get(name.toLowerCase())?.[0];
}

function firstByExtensions(files: string[], extensions: string[]): string | undefined {
  return files.find(file => extensions.includes(path.extname(file).toLowerCase()));
}

function relative(rootPath: string, file: string): string {
  return path.relative(rootPath, file) || path.basename(file);
}

function depth(value: string): number {
  return value.split(path.sep).length;
}
