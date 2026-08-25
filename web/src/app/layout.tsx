import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Space_Grotesk, Space_Mono, Doto, Newsreader } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["300", "400", "500", "700"],
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-space-mono",
  weight: ["400", "700"],
});

const doto = Doto({
  subsets: ["latin"],
  variable: "--font-doto",
  weight: ["400", "700"],
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://county-by-county.vercel.app"),
  title: { default: "County by County — U.S. Elections", template: "%s — County by County" },
  description: "Explore U.S. presidential elections, demographics and machine-learning predictions at county level.",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "County by County — U.S. Elections",
    description: "Three elections, 3,107 counties and a model exploring how people and place shape the vote.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "County by County — U.S. Elections, 2016 to 2024" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "County by County — U.S. Elections",
    description: "Three elections, 3,107 counties and a model exploring how people and place shape the vote.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${spaceGrotesk.variable} ${spaceMono.variable} ${doto.variable} ${newsreader.variable}`}
    >
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
