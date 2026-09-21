#!/usr/bin/env python3
"""U20 pass 2 — template-matching star removal for the light-background images
where pass-1 brightness detection failed. The watermark star has the same
rendering everywhere (same generator), so a template extracted from an
already-fixed image locates it reliably. Only the matched star bbox is
inpainted. Every hit is logged and visually verifiable."""
import cv2
import numpy as np
import os, shutil

BASE = "/home/z/my-project/public"
BACKUP = "/tmp/img-backups2"

# template source: the star already removed from cat-makeup.png (backup holds the original)
TPL_SRC = "/tmp/img-backups/images/cat-makeup.png"

# file -> fractional search region (kept tight around the known watermark zone)
TARGETS: dict[str, tuple[float, float, float, float]] = {}
for n in ("cat-bodycare", "cat-fragrance", "cat-lips", "cat-sets"):
    for ext in (".png", ".webp"):
        TARGETS[f"images/{n}{ext}"] = (0.0, 0.0, 0.40, 0.28)
for n in ("hero-2.png", "hero-3.png", "hero-3.webp"):
    TARGETS[f"images/{n}"] = (0.30, 0.55, 0.80, 0.85)
for n in ("lb-care-makeup-box", "lb-care-more-lotion", "lb-care-more-trio",
          "lb-starky-eva-set", "lb-strawberry-body-mist", "lb-strawberry-lip-set",
          "lb-university-box", "lb-vaseline-tonic", "lb-vaseline-tonic-blue"):
    for ext in (".jpg", ".webp"):
        p = f"images/products/{n}{ext}"
        if os.path.isfile(f"{BASE}/{p}"):
            TARGETS[p] = (0.05, 0.80, 1.0, 1.0)
# star-necklaces: only the very bottom edge (pendant stars must NOT match)
for ext in (".jpg", ".webp"):
    p = f"images/products/lb-star-necklaces{ext}"
    if os.path.isfile(f"{BASE}/{p}"):
        TARGETS[p] = (0.05, 0.90, 1.0, 1.0)

SCALES = [0.5, 0.65, 0.8, 1.0, 1.2, 1.4, 1.7, 2.0]

def build_template():
    img = cv2.imread(TPL_SRC, cv2.IMREAD_GRAYSCALE)
    assert img is not None
    hsv = cv2.cvtColor(cv2.imread(TPL_SRC), cv2.COLOR_BGR2HSV)
    m = ((hsv[:, :, 2] >= 175) & (hsv[:, :, 1] <= 85)).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    best = None
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if a < 60 or w < 12 or not (0.55 <= w / h <= 1.8):
            continue
        if best is None or x < best[0]:
            best = (x, y, w, h)
    assert best, "template star not found in cat-makeup backup"
    x, y, w, h = best
    pad = 2
    tpl = img[max(0, y - pad):y + h + pad, max(0, x - pad):x + w + pad]
    return tpl

def main():
    tpl = build_template()
    print(f"template {tpl.shape[1]}x{tpl.shape[0]}")
    os.makedirs(BACKUP, exist_ok=True)
    hits = []
    for rel, (fx0, fy0, fx1, fy1) in sorted(TARGETS.items()):
        fp = os.path.join(BASE, rel)
        img = cv2.imread(fp, cv2.IMREAD_UNCHANGED)
        if img is None:
            print(f"SKIP unreadable: {rel}")
            continue
        bgr = img[:, :, :3]
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        H, W = gray.shape
        x0, y0, x1, y1 = int(fx0 * W), int(fy0 * H), int(fx1 * W), int(fy1 * H)
        roi = gray[y0:y1, x0:x1]
        best = None  # (score, x, y, tw, th, scale)
        for s in SCALES:
            t = cv2.resize(tpl, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
            th_, tw_ = t.shape
            if th_ >= roi.shape[0] or tw_ >= roi.shape[1] or th_ < 8 or tw_ < 8:
                continue
            r = cv2.matchTemplate(roi, t, cv2.TM_CCOEFF_NORMED)
            _, mx, _, loc = cv2.minMaxLoc(r)
            if best is None or mx > best[0]:
                best = (mx, loc[0], loc[1], tw_, th_, s)
        if best is None or best[0] < 0.40:
            print(f"NO-MATCH ({best[0]:.2f}" if best else "NO-MATCH", f"): {rel}")
            continue
        score, mx_, my_, tw_, th_, s = best
        gx, gy = x0 + mx_, y0 + my_
        # tight mask: bright outliers inside the matched bbox
        bx0, by0 = max(0, gx - 2), max(0, gy - 2)
        bx1, by1 = min(W, gx + tw_ + 2), min(H, gy + th_ + 2)
        patch = bgr[by0:by1, bx0:bx1]
        phsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
        local_med = np.median(cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY))
        pm = ((phsv[:, :, 2] >= max(150, local_med + 12)) & (phsv[:, :, 1] <= 100)).astype(np.uint8) * 255
        pm = cv2.dilate(pm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
        mask = np.zeros((H, W), np.uint8)
        mask[by0:by1, bx0:bx1] = pm
        fixed = cv2.inpaint(bgr, mask, 5, cv2.INPAINT_TELEA)
        out = np.dstack([fixed, img[:, :, 3]]) if img.shape[2] == 4 else fixed
        bk = os.path.join(BACKUP, rel)
        os.makedirs(os.path.dirname(bk), exist_ok=True)
        shutil.copy2(fp, bk)
        ext = os.path.splitext(fp)[1].lower()
        params = [cv2.IMWRITE_WEBP_QUALITY, 92] if ext == ".webp" else ([cv2.IMWRITE_JPEG_QUALITY, 92] if ext in (".jpg", ".jpeg") else [])
        if not cv2.imwrite(fp, out, params):
            print(f"WRITE-FAIL: {fp}")
            continue
        hits.append((rel, gx, gy, tw_, th_))
        print(f"STAR-REMOVED score={score:.2f} scale={s} @({gx},{gy},{tw_}x{th_}): {rel}")
    print(f"\n== {len(hits)} stars removed ==")

if __name__ == "__main__":
    main()
