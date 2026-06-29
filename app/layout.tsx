import type { Metadata } from "next";
import { Source_Serif_4, Caveat, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

// Resolve a base URL for absolute OG/Twitter image links. Vercel sets VERCEL_URL
// at build/runtime; fall back to an explicit SITE_URL, then localhost in dev.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  "http://localhost:3000";

const title = "Sensei — Split event expenses, settle up fast";
const description =
  "Track shared event expenses with friends and settle up in the fewest possible payments.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "Sensei",
  openGraph: {
    title,
    description,
    siteName: "Sensei",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${caveat.variable} ${mono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
