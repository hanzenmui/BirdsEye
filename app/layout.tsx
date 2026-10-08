import type { Metadata } from "next";
import { Fraunces, Red_Hat_Text } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const redHatText = Red_Hat_Text({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-red-hat-text",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Birdseye — Bible People, Family Trees & Timeline",
  description: "Explore Bible people by book, trace family lines, and follow biblical and church history on one clear timeline.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${redHatText.variable}`}>
      <body>{children}</body>
    </html>
  );
}
