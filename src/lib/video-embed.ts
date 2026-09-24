// U82-VIDEO-LINK — classify a maintenance video value into how it should
// render: a direct file (upload or .mp4/.webm URL) plays in <video>, while
// YouTube / Vimeo links become muted, looping, chrome-less embeds.
// Pure + client-safe (no server imports): shared by MaintenanceScreen and
// the studio's live previews.

export type VideoSource =
  | { kind: "youtube"; src: string }
  | { kind: "vimeo"; src: string }
  | { kind: "file"; src: string }
  | { kind: "none" };

/** Extract a YouTube video id from every common link shape. */
function youtubeId(raw: string): string | null {
  const m =
    /(?:youtube\.com\/(?:watch\?[^#\s]*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,20})/i.exec(raw);
  return m ? m[1] : null;
}

/** YouTube/Vimeo link → muted autoplay-loop embed URL; anything else that
 * looks like a video URL stays a direct file; empty → none. */
export function resolveVideoSource(raw?: string | null): VideoSource {
  const v = (raw || "").trim();
  if (!v) return { kind: "none" };

  const id = youtubeId(v);
  if (id) {
    // nocookie domain + muted/looped/chrome-less = professional emblem loop
    const q = "autoplay=1&mute=1&loop=1&playlist=" + id + "&controls=0&modestbranding=1&rel=0&playsinline=1&iv_load_policy=3";
    return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}?${q}` };
  }
  const vimeo = /vimeo\.com\/(?:video\/)?(\d{6,12})/i.exec(v);
  if (vimeo) {
    // background=1 → autoplays muted + loops with zero chrome
    return { kind: "vimeo", src: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&muted=1&loop=1&background=1` };
  }
  return { kind: "file", src: v };
}
