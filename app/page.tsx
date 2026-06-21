import Link from "next/link";
import { SERVICES, SERVICE_TYPES, formatCents } from "@/lib/constants";

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Local racquet stringing, no hassle.
        </h1>
        <p className="max-w-xl text-zinc-600">
          Drop your racquet at a nearby meetup spot, tell me when you&apos;re free, and I&apos;ll
          string it and get it back to you. Fast turnaround, fair prices, pay in person.
        </p>
        <Link
          href="/book"
          className="inline-block rounded-md bg-zinc-900 px-5 py-2.5 text-white hover:bg-zinc-700"
        >
          Book a stringing
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Pricing</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {SERVICE_TYPES.map((t) => {
            const s = SERVICES[t];
            return (
              <div key={t} className="rounded-lg border border-zinc-200 bg-white p-5">
                <h3 className="font-medium">{s.label}</h3>
                <p className="mt-1 text-2xl font-semibold">{formatCents(s.laborCents)}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-zinc-400">
                  {s.needsString ? "+ string cost" : s.needsGrip ? "+ grip cost" : "labor"}
                </p>
                <p className="mt-3 text-sm text-zinc-600">{s.blurb}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">How it works</h2>
        <ol className="list-inside list-decimal space-y-1 text-zinc-600">
          <li>Book online and pick the meetup spot closest to you.</li>
          <li>I batch nearby drop-offs into one trip and email you a meetup time.</li>
          <li>I string your racquet and schedule a return meetup.</li>
          <li>Pay in person — cash, Venmo, or Zelle.</li>
        </ol>
      </section>
    </div>
  );
}
