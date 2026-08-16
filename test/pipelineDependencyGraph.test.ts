import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';

const MODULES_ROOT = path.resolve(process.cwd(), 'src', 'modules');
const PIPELINE_ROOT = path.join(MODULES_ROOT, 'pipeline');
const LIVE_REMEDIATION_ROOT = path.join(MODULES_ROOT, 'liveRemediation');

function typescriptFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && file.endsWith('.ts')) files.push(file);
    }
  };
  visit(root);
  return files;
}

function relativeImports(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const imports: string[] = [];
  const pattern = /(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(pattern)) {
    if (match[1].startsWith('.')) imports.push(match[1]);
  }
  return imports;
}

function resolveTypescriptImport(file: string, specifier: string): string | undefined {
  const target = path.resolve(path.dirname(file), specifier);
  return [target + '.ts', path.join(target, 'index.ts')].find(existsSync);
}

function belongsTo(file: string, root: string): boolean {
  const relative = path.relative(root, file);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

test('Pipeline no contiene ciclos de imports relativos', () => {
  const files = typescriptFiles(PIPELINE_ROOT);
  const graph = new Map(files.map(file => [
    file,
    relativeImports(file)
      .map(specifier => resolveTypescriptImport(file, specifier))
      .filter((target): target is string => Boolean(target))
      .filter(target => belongsTo(target, PIPELINE_ROOT))
  ]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles: string[][] = [];

  const visit = (file: string, stack: string[]): void => {
    if (visiting.has(file)) {
      const start = stack.indexOf(file);
      cycles.push([...stack.slice(start), file].map(item =>
        path.relative(PIPELINE_ROOT, item).replaceAll('\\', '/')
      ));
      return;
    }
    if (visited.has(file)) return;
    visiting.add(file);
    stack.push(file);
    for (const target of graph.get(file) ?? []) visit(target, stack);
    stack.pop();
    visiting.delete(file);
    visited.add(file);
  };

  for (const file of files) visit(file, []);
  assert.deepEqual(cycles, []);
});

test('Pipeline y Live Remediation no se importan directamente', () => {
  const crossImports: string[] = [];
  for (const root of [PIPELINE_ROOT, LIVE_REMEDIATION_ROOT]) {
    const otherRoot = root === PIPELINE_ROOT ? LIVE_REMEDIATION_ROOT : PIPELINE_ROOT;
    for (const file of typescriptFiles(root)) {
      for (const specifier of relativeImports(file)) {
        const target = resolveTypescriptImport(file, specifier);
        if (target && belongsTo(target, otherRoot)) {
          crossImports.push(
            `${path.relative(MODULES_ROOT, file)} -> ${path.relative(MODULES_ROOT, target)}`
          );
        }
      }
    }
  }
  assert.deepEqual(crossImports, []);
});
