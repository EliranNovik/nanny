import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Clear stale inline overflow from older builds (document-level scroll lock); CSS controls overflow.
document.documentElement.style.removeProperty("overflow-y");
document.body.style.removeProperty("overflow-y");

// PWA: register the service worker in all environments so the media cache
// (Supabase images) works during dev testing on mobile as well as production.
// The SW skips navigate requests, so React Router & Vite HMR are unaffected.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Prompt the new worker to take control immediately so cache updates apply now.
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          }
        });
        // Periodic update check every 30 s in dev, every 60 s in prod.
        const interval = import.meta.env.DEV ? 30_000 : 60_000;
        setInterval(() => registration.update(), interval);
      })
      .catch((error) => {
        console.warn("[SW] Registration failed:", error);
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
