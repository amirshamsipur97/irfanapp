import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "irfaninvest — Luxury Real Estate Intelligence",
    template: "%s · irfaninvest",
  },
  description:
    "AI-powered analytics, CRM and call intelligence for Oman's premium real estate market.",
  applicationName: "irfaninvest",
  authors: [{ name: "irfaninvest" }],
  keywords: ["Oman real estate", "luxury properties", "ITC zones", "investment", "Muscat"],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "irfaninvest — Luxury Real Estate Intelligence",
    description:
      "AI-powered analytics, CRM and call intelligence for Oman's premium real estate market.",
    type: "website",
    locale: "en_US",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
