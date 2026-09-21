// U7-IMG-FIX: runtime fallback for /uploads/* on the production server.
// Root cause (owner report 2026-09-18: "images upload but show broken"):
// `next start` (Next 16) snapshots public/ at process start, so any file
// uploaded AFTER the server booted 404s until the next restart — the upload
// API succeeds (file written, MediaAsset row created) but the storefront
// renders a broken image. This handler streams uploads straight from disk,
// catching everything the static snapshot does not know about (wired via an
// afterFiles rewrite in next.config.ts, so files already known to the
// snapshot keep being served statically with zero behavior change).
// Also adds Range support so hero/product videos can seek.
// U20: DB-BLOB-FIRST — every admin upload also stores its bytes in
// MediaAsset.data; this route serves the DB blob when present (immune to
// any static snapshot / platform file pinning / disk surprises), falling
// back to disk for legacy/orphan files.
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROOT = path.join(process.cwd(), "public", "uploads");

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

function ok(
  body: Buffer | ReadableStream,
  type: string,
  size: number,
  extra: Record<string, string> = {}
) {
  return new NextResponse(body as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Accept-Ranges": "bytes",
      "Content-Length": String(size),
      ...extra,
    },
  });
}

/** Range-aware response from an in-memory buffer (DB blob). */
function bufWithRange(req: Request, buf: Buffer, type: string) {
  const baseHeaders: Record<string, string> = {
    "Content-Type": type,
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    "Accept-Ranges": "bytes",
  };
  const range = req.headers.get("range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m && (m[1] !== "" || m[2] !== "")) {
      let start: number;
      let end: number;
      if (m[1] === "") {
        const n = Math.min(parseInt(m[2], 10), buf.length);
        start = buf.length - n;
        end = buf.length - 1;
      } else {
        start = parseInt(m[1], 10);
        end = m[2] === "" ? buf.length - 1 : Math.min(parseInt(m[2], 10), buf.length - 1);
      }
      if (isNaN(start) || isNaN(end) || start > end || start >= buf.length) {
        return new NextResponse("Range not satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${buf.length}` },
        });
      }
      const slice = buf.subarray(start, end + 1);
      return new NextResponse(new Uint8Array(slice), {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${buf.length}`,
          "Content-Length": String(slice.length),
        },
      });
    }
  }
  return ok(new Uint8Array(buf), type, buf.length);
}

export async function GET(req: Request, { params }: { params: Promise<{ file: string[] }> }) {
  const { file } = await params;
  const rel = (file || []).map(decodeURIComponent).join("/");
  if (!rel || rel.includes("..") || rel.includes("\\") || rel.includes("\0")) {
    return new NextResponse("Not found", { status: 404 });
  }
  const fp = path.resolve(ROOT, rel);
  if (fp !== ROOT && !fp.startsWith(ROOT + path.sep)) {
    return new NextResponse("Not found", { status: 404 });
  }

  // U20 — DB blob first: exact storageKey match (`uploads/<rel>`).
  try {
    const asset = await db.mediaAsset.findFirst({
      where: { storageKey: `uploads/${rel}` },
      select: { data: true, mimeType: true },
    });
    if (asset?.data && asset.data.length > 0) {
      const buf = Buffer.from(asset.data);
      const ext = path.extname(rel).slice(1).toLowerCase();
      const type = asset.mimeType || MIME[ext] || "application/octet-stream";
      return bufWithRange(req, buf, type);
    }
  } catch {
    // DB hiccup → fall through to disk
  }

  let st: fs.Stats;
  try {
    st = await fs.promises.stat(fp);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!st.isFile()) return new NextResponse("Not found", { status: 404 });

  const ext = path.extname(fp).slice(1).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const baseHeaders: Record<string, string> = {
    "Content-Type": type,
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    "Accept-Ranges": "bytes",
  };

  const range = req.headers.get("range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m && (m[1] !== "" || m[2] !== "")) {
      let start: number;
      let end: number;
      if (m[1] === "") {
        // suffix range: last N bytes
        const n = Math.min(parseInt(m[2], 10), st.size);
        start = st.size - n;
        end = st.size - 1;
      } else {
        start = parseInt(m[1], 10);
        end = m[2] === "" ? st.size - 1 : Math.min(parseInt(m[2], 10), st.size - 1);
      }
      if (isNaN(start) || isNaN(end) || start > end || start >= st.size) {
        return new NextResponse("Range not satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${st.size}` },
        });
      }
      const stream = Readable.toWeb(
        fs.createReadStream(fp, { start, end })
      ) as unknown as ReadableStream;
      return new NextResponse(stream, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${start}-${end}/${st.size}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }
  }

  const stream = Readable.toWeb(fs.createReadStream(fp)) as unknown as ReadableStream;
  return new NextResponse(stream, {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(st.size) },
  });
}
