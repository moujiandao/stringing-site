import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

// Owner-authenticated image upload. The client resizes to a uniform square JPEG
// first; this stores it in the public `catalog` bucket (service role bypasses
// Storage RLS) and returns a cache-busted public URL.
export async function POST(req: NextRequest) {
  const ssr = await createServerSupabase();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const folder = String(form.get("folder") || "");
  const id = String(form.get("id") || "");

  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (folder !== "strings" && folder !== "racquets") {
    return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = createAdminClient();
  const buf = Buffer.from(await file.arrayBuffer());
  const path = `${folder}/${id}.jpg`;

  const { error } = await supabase.storage.from("catalog").upload(path, buf, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabase.storage.from("catalog").getPublicUrl(path);
  return NextResponse.json({ url: `${data.publicUrl}?v=${Date.now()}` });
}
