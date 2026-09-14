import { api } from "../lib/api";

// Converts the VAPID public key (base64url) into the Uint8Array
// applicationServerKey PushManager.subscribe() expects.
function urlBase64ToUint8Array(base64String) {
 const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
 const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
 const rawData = window.atob(base64);
 const outputArray = new Uint8Array(rawData.length);
 for (let i = 0; i < rawData.length; i++) {
 outputArray[i] = rawData.charCodeAt(i);
 }
 return outputArray;
}

export const pushSupported = () =>
 typeof window !== "undefined" &&
 "serviceWorker" in navigator &&
 "PushManager" in window &&
 typeof Notification !== "undefined";

export async function getPushSubscriptionStatus() {
 if (!pushSupported()) return "unsupported";
 const reg = await navigator.serviceWorker.getRegistration();
 if (!reg) return "none";
 const sub = await reg.pushManager.getSubscription();
 return sub ? "subscribed" : "none";
}

// Requests Notification permission, registers the service worker, subscribes
// to push, and registers the subscription with the backend.
export async function enablePush() {
 if (!pushSupported()) throw new Error("Push notifications are not supported in this browser");

 const permission = await Notification.requestPermission();
 if (permission !== "granted") throw new Error("Notification permission was not granted");

 const reg = await navigator.serviceWorker.register("/service-worker.js");
 await navigator.serviceWorker.ready;

 const { data } = await api.get("/notifications/vapid-public-key");
 const applicationServerKey = urlBase64ToUint8Array(data.key);

 let sub = await reg.pushManager.getSubscription();
 if (!sub) {
 sub = await reg.pushManager.subscribe({
 userVisibleOnly: true,
 applicationServerKey,
 });
 }

 await api.post("/notifications/register-device", {
 platform: "web",
 provider: "webpush",
 subscription: sub.toJSON(),
 label: navigator.userAgent.slice(0, 120),
 });

 return sub;
}

export async function disablePush() {
 if (!pushSupported()) return;
 const reg = await navigator.serviceWorker.getRegistration();
 if (!reg) return;
 const sub = await reg.pushManager.getSubscription();
 if (sub) {
 await sub.unsubscribe();
 }
}
