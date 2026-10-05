import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorker } from "@/components/shell/ServiceWorker";

/** iPhone portrait screens (CSS points and pixel ratio) with a splash image in public/splash. */
const SPLASH: [number, number, number][] = [
  [375, 667, 2],
  [375, 812, 3],
  [390, 844, 3],
  [393, 852, 3],
  [402, 874, 3],
  [414, 896, 2],
  [414, 896, 3],
  [428, 926, 3],
  [430, 932, 3],
  [440, 956, 3],
];

export const metadata: Metadata = {
  title: "FOQUS",
  description: "Goals to weekly plan to time blocks to focus sessions.",
  applicationName: "FOQUS",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "FOQUS",
    // Content runs under the status bar; screens pad for the safe area themselves.
    statusBarStyle: "black-translucent",
    startupImage: SPLASH.map(([w, h, r]) => ({
      url: `/splash/splash-${w * r}x${h * r}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
    })),
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0E0F12",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg text-text antialiased">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
