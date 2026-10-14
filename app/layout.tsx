import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pocket Desk — Your day, at a glance",
  description: "One considered iPhone widget for SORA, S&P 500 forward P/E, the way home, and local air quality. Preview and install Pocket Desk with Scriptable.",
};

export const viewport: Viewport = { themeColor: "#f7f8f2" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}><body>{children}</body></html>;
}
