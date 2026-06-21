"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { rowToString, rowToRacquet } from "@/lib/mappers";
import type { StringItem, RacquetForSale } from "@/lib/types";
import ImageUpload from "@/components/admin/ImageUpload";

// Lazy: only create the browser client in the browser, never during SSR/prerender.
let _sb: ReturnType<typeof createClient> | null = null;
const sb = () => (_sb ??= createClient());
const field = "rounded-md border border-zinc-300 px-2 py-1 text-sm";

export default function InventoryPage() {
  const [strings, setStrings] = useState<StringItem[]>([]);
  const [racquets, setRacquets] = useState<RacquetForSale[]>([]);

  const load = useCallback(async () => {
    const [{ data: s }, { data: r }] = await Promise.all([
      sb().from("string_catalog").select("*").eq("active", true).order("sort_order"),
      sb().from("racquets_for_sale").select("*").eq("active", true).order("sort_order"),
    ]);
    setStrings((s ?? []).map(rowToString));
    setRacquets((r ?? []).map(rowToRacquet));
  }, []);

  useEffect(() => {
    // Fetch on mount; setState happens after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
      <StringsSection items={strings} reload={load} />
      <RacquetsSection items={racquets} reload={load} />
    </div>
  );
}

function StringsSection({ items, reload }: { items: StringItem[]; reload: () => void }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [gauge, setGauge] = useState("");
  const [color, setColor] = useState("");
  const [price, setPrice] = useState("");

  async function add() {
    if (!name.trim()) return;
    await sb().from("string_catalog").insert({
      name: name.trim(),
      brand: brand.trim() || null,
      gauge: gauge.trim() || null,
      color: color.trim() || null,
      price_cents: Math.round(Number(price || 0) * 100),
    });
    setName("");
    setBrand("");
    setGauge("");
    setColor("");
    setPrice("");
    reload();
  }

  async function save(s: StringItem, patch: Partial<StringItem>) {
    const next = { ...s, ...patch };
    await sb()
      .from("string_catalog")
      .update({
        name: next.name,
        brand: next.brand,
        gauge: next.gauge,
        color: next.color,
        photo_url: next.photoUrl,
        price_cents: next.priceCents,
        in_stock: next.inStock,
      })
      .eq("id", s.id);
    reload();
  }

  async function archive(id: string) {
    await sb().from("string_catalog").update({ active: false }).eq("id", id);
    reload();
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Strings</h2>
      <div className="flex flex-wrap gap-2">
        <input className={field} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={field} placeholder="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
        <input className={field} placeholder="Gauge" value={gauge} onChange={(e) => setGauge(e.target.value)} />
        <input className={field} placeholder="Color" value={color} onChange={(e) => setColor(e.target.value)} />
        <input className={field} placeholder="Price $" value={price} onChange={(e) => setPrice(e.target.value)} />
        <button onClick={add} className="rounded-md bg-zinc-900 px-3 py-1 text-sm text-white hover:bg-zinc-700">
          Add
        </button>
      </div>
      <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
        {items.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <ImageUpload
              folder="strings"
              id={s.id}
              url={s.photoUrl}
              onUploaded={(u) => save(s, { photoUrl: u })}
            />
            <input
              className={field}
              defaultValue={s.name}
              onBlur={(e) => e.target.value !== s.name && save(s, { name: e.target.value })}
            />
            <input
              className={`${field} w-24`}
              defaultValue={s.brand ?? ""}
              onBlur={(e) => save(s, { brand: e.target.value || null })}
              placeholder="Brand"
            />
            <input
              className={`${field} w-20`}
              defaultValue={s.gauge ?? ""}
              onBlur={(e) => save(s, { gauge: e.target.value || null })}
              placeholder="Gauge"
            />
            <input
              className={`${field} w-24`}
              defaultValue={s.color ?? ""}
              onBlur={(e) => save(s, { color: e.target.value || null })}
              placeholder="Color"
            />
            <input
              className={`${field} w-20`}
              defaultValue={(s.priceCents / 100).toFixed(2)}
              onBlur={(e) => save(s, { priceCents: Math.round(Number(e.target.value || 0) * 100) })}
            />
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={s.inStock} onChange={(e) => save(s, { inStock: e.target.checked })} />
              in stock
            </label>
            <button onClick={() => archive(s.id)} className="ml-auto text-zinc-400 hover:text-red-600">
              Archive
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="px-3 py-2 text-sm text-zinc-400">No strings yet.</p>}
      </div>
    </section>
  );
}

function RacquetsSection({ items, reload }: { items: RacquetForSale[]; reload: () => void }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  async function add() {
    if (!name.trim()) return;
    await sb().from("racquets_for_sale").insert({
      name: name.trim(),
      brand: brand.trim() || null,
      price_cents: Math.round(Number(price || 0) * 100),
      description: description.trim() || null,
      photo_url: photoUrl.trim() || null,
    });
    setName("");
    setBrand("");
    setPrice("");
    setDescription("");
    setPhotoUrl("");
    reload();
  }

  async function save(r: RacquetForSale, patch: Partial<RacquetForSale>) {
    const next = { ...r, ...patch };
    await sb()
      .from("racquets_for_sale")
      .update({
        name: next.name,
        brand: next.brand,
        price_cents: next.priceCents,
        description: next.description,
        photo_url: next.photoUrl,
        in_stock: next.inStock,
      })
      .eq("id", r.id);
    reload();
  }

  async function archive(id: string) {
    await sb().from("racquets_for_sale").update({ active: false }).eq("id", id);
    reload();
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Racquets for sale</h2>
      <div className="flex flex-wrap gap-2">
        <input className={field} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={field} placeholder="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
        <input className={field} placeholder="Price $" value={price} onChange={(e) => setPrice(e.target.value)} />
        <input className={field} placeholder="Photo URL" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
        <input
          className={`${field} grow`}
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button onClick={add} className="rounded-md bg-zinc-900 px-3 py-1 text-sm text-white hover:bg-zinc-700">
          Add
        </button>
      </div>
      <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
        {items.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <ImageUpload
              folder="racquets"
              id={r.id}
              url={r.photoUrl}
              onUploaded={(u) => save(r, { photoUrl: u })}
            />
            <input
              className={field}
              defaultValue={r.name}
              onBlur={(e) => save(r, { name: e.target.value })}
            />
            <input
              className={`${field} w-24`}
              defaultValue={r.brand ?? ""}
              onBlur={(e) => save(r, { brand: e.target.value || null })}
              placeholder="Brand"
            />
            <input
              className={`${field} w-20`}
              defaultValue={(r.priceCents / 100).toFixed(2)}
              onBlur={(e) => save(r, { priceCents: Math.round(Number(e.target.value || 0) * 100) })}
            />
            <input
              className={`${field} grow`}
              defaultValue={r.description ?? ""}
              onBlur={(e) => save(r, { description: e.target.value || null })}
              placeholder="Description"
            />
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={r.inStock} onChange={(e) => save(r, { inStock: e.target.checked })} />
              in stock
            </label>
            <button onClick={() => archive(r.id)} className="ml-auto text-zinc-400 hover:text-red-600">
              Archive
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="px-3 py-2 text-sm text-zinc-400">No racquets yet.</p>}
      </div>
    </section>
  );
}
