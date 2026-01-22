const isBrowser = typeof window !== "undefined";

const isLocalHost = (hostname) =>
  hostname === "localhost" || hostname === "127.0.0.1";

export const getApiBase = () => {
  const raw = (import.meta.env.VITE_API_URL || "").trim();
  if (!raw) return "";

  const hostname = isBrowser ? window.location.hostname : "";
  const local = isLocalHost(hostname);
  const rawLower = raw.toLowerCase();
  const pointsToLocal =
    rawLower.includes("localhost") || rawLower.includes("127.0.0.1");

  if (!local && pointsToLocal) {
    // Avoid broken localhost base in production
    return "";
  }

  return raw.replace(/\/+$/, "");
};

export const apiUrl = (path = "") => {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
};
