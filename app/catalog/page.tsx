import { createClient } from "@/lib/supabase/server";
import { rowToString, rowToRacquet } from "@/lib/mappers";
import { formatCents } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const supabase = await createClient();

  const [{ data: sRows }, { data: rRows }] = await Promise.all([
    supabase
      .from("string_catalog")
      .select("*")
      .eq("active", true)
      .eq("in_stock", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("racquets_for_sale")
      .select("*")
      .eq("active", true)
      .eq("in_stock", true)
      .order("sort_order", { ascending: true }),
  ]);

  const strings = (sRows ?? []).map(rowToString);
  const racquets = (rRows ?? []).map(rowToRacquet);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Strings in stock</h1>
        {strings.length === 0 ? (
          <p className="text-zinc-500">No strings listed right now. Bring your own and I&apos;ll string it.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
            {strings.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-zinc-500">
                    {[s.brand, s.gauge].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <span className="font-semibold">{formatCents(s.priceCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Racquets for sale</h2>
        {racquets.length === 0 ? (
          <p className="text-zinc-500">Nothing for sale at the moment.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {racquets.map((r) => (
              <div key={r.id} className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
                {r.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photoUrl} alt={r.name} className="h-40 w-full object-cover" />
                ) : null}
                <div className="space-y-1 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{r.name}</p>
                    <span className="font-semibold">{formatCents(r.priceCents)}</span>
                  </div>
                  {r.brand ? <p className="text-sm text-zinc-500">{r.brand}</p> : null}
                  {r.description ? <p className="text-sm text-zinc-600">{r.description}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
