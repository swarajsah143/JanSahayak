export const ADMIN_CATALOG_STORAGE_KEY = "jan-sahayak.admin-schemes.v1";

function isHttpUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}

export function readAdminSchemeCatalog(defaultCatalog, storage) {
  const savedCatalog = storage.getItem(ADMIN_CATALOG_STORAGE_KEY);
  if (savedCatalog === null) return defaultCatalog;

  let records;
  try {
    records = JSON.parse(savedCatalog);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("The saved demo scheme catalog is not valid JSON.", { cause: error });
    }
    throw error;
  }

  if (!Array.isArray(records)) {
    throw new Error("The saved demo scheme catalog must be a list.");
  }

  const seenIds = new Set();
  return records.map((record) => {
    if (
      !record ||
      typeof record.id !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.id) ||
      typeof record.name !== "string" ||
      typeof record.category !== "string"
    ) {
      throw new Error("A saved demo scheme is missing a valid ID, name, or category.");
    }
    if (seenIds.has(record.id)) {
      throw new Error(`The saved demo catalog contains duplicate scheme ID "${record.id}".`);
    }
    seenIds.add(record.id);

    const original = defaultCatalog.find((scheme) => scheme.id === record.id);
    const categoryTemplate = defaultCatalog.find((scheme) => scheme.category === record.category);
    if (!categoryTemplate) {
      throw new Error(`The saved demo scheme "${record.id}" uses an unsupported category.`);
    }

    const restored = {
      ...(categoryTemplate ?? {}),
      ...record,
      icon: original?.icon ?? categoryTemplate.icon,
    };
    if (!isHttpUrl(restored.href)) {
      throw new Error(`The saved demo scheme "${record.id}" has an invalid official website URL.`);
    }
    if (
      restored.officialLinks !== undefined &&
      (!Array.isArray(restored.officialLinks) ||
        restored.officialLinks.some((link) => !link || !isHttpUrl(link.href)))
    ) {
      throw new Error(`The saved demo scheme "${record.id}" has an invalid official link.`);
    }
    if (!Array.isArray(restored.requiredDocuments) || !Array.isArray(restored.applicationSteps)) {
      throw new Error(`The saved demo scheme "${record.id}" has invalid document or application steps.`);
    }
    return restored;
  });
}

export function writeAdminSchemeCatalog(catalog, storage) {
  const serializableCatalog = catalog.map(({ icon, ...scheme }) => scheme);
  storage.setItem(ADMIN_CATALOG_STORAGE_KEY, JSON.stringify(serializableCatalog));
}
