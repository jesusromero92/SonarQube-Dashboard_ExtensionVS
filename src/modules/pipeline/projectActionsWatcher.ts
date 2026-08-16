import * as vscode from 'vscode';

const PROJECT_ACTION_WATCH_FILES = [
  'package.json',
  'package-lock.json',
  'npm-shrinkwrap.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yml',
  '.eslintrc.yaml',
  'doctor.config.ts',
  'biome.json',
  'biome.jsonc',
  'stylelint.config.js',
  'stylelint.config.mjs',
  'stylelint.config.cjs',
  '.stylelintrc',
  '.stylelintrc.json',
  '.stylelintrc.yml',
  '.stylelintrc.yaml',
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.yml',
  '.prettierrc.yaml',
  'prettier.config.js',
  'prettier.config.mjs',
  'prettier.config.cjs',
  '.semgrep.yml',
  '.semgrep.yaml',
  'semgrep.yml',
  'semgrep.yaml',
  '.snyk',
  'trivy.yaml',
  'trivy.yml',
  '.trivyignore',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'ruff.toml',
  '.ruff.toml',
  'pyproject.toml',
  'requirements.txt',
  'requirements-dev.txt',
  '.bandit',
  'bandit.yaml',
  'bandit.yml',
  '.checkov.yml',
  '.checkov.yaml',
  'checkov.yml',
  'checkov.yaml',
  '.golangci.yml',
  '.golangci.yaml',
  '.golangci.toml',
  '.golangci.json'
] as const;

export const PROJECT_ACTION_WATCH_PATTERN = `{${PROJECT_ACTION_WATCH_FILES.join(',')}}`;

/**
 * Watches only files that participate in Pipeline project/integration detection.
 * The base path is the configured analysis root, so package installs do not
 * produce events for package.json files created inside node_modules.
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
