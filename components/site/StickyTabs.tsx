"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TabId = "home" | "pricing" | "strings" | "book";

const TABS: { id: TabId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "pricing", label: "Pricing" },
  { id: "strings", label: "Strings" },
  { id: "book", label: "Book" },
];

export default function StickyTabs() {
  const [active, setActive] = useState<TabId>("home");
  const [condensed, setCondensed] = useState(false);

  // Condense the bar once the user scrolls past the airy hero top.
  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scrollspy: mark the section nearest the top of the viewport as active.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const sections = TABS.map((t) => document.getElementById(t.id)).filter(
      (el): el is HTMLElement => el != null
    );
    if (sections.length === 0) return;

    const visible = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.intersectionRatio);
          } else {
            visible.delete(entry.target.id);
          }
        }
        // Pick the most-visible section that's currently in view.
        let best: { id: string; ratio: number } | null = null;
        for (const [id, ratio] of visible) {
          if (!best || ratio > best.ratio) best = { id, ratio };
        }
        if (best) setActive(best.id as TabId);
      },
      {
        // Bias toward the section crossing the upper third of the viewport.
        rootMargin: "-45% 0px -45% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        condensed
          ? "border-b border-line bg-cream/80 py-2 shadow-sm backdrop-blur"
          : "border-b border-transparent bg-transparent py-4"
      }`}
    >
      <nav className="mx-auto flex max-w-5xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="#home"
          className="font-display shrink-0 text-base font-semibold tracking-tight text-ink transition-colors hover:text-court sm:text-lg"
        >
          East Bay Stringing
        </Link>

        {/* Tabs — horizontally scrollable on mobile so they never wrap. */}
        <div className="ml-auto flex items-center">
          <div className="no-scrollbar flex items-center gap-1 overflow-x-auto whitespace-nowrap sm:gap-2">
            {TABS.map((t) => {
              const isActive = active === t.id;
              if (t.id === "book") {
                return (
                  <Link
                    key={t.id}
                    href="#book"
                    className={`ml-1 shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-court-deep text-white"
                        : "bg-court text-white hover:bg-court-deep"
                    }`}
                  >
                    Book
                  </Link>
                );
              }
              return (
                <Link
                  key={t.id}
                  href={`#${t.id}`}
                  className="group relative shrink-0 px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3"
                >
                  <span
                    className={
                      isActive ? "text-court" : "text-stone hover:text-ink"
                    }
                  >
                    {t.label}
                  </span>
                  <span
                    className={`absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-optic transition-opacity sm:inset-x-3 ${
                      isActive ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </Link>
              );
            })}

            {/* Shop lives on its own route — set slightly apart. */}
            <Link
              href="/racquets"
              className="ml-2 shrink-0 border-l border-line pl-3 text-sm font-medium text-stone transition-colors hover:text-court"
            >
              Shop
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
