#!/usr/bin/env python3
"""
One-off: bake true alpha from ChatGPT exports that embed fake checkerboard / white matting.

Removes pixels that are (a) near-white or (b) light *neutral* greys (checkerboard),
while keeping saturated colours (logo gradient).
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "ChatGPT Image May 4, 2026, 04_03_41 PM.png"
OUT = ROOT / "public" / "brand-mark.png"


def main() -> None:
    if not SRC.is_file():
        raise SystemExit(f"Missing source: {SRC}")

    img = Image.open(SRC).convert("RGBA")
    px = img.load()
    w, h = img.size

    # Low saturation + light => checker / paper white margin
    sat_max = 22
    lum_min = 188
    white_floor = 242

    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            mx = max(r, g, b)
            mn = min(r, g, b)
            sat = mx - mn
            lum = (r + g + b) / 3.0

            kill = False
            if r >= white_floor and g >= white_floor and b >= white_floor:
                kill = True
            elif sat <= sat_max and lum >= lum_min:
                kill = True

            if kill:
                px[x, y] = (r, g, b, 0)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, format="PNG", optimize=True)
    print(f"Wrote {OUT} ({w}x{h})")


if __name__ == "__main__":
    main()
