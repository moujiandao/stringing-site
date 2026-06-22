import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { rowToString } from "@/lib/mappers";
import { SERVICES, SERVICE_TYPES, formatCents } from "@/lib/constants";
import StickyTabs from "@/components/site/StickyTabs";
import Reveal from "@/components/site/Reveal";
import BookingForm from "@/components/BookingForm";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Book online",
    body: "Submit a request and pick the meetup spot that's closest to you.",
  },
  {
    title: "Meet at a hub",
    body: "Hand off your racquet at a nearby spot — no storefront detour.",
  },
  {
    title: "Pick up after 2–3 days",
    body: "I string it with a fast, accurate job, then meet you again near you — pay in person by cash, Venmo, or Zelle.",
  },
];

const WHY = [
  {
    emoji: "🏷️",
    title: "No storefront → lower prices",
    body: "Zero retail overhead. Those savings get passed straight to you.",
  },
  {
    emoji: "📍",
    title: "3 convenient meetup spots",
    body: "Mobile drop-off and pickup at a hub near you across the East Bay.",
  },
  {
    emoji: "🎾",
    title: "Wholesale strings, discounted",
    body: "I buy reels wholesale, so the string you pick costs you less.",
  },
  {
    emoji: "🎯",
    title: "Pro electronic stringing",
    body: "Constant-pull electronic machine, tension accurate to ±0.5 lb — strung to USRSA best practices.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("string_catalog")
    .select("*")
    .eq("active", true)
    .eq("in_stock", true)
    .order("sort_order");
  const strings = (data ?? []).map(rowToString);

  return (
    <>
      <StickyTabs />

      <main>
        {/* ---------------------------------------------------------- HERO */}
        <section
          id="home"
          className="court-glow stringbed relative overflow-hidden"
        >
          {/* Blurred photo of the stringing machine as a tasteful backdrop */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero-machine.jpg"
              alt=""
              className="h-full w-full scale-105 object-cover opacity-100 blur-[2px]"
            />
            {/* Left-weighted veil keeps the headline legible; machine stays visible */}
            <div className="absolute inset-0 bg-gradient-to-r from-cream via-cream/55 to-cream/20" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-cream" />
          </div>
          <div className="relative z-10 mx-auto max-w-5xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
            <Reveal>
              <p className="text-sm font-medium tracking-wide text-court">
                Mobile racquet stringing · East Bay
              </p>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="font-display mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl md:text-6xl">
                Fresh strings, no storefront, lower prices.
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink">
                Serving tennis players across the Bay Area. I come to you — drop
                off and pick up at one of 3 convenient meetup spots, get a fast
                turnaround, and pay in person. Wholesale strings mean you pay less.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="#book"
                  className="rounded-lg bg-court px-5 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-court-deep"
                >
                  Book a stringing
                </Link>
                <Link
                  href="#pricing"
                  className="rounded-lg border border-line bg-paper px-5 py-2.5 font-medium text-ink transition-colors hover:border-court/40 hover:text-court"
                >
                  See pricing
                </Link>
              </div>
            </Reveal>

            {/* How it works — the hero centerpiece */}
            <div className="mt-16 sm:mt-20">
              <Reveal>
                <h2 className="font-display text-xl font-semibold text-ink">
                  How it works
                </h2>
              </Reveal>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {STEPS.map((step, i) => (
                  <Reveal key={step.title} delay={i * 90}>
                    <div className="h-full rounded-2xl border border-line bg-paper/80 p-5 shadow-sm backdrop-blur-sm">
                      <div className="flex items-baseline gap-2">
                        <span className="font-display text-3xl font-semibold text-court">
                          {i + 1}
                        </span>
                        <span className="h-1.5 w-1.5 rounded-full bg-optic" />
                      </div>
                      <h3 className="font-display mt-3 text-base font-semibold text-ink">
                        {step.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-stone">
                        {step.body}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- WHY STRIP */}
        <section className="border-y border-line bg-court-tint/60">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-14">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {WHY.map((item, i) => (
                <Reveal key={item.title} delay={i * 90}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none" aria-hidden>
                      {item.emoji}
                    </span>
                    <div>
                      <h3 className="font-display text-sm font-semibold text-ink">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-stone">
                        {item.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- PRICING */}
        <section id="pricing" className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-24">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">
              Simple, honest pricing
            </h2>
            <p className="mt-3 max-w-xl text-stone">
              Flat labor, no markup games. Pick-your-string adds the wholesale string
              cost; regrip adds the grip cost — both paid in person.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {SERVICE_TYPES.map((t, i) => {
              const s = SERVICES[t];
              const sublabel = s.priceNote;
              const popular = t === "full_service";
              return (
                <Reveal key={t} delay={i * 90} className="h-full">
                  <Link
                    href={`/?service=${t}#book`}
                    className={`group relative flex h-full flex-col rounded-2xl border bg-paper p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md ${
                      popular ? "border-court" : "border-line"
                    }`}
                  >
                    {popular && (
                      <span className="absolute -top-2.5 right-5 rounded-full bg-optic px-2.5 py-0.5 text-xs font-semibold text-ink">
                        Popular
                      </span>
                    )}
                    <h3 className="font-display text-lg font-semibold text-ink">
                      {s.label}
                    </h3>
                    <p className="font-display mt-2 text-3xl font-semibold text-ink">
                      {formatCents(s.laborCents)}
                    </p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-stone">
                      {sublabel}
                    </p>
                    <p className="mt-4 text-sm leading-relaxed text-stone">
                      {s.blurb}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-court">
                      Book this
                      <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>

          <Reveal delay={120}>
            <div className="mt-10">
              <Link
                href="#book"
                className="inline-flex rounded-lg bg-court px-5 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-court-deep"
              >
                Book a stringing
              </Link>
            </div>
          </Reveal>
        </section>

        {/* -------------------------------------------------------- STRINGS */}
        <section className="relative overflow-hidden bg-sand/50">
          {/* Blurred on-court photo backdrop */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/strings-bg.jpg"
              alt=""
              className="h-full w-full scale-105 object-cover opacity-100 blur-[2px]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-cream via-cream/55 to-cream" />
          </div>
          <div
            id="strings"
            className="relative z-10 mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-24"
          >
            <Reveal>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">
                Strings in stock
              </h2>
              <p className="mt-3 max-w-xl text-stone">
                Pick any of these for full service — bought wholesale and passed
                on at a discount.
              </p>
            </Reveal>

            {strings.length === 0 ? (
              <Reveal>
                <div className="mt-10 rounded-2xl border border-line bg-paper p-8 text-center text-stone shadow-sm">
                  No strings in stock right now. Choose “bring your own string”
                  when you book, or check back soon.
                </div>
              </Reveal>
            ) : (
              <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {strings.map((s, i) => {
                  const sub = [s.brand, s.gauge, s.color]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <Reveal key={s.id} delay={(i % 4) * 70} className="h-full">
                      <div className="flex h-full flex-col rounded-2xl border border-line bg-paper p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                        {s.photoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.photoUrl}
                            alt={s.name}
                            className="mb-2.5 aspect-square w-full rounded-lg border border-line object-contain"
                          />
                        )}
                        <h3 className="font-display text-sm font-semibold text-ink">
                          {s.name}
                        </h3>
                        {sub && (
                          <p className="mt-1 text-xs text-stone">{sub}</p>
                        )}
                        <span className="mt-3 inline-flex w-fit items-center rounded-full bg-court-tint px-2.5 py-0.5 text-xs font-medium text-court">
                          {formatCents(s.priceCents)}
                        </span>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            )}

            <Reveal delay={120}>
              <p className="mt-8 text-sm text-stone">
                Looking for a racquet?{" "}
                <Link
                  href="/racquets"
                  className="font-medium text-court underline-offset-4 hover:underline"
                >
                  See racquets for sale →
                </Link>
              </p>
            </Reveal>
          </div>
        </section>

        {/* ----------------------------------------------------------- BOOK */}
        <section id="book" className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-24">
          <Reveal>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">
              Book your stringing
            </h2>
            <p className="mt-3 text-stone">
              Tell me a bit about your racquet and when you&apos;re free. I&apos;ll
              email you to confirm a meetup near you — no payment until we meet.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-8">
              <BookingForm />
            </div>
          </Reveal>
        </section>
      </main>
    </>
  );
}
