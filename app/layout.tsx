import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { RestrictionNotice } from "./components/RestrictionNotice";
import { Navbar } from "./components/Navbar";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { LegalLinks } from "./components/LegalLinks";
import { siteUrl } from "./lib/site";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Common · Community conversations",
    template: "%s · Common",
  },
  description: "Explore communities, share posts, and join the discussion.",
  openGraph: {
    type: "website",
    siteName: "Common",
    title: "Common · Community conversations",
    description: "Explore communities, share posts, and join the discussion.",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Navbar />
          <div id="main-content" tabIndex={-1} className="app-content">
            <RestrictionNotice />
            {children}
            <footer className="mx-auto max-w-[1100px] border-t px-4 py-4">
              <LegalLinks />
            </footer>
          </div>

          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
