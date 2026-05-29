import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Clear stale inline overflow from older builds (document-level scroll lock); CSS controls overflow.
document.documentElement.style.removeProperty("overflow-y");
document.body.style.removeProperty("overflow-y");

// PWA: register the service worker in all environments so the media cache
// (Supabase images) works during dev testing on mobile as well as production.
// updateViaCache: 'none' ensures mobile browsers re-fetch sw.js on each update check.
if ("serviceWorker" in navigator) {
  let refreshingForServiceWorker = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshingForServiceWorker) return;
    refreshingForServiceWorker = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
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
        const interval = import.meta.env.DEV ? 30_000 : 60_000;
        setInterval(() => registration.update(), interval);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            void registration.update();
          }
        });
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
