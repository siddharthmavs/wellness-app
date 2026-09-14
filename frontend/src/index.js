import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
 <React.StrictMode>
 <App />
 </React.StrictMode>,
);

// Registered eagerly (not gated on notification permission) so it's ready the
// moment the user opts into browser push from Settings (doc section 8.4).
if ("serviceWorker" in navigator) {
 window.addEventListener("load", () => {
 navigator.serviceWorker.register("/service-worker.js").catch(() => {});
 });
}
