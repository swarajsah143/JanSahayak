export const SAVED_SCHEMES_STORAGE_KEY = "jan-sahayak.saved-schemes.v1";

export function readSavedSchemes(storage) {
  const storedSchemes = storage.getItem(SAVED_SCHEMES_STORAGE_KEY);
  if (storedSchemes === null) return [];

  let schemeIds;
  try {
    schemeIds = JSON.parse(storedSchemes);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("The saved scheme list is not valid JSON.", { cause: error });
    }
    throw error;
  }

  if (!Array.isArray(schemeIds) || schemeIds.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error("The saved scheme list must contain scheme IDs.");
  }

  return [...new Set(schemeIds)];
}

export function writeSavedSchemes(schemeIds, storage) {
  if (!Array.isArray(schemeIds) || schemeIds.some((id) => typeof id !== "string" || !id.trim())) {
    throw new TypeError("Saved schemes must be a list of scheme IDs.");
  }
  storage.setItem(SAVED_SCHEMES_STORAGE_KEY, JSON.stringify([...new Set(schemeIds)]));
}
