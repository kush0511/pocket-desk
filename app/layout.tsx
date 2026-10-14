import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pocket Desk / Night Shift",
  description: "A personal instrument panel for your iPhone. SORA curves, S&P 500 valuation, a ticket home to Lakeside, and local air quality. Install Pocket Desk with Scriptable.",
};

export const viewport: Viewport = { themeColor: "#080e18" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}><body>{children}</body></html>;
}
