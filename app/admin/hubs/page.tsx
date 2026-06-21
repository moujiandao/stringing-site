"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { rowToHub } from "@/lib/mappers";
import type { Hub } from "@/lib/types";

// Lazy: only create the browser client in the browser, never during SSR/prerender.
let _sb: ReturnType<typeof createClient> | null = null;
const sb = () => (_sb ??= createClient());
const field = "rounded-md border border-zinc-300 px-2 py-1 text-sm";

export default function HubsPage() {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("");

  const load = useCallback(async () => {
    const { data } = await sb().from("hubs").select("*").eq("active", true).order("sort_order");
    setHubs((data ?? []).map(rowToHub));
  }, []);

  useEffect(() => {
    // Fetch on mount; setState happens after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function add() {
    if (!name.trim()) return;
    await sb().from("hubs").insert({
      name: name.trim(),
      description: description.trim() || null,
      sort_order: Number(sortOrder || 0),
    });
    setName("");
    setDescription("");
    setSortOrder("");
    load();
  }

  async function save(h: Hub, patch: Partial<Hub>) {
    const next = { ...h, ...patch };
    await sb()
      .from("hubs")
      .update({ name: next.name, description: next.description, sort_order: next.sortOrder })
      .eq("id", h.id);
    load();
  }

  async function archive(id: string) {
    await sb().from("hubs").update({ active: false }).eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Meetup hubs</h1>
      <p className="text-sm text-zinc-500">
        These are the fixed meetup spots customers pick from. Keep them spaced so most customers have one nearby.
      </p>

      <div className="flex flex-wrap gap-2">
        <input className={field} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className={`${field} grow`}
          placeholder="Description (landmark, parking, etc.)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          className={`${field} w-20`}
          placeholder="Order"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        />
        <button onClick={add} className="rounded-md bg-zinc-900 px-3 py-1 text-sm text-white hover:bg-zinc-700">
          Add
        </button>
      </div>

      <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
        {hubs.map((h) => (
          <div key={h.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <input className={field} defaultValue={h.name} onBlur={(e) => save(h, { name: e.target.value })} />
            <input
              className={`${field} grow`}
              defaultValue={h.description ?? ""}
              onBlur={(e) => save(h, { description: e.target.value || null })}
              placeholder="Description"
            />
            <input
              className={`${field} w-16`}
              defaultValue={String(h.sortOrder)}
              onBlur={(e) => save(h, { sortOrder: Number(e.target.value || 0) })}
            />
            <button onClick={() => archive(h.id)} className="ml-auto text-zinc-400 hover:text-red-600">
              Archive
            </button>
          </div>
        ))}
        {hubs.length === 0 && <p className="px-3 py-2 text-sm text-zinc-400">No hubs yet — add your first.</p>}
      </div>
    </div>
  );
}
