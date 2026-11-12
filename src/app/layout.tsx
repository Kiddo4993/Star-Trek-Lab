import type { Metadata, Viewport } from "next";
import { hand } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Star Trek Lab",
  description: "How long does a red-matter probe take to fall through Vulcan? Euler's method against the exact answer.",
};

export const viewport: Viewport = { themeColor: "#EEF3E4" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={hand.variable}>
      <body>{children}</body>
    </html>
  );
}
