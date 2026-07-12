import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  // Variable axis — one file, every weight, no FOUT between 400 and 600.
  axes: ["opsz"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gitpulse.vercel.app"),
  title: {
    default: "GitPulse — GitHub forgets. GitPulse doesn't.",
    template: "%s · GitPulse",
  },
  description:
    "See who followed you, who left, and when — on one dashboard. GitHub keeps only 14 days of repository traffic; GitPulse records views and clones every day and builds the full history it never gave you.",
  openGraph: {
    title: "GitPulse — GitHub forgets. GitPulse doesn't.",
    description:
      "Audience tracking, daily repository traffic recording, and AI repo analysis. Followers keyed on immutable user ids, so a rename is never counted as a loss.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#05070a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh bg-base antialiased">
        {/* Skip link — first thing in the tab order. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:rounded-lg focus:border focus:border-hairline focus:bg-elevated focus:px-4 focus:py-2 focus:text-sm focus:text-ink"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
