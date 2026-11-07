"use client";
import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    const isAdmin = window.location.pathname.startsWith("/admin");
    const manifestPath = isAdmin ? "/admin/manifest.webmanifest" : "/manifest.webmanifest";
    let manifest = document.querySelector('link[rel="manifest"]');
    if (!manifest) {
      manifest = document.createElement("link");
      manifest.rel = "manifest";
      document.head.appendChild(manifest);
    }
    manifest.href = manifestPath;
    document.querySelector('meta[name="application-name"]')?.setAttribute("content", isAdmin ? "Lumi admin" : "Lumi");
    if (isAdmin) {
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#a92f69");
      return;
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);
  return null;
}
