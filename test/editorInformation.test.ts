import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';

test('la integración del editor incluye CodeLens para issues y Security Hotspots', async () => {
  const source = await fs.readFile(
    path.join(process.cwd(), 'src', 'issueDecorations.ts'),
    'utf8'
  );
  const extension = await fs.readFile(
    path.join(process.cwd(), 'src', 'extension.ts'),
    'utf8'
  );

  assert.match(source, /export class SonarIssueCodeLensProvider/);
  assert.match(source, /showIssueDetail/);
  assert.match(source, /showHotspotDetail/);
  assert.match(source, /severityCodicon/);
  assert.match(extension, /registerCodeLensProvider\(\{ scheme: 'file' \}, issueCodeLensProvider\)/);
});
