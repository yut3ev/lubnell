#!/usr/bin/env python3
"""U20 — remove the decorative 4-point star (✦) from the seeded site images.

The seeded watermark is «✦ LUBNÉL»: a bright cream 4-point star, a gap, then
the wordmark letters on the same baseline. Detection signature per image:
  - bright + low-saturation pixels (HSV V>=175, S<=85)
  - a compact, roughly square, sparse-in-bbox component (the star)
  - with >=3 letter-like bright components to its RIGHT on the same band
  - and NOTHING bright immediately to its LEFT (the star precedes the text)
Only the star blob is inpainted (cv2.TELEA) — the LUBNÉL wordmark stays.
Regions are constrained per image group to protect product details.
"""
import cv2
import numpy as np
import os, shutil, sys

BASE = "/home/z/my-project/public"
BACKUP = "/tmp/img-backups"

# file -> (x0,y0,x1,y1) fractional search region for the watermark star
TARGETS: dict[str, tuple[float, float, float, float]] = {}
for n in ("cat-bodycare", "cat-fragrance", "cat-lips", "cat-makeup", "cat-sets", "cat-skincare"):
    for ext in (".png", ".webp"):
        TARGETS[f"images/{n}{ext}"] = (0.0, 0.0, 0.55, 0.30)          # top-left watermark
for n in ("hero-1.png", "hero-1.webp", "hero-2.png", "hero-3.png", "hero-3.webp"):
    TARGETS[f"images/{n}"] = (0.20, 0.45, 0.95, 0.97)                  # center watermark
for n in sorted(os.listdir(f"{BASE}/images/products")):
    if n.startswith(("gen-", "lb-")) and n.endswith((".jpg", ".webp", ".png")):
        TARGETS[f"images/products/{n}"] = (0.15, 0.62, 1.0, 1.0)       # bottom strip
# ads / uploads — full-frame scan (simple ad layouts, letter-check protects)
for n in ("images/hero-soft-glow-mobile.jpg", "images/hero-soft-ritual-mobile.jpg",
          "images/hero-skin-edit-mobile.jpg", "uploads/soft-ritual-mobile.jpg",
          "uploads/1789759566058-ChatGPT-Image-Sep-18--2026--10_19_24-PM.webp",
          "uploads/1789760486326-slider-1_e7bcf26d.jpg"):
    if os.path.isfile(f"{BASE}/{n}"):
        TARGETS[n] = (0.0, 0.0, 1.0, 1.0)

def detect_star(img, region):
    H, W = img.shape[:2]
    x0, y0, x1, y1 = region
    rx0, ry0, rx1, ry1 = int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)
    roi = img[ry0:ry1, rx0:rx1]
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    v, s = hsv[:, :, 2], hsv[:, :, 1]
    mask = ((v >= 175) & (s <= 85)).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    comps = []
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if a < 60 or a > 4000 or w < 12 or h < 10:
            continue
        aspect = w / h
        if not (0.55 <= aspect <= 1.8):
            continue
        fill = a / (w * h)
        if not (0.20 <= fill <= 0.85):
            continue
        comps.append((i, x, y, w, h, a))
    best = None
    for i, x, y, w, h, a in comps:
        cy = y + h / 2
        # letters to the right on the same band
        letters = 0
        for j, x2, y2, w2, h2, a2 in comps:
            if j == i:
                continue
            cy2 = y2 + h2 / 2
            if x2 > x + w and abs(cy2 - cy) < max(h, h2) * 0.75 and 0.4 <= h2 / h <= 2.2 and (x2 - (x + w)) < 14 * w:
                letters += 1
        if letters < 3:
            continue
        # nothing bright immediately on the LEFT (star precedes the wordmark)
        left_blocked = False
        for j, x2, y2, w2, h2, a2 in comps:
            if j == i:
                continue
            cy2 = y2 + h2 / 2
            if x2 + w2 <= x and abs(cy2 - cy) < max(h, h2) * 0.75 and (x - (x2 + w2)) < 3.5 * w:
                left_blocked = True
                break
        if left_blocked:
            continue
        if best is None or x < best[1]:
            best = (i, x, y, w, h, a)
    if best is None:
        return None
    i, x, y, w, h, a = best
    star_mask = np.zeros(roi.shape[:2], np.uint8)
    star_mask[labels == i] = 255
    pad = max(2, w // 6)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * pad + 1, 2 * pad + 1))
    star_mask = cv2.dilate(star_mask, k)
    full_mask = np.zeros((H, W), np.uint8)
    full_mask[ry0:ry1, rx0:rx1] = star_mask
    return full_mask, (rx0 + x, ry0 + y, w, h)

def main():
    only_missing = "--verify-only" in sys.argv
    os.makedirs(BACKUP, exist_ok=True)
    done, missed = [], []
    for rel, region in sorted(TARGETS.items()):
        fp = os.path.join(BASE, rel)
        if not os.path.isfile(fp):
            continue
        img = cv2.imread(fp, cv2.IMREAD_UNCHANGED)
        if img is None:
            print(f"SKIP (unreadable): {rel}")
            continue
        if img.ndim == 2:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        res = detect_star(img, region)
        if res is None:
            missed.append(rel)
            print(f"NO-STAR: {rel}")
            continue
        mask, (x, y, w, h) = res
        if not only_missing:
            bgr = img[:, :, :3]
            fixed = cv2.inpaint(bgr, mask, 5, cv2.INPAINT_TELEA)
            if img.shape[2] == 4:  # keep alpha if present
                fixed = np.dstack([fixed, img[:, :, 3]])
            bk = os.path.join(BACKUP, rel)
            os.makedirs(os.path.dirname(bk), exist_ok=True)
            shutil.copy2(fp, bk)
            ext = os.path.splitext(fp)[1].lower()
            params = [cv2.IMWRITE_WEBP_QUALITY, 92] if ext == ".webp" else ([cv2.IMWRITE_JPEG_QUALITY, 92] if ext in (".jpg", ".jpeg") else [])
            ok = cv2.imwrite(fp, fixed, params)
            if not ok:
                print(f"WRITE-FAIL: {fp} (backup at {bk})")
                continue
            done.append(rel)
            print(f"STAR-REMOVED @({x},{y},{w}x{h}): {rel}")
        else:
            done.append(rel)
    print(f"\n== {len(done)} inpainted, {len(missed)} without detected star ==")

if __name__ == "__main__":
    main()
