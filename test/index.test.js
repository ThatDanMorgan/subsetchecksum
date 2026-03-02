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

/**
 * @param {Record<string, unknown>} value
 * @returns {Record<string, unknown>}
 */
function sortObjectByKey(value) {
  const sorted = {};

  for (const key of Object.keys(value).sort()) {
    sorted[key] = value[key];
  }

  return sorted;
}

/**
 * @param {Record<string, unknown>} subset
 * @returns {string}
 */
function hashSubset(subset) {
  return hashObject(sortObjectByKey(subset));
}

test('returns null when object is null', () => {
  assert.equal(subsetChecksum(null, ['a']), null);
});

test('returns null for non-object inputs', () => {
  assert.equal(subsetChecksum(undefined, ['a']), null);
  assert.equal(subsetChecksum(1, ['a']), null);
  assert.equal(subsetChecksum('x', ['a']), null);
  assert.equal(subsetChecksum(true, ['a']), null);
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

  assert.equal(actual, hashSubset(expectedSubset));
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

test('supports long nested keys', () => {
  const segments = [
    'l01',
    'l02',
    'l03',
    'l04',
    'l05',
    'l06',
    'l07',
    'l08',
    'l09',
    'l10',
    'l11',
    'l12',
    'l13',
    'l14',
    'l15',
  ];
  const path = segments.join('.');
  const input = {};
  let cursor = input;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index];
    cursor[key] = {};
    cursor = cursor[key];
  }

  cursor[segments[segments.length - 1]] = 'deep-value';
  const actual = subsetChecksum(input, [path]);
  const expected = hashSubset({
    [path]: 'deep-value',
  });

  assert.equal(actual, expected);
});

test('supports keys with unusual characters', () => {
  const input = {
    weird: {
      'space key': {
        'hyphen-key': {
          'slash/key': {
            'colon:key': {
              unicode_ß: 'ok',
            },
          },
        },
      },
    },
    '#root': {
      '$dollar': 42,
    },
  };

  const keyA = 'weird.space key.hyphen-key.slash/key.colon:key.unicode_ß';
  const keyB = '#root.$dollar';
  const actual = subsetChecksum(input, [keyA, keyB]);
  const expected = hashSubset({
    [keyA]: 'ok',
    [keyB]: 42,
  });

  assert.equal(actual, expected);
});

test('treats missing and undefined values as null', () => {
  const input = {
    present: undefined,
  };
  const actual = subsetChecksum(input, ['missing.path', 'present']);
  const expected = hashSubset({
    'missing.path': null,
    present: null,
  });

  assert.equal(actual, expected);
});

test('returns null for path traversal when intermediate value is null', () => {
  const input = {
    a: null,
  };
  const actual = subsetChecksum(input, ['a.b.c']);
  const expected = hashSubset({
    'a.b.c': null,
  });

  assert.equal(actual, expected);
});

test('stringifies object values and uses null when JSON.stringify fails', () => {
  const originalConsoleError = console.error;
  let logged = false;
  const circular = { label: 'x' };
  circular.self = circular;

  const input = {
    obj: {
      hello: 'world',
    },
    circular,
  };

  let actual;
  try {
    console.error = () => {
      logged = true;
    };
    actual = subsetChecksum(input, ['obj', 'circular']);
  } finally {
    console.error = originalConsoleError;
  }

  const expectedSubset = {
    circular: null,
    obj: '{"hello":"world"}',
  };

  assert.equal(actual, hashSubset(expectedSubset));
  assert.equal(logged, true);
});

test('does not change checksum when duplicate keys are provided', () => {
  const input = {
    a: 1,
    b: 2,
  };

  const withDuplicates = subsetChecksum(input, ['a', 'a', 'b', 'b']);
  const unique = subsetChecksum(input, ['a', 'b']);

  assert.equal(withDuplicates, unique);
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

test('produces same checksum for different input objects with same selected subset', () => {
  const firstInput = {
    account: {
      id: 123,
      status: 'active',
    },
    ignored: {
      timestamp: '2020-01-01',
    },
  };

  const secondInput = {
    account: {
      id: 123,
      status: 'active',
      extra: 'ignore-me',
    },
    ignored: {
      timestamp: '2026-03-02',
    },
  };

  const keys = ['account.id', 'account.status'];
  const first = subsetChecksum(firstInput, keys);
  const second = subsetChecksum(secondInput, keys);

  assert.equal(first, second);
});

test('produces same checksum for semantically equal object values with different key insertion order', () => {
  const firstInput = {
    payload: {
      a: 1,
      b: 2,
      c: 3,
    },
  };
  const secondInput = {
    payload: {
      c: 3,
      a: 1,
      b: 2,
    },
  };

  const first = subsetChecksum(firstInput, ['payload']);
  const second = subsetChecksum(secondInput, ['payload']);

  assert.equal(first, second);
});

test('handles Date values deterministically for equal instants', () => {
  const first = {
    createdAt: new Date('2026-03-02T12:00:00.000Z'),
  };
  const second = {
    createdAt: new Date('2026-03-02T06:00:00.000-06:00'),
  };

  const firstChecksum = subsetChecksum(first, ['createdAt']);
  const secondChecksum = subsetChecksum(second, ['createdAt']);

  assert.equal(firstChecksum, secondChecksum);
});

test('keeps checksum stable for empty keys even when source key insertion order differs', () => {
  const first = {
    x: 1,
    y: {
      z: 'value',
    },
  };
  const second = {
    y: {
      z: 'value',
    },
    x: 1,
  };

  const firstChecksum = subsetChecksum(first, []);
  const secondChecksum = subsetChecksum(second, []);

  assert.equal(firstChecksum, secondChecksum);
});

test('reflects content differences when selected arrays differ', () => {
  const first = {
    arr: [1, 2, 3],
  };
  const second = {
    arr: [3, 2, 1],
  };

  const firstChecksum = subsetChecksum(first, ['arr']);
  const secondChecksum = subsetChecksum(second, ['arr']);

  assert.notEqual(firstChecksum, secondChecksum);
});

test('auto-generated keys can include Date and plain object leaves', () => {
  const date = new Date('2026-03-02T00:00:00.000Z');
  const input = {
    meta: {
      createdAt: date,
      payload: {
        x: 1,
      },
    },
    emptyObj: {},
  };

  const fromEmpty = subsetChecksum(input, []);
  const fromExplicit = subsetChecksum(input, ['meta.createdAt', 'meta.payload.x', 'emptyObj']);

  assert.equal(fromEmpty, fromExplicit);
});

test('supports key mapping object to rename source fields in checksum payload', () => {
  const input = {
    fullname: 'Jack Smith',
    emailaddress: 'foo@bar.com',
  };
  const mapping = {
    formalname: 'name',
    fullname: 'name',
    emailaddress: 'email',
  };

  const actual = subsetChecksum(input, mapping);
  const expected = hashSubset({
    email: 'foo@bar.com',
    name: 'Jack Smith',
  });

  assert.equal(actual, expected);
});

test('supports mapping object with deep source paths and custom output keys', () => {
  const input = {
    profile: {
      user: {
        name: 'Jack Smith',
      },
      contacts: {
        primary: {
          email: 'foo@bar.com',
        },
      },
    },
  };
  const mapping = {
    'profile.user.name': 'name',
    'profile.contacts.primary.email': 'email',
  };

  const actual = subsetChecksum(input, mapping);
  const expected = hashSubset({
    email: 'foo@bar.com',
    name: 'Jack Smith',
  });

  assert.equal(actual, expected);
});

test('mapping object preserves insertion-order precedence when multiple sources target one key', () => {
  const input = {
    formalname: 'Jonathan Smith',
    fullname: 'Jack Smith',
  };
  const mapping = {
    fullname: 'name',
    formalname: 'name',
  };

  const actual = subsetChecksum(input, mapping);
  const expected = hashSubset({
    name: 'Jonathan Smith',
  });

  assert.equal(actual, expected);
});

test('mapping object skips missing source paths but includes explicit undefined as null', () => {
  const input = {
    presentUndefined: undefined,
    existing: 'yes',
  };
  const mapping = {
    missing: 'missingRenamed',
    presentUndefined: 'definedButUndefined',
    existing: 'existingRenamed',
  };

  const actual = subsetChecksum(input, mapping);
  const expected = hashSubset({
    definedButUndefined: null,
    existingRenamed: 'yes',
  });

  assert.equal(actual, expected);
});

test('supports unusual characters in both source and destination mapping keys', () => {
  const input = {
    weird: {
      'source/key': {
        'with space': 7,
      },
    },
  };
  const mapping = {
    'weird.source/key.with space': 'output:key/with space',
  };

  const actual = subsetChecksum(input, mapping);
  const expected = hashSubset({
    'output:key/with space': 7,
  });

  assert.equal(actual, expected);
});

test('empty mapping object falls back to auto-generated key paths', () => {
  const input = {
    a: {
      b: 1,
    },
    c: 'value',
  };

  const fromEmptyMapping = subsetChecksum(input, {});
  const fromAutoArray = subsetChecksum(input, []);

  assert.equal(fromEmptyMapping, fromAutoArray);
});
