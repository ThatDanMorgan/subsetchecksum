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
 * Resolves a nested value by dot-path.
 * @param {Record<string, unknown>} source
 * @param {string} path
 * @returns {unknown}
 */
function getValueByPath(source, path) {
  if (!path) {
    return source;
  }

  const segments = path.split('.');
  let current = source;

  for (const segment of segments) {
    if (!isObject(current) || !(segment in current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
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
 * Creates a deterministic checksum for a subset of object paths.
 * @param {Record<string, unknown> | null} object - Source object.
 * @param {string[]} [keys] - Dot-path keys used to construct the subset.
 * @returns {string|null}
 */
module.exports = function subsetChecksum(object, keys = []) {
  if (object === null) {
    return null;
  }

  if (!isObject(object)) {
    return null;
  }

  const selectedKeys = Array.isArray(keys) && keys.length > 0 ? keys : generateKeyPaths(object);
  const subset = {};

  for (const key of selectedKeys) {
    const value = getValueByPath(object, key);
    subset[key] = normalizeSubsetValue(value, key);
  }

  const sortedSubset = sortObjectByKey(subset);
  const payload = JSON.stringify(sortedSubset);

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
};
