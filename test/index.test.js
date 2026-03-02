const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const subsetChecksum = require('../index');

/**
 * @param {Record<string, unknown>} value
 * @returns {string}
 */
function hashObject(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(value), 'utf8')
    .digest('hex');
}

test('returns null when object is null', () => {
  assert.equal(subsetChecksum(null, ['a']), null);
});

test('uses dot-path keys to build subset values and hashes sorted key object', () => {
  const input = {
    b: 2,
    a: {
      nested: 'value',
    },
  };

  const keys = ['b', 'a.nested'];
  const actual = subsetChecksum(input, keys);

  const expectedSubset = {
    'a.nested': 'value',
    b: 2,
  };

  assert.equal(actual, hashObject(expectedSubset));
});

test('auto-generates key list when keys are empty', () => {
  const input = {
    z: 'top',
    a: {
      b: {
        c: 5,
      },
    },
  };

  const fromEmpty = subsetChecksum(input, []);
  const fromExplicit = subsetChecksum(input, ['a.b.c', 'z']);

  assert.equal(fromEmpty, fromExplicit);
});

test('stringifies object values and uses null when JSON.stringify fails', () => {
  const circular = { label: 'x' };
  circular.self = circular;

  const input = {
    obj: {
      hello: 'world',
    },
    circular,
  };

  const actual = subsetChecksum(input, ['obj', 'circular']);
  const expectedSubset = {
    circular: null,
    obj: '{"hello":"world"}',
  };

  assert.equal(actual, hashObject(expectedSubset));
});

test('produces same checksum for same content even when key order differs', () => {
  const input = {
    b: 2,
    a: 1,
    c: 3,
  };

  const first = subsetChecksum(input, ['b', 'a', 'c']);
  const second = subsetChecksum(input, ['c', 'b', 'a']);

  assert.equal(first, second);
});
