# Session Notes - 2026-03-02

## Goal
Implement subset checksum utility with deterministic hashing, tests, and documentation.

## Requested Behavior
- Return `null` checksum when object input is `null`.
- Auto-generate keys when key list is empty.
- Support dot-path keys for nested object values.
- For each selected key, stringify object values with `JSON.stringify`; if stringify fails, store `null`.
- Sort resulting subset object keys before hashing.
- Produce deterministic checksum for equal content.

## Plan
- Add `node:test` coverage first.
- Implement utility in `index.js`.
- Update README and package scripts.

## Follow-up Expansion
- Expanded tests to cover long/deep keys, unusual key characters, duplicate keys, missing/undefined/null path handling, Date values, array differences, and cross-object determinism.
- Added deterministic object-value serialization so semantically equal object fields hash the same regardless of insertion order.
- Added support for key mapping objects (`sourcePath -> saveKey`) while keeping array mode intact.
- In mapping mode, missing source paths are skipped so alias mappings can target one output key safely.
