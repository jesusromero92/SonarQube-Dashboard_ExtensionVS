const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src');
const output = path.join(root, 'dist');
fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(source, output, { recursive: true });
console.log('Demo build completed.');
