import type { Metadata, Viewport } from "next";
import { hand } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Star Trek Lab",
  description: "Dylan Duan, Grade 11 Physics. How long a red-matter probe takes to fall to the centre of Vulcan, worked out step by step with Euler's method.",
};

export const viewport: Viewport = { themeColor: "#EEF3E4" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={hand.variable}>
      <body>{children}</body>
    </html>
  );
}
