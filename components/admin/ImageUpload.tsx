"use client";

import { useRef, useState } from "react";

// Client-side resize to a uniform square (contain on paper bg) so every catalog
// image is the same dimensions and small, then upload via /api/admin/upload.
function resizeToSquare(file: File, size = 600): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const img = new Image();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      img.src = reader.result as string;
    };
    img.onerror = () => reject(new Error("Could not load image"));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unsupported"));
      ctx.fillStyle = "#fffdf9";
      ctx.fillRect(0, 0, size, size);
      const scale = Math.min(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Resize failed"))), "image/jpeg", 0.85);
    };
    reader.readAsDataURL(file);
  });
}

// When dragging an image from a web page, the drop carries HTML like
// `<img src="...">` rather than a file. Pull the src out.
function imgSrcFromHtml(html: string): string {
  const m = html?.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : "";
}

export default function ImageUpload({
  folder,
  id,
  url,
  onUploaded,
}: {
  folder: "strings" | "racquets";
  id: string;
  url: string | null;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Image dragged from another browser/tab → send the URL; the server fetches
  // and resizes it (avoids client-side CORS limits).
  async function handleUrl(sourceUrl: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl, folder, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onUploaded(data.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    setBusy(true);
    setErr(null);
    try {
      const blob = await resizeToSquare(file);
      const fd = new FormData();
      fd.append("file", new File([blob], `${id}.jpg`, { type: "image/jpeg" }));
      fd.append("folder", folder);
      fd.append("id", id);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onUploaded(data.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0">
      {/* A div (not a button) is a far more reliable drop target across browsers. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDrag(false);
          const dt = e.dataTransfer;
          // 1) a real file (Finder, or browsers that expose the image as a file)
          const file = dt.files?.[0];
          if (file && file.type.startsWith("image/")) return void handleFile(file);
          // 2) items API — some browsers surface the dragged image here
          const itemFile = Array.from(dt.items || [])
            .find((it) => it.kind === "file")
            ?.getAsFile();
          if (itemFile && itemFile.type.startsWith("image/")) return void handleFile(itemFile);
          // 3) a URL dragged from another browser/tab
          const uri = (dt.getData("text/uri-list") || dt.getData("text/plain") || "").trim();
          const url = uri || imgSrcFromHtml(dt.getData("text/html"));
          if (url) return void handleUrl(url);
          setErr("Couldn't read that. Save the image, then click to pick it.");
        }}
        className={`relative flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-lg border bg-paper text-[10px] text-stone transition ${
          drag ? "border-court ring-2 ring-court/30" : "border-line hover:border-court/40"
        }`}
        title="Click to pick, or drag an image here (from Finder or another browser)"
      >
        {busy ? (
          <span>…</span>
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="pointer-events-none h-full w-full object-contain" />
        ) : (
          <span className="pointer-events-none px-1 text-center leading-tight">Drop / pick image</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {err && <p className="mt-1 w-44 text-[10px] leading-tight text-red-600">{err}</p>}
    </div>
  );
}
