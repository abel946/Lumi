"use client";
import { useEffect } from "react";
export default function PwaRegister() {
  useEffect(() => {
    // The administrator portal has its own manifest and service worker.
    // Do not let the customer app's root-scoped worker claim /admin pages.
    if (window.location.pathname.startsWith("/admin")) return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);
  return null;
}
