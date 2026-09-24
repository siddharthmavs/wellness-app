import axios from "axios";
import { useAuthStore } from "../store";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

// Avatars uploaded via POST /users/me/avatar come back as a backend-relative
// path (e.g. "/api/avatars/{uid}/{file}"); anything else (Dicebear, etc.) is
// already an absolute URL.
export const resolveAvatar = (avatar) =>
 avatar && avatar.startsWith("/api/") ? `${BACKEND_URL}${avatar}` : avatar;

api.interceptors.request.use((config) => {
 const token = useAuthStore.getState().token;
 if (token) config.headers.Authorization = `Bearer ${token}`;
 return config;
});

// Any successful write may have earned points; let point displays refresh
// (coalesced so a burst of requests triggers one refetch).
let pointsChangedTimer = null;
const announcePointsChanged = () => {
 clearTimeout(pointsChangedTimer);
 pointsChangedTimer = setTimeout(() => window.dispatchEvent(new Event("points-changed")), 300);
};

api.interceptors.response.use(
 (r) => {
 if (r.config?.method && r.config.method !== "get") announcePointsChanged();
 return r;
 },
 (e) => {
 if (e.response?.status === 401) {
 useAuthStore.getState().logout();
 }
 return Promise.reject(e);
 }
);
