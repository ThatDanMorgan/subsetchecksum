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
