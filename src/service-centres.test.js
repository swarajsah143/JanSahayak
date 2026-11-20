import assert from "node:assert/strict";
import test from "node:test";
import {
  searchNearbyServiceCentres,
  ServiceCentreSearchError,
} from "./service-centres.js";

const jsonResponse = (data, ok = true) => ({
  ok,
  json: async () => data,
});

test("search geocodes one manually entered Indian area and normalizes nearby centre records", async () => {
  const requests = [];
  const fetchMock = async (url, options) => {
    requests.push({ url: String(url), options });
    if (requests.length === 1) {
      return jsonResponse({
        features: [{
          properties: { countrycode: "IN", name: "Bengaluru", state: "Karnataka" },
          geometry: { coordinates: [77.5946, 12.9716] },
        }],
      });
    }
    return jsonResponse({
      elements: [
        {
          type: "node",
          id: 1,
          lat: 12.9717,
          lon: 77.5947,
          tags: {
            name: "Bengaluru Common Service Centre",
            "contact:phone": "+91 80 5555",
            "addr:city": "Bengaluru",
          },
        },
        {
          type: "way",
          id: 2,
          center: { lat: 12.973, lon: 77.595 },
          tags: { name: "District Social Welfare Office", office: "government" },
        },
        { type: "node", id: 3, lat: 12.972, lon: 77.595, tags: { office: "government" } },
        { type: "node", id: 4, lat: 13.2, lon: 77.6, tags: { name: "Far away office", office: "government" } },
      ],
    });
  };

  const result = await searchNearbyServiceCentres(" Bengaluru ", fetchMock);

  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /Bengaluru%2C\+India/);
  assert.equal(requests[1].options.method, undefined);
  assert.match(requests[1].url, /data=/);
  assert.ok(requests[1].options.signal instanceof AbortSignal);
  assert.equal(result.locationName, "Bengaluru, Karnataka");
  assert.equal(result.centres.length, 2);
  assert.equal(result.centres[0].type, "csc");
  assert.equal(result.centres[0].phone, "+91 80 5555");
  assert.equal(result.centres[0].address, "Bengaluru");
  assert.equal(result.centres[1].type, "government");
  assert.ok(result.centres[0].distanceMeters < result.centres[1].distanceMeters);
});

test("rejects a location result outside India without querying the directory", async () => {
  let requestCount = 0;
  const fetchMock = async () => {
    requestCount += 1;
    return jsonResponse({
      features: [{
        properties: { countrycode: "US", name: "Bengaluru" },
        geometry: { coordinates: [-122.4, 37.7] },
      }],
    });
  };

  await assert.rejects(
    searchNearbyServiceCentres("Bengaluru", fetchMock),
    (error) => error instanceof ServiceCentreSearchError && error.code === "location-not-found",
  );
  assert.equal(requestCount, 1);
});

test("surfaces directory service failures as a distinct error", async () => {
  let requestCount = 0;
  const fetchMock = async () => {
    requestCount += 1;
    return requestCount === 1
      ? jsonResponse({
          features: [{
            properties: { countrycode: "IN", name: "Bengaluru" },
            geometry: { coordinates: [77.5946, 12.9716] },
          }],
        })
      : jsonResponse({}, false);
  };

  await assert.rejects(
    searchNearbyServiceCentres("Bengaluru", fetchMock),
    (error) => error instanceof ServiceCentreSearchError && error.code === "directory-error",
  );
});
