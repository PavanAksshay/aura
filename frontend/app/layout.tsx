import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";
import { Toaster } from "@/components/ui/toaster";

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
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
