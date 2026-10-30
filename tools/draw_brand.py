# Draws the brand art after the Morellonomicon item into Assets/brand/: the logo (a padded purple tome in perspective, gold corner caps,
# three green claws bursting out of the cover, a fluttering ribbon, churning green fire) and the opening screen that uses it.
# Our own drawing, no Riot art. The book is modelled in 3D and projected, so every edge bows with the perspective.
# Run from the repo root: python3 -I tools/draw_brand.py
import math, random, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "Assets/brand"

# ---------- the book in 3D ----------
BOOK_W, BOOK_D, BOOK_T = 300, 230, 78     # width (x), depth (y), thickness (z)
BULGE = 20                                # how far the padded edges bow outwards
PUFF = 18                                 # how high the cover's middle rises
YAW, PITCH, ROLL = -30, 42, -10            # degrees: turn on the table, tilt towards the viewer, lean
CAM = 620                                 # camera distance (smaller = stronger perspective)
EDGE_N = 28                               # points per edge

def project(x, y, z, cx, cy, s):
    a = math.radians(YAW); x, y = x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)
    p = math.radians(PITCH); y, z = y * math.cos(p) - z * math.sin(p), y * math.sin(p) + z * math.cos(p)
    r = math.radians(ROLL); x, y = x * math.cos(r) - y * math.sin(r), x * math.sin(r) + y * math.cos(r)
    k = CAM / (CAM - z)
    return (cx + x * k * s, cy + y * k * s, z)

CORNERS = [(-1, -1), (1, -1), (1, 1), (-1, 1)]   # back-left, back-right, front-right, front-left

def outline(inset=0.0, z=0.0, bulge=BULGE, puff=0.0):
    """The cover's outline in 3D: four bowed edges, each EDGE_N points, starting at a corner."""
    hw, hd = BOOK_W / 2 - inset, BOOK_D / 2 - inset
    pts = []
    for i in range(4):
        (ax, ay), (bx, by) = CORNERS[i], CORNERS[(i + 1) % 4]
        nx, ny = (ay + by) / 2, -(ax + bx) / 2   # outward normal of this edge
        nx, ny = -ny if False else (ax + bx) / 2, (ay + by) / 2
        for j in range(EDGE_N):
            t = j / EDGE_N
            x = (ax + (bx - ax) * t) * hw; y = (ay + (by - ay) * t) * hd
            b = math.sin(math.pi * t)
            pts.append((x + nx * bulge * b, y + ny * bulge * b, z + puff * b))
    return pts

def path(pts, close=True):
    d = f"M{pts[0][0]:.1f} {pts[0][1]:.1f}" + "".join(f" L{x:.1f} {y:.1f}" for x, y, *_ in pts[1:])
    return d + (" Z" if close else "")

def book_svg(cx, cy, s):
    P = lambda q: project(q[0], q[1], q[2], cx, cy, s)
    top = outline(z=BOOK_T, puff=PUFF)
    bot = outline(z=0)
    pages_top, pages_bot = outline(inset=8, z=BOOK_T - 7, bulge=BULGE * 0.8), outline(inset=8, z=7, bulge=BULGE * 0.8)
    out = []
    # back cover slab
    out.append(f'<path d="{path([P(q) for q in bot])}" fill="#1A1028"/>')
    # side faces facing the viewer: front-right (pages) and front-left (spine)
    def side(i, upper, lower):
        a = [P(q) for q in upper[i * EDGE_N:(i + 1) * EDGE_N + 1] + ([upper[0]] if i == 3 else [])]
        b = [P(q) for q in lower[i * EDGE_N:(i + 1) * EDGE_N + 1] + ([lower[0]] if i == 3 else [])]
        return a, b
    # pages on edge 1 (back-right → front-right) and edge 2 (front-right → front-left)
    for i in (1, 2):
        a, b = side(i, pages_top, pages_bot)
        out.append(f'<path d="{path(a + b[::-1])}" fill="url(#bpages)"/>')
        for k in range(1, 9):   # page lines following the bow
            f = k / 9
            line = [(a[j][0] + (b[j][0] - a[j][0]) * f, a[j][1] + (b[j][1] - a[j][1]) * f) for j in range(len(a))]
            out.append(f'<path d="{path(line, False)}" fill="none" stroke="#8C7F62" stroke-width="{0.6 + (k % 3 == 0) * 0.5}" opacity="0.7"/>')
    # spine on edge 3 (front-left → back-left), dark leather with gold trims
    a, b = side(3, top, bot)
    out.append(f'<path d="{path(a + b[::-1])}" fill="url(#bspine)"/>')
    for f in (0.18, 0.82):
        line = [(a[j][0] + (b[j][0] - a[j][0]) * f, a[j][1] + (b[j][1] - a[j][1]) * f) for j in range(len(a))]
        out.append(f'<path d="{path(line, False)}" fill="none" stroke="url(#bgold)" stroke-width="{5 * s:.1f}" stroke-linecap="round"/>')
    # front cover thickness on edges 1 and 2 (a thin lip above the pages)
    lip = outline(z=BOOK_T - 8)
    for i in (1, 2):
        a, b = side(i, top, lip)
        out.append(f'<path d="{path(a + b[::-1])}" fill="#2A1A40"/>')
    # the cover
    tp = [P(q) for q in top]
    out.append(f'<path d="{path(tp)}" fill="url(#bcover)" stroke="#120A1C" stroke-width="{3 * s:.1f}"/>')
    out.append(f'<path d="{path(tp)}" fill="url(#bsheen)"/>')
    out.append(f'<path d="{path(tp)}" fill="#000" filter="url(#bleather)" opacity="0.5"/>')
    # the edges of the padded cover fall into shadow; a soft crease runs across it
    out.append(f'<clipPath id="bcov{int(cx)}"><path d="{path(tp)}"/></clipPath>')
    out.append(f'<g clip-path="url(#bcov{int(cx)})"><path d="{path(tp)}" fill="none" stroke="#0C0616" stroke-width="{34 * s:.1f}" opacity="0.75" filter="url(#bglow)"/>'
               + "".join(f'<path d="{path([P(q) for q in outline(inset=i, z=BOOK_T + PUFF * 0.5, bulge=BULGE * 0.8)], True)}" fill="none" stroke="#1A0F2C" stroke-width="{1.2 * s:.1f}" opacity="0.5"/>' for i in (52, 70))
               + '</g>')
    # embossed inner panel
    inner = [P(q) for q in outline(inset=30, z=BOOK_T + PUFF * 0.6, bulge=BULGE * 0.7)]
    out.append(f'<path d="{path(inner)}" fill="none" stroke="#1C1230" stroke-width="{6 * s:.1f}" stroke-linejoin="round"/>')
    out.append(f'<path d="{path(inner)}" fill="none" stroke="#9C7FD0" stroke-width="{1.4 * s:.1f}" opacity="0.55" transform="translate({-1.5 * s:.1f} {-1.5 * s:.1f})"/>')
    # gold corner caps (triangles that fold over the edge), three rivet holes each
    caps = []
    for ci, (ax, ay) in enumerate(CORNERS):
        hw, hd, L = BOOK_W / 2, BOOK_D / 2, 84
        c3 = (ax * hw, ay * hd, BOOK_T + 1.5)
        e1 = (ax * hw - ax * L, ay * hd, BOOK_T + 1.5 + PUFF * 0.25)
        e2 = (ax * hw, ay * hd - ay * L * 0.85, BOOK_T + 1.5 + PUFF * 0.25)
        m = ((e1[0] + e2[0]) / 2 - ax * 6, (e1[1] + e2[1]) / 2 - ay * 6, BOOK_T + 3)   # the cut edge curves in
        tri = [P(c3), P(e1), P(m), P(e2)]
        d = f"M{tri[0][0]:.1f} {tri[0][1]:.1f} L{tri[1][0]:.1f} {tri[1][1]:.1f} Q{tri[2][0]:.1f} {tri[2][1]:.1f} {tri[3][0]:.1f} {tri[3][1]:.1f} Z"
        caps.append(f'<path d="{d}" fill="#4A3410" transform="translate({1.5 * s:.1f} {5 * s:.1f})"/>')
        caps.append(f'<path d="{d}" fill="url(#bgold)" stroke="#5E4518" stroke-width="{2 * s:.1f}" stroke-linejoin="round"/>')
        # bevel highlight along the cut edge
        caps.append(f'<path d="M{tri[1][0]:.1f} {tri[1][1]:.1f} Q{tri[2][0]:.1f} {tri[2][1]:.1f} {tri[3][0]:.1f} {tri[3][1]:.1f}" fill="none" stroke="#FFF1B8" stroke-width="{1.4 * s:.1f}" opacity="0.8"/>')
        for hx, hy in ((0.24, 0.24), (0.5, 0.18), (0.18, 0.5)):
            q = P((ax * hw - ax * L * hx, ay * hd - ay * L * 0.85 * hy, BOOK_T + 3))
            caps.append(f'<circle cx="{q[0]:.1f}" cy="{q[1]:.1f}" r="{6.4 * s:.1f}" fill="#3A220E" stroke="#8A6424" stroke-width="{1.2 * s:.1f}"/><circle cx="{q[0] + 1.2 * s:.1f}" cy="{q[1] + 1.4 * s:.1f}" r="{3.6 * s:.1f}" fill="#1A0E06"/>')
        # the cap folds down over the side on the two corners facing the viewer
        if ci in (2, 3, 1):
            f1 = P((ax * hw, ay * hd, BOOK_T - 14)); f2 = P((ax * hw - ax * 34, ay * hd, BOOK_T - 12)); f3 = P((ax * hw, ay * hd - ay * 30, BOOK_T - 12))
            caps.insert(0, f'<path d="M{tri[0][0]:.1f} {tri[0][1]:.1f} L{f2[0]:.1f} {f2[1]:.1f} L{f1[0]:.1f} {f1[1]:.1f} L{f3[0]:.1f} {f3[1]:.1f} Z" fill="#8A6A28" stroke="#5E4518" stroke-width="{1.5 * s:.1f}"/>')
    out += caps
    bp = [P(q) for q in bot]
    sil = tp[:EDGE_N] + bp[EDGE_N:4 * EDGE_N] + tp[EDGE_N * 3:]
    return "\n    ".join(out), sil

# ---------- the claws: three green blades bursting up out of the cover, curving down-left past its edge ----------
def crescent(p0, p1, bow, w):
    (x0, y0), (x1, y1) = p0, p1
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    dx, dy = x1 - x0, y1 - y0; L = math.hypot(dx, dy); nx, ny = -dy / L, dx / L
    c_out = (mx + nx * (bow + w), my + ny * (bow + w)); c_in = (mx + nx * (bow - w), my + ny * (bow - w))
    return f"M{x0:.1f} {y0:.1f} Q{c_out[0]:.1f} {c_out[1]:.1f} {x1:.1f} {y1:.1f} Q{c_in[0]:.1f} {c_in[1]:.1f} {x0:.1f} {y0:.1f} Z"

def claws(cx, cy, s, ids=False, parts=False):
    C = [((-70, -96), (-138, 120), 40, 17), ((-14, -112), (-72, 150), 48, 21), ((42, -92), (-8, 140), 40, 16)]   # start, end (rel. to centre), bow, width
    out = []
    for i, ((sx, sy), (ex, ey), bow, w) in enumerate(C):
        p0, p1 = (cx + sx * s, cy + sy * s), (cx + ex * s, cy + ey * s)
        gid = f' id="claw{i}"' if ids else ""
        out.append(f'<g{gid}>'
                   f'<path d="{crescent(p0, p1, bow * s, w * s * 1.9)}" fill="#8FF050" opacity="0.8" filter="url(#bglow)"/>'
                   f'<path d="{crescent((p0[0] + 4 * s, p0[1] + 6 * s), (p1[0] + 6 * s, p1[1] + 2 * s), bow * s, w * s * 0.9)}" fill="#0E0716" opacity="0.75"/>'
                   f'<path d="{crescent(p0, p1, bow * s, w * s * 1.12)}" fill="#1D5A12"/>'
                   f'<path d="{crescent(p0, p1, bow * s, w * s)}" fill="url(#bclaw)"/>'
                   f'<path d="{crescent(p0, p1, bow * s * 1.06, w * s * 0.32)}" fill="#F6FFE2" opacity="0.92"/>'
                   f'</g>')
    if parts:
        return [(out[i], (cx + C[i][0][0] * s, cy + C[i][0][1] * s)) for i in range(3)]
    return "\n    ".join(out)

# ---------- the ribbon: a magenta strip from under the pages, fluttering out to the right with a forked end ----------
def ribbon(cx, cy, s):
    pts = []
    N = 34
    for i in range(N + 1):
        t = i / N
        x = cx + (20 + 150 * t) * s
        y = cy + (96 + 34 * math.sin(t * 3.4 + 0.4) - 10 * t) * s
        tw = math.cos(t * 5.2 + 0.6)                   # the twist: the strip turns its edge to us and back
        w = (17 + 4 * t) * s * (0.28 + 0.72 * abs(tw))
        pts.append((x, y, w, tw))
    segs = []
    for i in range(N):
        (x0, y0, w0, t0), (x1, y1, w1, t1) = pts[i], pts[i + 1]
        dx, dy = x1 - x0, y1 - y0; L = math.hypot(dx, dy) or 1; nx, ny = -dy / L, dx / L
        light = 0.5 + 0.5 * t0
        col = "#%02X%02X%02X" % (int(110 + 110 * light), int(28 + 60 * light), int(80 + 90 * light))
        segs.append(f'<path d="M{x0 + nx * w0:.1f} {y0 + ny * w0:.1f} L{x1 + nx * w1:.1f} {y1 + ny * w1:.1f} L{x1 - nx * w1:.1f} {y1 - ny * w1:.1f} L{x0 - nx * w0:.1f} {y0 - ny * w0:.1f} Z" fill="{col}" stroke="{col}" stroke-width="0.8"/>')
    x, y, w, _ = pts[-1]
    segs.append(f'<path d="M{x:.1f} {y - w:.1f} L{x + 22 * s:.1f} {y - w - 6 * s:.1f} L{x + 10 * s:.1f} {y:.1f} L{x + 22 * s:.1f} {y + w + 6 * s:.1f} L{x:.1f} {y + w:.1f} Z" fill="#B23A86"/>')
    return "".join(segs)

DEFS = """
    <radialGradient id="bbg" cx="0.5" cy="0.48" r="0.72"><stop offset="0" stop-color="#1B3A18"/><stop offset="0.55" stop-color="#0E1F0E"/><stop offset="1" stop-color="#050A05"/></radialGradient>
    <radialGradient id="bvig" cx="0.5" cy="0.5" r="0.72"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></radialGradient>
    <linearGradient id="bcover" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="#6B4A9E"/><stop offset="0.45" stop-color="#432A6E"/><stop offset="1" stop-color="#1C1030"/></linearGradient>
    <radialGradient id="bsheen" cx="0.45" cy="0.35" r="0.55"><stop offset="0" stop-color="#C9B2FF" stop-opacity="0.28"/><stop offset="1" stop-color="#C9B2FF" stop-opacity="0"/></radialGradient>
    <linearGradient id="bspine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A2558"/><stop offset="1" stop-color="#160D24"/></linearGradient>
    <linearGradient id="bpages" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EDE3C6"/><stop offset="1" stop-color="#A89A78"/></linearGradient>
    <linearGradient id="bgold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF0B0"/><stop offset="0.35" stop-color="#E2B95A"/><stop offset="0.7" stop-color="#A97E2E"/><stop offset="1" stop-color="#6A4A16"/></linearGradient>
    <linearGradient id="bclaw" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#E8FFB8"/><stop offset="0.35" stop-color="#A6EC5E"/><stop offset="1" stop-color="#3E9A22"/></linearGradient>
    <filter id="bglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="bleather" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.2" result="a"/>
      <feComposite in="a" in2="SourceGraphic" operator="in"/></filter>"""

def fire_defs(anim=False):
    # in the opening screen the fire starts wild on the landing, then breathes
    flare = ('<animate attributeName="scale" values="320;95" begin="0.85s" dur="1s" fill="freeze"/>'
             '<animate attributeName="scale" values="95;125;80;95" begin="1.85s" dur="6s" repeatCount="indefinite"/>' if anim else "")
    churn = ('<animate attributeName="baseFrequency" values="0.028 0.007;0.034 0.009;0.025 0.008;0.028 0.007" dur="9s" repeatCount="indefinite"/>' if anim else "")
    return f"""
    <filter id="bfire" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.028 0.007" numOctaves="4" seed="8" result="t">{churn}</feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="95" xChannelSelector="R" yChannelSelector="G" result="d">{flare}</feDisplacementMap>
      <feGaussianBlur in="d" stdDeviation="2.2"/></filter>
    <filter id="bsmoke" x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.045 0.012" numOctaves="3" seed="21" result="t">{churn.replace('0.028 0.007', '0.045 0.012').replace('0.034 0.009', '0.052 0.014').replace('0.025 0.008', '0.04 0.013')}</feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="44" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="4"/></filter>"""

def fire(cx, cy, s):
    """Green fire around the book: big soft licks behind, brighter tongues, all torn by the turbulence."""
    random.seed(5)
    back, mid, hot = [], [], []
    for k in range(26):
        a = k / 26 * 2 * math.pi
        rx, ry = 190 * s, 150 * s
        x, y = cx + math.cos(a) * rx, cy + math.sin(a) * ry
        h = (90 + random.random() * 90) * s * (1.3 if math.sin(a) < 0 else 0.8)
        w = (46 + random.random() * 30) * s
        tongue = f"M{x - w:.1f} {y + w * 0.4:.1f} C{x - w:.1f} {y - h * 0.4:.1f} {x - w * 0.1:.1f} {y - h * 0.7:.1f} {x + w * 0.15:.1f} {y - h:.1f} C{x + w * 0.4:.1f} {y - h * 0.55:.1f} {x + w:.1f} {y - h * 0.3:.1f} {x + w:.1f} {y + w * 0.4:.1f} Z"
        back.append(f'<path d="{tongue}"/>')
        if k % 2 == 0:
            mid.append(f'<path d="{tongue}" transform="translate({x:.1f} {y:.1f}) scale(0.62) translate({-x:.1f} {-y:.1f})"/>')
        if k % 3 == 0:
            hot.append(f'<path d="{tongue}" transform="translate({x:.1f} {y:.1f}) scale(0.34) translate({-x:.1f} {-y:.1f})"/>')
    return (f'<g filter="url(#bsmoke)" opacity="0.85"><ellipse cx="{cx}" cy="{cy + 10 * s:.1f}" rx="{230 * s:.1f}" ry="{190 * s:.1f}" fill="#0F2E0C" opacity="0.9"/>'
            f'<g fill="#1E5414" opacity="0.75">{"".join(back)}</g></g>'
            f'<g filter="url(#bfire)" opacity="0.65"><g fill="#3F9426" opacity="0.6">{"".join(mid)}</g><g fill="#A6EC6E" opacity="0.5">{"".join(hot)}</g></g>')

def wisps(cx, cy, s, n=9, seed=2):
    """Thin curling smoke wisps in front, crossing the book's edges (the tension of the item's picture)."""
    random.seed(seed); out = []
    for _ in range(n):
        a = random.random() * 2 * math.pi
        x, y = cx + math.cos(a) * 170 * s, cy + math.sin(a) * 130 * s
        L = (60 + random.random() * 80) * s; c = (random.random() - 0.5) * 80 * s
        out.append(f'<path d="M{x:.1f} {y:.1f} q{c:.1f} {-L / 2:.1f} {c * 0.3:.1f} {-L:.1f}" fill="none" stroke="#A6EC6E" stroke-width="{(3 + random.random() * 5) * s:.1f}" stroke-linecap="round" opacity="0.5"/>')
    return f'<g filter="url(#bsmoke)">{"".join(out)}</g>'

def sparks(cx, cy, s, n, anim=False, seed=9):
    random.seed(seed); out = []
    for _ in range(n):
        x, y = cx + (random.random() - 0.5) * 420 * s, cy + (random.random() - 0.4) * 360 * s
        r = (1.2 + random.random() * 2.4) * s
        if anim:
            d, b = 3 + random.random() * 4, random.random() * 5
            dx = (random.random() - 0.5) * 60
            out.append(f'<circle r="{r:.1f}" fill="#D8FFA8"><animate attributeName="cx" values="{x:.0f};{x + dx:.0f}" dur="{d:.1f}s" begin="{b:.1f}s" repeatCount="indefinite"/>'
                       f'<animate attributeName="cy" values="{y + 80 * s:.0f};{y - 220 * s:.0f}" dur="{d:.1f}s" begin="{b:.1f}s" repeatCount="indefinite"/>'
                       f'<animate attributeName="opacity" values="0;1;0.8;0" dur="{d:.1f}s" begin="{b:.1f}s" repeatCount="indefinite"/></circle>')
        else:
            out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="#D8FFA8" opacity="{0.4 + random.random() * 0.6:.2f}"/>')
    return "".join(out)

def emblem(cx, cy, s, anim=False):
    """Everything but the background: fire, book, claws, ribbon, wisps, sparks."""
    body, sil = book_svg(cx, cy - 6 * s, s)
    hug = path(sil)
    return f"""{fire(cx, cy, s)}
    <g filter="url(#bfire)" fill="none" stroke-linejoin="round">
      <path d="{hug}" stroke="#2E7E1C" stroke-width="{80 * s:.1f}" opacity="0.6"/>
      <path d="{hug}" stroke="#7FD84A" stroke-width="{36 * s:.1f}" opacity="0.7"/>
      <path d="{hug}" stroke="#E2FFB6" stroke-width="{8 * s:.1f}" opacity="0.75"/></g>
    <g>{body}</g>
    <path d="{hug}" fill="none" stroke="#B8F27E" stroke-width="{3 * s:.1f}" opacity="0.6" filter="url(#bglow)"/>
    {ribbon(cx, cy, s)}
    {claws(cx, cy, s, ids=anim)}
    {wisps(cx, cy, s)}"""

# ---------- the logo ----------
logo = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Morellonomicon logo, after the in-game item: made by tools/draw_brand.py (our own drawing, no Riot art) -->
  <defs>{DEFS}{fire_defs()}
    <clipPath id="bicon"><rect width="512" height="512" rx="112"/></clipPath></defs>
  <g clip-path="url(#bicon)">
    <rect width="512" height="512" fill="url(#bbg)"/>
    <rect width="512" height="512" fill="url(#bvig)"/>
    {emblem(262, 276, 1.08)}
    {sparks(256, 262, 1.1, 18)}
  </g>
</svg>
"""
open(f"{OUT}/logo-d-cursed-tome.svg", "w").write(logo)
print("logo ok")

# ---------- the opening screen: a hard-hitting start, then calm living motion until a tap ----------
def splash():
    W, H, cx, cy, sc = 390, 844, 195, 372, 0.8
    body, sil = book_svg(cx, cy - 6 * sc, sc)
    hug = path(sil)
    def burst(n, seed):   # sparks thrown out from the impact
        random.seed(seed); out = []
        for _ in range(n):
            a = random.random() * 2 * math.pi; r = 140 + random.random() * 240
            out.append(f'<circle cx="{cx}" cy="{cy}" r="{1.5 + random.random() * 2.5:.1f}" fill="#E2FFB6" opacity="0">'
                       f'<animate attributeName="cx" values="{cx};{cx + math.cos(a) * r:.0f}" begin="0.85s" dur="0.9s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.1 0.8 0.3 1"/>'
                       f'<animate attributeName="cy" values="{cy};{cy + math.sin(a) * r * 0.7:.0f}" begin="0.85s" dur="0.9s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.1 0.8 0.3 1"/>'
                       f'<animate attributeName="opacity" values="1;1;0" begin="0.85s" dur="0.9s" fill="freeze"/></circle>')
        return "".join(out)
    def charge(cx, cy):   # 0 to 0.85 s: embers are pulled in, a glow swells, a ring tightens; gone on the landing
        random.seed(13); out = []
        for _ in range(30):
            a = random.random() * 2 * math.pi; r = 260 + random.random() * 260; b = random.random() * 0.35
            out.append(f'<circle r="{1.2 + random.random() * 2:.1f}" fill="#C8F59A" opacity="0">'
                       f'<animate attributeName="cx" values="{cx + math.cos(a) * r:.0f};{cx}" begin="{b:.2f}s" dur="{0.85 - b:.2f}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.5 0 0.9 0.6"/>'
                       f'<animate attributeName="cy" values="{cy + math.sin(a) * r:.0f};{cy}" begin="{b:.2f}s" dur="{0.85 - b:.2f}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.5 0 0.9 0.6"/>'
                       f'<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.3;0.95;1" begin="{b:.2f}s" dur="{0.85 - b:.2f}s" fill="freeze"/></circle>')
        glow = (f'<circle cx="{cx}" cy="{cy}" r="10" fill="url(#scharge)" opacity="0">'
                f'<animate attributeName="r" values="6;120" begin="0s" dur="0.85s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.7 0 1 1"/>'
                f'<animate attributeName="opacity" values="0;0.9;0" keyTimes="0;0.97;1" begin="0s" dur="0.88s" fill="freeze"/></circle>')
        ring = (f'<circle cx="{cx}" cy="{cy}" r="220" fill="none" stroke="#7FE04A" stroke-width="1.5" stroke-dasharray="3 9" opacity="0">'
                f'<animate attributeName="r" values="240;30" begin="0.1s" dur="0.75s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.6 0 1 1"/>'
                f'<animate attributeName="opacity" values="0;0.8;0" keyTimes="0;0.5;1" begin="0.1s" dur="0.75s" fill="freeze"/></circle>')
        return glow + ring + "".join(out)
    claw_parts = claws(cx, cy, sc, parts=True)
    claw_svg = []
    streaks = []
    for i, (svg, (sx, sy)) in enumerate(claw_parts):
        b = 1.25 + i * 0.16
        claw_svg.append(f'<g transform="translate({sx:.1f} {sy:.1f})"><g transform="scale(0)">'
                        f'<animateTransform attributeName="transform" type="scale" values="0;1.12;1" keyTimes="0;0.6;1" begin="{b:.2f}s" dur="0.22s" fill="freeze"/>'
                        f'<g><animate attributeName="opacity" values="1;0.72;1;0.85;1" keyTimes="0;0.3;0.5;0.8;1" begin="{2.6 + i * 0.7:.1f}s" dur="{2.6 + i * 0.5:.1f}s" repeatCount="indefinite"/>'
                        f'<g transform="translate({-sx:.1f} {-sy:.1f})">{svg}</g></g></g></g>')
        x0, y0 = sx + 160 - i * 30, sy - 260
        x1, y1 = sx - 150 - i * 30, sy + 420
        streaks.append(f'<path d="M{x0:.0f} {y0:.0f} Q{(x0 + x1) / 2 + 70:.0f} {(y0 + y1) / 2:.0f} {x1:.0f} {y1:.0f}" fill="none" stroke="#C6F88E" stroke-width="8" stroke-linecap="round" stroke-dasharray="900" stroke-dashoffset="900" opacity="0">'
                       f'<animate attributeName="stroke-dashoffset" values="900;0" begin="{b:.2f}s" dur="0.12s" fill="freeze"/>'
                       f'<animate attributeName="opacity" values="0;1;0" keyTimes="0;0.15;1" begin="{b:.2f}s" dur="0.5s" fill="freeze"/>'
                       f'<animate attributeName="stroke-width" values="10;1" begin="{b:.2f}s" dur="0.5s" fill="freeze"/></path>')
    shake = ('<animateTransform attributeName="transform" type="translate" values="0 0;-14 8;12 -9;-9 -6;7 8;-4 3;0 0" begin="0.85s" dur="0.45s"/>'
             + "".join(f'<animateTransform attributeName="transform" type="translate" values="0 0;-6 4;5 -3;-2 2;0 0" begin="{1.25 + i * 0.16:.2f}s" dur="0.18s"/>' for i in range(3)))
    fire_in = '<animate attributeName="opacity" values="0;1" begin="0.85s" dur="0.25s" fill="freeze"/>'
    rise = f'<animateTransform attributeName="transform" type="scale" values="1 0.2;1 1.35;1 1" keyTimes="0;0.4;1" begin="0.85s" dur="0.9s" fill="freeze"/>'
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  <!-- Opening screen C, made by tools/draw_brand.py. Intro (about 3 s, once): embers are pulled into a swelling glow, the tome drops in from above and lands
       hard (flash, shockwave, shake, sparks thrown out), the fire bursts up around it, three claws tear out of the cover one by one,
       each with a streak across the screen, the ribbon whips out, the name lands. Then calm living motion until a tap: the fire
       churns and flickers, the tome hovers and sways, the claws pulse, the ribbon flutters, embers rise. -->
  <defs>{DEFS}{fire_defs(True)}
    <radialGradient id="scharge"><stop offset="0" stop-color="#F2FFD8"/><stop offset="0.3" stop-color="#9BE05A" stop-opacity="0.8"/><stop offset="1" stop-color="#3E9A22" stop-opacity="0"/></radialGradient>
    <radialGradient id="sbg" cx="0.5" cy="0.42" r="0.8"><stop offset="0" stop-color="#173816"/><stop offset="0.55" stop-color="#0A170A"/><stop offset="1" stop-color="#030603"/></radialGradient>
  </defs>
  <rect width="{W}" height="{H}" fill="#030603"/>
  {charge(cx, cy)}
  <g>{shake}
    <rect width="{W}" height="{H}" fill="url(#sbg)" opacity="0"><animate attributeName="opacity" values="0;1" begin="0.85s" dur="0.4s" fill="freeze"/>
      <animate attributeName="opacity" values="1;0.8;1" begin="2s" dur="5s" repeatCount="indefinite"/></rect>
    <!-- fire and the flames hugging the tome: burst up on landing, then churn -->
    <g opacity="0">{fire_in}<g transform="translate({cx} {cy + 120})"><g>{rise}<g transform="translate({-cx} {-cy - 120})">
      <g><animate attributeName="opacity" values="1;0.82;1;0.9;1" dur="2.3s" begin="1.8s" repeatCount="indefinite"/>{fire(cx, cy, sc)}</g>
      <g filter="url(#bfire)" fill="none" stroke-linejoin="round">
        <path d="{hug}" stroke="#2E7E1C" stroke-width="{80 * sc:.1f}" opacity="0.6"/>
        <path d="{hug}" stroke="#7FD84A" stroke-width="{36 * sc:.1f}" opacity="0.7"/>
        <path d="{hug}" stroke="#E2FFB6" stroke-width="{8 * sc:.1f}" opacity="0.75"/></g>
    </g></g></g></g>
    <!-- shockwave, flat like the floor under the book -->
    <ellipse cx="{cx}" cy="{cy + 40}" rx="10" ry="4" fill="none" stroke="#E2FFB6" stroke-width="5" opacity="0">
      <animate attributeName="rx" values="10;330" begin="0.85s" dur="0.7s" fill="freeze"/><animate attributeName="ry" values="4;130" begin="0.85s" dur="0.7s" fill="freeze"/>
      <animate attributeName="opacity" values="0;1;0" keyTimes="0;0.1;1" begin="0.85s" dur="0.7s" fill="freeze"/></ellipse>
    <!-- the tome: drops in, lands with a squash, then hovers and sways -->
    <g transform="translate({cx} {cy})">
      <g><animateTransform attributeName="transform" type="translate" values="0 0;0 -9;0 0" begin="2.4s" dur="5.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
      <g><animateTransform attributeName="transform" type="rotate" values="0;1.8;0;-1.4;0" begin="2.4s" dur="11s" repeatCount="indefinite"/>
      <g transform="translate(0 -700)"><animateTransform attributeName="transform" type="translate" values="0 -700;0 0" begin="0.5s" dur="0.35s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.6 0 1 1"/>
      <g><animateTransform attributeName="transform" type="scale" values="1 1;1.08 0.9;0.97 1.04;1 1" keyTimes="0;0.25;0.6;1" begin="0.85s" dur="0.45s" fill="freeze"/>
      <g transform="translate({-cx} {-cy})">
        <g>{body}</g>
        <path d="{hug}" fill="none" stroke="#B8F27E" stroke-width="{3 * sc:.1f}" opacity="0.6" filter="url(#bglow)"/>
        <g transform="translate({cx + 20 * sc:.1f} {cy + 96 * sc:.1f})"><g transform="scale(0 1)">
          <animateTransform attributeName="transform" type="scale" values="0 1;1.15 1;1 1" keyTimes="0;0.6;1" begin="1.85s" dur="0.4s" fill="freeze"/>
          <g><animateTransform attributeName="transform" type="skewY" values="0;6;-4;0" begin="2.3s" dur="3.2s" repeatCount="indefinite"/>
          <g transform="translate({-cx - 20 * sc:.1f} {-cy - 96 * sc:.1f})">{ribbon(cx, cy, sc)}</g></g></g></g>
        {"".join(claw_svg)}
        {wisps(cx, cy, sc)}
      </g></g></g></g></g>
    </g>
    {burst(26, 4)}
    <g opacity="0"><animate attributeName="opacity" values="0;1" begin="2s" dur="1s" fill="freeze"/>{sparks(cx, cy, 0.85, 22, True)}</g>
    <!-- name -->
    <g text-anchor="middle">
      <text x="{cx}" y="640" font-family="Georgia, 'Times New Roman', serif" font-size="25" fill="#F4F1E8" opacity="0" letter-spacing="22" filter="url(#bglow)">MORELLONOMICON
        <animate attributeName="opacity" values="0;0.9;0.35" begin="2.05s" dur="0.9s" fill="freeze"/>
        <animate attributeName="letter-spacing" values="22;4" begin="2.05s" dur="0.6s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.1 0.9 0.2 1"/></text>
      <text x="{cx}" y="640" font-family="Georgia, 'Times New Roman', serif" font-size="25" fill="#F4F1E8" opacity="0" letter-spacing="22">MORELLONOMICON
        <animate attributeName="opacity" values="0;1" begin="2.05s" dur="0.5s" fill="freeze"/>
        <animate attributeName="letter-spacing" values="22;4" begin="2.05s" dur="0.6s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.1 0.9 0.2 1"/></text>
      <text x="{cx}" y="680" font-family="'Noto Serif TC', 'PMingLiU', serif" font-size="20" letter-spacing="12" fill="#A6EC6E" opacity="0">黑魔禁書
        <animate attributeName="opacity" values="0;1" begin="2.4s" dur="0.6s" fill="freeze"/>
        <animate attributeName="y" values="696;680" begin="2.4s" dur="0.6s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.2 0.8 0.2 1"/></text>
      <path d="M{cx} 702 h0" stroke="#A6EC6E" stroke-width="1.2" opacity="0.6"><animate attributeName="d" values="M{cx} 702 h0;M{cx - 70} 702 h140" begin="2.6s" dur="0.6s" fill="freeze"/></path>
      <text x="{cx}" y="784" font-family="'Noto Sans TC', sans-serif" font-size="15" letter-spacing="4" fill="#C9C5B8" opacity="0">輕觸進入
        <animate attributeName="opacity" values="0.2;0.85;0.2" begin="3.1s" dur="2.6s" repeatCount="indefinite"/></text>
    </g>
  </g>
  {"".join(streaks)}
  <!-- impact flash, and a small one for each claw -->
  <rect width="{W}" height="{H}" fill="#EFFFD6" opacity="0"><animate attributeName="opacity" values="0;0.8;0" keyTimes="0;0.1;1" begin="0.85s" dur="0.28s" fill="freeze"/>
    {"".join(f'<animate attributeName="opacity" values="0;0.35;0" begin="{1.25 + i * 0.16:.2f}s" dur="0.2s"/>' for i in range(3))}</rect>
</svg>
"""

open(f"{OUT}/splash-c-tome.svg", "w").write(splash())
print("splash ok")
