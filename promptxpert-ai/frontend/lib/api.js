const BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
const KEY = "px_token";

export const token = {
  get: () => (typeof window === "undefined" ? null : window.localStorage.getItem(KEY)),
  set: (t) => window.localStorage.setItem(KEY, t),
  clear: () => window.localStorage.removeItem(KEY),
};

async function req(path, { json, form, method, raw } = {}, retried = false) {
  const headers = {};
  const t = token.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  if (json) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(BASE + path, { method: method || (json || form ? "POST" : "GET"), headers, body: json ? JSON.stringify(json) : form });
  } catch {
    throw new Error("Can't reach the server. The free backend may be waking up, so try again in about 30 seconds.");
  }
  if (res.status === 401 && t && !retried && !path.startsWith("/auth/")) {
    token.clear(); // expired token: retry as guest
    return req(path, { json, form, method, raw }, true);
  }
  if (raw && res.ok) return res;
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data && (data.error || data.detail)) || (res.status === 429 ? "Too many requests. Please wait a few minutes." : `Request failed (${res.status}).`);
    throw new Error(msg);
  }
  return data;
}

export const api = {
  health: () => req("/api/health"),
  register: (email, password) => req("/api/auth/register", { json: { email, password } }),
  login: (email, password) => req("/api/auth/login", { json: { email, password } }),
  me: () => req("/api/auth/me"),
  analyze: (form) => req("/api/analyze", { form }),
  compose: (body) => req("/api/prompt/compose", { json: body }),
  history: () => req("/api/history"),
  remove: (id) => req(`/api/history/${id}`, { method: "DELETE" }),
  update: (id, body) => req(`/api/history/${id}`, { method: "PATCH", json: body }),
  share: (id) => req(`/api/history/${id}/share`, { method: "POST", json: {} }),
  shared: (tokenValue) => req(`/api/share/${tokenValue}`),
  stats: () => req("/api/stats"),
  transform: (text, mode, arg = "") => req("/api/prompt/transform", { json: { text, mode, arg } }),
  compare: (form) => req("/api/compare", { form }),
  variations: (attributes) => req("/api/prompt/variations", { json: { attributes } }),
  report: async (id, fmt = "md") => {
    const res = await req(`/api/history/${id}/report${fmt === "json" ? "?fmt=json" : ""}`, { raw: true });
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: `promptxpert-report-${id}.${fmt}` });
    a.click();
    URL.revokeObjectURL(url);
  },
};
