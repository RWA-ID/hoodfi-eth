import type { Metadata } from "next";
import {
  Archivo,
  Inter,
  IBM_Plex_Mono,
  IBM_Plex_Serif,
  Space_Grotesk,
} from "next/font/google";
import { Providers } from "./providers";
import { SITE } from "@/lib/site";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["500", "600", "700", "800", "900"],
});

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

/* Hero headline: the chrome-gradient statement line. */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-statement",
  weight: ["500", "600", "700"],
});

/* Hero accent: same superfamily as the mono, so the serif reads in-brand. */
const plexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400"],
  style: ["italic"],
});

export const metadata: Metadata = {
  title: `${SITE.name} — names on Robinhood Chain, secured until 3026`,
  description: SITE.description,
  metadataBase: new URL(SITE.url),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${archivo.variable} ${inter.variable} ${plexMono.variable} ${spaceGrotesk.variable} ${plexSerif.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
