const BASE_URL = "/api";

export const client = {
  async get(path, params = {}) {
    const url = new URL(BASE_URL + path, window.location.origin);
    Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));
    const res = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } });
    if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
    return res.json();
  },
};