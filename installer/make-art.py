"""Draws the installer pictures: the Windows setup wizard's sidebar, header and icon, and the Mac .dmg
window background. Same look as the app: dark night sky, falling white dots, the home screen's tile colours.

Run from the repo root after changing the design:  python3 installer/make-art.py
Needs Pillow and the Inter font (falls back to DejaVu Sans).
"""
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON = Image.open(os.path.join(ROOT, "src", "icon.png")).convert("RGBA")
SS = 4  # draw everything this many times bigger, then shrink it, for smooth edges

TOP = (21, 28, 48)
BOTTOM = (9, 12, 21)
WHITE = (255, 255, 255)
MUTED = (154, 163, 184)
# The home screen tiles: Quick submit, Log study, Send report, Teachers, Donate, Coming soon.
TILES = [
    ((34, 211, 238), (14, 116, 144)),
    ((79, 125, 255), (43, 79, 216)),
    ((47, 209, 139), (14, 154, 106)),
    ((169, 112, 255), (106, 61, 240)),
    ((255, 111, 168), (224, 48, 111)),
    ((74, 82, 104), (44, 50, 66)),
]


def font(size, weight="Bold"):
    for path in (f"/usr/share/fonts/opentype/inter/Inter-{weight}.otf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        if os.path.exists(path):
            return ImageFont.truetype(path, int(size * SS))
    return ImageFont.load_default()


def gradient(w, h, top, bottom, diagonal=False):
    """A top-to-bottom (or top-left to bottom-right) colour fade."""
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w) if diagonal else [0]:
            t = (x / w + y / h) / 2 if diagonal else y / max(1, h - 1)
            colour = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
            if diagonal:
                px[x, y] = colour
            else:
                for xx in range(w):
                    px[xx, y] = colour
    return img


def night_sky(w, h, seed, dots=1.0, glow=(0.5, 0.0)):
    """Dark gradient, a soft blue glow and scattered white dots (drawn at SS scale)."""
    W, H = w * SS, h * SS
    sky = gradient(w, h, TOP, BOTTOM).resize((W, H)).convert("RGBA")
    halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gx, gy, r = glow[0] * W, glow[1] * H, max(W, H) * 0.55
    ImageDraw.Draw(halo).ellipse((gx - r, gy - r, gx + r, gy + r), fill=(79, 125, 255, 46))
    sky.alpha_composite(halo.filter(ImageFilter.GaussianBlur(r / 2.2)))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    rnd = random.Random(seed)
    for _ in range(int(w * h / 260 * dots)):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        size = rnd.choice([0.6, 0.8, 1.0, 1.0, 1.3, 1.7]) * SS
        draw.ellipse((x - size, y - size, x + size, y + size), fill=(255, 255, 255, rnd.randint(70, 230)))
    sky.alpha_composite(layer)
    return sky


def paste_icon(img, size, cx, cy, glow=True):
    size *= SS
    icon = ICON.resize((int(size), int(size)), Image.LANCZOS)
    x, y = int(cx * SS - size / 2), int(cy * SS - size / 2)
    if glow:
        halo = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(halo).rounded_rectangle((x, y + size * 0.08, x + size, y + size * 1.04), radius=size * 0.25,
                                               fill=(59, 110, 245, 150))
        img.alpha_composite(halo.filter(ImageFilter.GaussianBlur(size * 0.14)))
    img.alpha_composite(icon, (x, y))


def tile(img, x, y, size, colours, radius=0.28):
    """One home-screen style tile (top-left corner x, y in final pixels)."""
    s = int(size * SS)
    face = gradient(s, s, colours[0], colours[1], diagonal=True).convert("RGBA")
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=s * radius, fill=255)
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x * SS, (y + 2) * SS, x * SS + s, (y + 2) * SS + s), radius=s * radius,
                                             fill=(0, 0, 0, 140))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(3 * SS)))
    img.paste(face, (int(x * SS), int(y * SS)), mask)


def text(img, xy, words, size, colour=WHITE, weight="Bold", anchor="mm"):
    ImageDraw.Draw(img).text((xy[0] * SS, xy[1] * SS), words, font=font(size, weight), fill=colour, anchor=anchor)


def finish(img, w, h):
    return img.resize((w, h), Image.LANCZOS).convert("RGB")


# ---------- Windows: setup wizard ----------

def sidebar():
    """Left-hand picture on the Welcome and Finish pages (NSIS wants 164 x 314)."""
    w, h = 164, 314
    img = night_sky(w, h, seed=7, glow=(0.5, 0.12))
    paste_icon(img, 66, w / 2, 62)
    text(img, (w / 2, 122), "Smart School", 18.5)
    text(img, (w / 2, 145), "Tool", 18.5)
    text(img, (w / 2, 170), "Study · Submit · Report", 10, MUTED, "Medium")
    size, gap = 30, 10
    left = (w - (3 * size + 2 * gap)) / 2
    for i, colours in enumerate(TILES):
        tile(img, left + (i % 3) * (size + gap), 204 + (i // 3) * (size + gap), size, colours)
    text(img, (w / 2, 296), "Free · Updates itself", 9.5, MUTED, "Medium")
    return finish(img, w, h)


def header():
    """Picture at the right of the top bar on the other pages (NSIS wants 150 x 57)."""
    w, h = 150, 57
    img = night_sky(w, h, seed=3, dots=1.4, glow=(0.85, 0.5))
    # Fade into the plain header colour on the left so the page title sits on a clean background.
    fade = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    px = fade.load()
    for x in range(w * SS):
        a = max(0, 255 - int(255 * x / (w * SS * 0.55)))
        for y in range(h * SS):
            px[x, y] = (11, 15, 26, a)
    img.alpha_composite(fade)
    paste_icon(img, 38, w - 30, h / 2)
    return finish(img, w, h)


# ---------- Mac: the .dmg window ----------

def dmg(scale):
    """Window background for the .dmg (540 x 380 points; scale 2 is the Retina copy). The app icon and the
    Applications folder are placed on the coloured card by mac/electron-builder.yml (x 150 / 390, y 196)."""
    w, h = 540 * scale, 380 * scale
    img = night_sky(w, h, seed=11, dots=0.8 / scale, glow=(0.5, 0.0))
    s = scale
    text(img, (w / 2, 42 * s), "Smart School Tool", 24 * s)
    text(img, (w / 2, 70 * s), "Drag the app into Applications to install it", 13 * s, MUTED, "Medium")

    # The card the two icons sit on. Its colour is mid-bright on purpose: Finder writes the icon names in
    # black (light mode) or white (dark mode), and both stay readable on it.
    x0, y0, x1, y1 = 48 * s, 100 * s, 492 * s, 292 * s
    cw, ch = x1 - x0, y1 - y0
    card = gradient(cw * SS // 4, ch * SS // 4, (84, 122, 245), (128, 94, 235), diagonal=True).resize((cw * SS, ch * SS))
    mask = Image.new("L", (cw * SS, ch * SS), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, cw * SS - 1, ch * SS - 1), radius=26 * s * SS, fill=255)
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x0 * SS, (y0 + 8 * s) * SS, x1 * SS, (y1 + 8 * s) * SS),
                                             radius=26 * s * SS, fill=(0, 0, 0, 150))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(14 * s * SS)))
    img.paste(card.convert("RGBA"), (x0 * SS, y0 * SS), mask)
    shine = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shine).rounded_rectangle((x0 * SS, y0 * SS, x1 * SS, y1 * SS), radius=26 * s * SS,
                                            outline=(255, 255, 255, 70), width=int(1.5 * s * SS))
    img.alpha_composite(shine)

    # Arrow from the app to Applications.
    d = ImageDraw.Draw(img)
    y = 196 * s * SS
    xa, xb = 222 * s * SS, 318 * s * SS
    dash, gapw, width = 9 * s * SS, 7 * s * SS, int(4 * s * SS)
    x = xa
    while x < xb - 16 * s * SS:
        d.line((x, y, min(x + dash, xb - 16 * s * SS), y), fill=(255, 255, 255, 235), width=width)
        x += dash + gapw
    head = 14 * s * SS
    d.line((xb - head, y - head, xb, y), fill=(255, 255, 255, 235), width=width, joint="curve")
    d.line((xb - head, y + head, xb, y), fill=(255, 255, 255, 235), width=width, joint="curve")
    for cx in (xb,):
        d.ellipse((cx - width / 2, y - width / 2, cx + width / 2, y + width / 2), fill=(255, 255, 255, 235))

    text(img, (w / 2, 322 * s), "Mac says it can't verify the app? Click Done, then open", 11 * s, MUTED, "Medium")
    text(img, (w / 2, 340 * s), "System Settings → Privacy & Security → Open Anyway", 11 * s, (210, 218, 235), "SemiBold")
    return finish(img, w, h)


def main():
    win = os.path.join(ROOT, "windows", "installer")
    mac = os.path.join(ROOT, "mac", "dmg")
    os.makedirs(win, exist_ok=True)
    os.makedirs(mac, exist_ok=True)
    sidebar().save(os.path.join(win, "sidebar.bmp"))
    header().save(os.path.join(win, "header.bmp"))
    ICON.save(os.path.join(win, "icon.ico"), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    dmg(1).save(os.path.join(mac, "background.png"))
    dmg(2).save(os.path.join(mac, "background@2x.png"))
    print("Installer pictures written to windows/installer and mac/dmg")


if __name__ == "__main__":
    main()
