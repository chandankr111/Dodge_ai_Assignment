import axios from "axios";

// Normalize base URL to avoid double slashes when env ends with `/`.
const BASE = (import.meta.env.VITE_API_BASE_URL ?? "https://dodgeaibackend-production.up.railway.app").replace(
  /\/+$/,
  ""
);

export const api = {
  getGraph: () => axios.get(`${BASE}/api/graph`).then((r) => r.data),
  getNodeDetail: (type: string, id: string) =>
    axios.get(`${BASE}/api/graph/node/${type}/${encodeURIComponent(id)}`).then((r) => r.data),
  chat: (message: string) => axios.post(`${BASE}/api/chat`, { message }).then((r) => r.data),
};
