export const SCHEME_CATALOG_STORAGE_KEY = "jan-sahayak-scheme-catalog-v1";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

function serializeSchemeContent(scheme) {
  const { icon, tone, ...schemeContent } = scheme;
  return JSON.stringify(schemeContent);
}

export function createSchemeCatalogSnapshot(schemes) {
  return Object.fromEntries(
    schemes.map((scheme) => [scheme.id, serializeSchemeContent(scheme)]),
  );
}

export function getSchemeCatalogChanges(previousSnapshot, currentSnapshot) {
  if (!previousSnapshot || typeof previousSnapshot !== "object" || Array.isArray(previousSnapshot)) {
    return [];
  }

  return Object.entries(currentSnapshot).flatMap(([schemeId, fingerprint]) => {
    if (!Object.hasOwn(previousSnapshot, schemeId)) {
      return [{ schemeId, type: "added" }];
    }
    return previousSnapshot[schemeId] === fingerprint
      ? []
      : [{ schemeId, type: "updated" }];
  });
}

export function readSchemeCatalogChanges(schemes, storage) {
  const currentSnapshot = createSchemeCatalogSnapshot(schemes);
  const storedSnapshot = storage.getItem(SCHEME_CATALOG_STORAGE_KEY);

  if (storedSnapshot === null) {
    storage.setItem(SCHEME_CATALOG_STORAGE_KEY, JSON.stringify(currentSnapshot));
    return [];
  }

  const previousSnapshot = JSON.parse(storedSnapshot);
  if (!previousSnapshot || typeof previousSnapshot !== "object" || Array.isArray(previousSnapshot)) {
    throw new TypeError("The saved scheme catalog snapshot is invalid.");
  }

  return getSchemeCatalogChanges(previousSnapshot, currentSnapshot);
}

export function acknowledgeSchemeCatalogChanges(schemes, storage) {
  storage.setItem(
    SCHEME_CATALOG_STORAGE_KEY,
    JSON.stringify(createSchemeCatalogSnapshot(schemes)),
  );
}

function getDateOnlyTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    return null;
  }
  return timestamp;
}

export function getSmartNotifications({
  schemes,
  collectedDocuments = {},
  startedChecklistIds = [],
  relevantSchemeIds = [],
  catalogChanges = [],
  today = new Date(),
  upcomingDays = 30,
}) {
  if (!(today instanceof Date) || Number.isNaN(today.getTime())) {
    throw new TypeError("today must be a valid Date.");
  }
  if (!Number.isInteger(upcomingDays) || upcomingDays < 0) {
    throw new RangeError("upcomingDays must be a non-negative integer.");
  }

  const relevantIds = new Set(relevantSchemeIds);
  const startedIds = new Set(startedChecklistIds);
  const startOfToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const notifications = [];

  for (const scheme of schemes) {
    if (!relevantIds.has(scheme.id)) continue;

    const deadlineTimestamp = getDateOnlyTimestamp(scheme.applicationDeadlineDate);
    if (deadlineTimestamp !== null) {
      const daysRemaining = Math.round((deadlineTimestamp - startOfToday) / DAY_IN_MILLISECONDS);
      if (daysRemaining >= 0 && daysRemaining <= upcomingDays) {
        notifications.push({
          id: `deadline:${scheme.id}:${scheme.applicationDeadlineDate}`,
          type: "deadline",
          schemeId: scheme.id,
          deadlineDate: scheme.applicationDeadlineDate,
          daysRemaining,
        });
      }
    }

    if (startedIds.has(scheme.id)) {
      const documents = scheme.requiredDocuments ?? [];
      const collected = collectedDocuments[scheme.id] ?? {};
      const collectedCount = documents.filter((document) => Boolean(collected[document.id])).length;
      if (documents.length > 0 && collectedCount < documents.length) {
        notifications.push({
          id: `checklist:${scheme.id}`,
          type: "checklist",
          schemeId: scheme.id,
          collectedCount,
          totalDocuments: documents.length,
        });
      }
    }
  }

  for (const change of catalogChanges) {
    if (!relevantIds.has(change.schemeId)) continue;
    if (!schemes.some((scheme) => scheme.id === change.schemeId)) continue;
    if (change.type !== "added" && change.type !== "updated") continue;

    notifications.push({
      id: `${change.type}:${change.schemeId}`,
      type: change.type === "added" ? "new-scheme" : "scheme-updated",
      schemeId: change.schemeId,
    });
  }

  const priority = { deadline: 0, checklist: 1, "new-scheme": 2, "scheme-updated": 3 };
  return notifications.sort((first, second) =>
    priority[first.type] - priority[second.type] ||
    (first.type === "deadline" ? first.daysRemaining - second.daysRemaining : 0),
  );
}
