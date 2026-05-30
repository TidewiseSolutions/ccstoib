"""Remove solid edge-connected backgrounds from logo images (flood-fill)."""
from pathlib import Path
from collections import deque

from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "assets"

LOGOS = [
    "CCST-logo5.png",
    "CCST-logo6.png",
    "CCST-logo7.png",
    "CCST-logo8.png",
    "CCST-logo9.png",
    "CCST-logo10.png",
    "CCST-logo11.png",
    "CCSTt-logo.jpg",
    "CCSTt-logo1.png",
    "CCSTt-logo2.png",
    "CCSTt-logo3.png",
    "CCSTt-logo4.png",
]

TOLERANCE = 38


def color_close(a, b, tol):
    return all(abs(x - y) <= tol for x, y in zip(a, b))


def dominant_edge_color(pixels, w, h):
    samples = []
    for x in range(w):
        samples.append(pixels[x, 0][:3])
        samples.append(pixels[x, h - 1][:3])
    for y in range(h):
        samples.append(pixels[0, y][:3])
        samples.append(pixels[w - 1, y][:3])
    # Most common rounded bucket
    buckets = {}
    for r, g, b in samples:
        key = (r // 8, g // 8, b // 8)
        buckets[key] = buckets.get(key, 0) + 1
    best = max(buckets, key=buckets.get)
    return tuple(c * 8 + 4 for c in best)


def remove_background(path: Path, tolerance: int = TOLERANCE) -> Path:
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    pixels = img.load()
    bg = dominant_edge_color(pixels, w, h)

    transparent = set()
    queue = deque()

    def try_add(x, y):
        if (x, y) in transparent:
            return
        if x < 0 or y < 0 or x >= w or y >= h:
            return
        r, g, b, a = pixels[x, y]
        if a < 10:
            transparent.add((x, y))
            queue.append((x, y))
            return
        if color_close((r, g, b), bg, tolerance):
            transparent.add((x, y))
            queue.append((x, y))

    for x in range(w):
        try_add(x, 0)
        try_add(x, h - 1)
    for y in range(h):
        try_add(0, y)
        try_add(w - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            try_add(nx, ny)

    for x, y in transparent:
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)

    out = path.with_suffix(".png")
    img.save(out, "PNG", optimize=True)
    if path.suffix.lower() != ".png" and path.exists():
        path.unlink()
    return out


def main():
    for name in LOGOS:
        src = ASSETS / name
        if not src.exists():
            print(f"skip missing: {name}")
            continue
        out = remove_background(src)
        print(f"ok: {src.name} -> {out.name}")


if __name__ == "__main__":
    main()
