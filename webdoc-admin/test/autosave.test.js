import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTOSAVE_INTERVALS,
  AUTOSAVE_STORAGE_KEY,
  getNextAutosaveInterval,
  readStoredAutosaveInterval,
  writeStoredAutosaveInterval,
} from '../src/lib/autosave.js';

test('AUTOSAVE_INTERVALS defines [30, -1, 5, 10, 20]', () => {
  assert.deepEqual(AUTOSAVE_INTERVALS, [30, -1, 5, 10, 20]);
});

test('getNextAutosaveInterval cycles strictly through 30 -> -1 -> 5 -> 10 -> 20 -> 30', () => {
  assert.equal(getNextAutosaveInterval(30), -1);
  assert.equal(getNextAutosaveInterval(-1), 5);
  assert.equal(getNextAutosaveInterval(5), 10);
  assert.equal(getNextAutosaveInterval(10), 20);
  assert.equal(getNextAutosaveInterval(20), 30);
  assert.equal(getNextAutosaveInterval(999), 30); // fallback to start
});

test('readStoredAutosaveInterval returns 30 by default', () => {
  assert.equal(readStoredAutosaveInterval(), 30);
});

test('readStoredAutosaveInterval and writeStoredAutosaveInterval round-trip via global localStorage mockup', () => {
  const storage = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
    },
  };

  assert.equal(readStoredAutosaveInterval(), 30);

  writeStoredAutosaveInterval(-1);
  assert.equal(readStoredAutosaveInterval(), -1);

  writeStoredAutosaveInterval(10);
  assert.equal(readStoredAutosaveInterval(), 10);

  // Invalid value falls back to 30
  storage.set(AUTOSAVE_STORAGE_KEY, 'invalid');
  assert.equal(readStoredAutosaveInterval(), 30);

  // Clean up
  delete globalThis.window;
});
