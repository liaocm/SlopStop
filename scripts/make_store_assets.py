"""Builds the Chrome Web Store listing images from the raw captures.

Run `npm run screenshots` first (writes store/raw/), then:

    python3 scripts/make_store_assets.py

Writes:
    store/screenshots/*.png   1280x800, no alpha (store requirement)
    store/promo-small-440x280.png
    store/promo-marquee-1400x560.png
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "store" / "raw"
STORE = ROOT / "store"
SHOTS = STORE / "screenshots"

RED = (204, 0, 0)
DARK_RED = (110, 0, 0)
WHITE = (255, 255, 255)
FONT_DIR = Path("/System/Library/Fonts/Supplemental")


def font(name, px):
    return ImageFont.truetype(str(FONT_DIR / name), px)


def octagon(cx, cy, r):
    return [
        (cx + r * math.cos(math.radians(22.5 + 45 * i)),
         cy + r * math.sin(math.radians(22.5 + 45 * i)))
        for i in range(8)
    ]


def stop_sign(size):
    """The extension icon, drawn at any size."""
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon(octagon(s / 2, s / 2, s * 0.5), fill=WHITE)
    d.polygon(octagon(s / 2, s / 2, s * 0.45), fill=RED)
    d.text((s / 2, s / 2), "AI", font=font("Arial Black.ttf", int(s * 0.46)),
           fill=WHITE, anchor="mm")
    return img.resize((size, size), Image.LANCZOS)


def gradient(w, h, top, bottom):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)],
               fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    return img


def pill(draw, center, text, fnt, fill=(15, 15, 15), fg=WHITE, pad=(18, 10)):
    left, top, right, bottom = draw.textbbox((0, 0), text, font=fnt)
    w, h = right - left + pad[0] * 2, bottom - top + pad[1] * 2
    x, y = center[0] - w / 2, center[1] - h / 2
    draw.rounded_rectangle([x, y, x + w, y + h], radius=h / 2, fill=fill)
    draw.text((center[0], center[1]), text, font=fnt, fill=fg, anchor="mm")


def save_rgb(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(path, optimize=True)
    print(f"wrote {path.relative_to(ROOT)}")


def screenshots():
    search = Image.open(RAW / "search.png")
    with_overlay = Image.open(RAW / "channel.png").convert("RGB")
    without = Image.open(RAW / "channel-without.png").convert("RGB")
    for img in (search, with_overlay, without):
        assert img.size == (1280, 800), img.size

    save_rgb(search, SHOTS / "1-search-results.png")
    save_rgb(with_overlay, SHOTS / "2-channel-grid.png")

    # Before/after: left side as YouTube shows it, right side with SlopStopper.
    # The split runs through the middle column of the channel's video grid.
    split = 668
    combo = without.copy()
    combo.paste(with_overlay.crop((split, 0, 1280, 800)), (split, 0))
    d = ImageDraw.Draw(combo)
    d.rectangle([split - 2, 56, split + 2, 800], fill=RED)
    label = font("Arial Bold.ttf", 24)
    pill(d, (520, 144), "Without SlopStopper", label)
    pill(d, (974, 144), "With SlopStopper", label, fill=RED)
    save_rgb(combo, SHOTS / "3-before-after.png")


def promo_small():
    w, h = 440, 280
    img = gradient(w, h, RED, DARK_RED)
    icon = stop_sign(150)
    img.paste(icon, (34, (h - 150) // 2), icon)
    d = ImageDraw.Draw(img)
    d.text((206, h / 2 - 6), "Slop", font=font("Arial Black.ttf", 52), fill=WHITE, anchor="ls")
    d.text((206, h / 2 + 50), "Stopper", font=font("Arial Black.ttf", 52), fill=WHITE, anchor="ls")
    save_rgb(img, STORE / "promo-small-440x280.png")


def promo_marquee():
    w, h = 1400, 560
    img = gradient(w, h, RED, DARK_RED)

    # Right: a tilted card cut from the channel screenshot.
    shot = Image.open(RAW / "channel.png").convert("RGB").crop((120, 170, 1220, 700))
    shot = shot.resize((660, round(660 * shot.height / shot.width)), Image.LANCZOS)
    card = Image.new("RGBA", (shot.width + 24, shot.height + 24), (0, 0, 0, 0))
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, *shot.size], radius=18, fill=255)
    card.paste(shot, (12, 12), mask)
    card = card.rotate(-4, resample=Image.BICUBIC, expand=True)
    shadow = Image.new("RGBA", card.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 140), mask=card.split()[3])
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    x, y = w - card.width - 60, (h - card.height) // 2
    img.paste(shadow, (x + 10, y + 16), shadow)
    img.paste(card, (x, y), card)

    # Left: icon and name.
    icon = stop_sign(170)
    img.paste(icon, (80, 110), icon)
    d = ImageDraw.Draw(img)
    d.text((80, 390), "SlopStopper", font=font("Arial Black.ttf", 64), fill=WHITE, anchor="ls")
    d.text((82, 440), "Spot AI-labeled videos before you click.",
           font=font("Arial Bold.ttf", 28), fill=(255, 225, 225), anchor="ls")
    save_rgb(img, STORE / "promo-marquee-1400x560.png")


def main():
    screenshots()
    promo_small()
    promo_marquee()


if __name__ == "__main__":
    main()
