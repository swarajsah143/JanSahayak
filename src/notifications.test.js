import assert from "node:assert/strict";
import test from "node:test";
import {
  acknowledgeSchemeCatalogChanges,
  createSchemeCatalogSnapshot,
  getSchemeCatalogChanges,
  getSmartNotifications,
  readSchemeCatalogChanges,
  SCHEME_CATALOG_STORAGE_KEY,
} from "./notifications.js";

const scheme = {
  id: "farmers",
  name: "Farmer support",
  applicationDeadline: "Check current portal",
  requiredDocuments: [{ id: "identity" }, { id: "land-records" }],
};

function createMemoryStorage(initialValue = null) {
  const values = new Map(initialValue === null ? [] : [[SCHEME_CATALOG_STORAGE_KEY, initialValue]]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("catalog tracking seeds a first-use snapshot and reports later additions and edits", () => {
  const storage = createMemoryStorage();
  assert.deepEqual(readSchemeCatalogChanges([scheme], storage), []);
  const originalSnapshot = JSON.parse(storage.getItem(SCHEME_CATALOG_STORAGE_KEY));

  const changedScheme = { ...scheme, benefits: "Updated benefits" };
  const newScheme = { ...scheme, id: "housing", name: "Housing support" };
  const changes = getSchemeCatalogChanges(
    originalSnapshot,
    createSchemeCatalogSnapshot([changedScheme, newScheme]),
  );
  assert.deepEqual(changes, [
    { schemeId: "farmers", type: "updated" },
    { schemeId: "housing", type: "added" },
  ]);
});

test("catalog changes stay pending until explicitly acknowledged", () => {
  const storage = createMemoryStorage(JSON.stringify(createSchemeCatalogSnapshot([scheme])));
  const changedScheme = { ...scheme, benefits: "Updated benefits" };

  assert.deepEqual(readSchemeCatalogChanges([changedScheme], storage), [
    { schemeId: "farmers", type: "updated" },
  ]);
  acknowledgeSchemeCatalogChanges([changedScheme], storage);
  assert.deepEqual(readSchemeCatalogChanges([changedScheme], storage), []);
});

test("deadline alerts require an exact date and only include relevant schemes within 30 days", () => {
  const today = new Date(2026, 10, 20, 12);
  const notifications = getSmartNotifications({
    schemes: [
      { ...scheme, applicationDeadline: "Applications close soon" },
      { ...scheme, id: "dated", applicationDeadlineDate: "2026-12-10" },
      { ...scheme, id: "past", applicationDeadlineDate: "2026-11-19" },
      { ...scheme, id: "far", applicationDeadlineDate: "2027-01-01" },
    ],
    relevantSchemeIds: ["farmers", "dated", "past", "far"],
    today,
  });

  assert.deepEqual(notifications.map(({ schemeId, daysRemaining }) => ({ schemeId, daysRemaining })), [
    { schemeId: "dated", daysRemaining: 20 },
  ]);
});

test("started checklists remain reminders until every document is marked collected", () => {
  const notifications = getSmartNotifications({
    schemes: [scheme],
    relevantSchemeIds: ["farmers"],
    startedChecklistIds: ["farmers"],
    collectedDocuments: { farmers: { identity: true } },
    today: new Date(2026, 10, 20),
  });

  assert.deepEqual(notifications, [{
    id: "checklist:farmers",
    type: "checklist",
    schemeId: "farmers",
    collectedCount: 1,
    totalDocuments: 2,
  }]);

  assert.deepEqual(getSmartNotifications({
    schemes: [scheme],
    relevantSchemeIds: ["farmers"],
    startedChecklistIds: ["farmers"],
    collectedDocuments: { farmers: { identity: true, "land-records": true } },
    today: new Date(2026, 10, 20),
  }), []);
});

test("catalog alerts are restricted to relevant schemes", () => {
  const notifications = getSmartNotifications({
    schemes: [scheme],
    catalogChanges: [{ schemeId: "farmers", type: "added" }],
    relevantSchemeIds: [],
    today: new Date(2026, 10, 20),
  });
  assert.deepEqual(notifications, []);
});

test("relevant catalog additions and edits become actionable notifications", () => {
  const housingScheme = { ...scheme, id: "housing", name: "Housing support" };
  const notifications = getSmartNotifications({
    schemes: [scheme, housingScheme],
    catalogChanges: [
      { schemeId: "farmers", type: "added" },
      { schemeId: "housing", type: "updated" },
    ],
    relevantSchemeIds: ["farmers", "housing"],
    today: new Date(2026, 10, 20),
  });

  assert.deepEqual(notifications.map(({ type, schemeId }) => ({ type, schemeId })), [
    { type: "new-scheme", schemeId: "farmers" },
    { type: "scheme-updated", schemeId: "housing" },
  ]);
});
