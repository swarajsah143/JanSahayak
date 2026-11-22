const PHOTON_ENDPOINT = "https://photon.komoot.io/api/";
const PHOTON_REVERSE_ENDPOINT = "https://photon.komoot.io/reverse";
const SEARCH_RADIUS_METERS = 8000;
const MAX_RESULTS = 60;
const PHOTON_SERVICE_TAGS = [
  "office:government",
  "government:administrative",
  "government:register_office",
  "government:tax",
  "government:public_service",
  "government:social_services",
  "amenity:townhall",
  "amenity:courthouse",
];

const cscNamePattern =
  /\b(csc|common service cent(re|er)|e.?seva|emitra|jan seva|mee seva|seva kendra|suvidha kendra)\b/i;

export class ServiceCentreSearchError extends Error {
  constructor(code) {
    super(code);
    this.name = "ServiceCentreSearchError";
    this.code = code;
  }
}

function getCoordinates(feature) {
  const coordinates = feature.geometry?.coordinates;
  const longitude = Number(coordinates?.[0]);
  const latitude = Number(coordinates?.[1]);
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

function getAddress(properties) {
  const fullAddress = getStringTag(properties, ["addr:full"]);
  if (fullAddress) return fullAddress;
  return [
    properties.housenumber,
    properties.street,
    properties.district,
    properties.city ?? properties.county,
    properties.state,
    properties.postcode,
  ]
    .filter((part) => typeof part === "string" && part.trim())
    .map((part) => part.trim())
    .join(", ");
}

function toServiceCentre(feature, origin) {
  if (!feature || typeof feature !== "object") return null;
  const properties = feature.properties && typeof feature.properties === "object"
    ? feature.properties
    : {};
  const extra = properties.extra && typeof properties.extra === "object" ? properties.extra : {};
  const name = getStringTag(properties, ["name", "name:en", "official_name"]);
  const coordinates = getCoordinates(feature);
  if (!name || !coordinates) return null;

  const distanceMeters = distanceInMeters(origin, coordinates);
  if (distanceMeters > SEARCH_RADIUS_METERS) return null;

  return {
    id: `${properties.osm_type ?? "photon"}/${properties.osm_id ?? `${coordinates.latitude},${coordinates.longitude}`}`,
    name,
    type: cscNamePattern.test(name) ? "csc" : "government",
    address: getAddress(properties),
    phone: getStringTag(extra, ["contact:phone", "phone", "contact:mobile", "mobile"]),
    email: getStringTag(extra, ["contact:email", "email"]),
    website: getStringTag(extra, ["contact:website", "website"]),
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

  const nearbyUrl = new URL(PHOTON_REVERSE_ENDPOINT);
  nearbyUrl.searchParams.set("lon", String(origin.longitude));
  nearbyUrl.searchParams.set("lat", String(origin.latitude));
  nearbyUrl.searchParams.set("radius", String(SEARCH_RADIUS_METERS / 1000));
  nearbyUrl.searchParams.set("limit", String(MAX_RESULTS));
  nearbyUrl.searchParams.set("lang", "en");
  for (const tag of PHOTON_SERVICE_TAGS) {
    nearbyUrl.searchParams.append("osm_tag", tag);
  }
  const directory = await fetchJson(fetchImpl, nearbyUrl, undefined, "directory-error");
  if (!Array.isArray(directory.features)) {
    throw new ServiceCentreSearchError("directory-error");
  }
  const seen = new Set();
  const centres = directory.features
    .map((feature) => toServiceCentre(feature, origin))
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
