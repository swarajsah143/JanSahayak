const PHOTON_ENDPOINT = "https://photon.komoot.io/api/";
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const SEARCH_RADIUS_METERS = 8000;
const MAX_RESULTS = 60;

const cscNamePattern =
  /\b(csc|common service cent(re|er)|e.?seva|emitra|jan seva|mee seva|seva kendra|suvidha kendra)\b/i;

export class ServiceCentreSearchError extends Error {
  constructor(code) {
    super(code);
    this.name = "ServiceCentreSearchError";
    this.code = code;
  }
}

function getCoordinates(element) {
  const latitude = Number(element.lat ?? element.center?.lat);
  const longitude = Number(element.lon ?? element.center?.lon);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

function distanceInMeters(from, to) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDifference = radians(to.latitude - from.latitude);
  const longitudeDifference = radians(to.longitude - from.longitude);
  const haversine =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDifference / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function getStringTag(tags, keys) {
  for (const key of keys) {
    if (typeof tags[key] === "string" && tags[key].trim()) return tags[key].trim();
  }
  return "";
}

function getAddress(tags) {
  const fullAddress = getStringTag(tags, ["addr:full"]);
  if (fullAddress) return fullAddress;
  return [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:village"],
    tags["addr:district"],
    tags["addr:postcode"],
  ]
    .filter((part) => typeof part === "string" && part.trim())
    .map((part) => part.trim())
    .join(", ");
}

function toServiceCentre(element, origin) {
  if (!element || typeof element !== "object") return null;
  const tags = element.tags && typeof element.tags === "object" ? element.tags : {};
  const name = getStringTag(tags, ["name", "name:en", "official_name"]);
  const coordinates = getCoordinates(element);
  if (!name || !coordinates) return null;

  const distanceMeters = distanceInMeters(origin, coordinates);
  if (distanceMeters > SEARCH_RADIUS_METERS) return null;

  return {
    id: `${element.type}/${element.id}`,
    name,
    type: cscNamePattern.test(name) ? "csc" : "government",
    address: getAddress(tags),
    phone: getStringTag(tags, ["contact:phone", "phone", "contact:mobile", "mobile"]),
    email: getStringTag(tags, ["contact:email", "email"]),
    website: getStringTag(tags, ["contact:website", "website"]),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    distanceMeters,
  };
}

function formatLocationName(properties, fallback) {
  const parts = [
    properties.name ?? properties.city ?? properties.district ?? fallback,
    properties.state,
  ].filter(Boolean);
  return [...new Set(parts)].join(", ");
}

function buildOverpassQuery({ latitude, longitude }) {
  return `[out:json][timeout:25];
(
  nwr(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})["office"="government"];
  nwr(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})["government"~"administrative|register_office|tax|public_service|social_services",i];
  nwr(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})["amenity"~"townhall|courthouse",i];
  nwr(around:${SEARCH_RADIUS_METERS},${latitude},${longitude})["name"~"Common Service Centre|Common Service Center|CSC|e.?Seva|eMitra|Jan Seva|Mee Seva|Seva Kendra|Suvidha Kendra",i];
);
out center;`;
}

async function fetchJson(fetchImpl, url, options, errorCode) {
  let response;
  try {
    response = await fetchImpl(url, {
      ...options,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ServiceCentreSearchError(errorCode);
  }
  if (!response.ok) throw new ServiceCentreSearchError(errorCode);
  try {
    return await response.json();
  } catch {
    throw new ServiceCentreSearchError(errorCode);
  }
}

export async function searchNearbyServiceCentres(query, fetchImpl = globalThis.fetch) {
  const searchTerm = query.trim();
  if (!searchTerm) throw new ServiceCentreSearchError("empty-query");
  if (typeof fetchImpl !== "function") throw new ServiceCentreSearchError("network-error");

  const geocodeUrl = new URL(PHOTON_ENDPOINT);
  geocodeUrl.searchParams.set("q", `${searchTerm}, India`);
  geocodeUrl.searchParams.set("limit", "1");
  geocodeUrl.searchParams.set("lang", "en");
  const geocoding = await fetchJson(fetchImpl, geocodeUrl, undefined, "geocoding-error");
  const feature = geocoding.features?.[0];
  const properties = feature?.properties ?? {};
  const geocodedCoordinates = feature?.geometry?.coordinates;
  const countryCode = typeof properties.countrycode === "string"
    ? properties.countrycode.toUpperCase()
    : "";
  const countryName = typeof properties.country === "string"
    ? properties.country.toLowerCase()
    : "";
  const isInIndia =
    countryCode === "IN" || countryName === "india";
  if (
    !isInIndia ||
    !Array.isArray(geocodedCoordinates) ||
    geocodedCoordinates.length < 2 ||
    (countryCode && countryCode !== "IN")
  ) {
    throw new ServiceCentreSearchError("location-not-found");
  }

  const origin = {
    longitude: Number(geocodedCoordinates[0]),
    latitude: Number(geocodedCoordinates[1]),
  };
  if (
    !Number.isFinite(origin.latitude) ||
    !Number.isFinite(origin.longitude) ||
    origin.latitude < -90 ||
    origin.latitude > 90 ||
    origin.longitude < -180 ||
    origin.longitude > 180
  ) {
    throw new ServiceCentreSearchError("location-not-found");
  }

  const overpassUrl = new URL(OVERPASS_ENDPOINT);
  overpassUrl.searchParams.set("data", buildOverpassQuery(origin));
  const directory = await fetchJson(
    fetchImpl,
    overpassUrl,
    undefined,
    "directory-error",
  );
  if (!Array.isArray(directory.elements)) {
    throw new ServiceCentreSearchError("directory-error");
  }
  const elements = directory.elements;
  const seen = new Set();
  const centres = elements
    .map((element) => toServiceCentre(element, origin))
    .filter((centre) => {
      if (!centre || seen.has(centre.id)) return false;
      seen.add(centre.id);
      return true;
    })
    .sort((first, second) => first.distanceMeters - second.distanceMeters)
    .slice(0, MAX_RESULTS);

  return {
    locationName: formatLocationName(properties, searchTerm),
    centres,
  };
}
