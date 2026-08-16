import * as vscode from 'vscode';
import { getRegisteredIntegrationWatchFiles } from './integrations';

const PROJECT_ACTION_BASE_WATCH_FILES = [
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'settings.gradle',
  'settings.gradle.kts',
  'Cargo.toml',
  'go.mod',
  'pyproject.toml',
  'pytest.ini',
  'setup.cfg',
  'requirements.txt',
  'requirements-dev.txt',
  'setup.py',
  'Pipfile',
  'tox.ini',
  'tsconfig.json',
  'tsconfig.*.json',
  '*.sln',
  '*.slnx',
  '*.csproj',
  '*.vbproj',
  '*.fsproj',
  '*.tf',
  '.terraform.lock.hcl',
  'Dockerfile',
  'Dockerfile.*',
  'docker-compose.yml',
  'docker-compose.yaml',
  'compose.yml',
  'compose.yaml'
] as const;

export const PROJECT_ACTION_WATCH_FILES = Object.freeze([
  ...new Set([...PROJECT_ACTION_BASE_WATCH_FILES, ...getRegisteredIntegrationWatchFiles()])
]);

export const PROJECT_ACTION_WATCH_PATTERN = `{${PROJECT_ACTION_WATCH_FILES.join(',')}}`;

/**
 * Watches only files that participate in Pipeline project/integration detection.
 * Provider-specific files are contributed by the integration registry, so adding
 * an integration does not require editing this watcher.
 */
export function watchProjectActionFiles(
  rootPath: string,
  onChange: () => void
): vscode.Disposable {
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(rootPath, PROJECT_ACTION_WATCH_PATTERN)
  );
  const subscriptions = [
    watcher.onDidCreate(onChange),
    watcher.onDidChange(onChange),
    watcher.onDidDelete(onChange)
  ];
  return vscode.Disposable.from(watcher, ...subscriptions);
}
