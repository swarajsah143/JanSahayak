
const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  let result = {};
  if (response.status !== 204) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      if (path === "/nearby-centres") {
        throw new Error(
          `The API returned a non-JSON response (${response.status}). Check VITE_API_URL and deploy the latest Render API.`,
        );
      }
      throw new Error(`The API returned an unexpected response (${response.status}).`);
    }
    result = await response.json();
  }

  if (!response.ok) {
    const error = new Error(result.error || `Request failed with status ${response.status}.`);
    error.code = result.code;
    throw error;
  }

  return result;
}
