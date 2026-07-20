import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";
import { SPLASH_STYLE } from "@/lib/splash";
import { Toaster } from "@/components/ui/toaster";
import { AppSplash } from "@/components/pwa/AppSplash";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Aura — Clinical Scribe",
    template: "%s · Aura",
  },
  description:
    "Aura is a privacy-first clinical workspace: ambient session transcription, structured notes, and patient memory — nothing leaves your practice.",
  manifest: "/manifest.webmanifest",
  applicationName: "Aura",
  appleWebApp: {
    // iOS has no install prompt; these make "Add to Home Screen" launch Aura
    // full screen with the right title rather than as a Safari tab.
    capable: true,
    title: "Aura",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  // Matches the manifest so the OS chrome blends with the app in both themes.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#101817" },
  ],
  // Let the app draw under the iPhone's notch / home indicator.
  viewportFit: "cover",
  // Zoom disabled on the installed app by explicit product decision. Note the
  // trade-off this makes: pinch-to-zoom is an accessibility affordance (WCAG
  // 1.4.4), and switching it off removes it for everyone, including anyone who
  // needs to magnify text. Input font sizes are kept at 16px on mobile anyway,
  // so iOS has no reason to zoom on focus even if this is ever reverted.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The theme script mutates <html> before hydration; that divergence is the
    // point, so React is told not to complain about it.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${sora.variable} h-full antialiased`}
    >
      <head>
        {/* Must run before paint, or the page flashes the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Styles the splash on the first frame, before the CSS bundle loads. */}
        <style dangerouslySetInnerHTML={{ __html: SPLASH_STYLE }} />
      </head>
      <body className="min-h-full flex flex-col">
        {/* First child, so it covers the app from the very first paint. */}
        <AppSplash />
        {children}
        <Toaster />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
