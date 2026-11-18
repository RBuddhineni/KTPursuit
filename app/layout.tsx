import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KTPursuit — find roles and the KTP alumni who can get you there",
  description:
    "Upload your resume, get AI-matched roles, and see which Kappa Theta Pi alumni work at each company.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-line bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="text-xl font-bold tracking-tight text-navy">
              KTP<span className="text-accent">ursuit</span>
            </Link>
            <nav className="flex gap-4 text-sm font-medium text-muted">
              <Link href="/upload" className="hover:text-navy">
                Get matched
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line bg-white py-6 text-center text-sm text-muted">
          Built by KTP Alpha Eta pledges
        </footer>
      </body>
    </html>
  );
}
