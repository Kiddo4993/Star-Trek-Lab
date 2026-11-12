import type { MetadataRoute } from "next";

// Home-screen icons for Android / "Add to Home Screen". The base path is
// added by hand because manifest URLs aren't rewritten for GitHub Pages.
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Star Trek Lab",
    short_name: "Star Trek Lab",
    description: "Dylan Duan, Grade 11 Physics: a red-matter probe falling to the centre of Vulcan.",
    start_url: `${base}/`,
    display: "standalone",
    background_color: "#EEF3E4",
    theme_color: "#EEF3E4",
    icons: [
      { src: `${base}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${base}/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
  };
}
