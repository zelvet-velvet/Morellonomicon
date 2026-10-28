import { SWIPE, haptic } from "../ui";

// A pile of collectible cards (the Handbook's topic cards, 速查's champions): the top one at rest, the next ones leaning under it, the
// ones already gone parked off to the side. The top card follows the finger and tilts like a Tinder card, the pile under it moves up.
//   browse (Handbook): left = next card, right = the previous one back; the last card resists and can be pulled to what comes next
//   judge (速查): either way moves on and the card is decided (right = like, left = pass); nothing comes back
const PULL = 0.6;      // how far the last card moves per px pulled (it resists a little, like a rubber band)
export const GO_AT = 130;     // px of card movement that opens what comes after the last card when the finger lifts
const TILT = 12;       // degrees a card tilts per card width it is dragged
const GONE = -1.2;     // where a swiped-away card rests, in card widths off the pile
const FAN = [0, 2.6, -2.2, -2.2];   // degrees the cards under the top one lean, so the pile looks laid on a table
const STEP_Y = 6;      // px each card under the top one sits lower, so their edges show like a stack of cards
const SETTLE_MS = 280; // how long a card takes to land after a swipe

export interface PileHooks {
    judge?: boolean;
    onLayout?: (cur: number) => void;             // after the cards are posed: progress bars, which clips play
    onDrag?: (dx: number, width: number) => void; // while the top card is dragged (judge: a 喜歡 / 略過 stamp); 0 when it is let go
    onJudge?: (index: number, like: boolean) => void;
    onEnd?: () => void;                           // judge: the last card is gone
    last?: { move: (px: number) => boolean; reset: () => void; go: () => void };   // browse: pulling the last card (true = far enough)
    scroll?: string;                              // the part of a card scrolled by hand on a vertical move
}
export interface Pile { layout: (animate: boolean) => void; decide: (like: boolean) => void; readonly cur: number }

export function cardPile(pager: HTMLElement, sec: HTMLElement[], o: PileHooks): Pile {
    const count = sec.length;
    let cur = 0;   // the card on top
    const right: boolean[] = [];   // judge: the cards that went right (liked)
    // `u` places a card: 0 = on top, 1 = first under it … , below 0 = dragged off by that many card widths (to the right if `toRight`)
    const pose = (el: HTMLElement, u: number, toRight = false) => {
        const w = pager.clientWidth;
        let x = 0, y = 0, deg = 0, op = "";
        if (u < 0) { const s = toRight ? -1 : 1; x = s * u * w; deg = s * u * TILT; }
        else {
            const k = Math.min(FAN.length - 1, Math.floor(u)), a = FAN[k], b = FAN[Math.min(FAN.length - 1, k + 1)];
            deg = a + (b - a) * (u - k);
            y = Math.min(u, 2) * STEP_Y;
            if (u > 2) op = String(Math.max(0, 3 - u));
        }
        el.style.transform = `translateX(${x.toFixed(1)}px) translateY(${y.toFixed(1)}px) rotate(${deg.toFixed(2)}deg)`;
        el.style.setProperty("--sheen", `${(30 - Math.min(u, 0) * 70).toFixed(0)}%`);   // the rainbow sheen slides across the face as the card is dragged
        el.style.opacity = op;
    };
    let busy = false, leaving = false, settleT = 0;
    const layout = (animate: boolean) => {
        if (animate) {
            busy = true;
            sec.forEach((c) => c.addClass("is-settle"));
            window.clearTimeout(settleT);
            settleT = window.setTimeout(() => { sec.forEach((c) => c.removeClass("is-settle")); busy = false; }, SETTLE_MS);
        }
        sec.forEach((c, i) => { pose(c, i < cur ? GONE : i - cur, !!right[i]); c.style.zIndex = String(i < cur ? 100 + i : count - i); });
        o.onLayout?.(cur);
    };
    // judge: the top card is decided, flies off to its side, and the next one comes up (the end is told once the last has landed)
    const decide = (like: boolean) => {
        if (!o.judge || cur >= count || leaving) return;
        right[cur] = like;
        o.onJudge?.(cur, like);
        o.onDrag?.(0, pager.clientWidth);
        cur++;
        haptic();
        layout(true);
        if (cur >= count) { leaving = true; window.setTimeout(() => o.onEnd?.(), SETTLE_MS); }
    };

    const lastIdx = count - 1;
    let x0 = 0, y0 = 0, t0 = 0, pid = -1, dx = 0, lastY = 0, mode: "" | "x" | "y" = "", armed = false;
    let scroller: HTMLElement | null = null;
    const drag = () => {
        const w = pager.clientWidth, top = sec[cur];
        if (!top) return;
        if (o.judge) {   // either way: the top card leaves to that side, the pile under it comes up
            pose(top, -Math.abs(dx) / w, dx > 0);
            const p = Math.min(1, Math.abs(dx) / w / 0.8);
            for (let i = cur + 1; i < count; i++) pose(sec[i], i - cur - p);
            o.onDrag?.(dx, w);
            return;
        }
        if (dx < 0) {
            if (cur === lastIdx) {
                const move = dx * PULL;
                top.style.transform = `translateX(${move.toFixed(1)}px) translateY(0px) rotate(${(move / GO_AT * TILT).toFixed(2)}deg)`;
                if (o.last) { const ready = o.last.move(-move); if (ready !== armed) { armed = ready; if (ready) haptic(); } }
                return;
            }
            pose(top, dx / w);
            const p = Math.min(1, -dx / w / 0.8);
            for (let i = cur + 1; i < count; i++) pose(sec[i], i - cur - p);
        } else {
            if (cur === 0) { top.style.transform = `translateX(${(dx * 0.2).toFixed(1)}px) translateY(0px) rotate(${(dx * 0.2 / w * TILT).toFixed(2)}deg)`; return; }
            o.last?.reset(); armed = false;
            pose(sec[cur - 1], Math.min(0, GONE + dx / w));
            const p = Math.min(1, dx / w / 0.8);
            for (let i = cur; i < count; i++) pose(sec[i], i - cur + p);
        }
    };
    pager.addEventListener("pointerdown", (e) => {
        if (leaving || pid !== -1 || cur >= count || (e.pointerType === "mouse" && e.button !== 0)) return;
        if (busy) {   // a new drag while the cards are still landing: let them land at once, never make the finger wait
            window.clearTimeout(settleT);
            sec.forEach((c) => c.removeClass("is-settle"));
            busy = false;
            layout(false);
        }
        x0 = e.clientX; y0 = e.clientY; lastY = e.clientY; t0 = e.timeStamp; pid = e.pointerId; mode = ""; dx = 0;
        scroller = o.scroll ? (e.target as HTMLElement).closest<HTMLElement>(o.scroll) : null;
    });
    pager.addEventListener("pointermove", (e) => {
        if (e.pointerId !== pid) return;
        dx = e.clientX - x0;
        const dy = e.clientY - y0;
        if (!mode) {
            if (Math.abs(dx) < SWIPE.slop && Math.abs(dy) < SWIPE.slop) return;
            mode = Math.abs(dx) > Math.abs(dy) * SWIPE.bias ? "x" : "y";   // sideways: ours; vertical: the card's text scrolls
            pager.setPointerCapture(pid);
            if (mode === "x") {
                pager.addClass("is-drag");
                sec.forEach((c) => c.removeClass("is-settle"));
                if (!o.judge && cur === lastIdx && dx < 0) { const card = sec[cur].firstElementChild; card?.removeClass("is-shiver"); void (card as HTMLElement | null)?.offsetWidth; card?.addClass("is-shiver"); haptic(); }
            }
        }
        if (mode === "x") drag();
        else if (scroller) scroller.scrollTop += lastY - e.clientY;
        lastY = e.clientY;
    });
    const end = (e: PointerEvent) => {
        if (e.pointerId !== pid) return;
        pid = -1;
        const m = mode;
        mode = "";
        pager.removeClass("is-drag");
        if (m !== "x") return;
        sec[cur]?.firstElementChild?.removeClass("is-shiver");
        const w = pager.clientWidth, v = dx / Math.max(1, e.timeStamp - t0);
        const far = Math.abs(dx) > SWIPE.at * w || (Math.abs(v) > SWIPE.flick && Math.abs(dx) > SWIPE.flickMin);
        if (o.judge) {
            if (far) { decide(dx > 0); return; }
            o.onDrag?.(0, w);
            layout(true);
            return;
        }
        if (dx < 0 && far && cur < lastIdx) cur++;
        else if (dx > 0 && far && cur > 0) cur--;
        else if (dx < 0 && cur === lastIdx && armed && o.last) {
            busy = leaving = true;
            sec[cur].addClass("is-settle");
            pose(sec[cur], GONE);   // flies off, then what comes next opens
            window.setTimeout(o.last.go, 220);
            return;
        }
        o.last?.reset(); armed = false;
        layout(true);
    };
    pager.addEventListener("pointerup", end);
    pager.addEventListener("pointercancel", end);
    return { layout, decide, get cur() { return cur; } };
}
