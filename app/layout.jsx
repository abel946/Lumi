import "./globals.css";
import PwaRegister from "./pwa-register.jsx";

export const metadata = {
  title: "Lumi · ሉሚ",
  description: "A natural fertility-awareness companion.",
  applicationName: "Lumi",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Lumi" },
  icons: {
    icon: [{ url: "/icons/lumi.svg", type: "image/svg+xml", sizes: "any" }],
    apple: [{ url: "/icons/lumi.svg", type: "image/svg+xml" }]
  }
};

export const viewport = { themeColor: "#e85b98", width: "device-width", initialScale: 1 };

export default function RootLayout({children}) {
  return <html lang="en"><body><PwaRegister />{children}</body></html>;
}
