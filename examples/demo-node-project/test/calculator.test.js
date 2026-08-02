const test = require('node:test');
const assert = require('node:assert/strict');
const { add, formatTotal } = require('../src/calculator');

test('adds two values', () => {
  assert.equal(add(2, 3), 5);
});

test('formats a total', () => {
  assert.equal(formatTotal('Total', 5), 'Total: 5 EUR');
});
