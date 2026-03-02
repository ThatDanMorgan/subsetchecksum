# subsetchecksum

Build a deterministic SHA-256 checksum from a subset of object values.

## Behavior

- If `object` is `null`, returns `null`.
- If `keys` is empty (or not provided), key paths are auto-generated from object leaf paths.
- Nested fields are supported with dot-path notation like `profile.name.first`.
- If a selected value is an object, it is stored as a deterministic JSON string (recursively key-sorted before `JSON.stringify`).
- If `JSON.stringify` throws (for example circular references), that subset value is set to `null`.
- The generated subset object is sorted by key before hashing.

## Install

```bash
npm install
```

## Test

```bash
npm test
```

## Usage

```js
const subsetChecksum = require('./index');

const source = {
  id: 5,
  profile: {
    name: 'Dana',
  },
};

const checksum = subsetChecksum(source, ['profile.name', 'id']);
console.log(checksum);
```
