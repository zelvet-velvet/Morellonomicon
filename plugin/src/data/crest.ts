// Riot's champion mastery crests, cleaned on the device. Riot's art (CommunityDragon, by address) pads each 800 x 900 crest with
// empty space and fills the panels inside its wings with dark navy, which reads as a dark smudge at Home's size. The first time a
// level is needed its crest is drawn on a canvas, cut to its art and the navy made see-through; the result is kept on this device
// (localStorage), so later visits show it at once. Levels above 10 use the level 10 crest, as the client does.

const SRC = (n: number) => `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/mastery-${n}.png`;
// where the art sits in each crest (left, top, width, height)
export const CREST_BOX: Record<number, [number, number, number, number]> = {
    1: [183, 373, 433, 273], 2: [129, 325, 541, 367], 3: [109, 295, 582, 428], 4: [54, 300, 692, 417], 5: [54, 301, 692, 417],
    6: [9, 277, 782, 440], 7: [9, 277, 782, 462], 8: [17, 271, 766, 479], 9: [16, 271, 768, 496], 10: [16, 233, 768, 546],
};
const KEY = (n: number) => `mn-crest-${n}-v1`;
const WIDTH = 160;   // the kept copy's width (Home shows it about 34 px wide; enough for a sharp 3x screen)
const made = new Map<number, Promise<string>>();

export const crestLevel = (level: number): number => Math.min(10, Math.max(1, Math.round(level)));
// width / height of a level's crest, so a row of crests can share one height before they arrive
export const crestRatio = (level: number): number => { const b = CREST_BOX[crestLevel(level)]; return b[2] / b[3]; };

// The cleaned crest as a data URL ("" when it cannot be made: offline, or Riot's address moved)
export function crest(level: number): Promise<string> {
    const n = crestLevel(level);
    let p = made.get(n);
    if (!p) {
        p = make(n);
        made.set(n, p);
    }
    return p;
}

async function make(n: number): Promise<string> {
    try { const kept = window.localStorage.getItem(KEY(n)); if (kept) return kept; } catch { /* storage off: make it again */ }
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.src = SRC(n);
    try { await im.decode(); } catch { made.delete(n); return ""; }
    const [l, t, w, h] = CREST_BOX[n];
    const cv = document.createElement("canvas");
    cv.width = WIDTH;
    cv.height = Math.round(WIDTH * h / w);
    const x = cv.getContext("2d");
    if (!x) return "";
    x.drawImage(im, l, t, w, h, 0, 0, cv.width, cv.height);
    const px = x.getImageData(0, 0, cv.width, cv.height);
    const d = px.data;
    // the wing panels: very dark and blue over red (every dark part of the gold art is warm, red over blue)
    for (let i = 0; i < d.length; i += 4) if (d[i] < 40 && d[i + 2] > d[i] + 6 && d[i + 2] < 100 && d[i + 2] >= d[i + 1]) d[i + 3] = 0;
    x.putImageData(px, 0, 0);
    const url = cv.toDataURL("image/png");
    try { window.localStorage.setItem(KEY(n), url); } catch { /* full or off: kept for this session only */ }
    return url;
}
