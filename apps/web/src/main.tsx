import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Clear stale inline overflow from older builds (document-level scroll lock); CSS controls overflow.
document.documentElement.style.removeProperty("overflow-y");
document.body.style.removeProperty("overflow-y");

// PWA: only register the service worker in production. In dev it intercepts navigations
// and fetches, which breaks client-side routing (React Router) and Vite HMR.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service Worker registered:", registration.scope);
        setInterval(() => {
          registration.update();
        }, 60000);
      })
      .catch((error) => {
        console.log("Service Worker registration failed:", error);
      });
  });
} else if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => {
      r.unregister();
      console.log("[dev] Service Worker unregistered for SPA routing");
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
