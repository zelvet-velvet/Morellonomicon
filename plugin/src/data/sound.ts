// Matching by how a name is said, for 🎤 speech to text: it usually gets the sounds right and the characters wrong
// (阿狸 for 阿璃, 卡特琳娜 for 卡特蓮娜). _data/sounds.json (tools/build_sounds.py, from Unicode's Unihan) lists the
// characters for each Mandarin sound, tones dropped; a character with several readings is under each of them.

export type Said = Set<string>[];   // per character: the sounds it can be read as

// Sounds that Taiwanese Mandarin and speech to text often swap: zh/z, ch/c, sh/s, -ing/-in, -eng/-en, l-/n-
function loose(s: string): string {
    return s.replace(/^zh/, "z").replace(/^ch/, "c").replace(/^sh/, "s").replace(/ing$/, "in").replace(/eng$/, "en").replace(/^l/, "n");
}

export class Sounds {
    private exact = new Map<string, Set<string>>();
    private near = new Map<string, Set<string>>();
    private exactAll = new Map<string, Set<string>>();
    private nearAll = new Map<string, Set<string>>();

    // `table`: the usual reading of each character; `rare`: older or rarer ones, which only what was said may use (a name
    // matched on its rare readings finds wrong champions: 鄂爾 for 阿狸)
    constructor(table: Record<string, string>, rare: Record<string, string> = {}) {
        const add = (exact: Map<string, Set<string>>, near: Map<string, Set<string>>, t: Record<string, string>) => {
            for (const [sound, chars] of Object.entries(t)) for (const ch of chars) {
                if (!exact.has(ch)) { exact.set(ch, new Set()); near.set(ch, new Set()); }
                exact.get(ch)!.add(sound);
                near.get(ch)!.add(loose(sound));
            }
        };
        add(this.exact, this.near, table);
        add(this.exactAll, this.nearAll, table);
        add(this.exactAll, this.nearAll, rare);
    }

    // The Chinese characters of a text, as sounds (anything else is dropped); a character not in the table matches nothing.
    // `heard`: what was typed or said, which may use any reading; otherwise a name, on its usual readings.
    said(text: string, near = false, heard = false): Said {
        const map = heard ? (near ? this.nearAll : this.exactAll) : (near ? this.near : this.exact);
        const out: Said = [];
        for (const ch of text) {
            if (!/\p{Script=Han}/u.test(ch)) continue;
            out.push(map.get(ch) ?? new Set());
        }
        return out;
    }
}

const same = (a: Set<string>, b: Set<string>) => { for (const x of a) if (b.has(x)) return true; return false; };

// Where `part` is said inside `whole` (every character sounds alike), or -1
export function findSaid(whole: Said, part: Said, from = 0): number {
    if (!part.length) return -1;
    for (let i = from; i + part.length <= whole.length; i++) {
        let ok = true;
        for (let j = 0; j < part.length && ok; j++) ok = same(whole[i + j], part[j]);
        if (ok) return i;
    }
    return -1;
}

// Characters to change, add or remove so the two sound alike
export function saidDistance(a: Said, b: Said): number {
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (same(a[i - 1], b[j - 1]) ? 0 : 1));
        prev = cur;
    }
    return prev[b.length];
}

// How well what was said matches a name by sound; `near` is the looser hearing (zh/z, -ing/-in, l/n). 0 = no match.
// Below the plain text scores of an exact name (100), its start (90) or a part of it (80).
export function soundScore(q: Said, name: Said, near: boolean): number {
    const cut = near ? 4 : 0;
    if (!q.length || !name.length) return 0;
    const at = findSaid(name, q);
    if (q.length === name.length && at === 0) return 78 - cut;
    if (q.length >= 2 && at === 0) return 70 - cut;
    if (q.length >= 2 && at > 0) return 64 - cut;
    // one character misheard, one too many or one missing, in a name of three or more
    if (near && Math.min(q.length, name.length) >= 3 && saidDistance(q, name) === 1) return 52;
    return 0;
}
