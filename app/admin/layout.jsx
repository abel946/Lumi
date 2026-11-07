import AdminPwaRegister from "./admin-pwa-register.jsx";

export const metadata = {
  title: "Lumi admin",
  applicationName: "Lumi admin",
  description: "Lumi administrator portal and shop management.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Lumi admin" },
  icons: {
    icon: [{ url: "/icons/lumi-admin.svg", type: "image/svg+xml", sizes: "any" }],
    apple: [{ url: "/icons/lumi-admin.svg", type: "image/svg+xml" }]
  }
};
export const viewport = { themeColor: "#a92f69", width: "device-width", initialScale: 1 };
export default function AdminLayout({children}) {
  return <><AdminPwaRegister />{children}</>;
}
