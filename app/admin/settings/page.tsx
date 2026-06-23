"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

let _sb: ReturnType<typeof createClient> | null = null;
const sb = () => (_sb ??= createClient());

export default function SettingsPage() {
  const [ownerEmail, setOwnerEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await sb().from("settings").select("value").eq("key", "owner_email").maybeSingle();
    setOwnerEmail(data?.value ?? "");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setMsg(null);
    const { error } = await sb()
      .from("settings")
      .upsert({ key: "owner_email", value: ownerEmail.trim(), updated_at: new Date().toISOString() });
    setSaving(false);
    setMsg(error ? `Couldn't save: ${error.message}` : "Saved.");
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-5">
        <label className="block text-sm font-medium text-zinc-700">Notification email</label>
        <p className="text-sm text-zinc-500">Where new-booking notifications are sent.</p>
        <input
          type="email"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {msg && <span className="text-sm text-zinc-500">{msg}</span>}
        </div>
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Until a sending domain is verified in Resend, email only delivers to your Resend account
          address (currently <strong>brian099121@gmail.com</strong>). Set that here to receive
          notifications now; verify a domain to use any address.
        </p>
      </div>
    </div>
  );
}
