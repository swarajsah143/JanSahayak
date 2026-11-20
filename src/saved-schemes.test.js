import assert from "node:assert/strict";
import test from "node:test";
import {
  readSavedSchemes,
  SAVED_SCHEMES_STORAGE_KEY,
  writeSavedSchemes,
} from "./saved-schemes.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("saved schemes persist and restore unique IDs", () => {
  const storage = createStorage();
  writeSavedSchemes(["health", "housing", "health"], storage);

  assert.deepEqual(readSavedSchemes(storage), ["health", "housing"]);
});

test("saved schemes reject malformed stored data", () => {
  const storage = createStorage();
  storage.setItem(SAVED_SCHEMES_STORAGE_KEY, JSON.stringify(["health", 3]));

  assert.throws(() => readSavedSchemes(storage), /must contain scheme IDs/);
});
