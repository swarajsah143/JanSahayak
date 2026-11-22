
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
  const result = response.status === 204 ? {} : await response.json();

  if (!response.ok) {
    const error = new Error(result.error || `Request failed with status ${response.status}.`);
    error.code = result.code;
    throw error;
  }

  return result;
}
