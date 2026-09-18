import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "./providers";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { SITE } from "@/lib/site";
import { GA_MEASUREMENT_ID } from "@/lib/gtag";
import "./globals.css";

/* Two families, and only two. Archivo carries every piece of structure from the
   152px hero down to a 13px button; Plex Mono carries anything that is data. */
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: `${SITE.name} — lifetime names on Robinhood Chain`,
  description: SITE.description,
  metadataBase: new URL(SITE.url),
  // Search Console ownership. Emitted on every route, which is what Google's
  // HTML-tag method checks for — it only ever fetches the homepage, but the tag
  // costs nothing elsewhere and survives whichever page it lands on.
  verification: { google: "ZUGijkox-osXu7C0HG07r1IN0uoCNURhxUXMaO-TGzc" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${archivo.variable} ${plexMono.variable} antialiased`}>
        {/* Google Analytics (gtag.js), on every route because the root layout is.
            Plain <script> rather than next/script: an afterInteractive script only ever
            runs if hydration succeeds, and this export ships to IPFS gateways where a
            slow chunk or a wallet-provider clash can leave React down on a page that a
            reader still saw. These two tags sit in the emitted HTML and fire either
            way. Client-side route changes are gtag's blind spot — <GoogleAnalytics />
            below reports those. */}
        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`,
          }}
        />
        <Providers>{children}</Providers>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
