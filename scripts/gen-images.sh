#!/bin/bash
# LUBNÉL product image generation (background job)
cd /home/z/my-project
STYLE="professional product photography, warm cream and dusty rose color palette, soft studio lighting, elegant luxury boutique aesthetic, high quality, detailed"
gen() {
  z-ai image -p "$2" -o "public/products/$1.png" -s 1024x1024 >> /tmp/imggen.log 2>&1 && echo "OK $1" >> /tmp/imggen.log || echo "FAIL $1" >> /tmp/imggen.log
}
echo "=== start $(date) ===" >> /tmp/imggen.log
z-ai image -p "luxury beauty gift boxes flat lay with roses, ribbons and cosmetics on cream silk fabric, $STYLE" -o "public/products/hero.png" -s 1440x720 >> /tmp/imggen.log 2>&1 && echo "OK hero" >> /tmp/imggen.log || echo "FAIL hero" >> /tmp/imggen.log
gen university-box "elegant open gift box for university students with notebook, mug, pens and small cosmetics, dusty rose and cream colors, $STYLE"
gen rose-ritual-box "luxurious spa ritual gift box with rose petals, cream jars and soap bars, $STYLE"
gen glam-lipstick-set "set of three luxury lipsticks in rose gold cases, $STYLE"
gen velvet-shadow-palette "open eyeshadow palette with warm rose and bronze shades, $STYLE"
gen glow-serum "glass serum dropper bottle with golden liquid on cream background, $STYLE"
gen silk-cloud-cream "white cosmetic cream jar with rose gold lid, $STYLE"
gen oud-elixir-perfume "oriental oud perfume bottle amber glass with gold cap, $STYLE"
gen brush-set "set of makeup brushes in dusty rose holder, $STYLE"
gen amber-candle "luxury scented candle in amber glass jar with dried flowers, $STYLE"
echo "=== done $(date) ===" >> /tmp/imggen.log
