export async function apiRequest(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const result = response.status === 204 ? {} : await response.json();

  if (!response.ok) {
    throw new Error(result.error || `Request failed with status ${response.status}.`);
  }

  return result;
}
