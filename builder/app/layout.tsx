import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "./providers";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { SITE } from "@/lib/site";
import { ogMetadata } from "@/lib/metadata";
import { GA_MEASUREMENT_ID } from "@/lib/gtag";
import "./globals.css";

/* Same two families as the site, for the same reason: Archivo carries structure,
   Plex Mono carries data. Note the variables are applied to <body>, never :root —
   next/font emits hashed family names, and an alias declared at :root renders the
   whole app in a system face with nothing to show for it. */
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
  ...ogMetadata({
    title: "Your name is the site",
    description: SITE.description,
    path: "/",
    image: "/og/default.png",
  }),
  metadataBase: new URL(SITE.url),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${archivo.variable} ${plexMono.variable} antialiased`}>
        {/* Google Analytics (gtag.js), on every route because the root layout is.
            Its own property, not the site's — see lib/gtag.ts. Plain <script> rather
            than next/script for the same reason as the site: an afterInteractive script
            only runs if hydration succeeds, and these fire either way. Client-side route
            changes are gtag's blind spot — <GoogleAnalytics /> below reports those. */}
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
