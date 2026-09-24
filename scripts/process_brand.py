#!/usr/bin/env python3
"""U16-BRAND — replace shipped logos + icon set with the owner's uploaded artwork.

Inputs:
  upload/brave_5aiSulxTaS.png  (white wordmark + purple L-ring on navy  #010F1C)
  upload/brave_Ll02sUcGDf.png  (navy  wordmark + purple L-ring on white #FFFFFF)

Outputs:
  public/brand/logo-light.png   white-text transparent logo (dark backgrounds)
  public/brand/logo-dark.png    navy-text  transparent logo (light backgrounds)
  src/app/icon.png              256 rounded favicon
  src/app/apple-icon.png        180 full-bleed apple touch icon
  public/icons/icon-192.png     192 rounded
  public/icons/icon-512.png     512 rounded
  public/icons/icon-maskable-512.png  512 full-bleed with safe-zone padding
  public/icons/apple-touch-icon.png   180 full-bleed
"""
from PIL import Image, ImageDraw, ImageFont
import numpy as np

ROOT = "/home/z/my-project"
NAVY = (1, 15, 28)
PURPLE = (117, 83, 165)

# ---------------------------------------------------------------- transparent logos
def unmix(path, bg, out, ramp=64.0):
    im = np.array(Image.open(path).convert("RGB")).astype(np.float64)
    bgv = np.array(bg, dtype=np.float64)
    dist = np.abs(im - bgv).max(axis=2)          # per-pixel distance from bg
    alpha = np.clip(dist / ramp, 0.0, 1.0)       # soft ramp for antialiased edges
    # un-mix: F = (P - (1-a)*B) / a   → correct color on ANY background
    a3 = alpha[..., None]
    fg = np.where(a3 > 0, (im - (1.0 - a3) * bgv) / np.maximum(a3, 1e-6), 0.0)
    fg = np.clip(fg, 0, 255)
    rgba = np.dstack([fg, alpha * 255.0]).astype(np.uint8)
    img = Image.fromarray(rgba, "RGBA")
    # trim to content + small pad
    ys, xs = np.where(alpha > 0.02)
    pad = 4
    box = (max(int(xs.min()) - pad, 0), max(int(ys.min()) - pad, 0),
           min(int(xs.max()) + 1 + pad, img.width), min(int(ys.max()) + 1 + pad, img.height))
    img.crop(box).save(out)
    print("wrote", out, img.crop(box).size)

unmix(f"{ROOT}/upload/brave_5aiSulxTaS.png", NAVY, f"{ROOT}/public/brand/logo-light.png")
unmix(f"{ROOT}/upload/brave_Ll02sUcGDf.png", (255, 255, 255), f"{ROOT}/public/brand/logo-dark.png")

# ---------------------------------------------------------------- badge icon renderer
FONT = "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf"

def draw_badge(size, rounded):
    """Navy tile + purple ring + white italic serif L, drawn natively at `size`."""
    S = 4  # supersample factor for crisp edges
    n = size * S
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, n - 1, n - 1], radius=int(n * 0.22), fill=(*NAVY, 255))
    else:
        d.rectangle([0, 0, n - 1, n - 1], fill=(*NAVY, 255))
    r = n * 0.345
    w = max(int(n * 0.031), 2)
    d.ellipse([n / 2 - r, n / 2 - r, n / 2 + r, n / 2 + r],
              outline=(*PURPLE, 255), width=w)
    font = ImageFont.truetype(FONT, int(n * 0.52))
    d.text((n / 2, n / 2 + n * 0.008), "L", font=font, fill=(255, 255, 255, 255), anchor="mm")
    return img.resize((size, size), Image.LANCZOS)

for out, size in [
    (f"{ROOT}/src/app/icon.png", 256),
    (f"{ROOT}/public/icons/icon-192.png", 192),
    (f"{ROOT}/public/icons/icon-512.png", 512),
]:
    draw_badge(size, True).save(out)  # keep RGBA — rounded corners stay transparent
    print("wrote", out)

def draw_maskable(size):
    S = 4
    n = size * S
    img = Image.new("RGBA", (n, n), (*NAVY, 255))
    d = ImageDraw.Draw(img)
    r = n * 0.28   # smaller ring → inside 80% safe zone
    d.ellipse([n / 2 - r, n / 2 - r, n / 2 + r, n / 2 + r],
              outline=(*PURPLE, 255), width=max(int(n * 0.028), 2))
    font = ImageFont.truetype(FONT, int(n * 0.42))
    d.text((n / 2, n / 2 + n * 0.008), "L", font=font, fill=(255, 255, 255, 255), anchor="mm")
    return img.resize((size, size), Image.LANCZOS)

for out, size in [
    (f"{ROOT}/src/app/apple-icon.png", 180),
    (f"{ROOT}/public/icons/apple-touch-icon.png", 180),
    (f"{ROOT}/public/icons/icon-maskable-512.png", 512),
]:
    draw_maskable(size).convert("RGB").save(out)
    print("wrote", out)

print("done")
