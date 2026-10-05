import type { MetadataRoute } from "next";

/** The web app manifest (§6.10): installed to the home screen, standalone, dark. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FOQUS",
    short_name: "FOQUS",
    description: "Goals to weekly plan to time blocks to focus sessions.",
    id: "/today",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0E0F12",
    theme_color: "#0E0F12",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
