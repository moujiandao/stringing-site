import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Owner-authenticated image upload. Two input modes:
//  - multipart file (from Finder / client), or
//  - JSON { sourceUrl } when an image is dragged from another browser. If the
//    URL turns out to be a web page, we extract the real image (og:image / first
//    <img>) and fetch that. Resized to a uniform square via sharp and stored in
//    the public `catalog` bucket (service role bypasses Storage RLS).
const PAPER = { r: 255, g: 253, b: 249, alpha: 1 };
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

async function squareJpeg(input: Buffer): Promise<Buffer> {
  return sharp(input).resize(600, 600, { fit: "contain", background: PAPER }).jpeg({ quality: 85 }).toBuffer();
}

function fetchImage(url: string, referer: string): Promise<Response> {
  return fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      ...(referer ? { Referer: referer } : {}),
    },
    redirect: "follow",
  });
}

// Pull a real image URL out of an HTML page (og:image / twitter:image / first <img>).
function extractImageUrl(html: string): string {
  const metas = [
    /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["']/i,
  ];
  for (const re of metas) {
    const m = html.match(re);
    if (m) return m[1];
  }
  const img = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return img ? img[1] : "";
}

const bad = (msg: string) => NextResponse.json({ error: msg }, { status: 400 });

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

  if (contentType.includes("application/json")) {
    let body: { sourceUrl?: string; folder?: string; id?: string };
    try {
      body = await req.json();
    } catch {
      return bad("Bad request body");
    }
    folder = body.folder || "";
    id = body.id || "";
    const sourceUrl = (body.sourceUrl || "").trim();
    if (!sourceUrl) return bad("No image URL in that drop");

    let referer = "";
    try {
      referer = new URL(sourceUrl).origin;
    } catch {
      return bad(`Not a valid URL: ${sourceUrl.slice(0, 60)}`);
    }

    let r: Response;
    try {
      r = await fetchImage(sourceUrl, referer);
    } catch (e) {
      return bad(`Couldn't reach it: ${e instanceof Error ? e.message : "network error"}`);
    }
    if (!r.ok) return bad(`Image host returned ${r.status}`);

    let raw = Buffer.from(await r.arrayBuffer());
    let ct = r.headers.get("content-type") || "";

    // Landed on a web page → dig out the real image and fetch it.
    if (ct.includes("text/html")) {
      const imgUrl = extractImageUrl(raw.toString("utf8"));
      if (!imgUrl) return bad("That page had no clear image — drag the image itself");
      let abs: string;
      try {
        abs = new URL(imgUrl, sourceUrl).href;
      } catch {
        return bad("Found an unreadable image link on that page");
      }
      let r2: Response;
      try {
        r2 = await fetchImage(abs, referer);
      } catch (e) {
        return bad(`Couldn't reach the image: ${e instanceof Error ? e.message : "network error"}`);
      }
      if (!r2.ok) return bad(`Image returned ${r2.status}`);
      raw = Buffer.from(await r2.arrayBuffer());
      ct = r2.headers.get("content-type") || "";
    }

    if (raw.length === 0) return bad("Fetched an empty file");
    try {
      buf = await squareJpeg(raw);
    } catch {
      return bad(`Got ${raw.length}B (${ct || "unknown"}) — not a decodable image`);
    }
  } else {
    const form = await req.formData();
    const file = form.get("file");
    folder = String(form.get("folder") || "");
    id = String(form.get("id") || "");
    if (!(file instanceof File)) return bad("No file received");
    try {
      buf = await squareJpeg(Buffer.from(await file.arrayBuffer()));
    } catch {
      return bad("Couldn't decode the uploaded image");
    }
  }

  if (folder !== "strings" && folder !== "racquets") return bad("Invalid folder");
  if (!id) return bad("Missing id");

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
