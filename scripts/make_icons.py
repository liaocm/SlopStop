"""Draws the extension icon (a stop-sign octagon reading "AI") at each size."""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "icons"
SIZES = (16, 32, 48, 128)
BIG = 1024
RED = (204, 0, 0, 255)
WHITE = (255, 255, 255, 255)


def octagon(cx, cy, r):
    return [
        (cx + r * math.cos(math.radians(22.5 + 45 * i)),
         cy + r * math.sin(math.radians(22.5 + 45 * i)))
        for i in range(8)
    ]


def load_font(px):
    for name in (
        "/System/Library/Fonts/Supplemental/Arial Black.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
    ):
        try:
            return ImageFont.truetype(name, px)
        except OSError:
            continue
    return ImageFont.load_default(px)


def draw():
    img = Image.new("RGBA", (BIG, BIG), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = BIG / 2
    d.polygon(octagon(c, c, BIG * 0.5), fill=WHITE)
    d.polygon(octagon(c, c, BIG * 0.45), fill=RED)
    font = load_font(int(BIG * 0.46))
    d.text((c, c), "AI", font=font, fill=WHITE, anchor="mm")
    return img


def render(big, size):
    """Small sizes are full-bleed for legibility. The 128px icon doubles as the
    Chrome Web Store icon, which wants 96px of artwork with 16px of padding."""
    if size < 128:
        return big.resize((size, size), Image.LANCZOS)
    art = round(size * 96 / 128)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = (size - art) // 2
    canvas.paste(big.resize((art, art), Image.LANCZOS), (offset, offset))
    return canvas


def main():
    OUT.mkdir(exist_ok=True)
    big = draw()
    for size in SIZES:
        render(big, size).save(OUT / f"icon{size}.png")
        print(f"wrote icons/icon{size}.png")


if __name__ == "__main__":
    main()
