import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_CATALOG_STORAGE_KEY,
  readAdminSchemeCatalog,
  writeAdminSchemeCatalog,
} from "./admin-catalog.js";
import { schemes } from "./data/schemes.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("admin catalog persists edits and restores default icon components", () => {
  const storage = createStorage();
  const editedCatalog = schemes.map((scheme) =>
    scheme.id === "farmers" ? { ...scheme, benefits: "Updated demo benefit." } : scheme,
  );
  writeAdminSchemeCatalog(editedCatalog, storage);

  const restored = readAdminSchemeCatalog(schemes, storage);
  const farmer = restored.find((scheme) => scheme.id === "farmers");

  assert.equal(farmer.benefits, "Updated demo benefit.");
  assert.equal(farmer.icon, schemes.find((scheme) => scheme.id === "farmers").icon);
  assert.equal(storage.getItem(ADMIN_CATALOG_STORAGE_KEY).includes('"icon"'), false);
});

test("admin catalog preserves added schemes and accepts an empty catalog after deletion", () => {
  const storage = createStorage();
  const newScheme = {
    ...schemes[0],
    id: "demo-support",
    name: "Demo support",
    category: "Healthcare",
  };
  writeAdminSchemeCatalog([...schemes, newScheme], storage);
  assert.equal(readAdminSchemeCatalog(schemes, storage).at(-1).id, "demo-support");

  writeAdminSchemeCatalog([], storage);
  assert.deepEqual(readAdminSchemeCatalog(schemes, storage), []);
});

test("admin catalog rejects invalid saved records instead of silently replacing them", () => {
  const storage = createStorage();
  storage.setItem(ADMIN_CATALOG_STORAGE_KEY, JSON.stringify([{ id: "Bad ID" }]));

  assert.throws(() => readAdminSchemeCatalog(schemes, storage), /valid ID, name, or category/);
});

test("admin catalog rejects unsafe official website links", () => {
  const storage = createStorage();
  const unsafeCatalog = schemes.map((scheme) =>
    scheme.id === "farmers" ? { ...scheme, href: "javascript:alert(1)" } : scheme,
  );
  writeAdminSchemeCatalog(unsafeCatalog, storage);

  assert.throws(() => readAdminSchemeCatalog(schemes, storage), /invalid official website URL/);
});
