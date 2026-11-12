import { Kalam } from "next/font/google";

/**
 * The "student's pen" handwriting face. next/font bundles it into the site
 * at build time, so it works with static export (no runtime Google request).
 * `hand.style.fontFamily` is also passed to SVG text in the charts.
 */
export const hand = Kalam({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  variable: "--font-hand",
  display: "swap",
});
