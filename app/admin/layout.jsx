export const metadata = {
  title: "Lumi CEO · Administration",
  applicationName: "Lumi CEO",
  description: "Lumi administration dashboard.",
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Lumi CEO" },
  icons: {
    icon: [{ url: "/icons/lumi-admin.svg", type: "image/svg+xml", sizes: "any" }],
    apple: [{ url: "/icons/lumi-admin.svg", type: "image/svg+xml" }]
  }
};
export const viewport = { themeColor: "#a92f69", width: "device-width", initialScale: 1 };
export default function AdminLayout({children}) { return children; }
