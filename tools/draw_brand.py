# Draws the Cursed tome logo (D) and the "Tome awakens" opening screen (C) from the same parts, into Assets/brand/.
# Our own drawing after the Morellonomicon item; no Riot art. Run from the repo root: python3 -I tools/draw_brand.py
import math, random, sys
OUT = sys.argv[1] if len(sys.argv) > 1 else "Assets/brand"
random.seed(7)

def claw(x1, y1, x2, y2, w, bend=14):
    mx, my = x1 + (x2 - x1) * 0.4, y1 + (y2 - y1) * 0.4
    return f"M{x1} {y1} Q{mx + w + bend:.0f} {my:.0f} {x2} {y2} Q{mx - w + bend:.0f} {my:.0f} {x1} {y1} Z"

SLASHES = [(212, 122, 164, 408, 24), (280, 108, 218, 424, 28), (344, 140, 288, 404, 22)]

DEFS = """
    <radialGradient id="tbg" cx="0.5" cy="0.55" r="0.75"><stop offset="0" stop-color="#1F2E1F"/><stop offset="0.6" stop-color="#121A13"/><stop offset="1" stop-color="#0A0D0B"/></radialGradient>
    <radialGradient id="taura" cx="0.5" cy="0.5" r="0.5"><stop offset="0.35" stop-color="#7FCB4E" stop-opacity="0.55"/><stop offset="1" stop-color="#7FCB4E" stop-opacity="0"/></radialGradient>
    <linearGradient id="tcover" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6A4A9A"/><stop offset="0.45" stop-color="#46306C"/><stop offset="1" stop-color="#241838"/></linearGradient>
    <linearGradient id="tspine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1C1330"/><stop offset="0.5" stop-color="#3A2858"/><stop offset="1" stop-color="#22173A"/></linearGradient>
    <linearGradient id="tpages" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#B8AC8E"/><stop offset="1" stop-color="#E6DCC2"/></linearGradient>
    <linearGradient id="tgold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3D88A"/><stop offset="0.5" stop-color="#C9A24A"/><stop offset="1" stop-color="#8A6A28"/></linearGradient>
    <linearGradient id="tslash" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E9FFC0"/><stop offset="0.45" stop-color="#9BE05A"/><stop offset="1" stop-color="#4A962C"/></linearGradient>
    <linearGradient id="tflame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#3E8A2A"/><stop offset="0.6" stop-color="#76C24A"/><stop offset="1" stop-color="#B9EE86" stop-opacity="0.2"/></linearGradient>
    <linearGradient id="tribbon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C2408A"/><stop offset="1" stop-color="#7E2259"/></linearGradient>
    <filter id="tsoft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
    <filter id="tglow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="tsmall" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <linearGradient id="tfadeg" x1="0" y1="0" x2="0" y2="1"><stop offset="0.7" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="tfade" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><rect x="0" y="0" width="512" height="450" fill="url(#tfadeg)"/></mask>
    <clipPath id="tcoverclip"><rect x="128" y="128" width="222" height="264" rx="14"/></clipPath>"""

def flames(anim=False):
    # three layers of tongues; when animated each tongue flickers on its own beat
    layers = [("#2F6E22", 0.85, "tsoft", [(-150, 170, 120), (-100, 130, 150), (-40, 210, 110), (40, 200, 120), (100, 140, 150), (150, 170, 120), (0, 240, 90)]),
              ("url(#tflame)", 0.8, "tsmall", [(-140, 150, 80), (-90, 110, 110), (90, 120, 110), (140, 150, 80), (0, 210, 60)]),
              ("#B5EC80", 0.55, "tsmall", [(-128, 140, 46), (-84, 100, 64), (84, 108, 64), (128, 140, 46)])]
    out = []
    for fill, op, flt, tongues in layers:
        g = [f'<g fill="{fill}" opacity="{op}" filter="url(#{flt})">']
        for i, (dx, h, w) in enumerate(tongues):
            x0, y0 = 256 + dx, 430
            p = f"M{x0 - w/2:.0f} {y0} C{x0 - w/2:.0f} {y0 - h*0.5:.0f} {x0 - w*0.1:.0f} {y0 - h*0.7:.0f} {x0 + w*0.08:.0f} {y0 - h} C{x0 + w*0.25:.0f} {y0 - h*0.6:.0f} {x0 + w/2:.0f} {y0 - h*0.45:.0f} {x0 + w/2:.0f} {y0} Z"
            if anim:
                d = 1.1 + random.random() * 1.4
                s1, s2 = 0.86 + random.random() * 0.08, 1.04 + random.random() * 0.1
                g.append(f'<g transform="translate({x0} {y0})"><g><path d="{p}" transform="translate({-x0} {-y0})"/>'
                         f'<animateTransform attributeName="transform" type="scale" values="1 {s1:.2f};1.03 {s2:.2f};0.97 {s1+0.06:.2f};1 {s1:.2f}" dur="{d:.2f}s" repeatCount="indefinite"/></g></g>')
            else:
                g.append(f'<path d="{p}"/>')
        g.append("</g>")
        out.append("".join(g))
    return '<g mask="url(#tfade)">' + "\n  ".join(out) + "</g>"

def book():
    lines_r = "".join(f'<path d="M{352 + i*3} {146 + i} v{232 - i*2}" stroke="#9F947A" stroke-width="1"/>' for i in range(0, 6))
    lines_b = "".join(f'<path d="M160 {396 + i*2.4:.1f} h{188 - i}" stroke="#A89C80" stroke-width="0.8"/>' for i in range(0, 5))
    rivets = "".join(f'<circle cx="{x}" cy="{y}" r="3.2" fill="#F6E2A4" stroke="#6E5420" stroke-width="1"/>' for x, y in [(338, 141), (338, 379), (172, 141), (172, 379)])
    return f"""<g>
    <!-- back cover and page block -->
    <rect x="136" y="136" width="230" height="270" rx="14" fill="#1A1228"/>
    <path d="M150 140 h204 a12 12 0 0 1 12 12 v240 a12 12 0 0 1 -12 12 h-204 z" fill="url(#tpages)"/>
    {lines_r}{lines_b}
    <!-- ribbon bookmark hanging from the pages -->
    <path d="M300 396 h20 v60 l-10 -10 l-10 10 z" fill="url(#tribbon)" stroke="#5A1740" stroke-width="1.5"/>
    <!-- cover -->
    <rect x="128" y="128" width="222" height="264" rx="14" fill="url(#tcover)" stroke="#140D20" stroke-width="4"/>
    <g clip-path="url(#tcoverclip)">
      <path d="M128 128 L350 128 L350 160 C280 150 200 170 128 220 Z" fill="#FFFFFF" opacity="0.07"/>
      <g stroke="#2A1C44" stroke-width="1" opacity="0.6">{"".join(f'<path d="M{150 + i*14} 128 l-30 264"/>' for i in range(0, 17))}</g>
    </g>
    <!-- embossed frame and an etched rune seal -->
    <rect x="170" y="146" width="164" height="228" rx="8" fill="none" stroke="#24183A" stroke-width="5"/>
    <rect x="172" y="148" width="160" height="224" rx="7" fill="none" stroke="#7E62AE" stroke-width="1.5" opacity="0.7"/>
    <g fill="none" stroke="#2A1C44" stroke-width="3" opacity="0.9">
      <circle cx="252" cy="260" r="46"/><circle cx="252" cy="260" r="34" stroke-dasharray="4 6"/>
      <path d="M252 220 L287 280 L217 280 Z"/>
    </g>
    <g fill="none" stroke="#8C70BC" stroke-width="1" opacity="0.45"><circle cx="253" cy="259" r="46"/><path d="M253 219 L288 279 L218 279 Z"/></g>
    <!-- spine with gold bands -->
    <rect x="128" y="128" width="34" height="264" rx="12" fill="url(#tspine)"/>
    <g fill="url(#tgold)" stroke="#6E5420" stroke-width="1">
      <rect x="128" y="168" width="34" height="9" rx="2"/><rect x="128" y="256" width="34" height="9" rx="2"/><rect x="128" y="344" width="34" height="9" rx="2"/>
    </g>
    <!-- gold corners with filigree -->
    <g fill="url(#tgold)" stroke="#6E5420" stroke-width="1.5" stroke-linejoin="round">
      <path d="M350 128 v62 c-8 -4 -14 -12 -16 -22 c-6 2 -12 0 -14 -6 c-6 2 -12 -2 -12 -8 c-10 -2 -18 -8 -20 -26 z"/>
      <path d="M350 392 v-62 c-8 4 -14 12 -16 22 c-6 -2 -12 0 -14 6 c-6 -2 -12 2 -12 8 c-10 2 -18 8 -20 26 z"/>
      <path d="M162 128 h44 c-2 10 -10 16 -18 16 c-2 6 -8 10 -14 8 c-4 6 -8 8 -12 8 z"/>
      <path d="M162 392 h44 c-2 -10 -10 -16 -18 -16 c-2 -6 -8 -10 -14 -8 c-4 -6 -8 -8 -12 -8 z"/>
    </g>
    {rivets}
    <!-- clasp on the open side -->
    <path d="M340 238 h24 a6 6 0 0 1 6 6 v32 a6 6 0 0 1 -6 6 h-24 z" fill="url(#tgold)" stroke="#6E5420" stroke-width="1.5"/>
    <circle cx="358" cy="260" r="6" fill="#7FCB4E" stroke="#2F6E22" stroke-width="1.5"/><circle cx="356" cy="258" r="2" fill="#E9FFC0"/>
  </g>"""

def slashes(anim=False):
    cut = "".join(f'<path d="{claw(*s[:4], s[4] + 5)}"/>' for s in SLASHES)
    glow = "".join(f'<path d="{claw(*s[:4], s[4] + 12)}"/>' for s in SLASHES)
    core = "".join(f'<path d="{claw(*s[:4], s[4])}"/>' for s in SLASHES)
    hot = "".join(f'<path d="{claw(*s[:4], s[4] // 4)}"/>' for s in SLASHES)
    drips = "".join(f'<path d="M{x} {y} c-3 6 -3 12 0 16 c3 -4 3 -10 0 -16 z"/>' for x, y in [(170, 392), (224, 410), (292, 390)])
    pulse = '<animate attributeName="opacity" values="0.9;0.55;0.9" dur="3.2s" repeatCount="indefinite"/>' if anim else ""
    return f"""<g>
    <g fill="#9BE05A" opacity="0.9" filter="url(#tglow)">{glow}{pulse}</g>
    <g fill="#120A1C" opacity="0.85">{cut}</g>
    <g fill="url(#tslash)">{core}</g>
    <g fill="#F4FFE0" opacity="0.9">{hot}</g>
    <g fill="#9BE05A" opacity="0.85">{drips}</g>
  </g>"""

def sparks(n, anim=False):
    out = []
    for _ in range(n):
        x, y, r = 80 + random.random() * 352, 90 + random.random() * 340, 1 + random.random() * 2.2
        if anim:
            d, b = 3 + random.random() * 4, random.random() * 4
            out.append(f'<circle cx="{x:.0f}" r="{r:.1f}" fill="#C8F59A"><animate attributeName="cy" values="{y + 120:.0f};{y - 140:.0f}" dur="{d:.1f}s" begin="{b:.1f}s" repeatCount="indefinite"/>'
                       f'<animate attributeName="opacity" values="0;1;0" dur="{d:.1f}s" begin="{b:.1f}s" repeatCount="indefinite"/></circle>')
        else:
            out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.1f}" fill="#C8F59A" opacity="{0.4 + random.random() * 0.6:.2f}"/>')
    return "".join(out)

# ---------- the logo ----------
logo = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Option D · Cursed tome, after the Morellonomicon item: a purple tome with gold corners, spine bands, a clasp and a ribbon,
       three green claw slashes torn into its cover, green fire around it. Our own drawing, made by tools/draw_brand.py. -->
  <defs>{DEFS}</defs>
  <rect width="512" height="512" rx="112" fill="url(#tbg)"/>
  <circle cx="256" cy="270" r="220" fill="url(#taura)"/>
  {flames()}
  <g transform="rotate(-14 256 262)">{book()}</g>
  {slashes()}
  <g filter="url(#tsmall)">{sparks(14)}</g>
</svg>
"""
open(f"{OUT}/logo-d-cursed-tome.svg", "w").write(logo)

# ---------- the opening screen: vivid intro, then calm live motion ----------
random.seed(11)
W, H = 390, 844
conv = []
for i in range(22):   # sparks rushing in to the middle in the first 0.7 s
    a = random.random() * 6.283
    r = 260 + random.random() * 160
    x, y = 195 + math.cos(a) * r, 330 + math.sin(a) * r
    conv.append(f'<circle r="{1.5 + random.random() * 2:.1f}" fill="#D6FBA8" opacity="0"><animate attributeName="cx" values="{x:.0f};195" dur="0.7s" fill="freeze"/>'
                f'<animate attributeName="cy" values="{y:.0f};330" dur="0.7s" fill="freeze"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.2;0.85;1" dur="0.7s" fill="freeze"/></circle>')
big = [(40, 120, 300, 640), (120, 90, 380, 600), (-10, 200, 230, 700)]   # the screen-wide claw marks of the intro
rips = []
for i, (x1, y1, x2, y2) in enumerate(big):
    b = 0.85 + i * 0.11
    rips.append(f'<path d="M{x1} {y1} Q{(x1 + x2) / 2 + 40:.0f} {(y1 + y2) / 2:.0f} {x2} {y2}" fill="none" stroke="#C8F59A" stroke-width="10" stroke-linecap="round" '
                f'stroke-dasharray="700" stroke-dashoffset="700" opacity="0"><animate attributeName="stroke-dashoffset" values="700;0" begin="{b:.2f}s" dur="0.14s" fill="freeze"/>'
                f'<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.5;1" begin="{b:.2f}s" dur="0.55s" fill="freeze"/>'
                f'<animate attributeName="stroke-width" values="14;2" begin="{b:.2f}s" dur="0.55s" fill="freeze"/></path>')
shake = '<animateTransform attributeName="transform" type="translate" values="0 0;-9 5;8 -6;-6 -4;5 6;-3 2;0 0" begin="0.85s" dur="0.5s" fill="freeze"/>'
splash = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
  <!-- Opening screen option C · Tome awakens (preview). Intro about 3 s: sparks rush in, a flash, the tome slams in, three claw marks rip
       across the screen with a shake, a shockwave, the fire bursts up, the name lands. Then calm live motion until a tap: the tome floats
       and sways, flames flicker, the slashes breathe, embers rise, the rune ring turns, a glint crosses the cover. -->
  <defs>{DEFS}
    <radialGradient id="sbg" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stop-color="#1C2A1C"/><stop offset="1" stop-color="#070908"/></radialGradient>
    <linearGradient id="sglint" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="{W}" height="{H}" fill="#070908"/>
  <g>{shake}
    <rect width="{W}" height="{H}" fill="url(#sbg)" opacity="0"><animate attributeName="opacity" to="1" begin="0.7s" dur="0.6s" fill="freeze"/></rect>
    <!-- embers: the calm loop -->
    <g opacity="0" filter="url(#tsmall)"><animate attributeName="opacity" to="0.9" begin="2s" dur="1s" fill="freeze"/>{sparks(18, True)}</g>
    <!-- rune ring, slow turn -->
    <g transform="translate(195 330)" opacity="0"><animate attributeName="opacity" to="0.7" begin="1.5s" dur="1s" fill="freeze"/>
      <g><circle r="168" fill="none" stroke="#7FCB4E" stroke-width="1.5" stroke-dasharray="2 10" stroke-linecap="round"/>
        <circle r="184" fill="none" stroke="#7FCB4E" stroke-width="1" opacity="0.5"/>
        <g fill="#7FCB4E">{"".join(f'<path d="M0 -190 l5 9 h-10 z" transform="rotate({k * 45})"/>' for k in range(8))}</g>
        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="60s" repeatCount="indefinite"/></g>
    </g>
    <!-- shockwave -->
    <circle cx="195" cy="330" r="20" fill="none" stroke="#D6FBA8" stroke-width="6" opacity="0">
      <animate attributeName="r" values="20;360" begin="1.25s" dur="0.8s" fill="freeze"/>
      <animate attributeName="opacity" values="0;0.9;0" begin="1.25s" dur="0.8s" fill="freeze"/>
      <animate attributeName="stroke-width" values="10;1" begin="1.25s" dur="0.8s" fill="freeze"/></circle>
    <!-- the tome: placed at the middle, floats (bob) and sways in the loop -->
    <g transform="translate(195 330)">
      <g><animateTransform attributeName="transform" type="translate" values="0 0;0 -8;0 0" begin="2.6s" dur="5s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
      <g><animateTransform attributeName="transform" type="rotate" values="0;1.6;0;-1.6;0" begin="2.6s" dur="9s" repeatCount="indefinite"/>
      <g transform="scale(0.62)">
        <g opacity="0"><animate attributeName="opacity" values="0;1" begin="0.7s" dur="0.15s" fill="freeze"/>
          <animateTransform attributeName="transform" type="scale" values="1.6;0.94;1.03;1" keyTimes="0;0.5;0.75;1" begin="0.7s" dur="0.55s" fill="freeze"/>
          <g transform="translate(-256 -262)">
            <circle cx="256" cy="270" r="230" fill="url(#taura)"><animate attributeName="r" values="215;240;215" begin="2.6s" dur="4s" repeatCount="indefinite"/></circle>
            <g transform="translate(256 430)"><g><animateTransform attributeName="transform" type="scale" values="1 0;1 1.25;1 1" begin="1.35s" dur="0.6s" fill="freeze"/>
              <g transform="translate(-256 -430)">{flames(True)}</g></g></g>
            <g transform="rotate(-14 256 262)">{book()}
              <g clip-path="url(#tcoverclip)"><rect x="40" y="100" width="70" height="320" fill="url(#sglint)" transform="skewX(-18)">
                <animate attributeName="x" values="40;460" begin="3.2s;glint.end+5s" dur="1.4s" id="glint"/></rect></g>
            </g>
            <g opacity="0"><animate attributeName="opacity" values="0;1" begin="0.95s" dur="0.2s" fill="freeze"/>{slashes(True)}</g>
          </g>
        </g>
      </g></g></g>
    </g>
    <!-- the claw marks ripping the screen -->
    {"".join(rips)}
    <!-- name -->
    <g text-anchor="middle">
      <text x="195" y="590" font-family="Georgia, 'Times New Roman', serif" font-size="23" fill="#F4F1E8" opacity="0" letter-spacing="16">MORELLONOMICON
        <animate attributeName="opacity" to="1" begin="1.9s" dur="0.6s" fill="freeze"/>
        <animate attributeName="letter-spacing" values="16;4" begin="1.9s" dur="0.7s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.2 0.8 0.2 1"/></text>
      <text x="195" y="628" font-family="'Noto Serif TC', 'PMingLiU', serif" font-size="19" letter-spacing="10" fill="#9BD86A" opacity="0">黑魔禁書
        <animate attributeName="opacity" to="1" begin="2.3s" dur="0.6s" fill="freeze"/>
        <animate attributeName="y" values="644;628" begin="2.3s" dur="0.6s" fill="freeze"/></text>
      <path d="M135 650 h120" stroke="#9BD86A" stroke-width="1" opacity="0"><animate attributeName="opacity" to="0.5" begin="2.6s" dur="0.6s" fill="freeze"/></path>
      <text x="195" y="770" font-family="'Noto Sans TC', sans-serif" font-size="15" letter-spacing="4" fill="#C9C5B8" opacity="0">輕觸進入
        <animate attributeName="opacity" values="0.25;0.9;0.25" begin="3s" dur="2.4s" repeatCount="indefinite"/></text>
    </g>
  </g>
  <!-- sparks rushing in, then the flash -->
  {"".join(conv)}
  <rect width="{W}" height="{H}" fill="#E9FFC8" opacity="0"><animate attributeName="opacity" values="0;0.85;0" begin="0.68s" dur="0.4s" fill="freeze"/></rect>
</svg>
"""
open(f"{OUT}/splash-c-tome.svg", "w").write(splash)
print("ok")
