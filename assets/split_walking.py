"""Convert assets/sprites/cat walk.png (4x3 grid, RGB, black bg, with white
number labels above each cat) into 12 transparent, tightly-cropped PNG frames.
Uses connected-component detection so cats whose tails cross cell boundaries
aren't truncated. Output: assets/sprites/walk/cat_walk_01.png .. _12.png"""
from PIL import Image
from collections import deque
from pathlib import Path

SRC = Path(__file__).parent / "sprites" / "cat walk.png"
OUT_DIR = Path(__file__).parent / "sprites" / "walk"
OUT_DIR.mkdir(parents=True, exist_ok=True)

COLS, ROWS = 4, 3
FRAMES = COLS * ROWS

BLACK_CUTOFF = 30
FADE_CUTOFF = 80
WHITE_CUTOFF = 720
PURE_WHITE_MIN = 240        # min per-channel value for "digit" pixels (paws are < 240)
LABEL_SCAN_FRACTION = 0.5   # only look for digits in the top half of each cell
LABEL_ERASE_MARGIN = 4      # px halo around digit bbox to kill anti-aliased edges
PAD = 8
ALPHA_THRESHOLD = 24
MIN_AREA = 1500            # ignore tiny stray pixel clusters
DILATE = 2                 # merge components within this many px (whiskers, etc.)

img = Image.open(SRC).convert("RGBA")
W, H = img.size
cell_w, cell_h = W // COLS, H // ROWS
px = img.load()

# Pass 1: chroma-key. Erase black -> transparent and near-white -> transparent
# (the latter removes the "1".."12" digit labels).
for y in range(H):
    for x in range(W):
        r, g, b, _ = px[x, y]
        s = r + g + b
        if s <= BLACK_CUTOFF or s >= WHITE_CUTOFF:
            px[x, y] = (0, 0, 0, 0)
        elif s < FADE_CUTOFF:
            a = int(255 * (s - BLACK_CUTOFF) / (FADE_CUTOFF - BLACK_CUTOFF))
            px[x, y] = (r, g, b, a)

# Pass 1.5: erase the digit label in each cell. Find the bbox of pure-white
# pixels (digits) in the top half of each cell, then clear that bbox + halo.
# Cat fur/paws are off-white (< 240/channel) so they're left untouched.
scan_h = int(cell_h * LABEL_SCAN_FRACTION)
for r_idx in range(ROWS):
    for c_idx in range(COLS):
        cx0 = c_idx * cell_w
        cy0 = r_idx * cell_h
        dminx = dminy = 10**9
        dmaxx = dmaxy = -1
        for y in range(cy0, cy0 + scan_h):
            for x in range(cx0, cx0 + cell_w):
                r, g, b, _ = px[x, y]
                if r >= PURE_WHITE_MIN and g >= PURE_WHITE_MIN and b >= PURE_WHITE_MIN:
                    if x < dminx: dminx = x
                    if x > dmaxx: dmaxx = x
                    if y < dminy: dminy = y
                    if y > dmaxy: dmaxy = y
        if dmaxx < 0:
            continue
        x0 = max(cx0, dminx - LABEL_ERASE_MARGIN)
        x1 = min(cx0 + cell_w, dmaxx + 1 + LABEL_ERASE_MARGIN)
        y0 = max(cy0, dminy - LABEL_ERASE_MARGIN)
        y1 = min(cy0 + cell_h, dmaxy + 1 + LABEL_ERASE_MARGIN)
        for y in range(y0, y1):
            for x in range(x0, x1):
                px[x, y] = (0, 0, 0, 0)

alpha = img.split()[-1].load()

# Pass 2: dilated mask -> connected components -> per-cat bboxes.
mask = [[alpha[x, y] > ALPHA_THRESHOLD for x in range(W)] for y in range(H)]
if DILATE > 0:
    dilated = [[False] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if mask[y][x]:
                for dy in range(-DILATE, DILATE + 1):
                    ny = y + dy
                    if 0 <= ny < H:
                        for dx in range(-DILATE, DILATE + 1):
                            nx = x + dx
                            if 0 <= nx < W:
                                dilated[ny][nx] = True
    mask = dilated

visited = [[False] * W for _ in range(H)]
boxes = []
for y0 in range(H):
    for x0 in range(W):
        if not mask[y0][x0] or visited[y0][x0]:
            continue
        q = deque([(x0, y0)])
        visited[y0][x0] = True
        minx = maxx = x0
        miny = maxy = y0
        area = 0
        while q:
            x, y = q.popleft()
            area += 1
            if x < minx: minx = x
            if x > maxx: maxx = x
            if y < miny: miny = y
            if y > maxy: maxy = y
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and mask[ny][nx] and not visited[ny][nx]:
                    visited[ny][nx] = True
                    q.append((nx, ny))
        if area >= MIN_AREA:
            boxes.append((minx, miny, maxx + 1, maxy + 1))

# Sort cats into reading order: group by row (vertical overlap), then by x.
boxes.sort(key=lambda b: (b[1], b[0]))
rows = []
for b in boxes:
    placed = False
    for row in rows:
        if any(not (b[3] <= rb[1] or b[1] >= rb[3]) for rb in row):
            row.append(b)
            placed = True
            break
    if not placed:
        rows.append([b])
rows.sort(key=lambda r: min(b[1] for b in r))
ordered = [b for row in rows for b in sorted(row, key=lambda b: b[0])]

if len(ordered) != FRAMES:
    print(f"WARNING: detected {len(ordered)} components, expected {FRAMES}")

# Pass 3: unify dimensions. Bottom-align so feet share a common ground line.
max_w = max(b[2] - b[0] for b in ordered) + PAD * 2
max_h = max(b[3] - b[1] for b in ordered) + PAD * 2

for old in OUT_DIR.glob("cat_walk_*.png"):
    old.unlink()

for i, (l, t, r, b) in enumerate(ordered, start=1):
    crop = img.crop((l, t, r, b))
    canvas = Image.new("RGBA", (max_w, max_h), (0, 0, 0, 0))
    cw_i, ch_i = crop.size
    ox = (max_w - cw_i) // 2
    oy = max_h - ch_i - PAD  # bottom-align with PAD below feet
    canvas.paste(crop, (ox, oy), crop)
    out_path = OUT_DIR / f"cat_walk_{i:02d}.png"
    canvas.save(out_path)
    print(f"  {out_path.name}  src={crop.size}  canvas={canvas.size}")

print(f"Done. {len(ordered)} frames at {max_w}x{max_h}")
