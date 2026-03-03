const crypto = require('node:crypto');

/**
 * Checks if a value is a non-null object.
 * @param {unknown} value
 * @returns {boolean}
 */
function isObject(value) {
  return typeof value === 'object' && value !== null;
}

/**
 * Checks if a value is a plain object.
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  if (!isObject(value) || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Resolves a nested value by dot-path and reports if path exists.
 * @param {Record<string, unknown>} source
 * @param {string} path
 * @returns {{ found: boolean, value: unknown }}
 */
function getPathResult(source, path) {
  if (!path) {
    return {
      found: true,
      value: source,
    };
  }

  const segments = path.split('.');
  let current = source;

  for (const segment of segments) {
    if (!isObject(current) || !(segment in current)) {
      return {
        found: false,
        value: undefined,
      };
    }

    current = current[segment];
  }

  return {
    found: true,
    value: current,
  };
}

/**
 * Generates leaf key paths from an object.
 * @param {Record<string, unknown>} source
 * @param {string} [prefix]
 * @returns {string[]}
 */
function generateKeyPaths(source, prefix = '') {
  if (!isObject(source) || Array.isArray(source)) {
    return prefix ? [prefix] : [];
  }

  const keys = Object.keys(source);
  if (keys.length === 0) {
    return prefix ? [prefix] : [];
  }

  const paths = [];

  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const value = source[key];

    if (isObject(value) && !Array.isArray(value) && Object.keys(value).length > 0) {
      paths.push(...generateKeyPaths(value, path));
      continue;
    }

    paths.push(path);
  }

  return paths;
}

/**
 * Converts an object/array tree into a JSON-stable structure by sorting object keys.
 * Throws on circular references to mirror JSON.stringify behavior.
 * @param {unknown} value
 * @param {unknown[]} [ancestors]
 * @returns {unknown}
 */
function toStableJsonValue(value, ancestors = []) {
  if (!isObject(value)) {
    return value;
  }

  if (typeof value.toJSON === 'function') {
    return toStableJsonValue(value.toJSON(), ancestors);
  }

  if (ancestors.includes(value)) {
    throw new TypeError('Converting circular structure to JSON');
  }

  const nextAncestors = [...ancestors, value];

  if (Array.isArray(value)) {
    return value.map((item) => toStableJsonValue(item, nextAncestors));
  }

  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = toStableJsonValue(value[key], nextAncestors);
  }

  return sorted;
}

/**
 * Stringifies a value with deterministic object key ordering.
 * @param {unknown} value
 * @returns {string}
 */
function stableStringify(value) {
  return JSON.stringify(toStableJsonValue(value));
}

/**
 * Converts a subset value into a hash-safe value.
 * @param {unknown} value
 * @param {string} key
 * @returns {unknown}
 */
function normalizeSubsetValue(value, key) {
  if (isObject(value)) {
    try {
      return stableStringify(value);
    } catch (error) {
      console.error(`[subsetchecksum] Unable to stringify object at key "${key}":`, error);
      return null;
    }
  }

  if (value === undefined) {
    return null;
  }

  return value;
}

/**
 * Returns a new object with lexicographically sorted keys.
 * @param {Record<string, unknown>} source
 * @returns {Record<string, unknown>}
 */
function sortObjectByKey(source) {
  const sorted = {};

  for (const key of Object.keys(source).sort()) {
    sorted[key] = source[key];
  }

  return sorted;
}

/**
 * Builds a subset using direct key paths.
 * @param {Record<string, unknown>} source
 * @param {string[]} selectedKeys
 * @returns {Record<string, unknown>}
 */
function buildSubsetFromArrayKeys(source, selectedKeys) {
  const subset = {};

  for (const key of selectedKeys) {
    const { value } = getPathResult(source, key);
    subset[key] = normalizeSubsetValue(value, key);
  }

  return subset;
}

/**
 * Builds a subset using source-to-target key mappings.
 * @param {Record<string, unknown>} source
 * @param {Record<string, string>} keyMap
 * @returns {Record<string, unknown>}
 */
function buildSubsetFromKeyMap(source, keyMap) {
  const subset = {};

  for (const sourceKey of Object.keys(keyMap)) {
    const targetKey = keyMap[sourceKey];
    const { found, value } = getPathResult(source, sourceKey);

    // In mapping mode, skip truly missing paths. This allows aliases to map
    // to the same destination key without missing values overwriting matches.
    if (!found) {
      continue;
    }

    subset[targetKey] = normalizeSubsetValue(value, sourceKey);
  }

  return subset;
}

/**
 * Creates a deterministic checksum for a subset of object paths.
 * @param {Record<string, unknown> | null} object - Source object.
 * @param {string[] | Record<string, string>} [keys] - Either an array of dot-path keys or a mapping of sourcePath to output key.
 * @returns {string|null}
 */
module.exports = function subsetChecksum(object, keys = []) {
  if (object === null) {
    return null;
  }

  if (!isObject(object)) {
    return null;
  }

  let subset;

  if (Array.isArray(keys)) {
    const selectedKeys = keys.length > 0 ? keys : generateKeyPaths(object);
    subset = buildSubsetFromArrayKeys(object, selectedKeys);
  } else if (isPlainObject(keys)) {
    const mappingKeys = Object.keys(keys);
    if (mappingKeys.length === 0) {
      subset = buildSubsetFromArrayKeys(object, generateKeyPaths(object));
    } else {
      subset = buildSubsetFromKeyMap(object, keys);
    }
  } else {
    subset = buildSubsetFromArrayKeys(object, generateKeyPaths(object));
  }

  const sortedSubset = sortObjectByKey(subset);
  const payload = JSON.stringify(sortedSubset);

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
};
