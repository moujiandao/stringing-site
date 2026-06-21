import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Owner-authenticated image upload. Two input modes:
//  - multipart file (already client-resized to a square JPEG), or
//  - JSON { sourceUrl } when an image is dragged in from another browser —
//    the server fetches it (no CORS) and sharp-resizes to the uniform square.
// Stored in the public `catalog` bucket (service role bypasses Storage RLS).
const PAPER = { r: 255, g: 253, b: 249, alpha: 1 };

async function squareJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize(600, 600, { fit: "contain", background: PAPER })
    .jpeg({ quality: 85 })
    .toBuffer();
}

export async function POST(req: NextRequest) {
  const ssr = await createServerSupabase();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") || "";
  let buf: Buffer;
  let folder = "";
  let id = "";

  try {
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { sourceUrl?: string; folder?: string; id?: string };
      folder = body.folder || "";
      id = body.id || "";
      const sourceUrl = body.sourceUrl || "";
      if (!sourceUrl) return NextResponse.json({ error: "Missing image URL" }, { status: 400 });
      const r = await fetch(sourceUrl, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*" },
      });
      if (!r.ok) return NextResponse.json({ error: "Could not fetch that image" }, { status: 400 });
      if (!(r.headers.get("content-type") || "").startsWith("image/")) {
        return NextResponse.json({ error: "That link isn't an image" }, { status: 400 });
      }
      buf = await squareJpeg(Buffer.from(await r.arrayBuffer()));
    } else {
      const form = await req.formData();
      const file = form.get("file");
      folder = String(form.get("folder") || "");
      id = String(form.get("id") || "");
      if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
      // Client already resized; normalize again to be safe and uniform.
      buf = await squareJpeg(Buffer.from(await file.arrayBuffer()));
    }
  } catch {
    return NextResponse.json({ error: "Could not process that image" }, { status: 400 });
  }

  if (folder !== "strings" && folder !== "racquets") {
    return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = createAdminClient();
  const path = `${folder}/${id}.jpg`;
  const { error } = await supabase.storage.from("catalog").upload(path, buf, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabase.storage.from("catalog").getPublicUrl(path);
  return NextResponse.json({ url: `${data.publicUrl}?v=${Date.now()}` });
}
