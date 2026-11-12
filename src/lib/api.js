const BASE = import.meta.env.VITE_API_URL ?? "/api";

export async function api(path, { method = "GET", body, actor } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(actor ? { "X-Actor": actor } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}
