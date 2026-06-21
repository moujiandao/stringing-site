import { createClient } from "@/lib/supabase/server";
import { rowToRacquet } from "@/lib/mappers";
import { formatCents } from "@/lib/constants";
import SiteHeader from "@/components/site/SiteHeader";

export const dynamic = "force-dynamic";

export default async function RacquetsPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("racquets_for_sale")
    .select("*")
    .eq("active", true)
    .eq("in_stock", true)
    .order("sort_order", { ascending: true });

  const racquets = (rows ?? []).map(rowToRacquet);

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <header className="max-w-2xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Racquets for sale
          </h1>
          <p className="mt-3 text-stone">
            Gently used and demo racquets, ready to play. Strung to your spec on request.
          </p>
        </header>

        {racquets.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-line bg-paper p-10 text-center shadow-sm">
            <p className="text-stone">Nothing for sale right now.</p>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {racquets.map((r) => (
              <article
                key={r.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-sm transition-shadow hover:shadow-md"
              >
                {r.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.photoUrl}
                    alt={r.name}
                    className="aspect-square w-full border-b border-line object-contain"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-sand">
                    <span className="font-display text-sm text-stone">No photo</span>
                  </div>
                )}

                <div className="flex flex-1 flex-col p-5">
                  <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                    {r.name}
                  </h2>
                  {r.brand ? <p className="mt-0.5 text-sm text-stone">{r.brand}</p> : null}
                  {r.description ? (
                    <p className="mt-2 text-sm text-stone">{r.description}</p>
                  ) : null}

                  <div className="mt-4 pt-1">
                    <span className="inline-flex items-center rounded-full bg-court-tint px-3 py-1 text-sm font-medium text-court">
                      {formatCents(r.priceCents)}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
