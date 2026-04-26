import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono, Doto } from "next/font/google";
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

export const metadata: Metadata = {
  title: "U.S. Elections",
  description: "County-level US presidential election results · 2016–2024",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${spaceMono.variable} ${doto.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
