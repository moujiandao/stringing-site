"use client";

import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-cream/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight text-ink transition-colors hover:text-court"
        >
          East Bay Stringing
        </Link>

        <div className="flex items-center gap-5 sm:gap-7">
          <Link
            href="/"
            className="text-sm text-stone transition-colors hover:text-ink"
          >
            Home
          </Link>
          <Link
            href="/racquets"
            className="text-sm text-stone transition-colors hover:text-ink"
          >
            Racquets
          </Link>
          <Link
            href="/#book"
            className="rounded-full bg-court px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-court-deep"
          >
            Book
          </Link>
        </div>
      </nav>
    </header>
  );
}
