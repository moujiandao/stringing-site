"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** Extra classes appended after the base `reveal` class. */
  className?: string;
  /** Stagger delay in ms → inline `transitionDelay`. */
  delay?: number;
  /** Element tag to render. Defaults to "div". */
  as?: ElementType;
  /** Additional inline styles, merged with the delay style. */
  style?: CSSProperties;
};

export default function Reveal({
  children,
  className,
  delay,
  as: Tag = "div",
  style,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // SSR/older-browser guard: if IntersectionObserver is unavailable,
    // reveal immediately so content is never stuck hidden.
    if (typeof IntersectionObserver === "undefined") {
      el.setAttribute("data-shown", "true");
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-shown", "true");
            obs.unobserve(entry.target); // reveal once, don't reverse
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const mergedStyle: CSSProperties | undefined =
    delay != null ? { ...style, transitionDelay: `${delay}ms` } : style;

  return (
    <Tag ref={ref} className={`reveal ${className || ""}`} style={mergedStyle}>
      {children}
    </Tag>
  );
}
