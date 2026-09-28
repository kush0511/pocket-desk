import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pocket Desk — iPhone widgets for SORA & S&P 500 valuation",
  description:
    "Native iPhone Home Screen and Lock Screen widgets for the SORA Rates and S&P 500 Valuation Bands GitHub Pages dashboards.",
};

export const viewport: Viewport = {
  themeColor: "#0b0c12",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-[#0b0c12]">{children}</body>
    </html>
  );
}
