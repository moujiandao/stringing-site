import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Racquet Stringing",
  description: "Local racquet stringing — fast turnaround, contactless meetup.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-zinc-200 bg-white">
          <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              Racquet Stringing
            </Link>
            <div className="flex gap-5 text-sm">
              <Link href="/catalog" className="text-zinc-600 hover:text-zinc-900">
                Catalog
              </Link>
              <Link
                href="/book"
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-700"
              >
                Book
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-zinc-200 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-zinc-500">
            Local racquet stringing · contactless meetup · cash / Venmo / Zelle
          </div>
        </footer>
      </body>
    </html>
  );
}
