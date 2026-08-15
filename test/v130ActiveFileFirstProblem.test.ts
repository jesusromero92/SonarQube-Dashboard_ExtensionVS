import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';

const read = (relativePath: string): string => readFileSync(
  path.resolve(process.cwd(), relativePath),
  'utf8'
);

test('al entrar en un archivo se revela su primer diagnóstico de SonarQube', () => {
  const source = read('src/issueNavigation.ts');

  assert.match(source, /onDidChangeActiveTextEditor\(editor =>/);
  assert.match(source, /vscode\.languages\.getDiagnostics\(editor\.document\.uri\)/);
  assert.match(source, /diagnostic\.source === 'SonarQube Dashboard'/);
  assert.match(source, /sort\(compareDiagnosticPosition\)/);
  assert.match(source, /editor\.selection = new vscode\.Selection\(position, position\)/);
  assert.match(source, /editor\.revealRange\([\s\S]*TextEditorRevealType\.InCenterIfOutsideViewport/);
});

test('la navegación explícita a un issue no se sustituye por el primer defecto del archivo', () => {
  const source = read('src/issueNavigation.ts');

  assert.match(source, /private explicitNavigation = false/);
  assert.match(source, /this\.explicitNavigation = true;[\s\S]*showTextDocument[\s\S]*finally \{[\s\S]*this\.explicitNavigation = false/);
  assert.match(source, /if \(this\.explicitNavigation \|\| editor\.document\.uri\.scheme !== 'file'\)/);
});

test('README y changelog documentan el salto al primer problema del archivo activo', () => {
  assert.match(read('README.md'), /automatically reveals the first SonarQube issue/);
  assert.match(read('README.es.md'), /muestra automáticamente el primer defecto de SonarQube/);
  assert.match(read('CHANGELOG.md'), /automatically reveals the first SonarQube problem/);
});


test('al restaurar la ventana Problems recibe el archivo activo en una actualización separada', () => {
  const source = read('src/modules/liveRemediation/manager.ts') + read('src/modules/liveRemediation/constants.ts');
  const navigation = read('src/issueNavigation.ts');

  assert.match(source, /ACTIVE_PROBLEMS_REVEAL_DELAY_MS = 120/);
  assert.match(source, /getConfiguration\('problems'\)[\s\S]*get<boolean>\('autoReveal', true\)/);
  assert.match(source, /this\.activeProblemsRevealTimer = setTimeout\([\s\S]*this\.publishUri\(uri\)/);
  assert.match(source, /cancelActiveProblemsReveal/);
  assert.match(navigation, /vscode\.languages\.onDidChangeDiagnostics\(event =>/);
  assert.match(navigation, /event\.uris\.some\(uri => uri\.toString\(\) === activeUri\)/);
});
