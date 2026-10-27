// Colour themes for the app screen (it does not touch the rest of Obsidian). Each one has a dark and a light set; the set follows
// Obsidian's own light / dark. "popping" and "ocean" are the ZeLedgerOS themes (ze-theme-popping-and-locking.css, ze-theme-template.css).
// To add one: copy a block below and change the values.
export interface Tokens {
    bg: string; surface: string; surface2: string;            // page, cards, inset chips and boxes
    text: string; text2: string; text3: string; onAccent: string;
    accent: string; positive: string; negative: string; warning: string; info: string;
    orange: string; purple: string; pink: string; cyan: string;
    line: string;
}
export interface Theme { id: string; name: string; dark?: Tokens; light?: Tokens }

export const THEMES: Theme[] = [
    { id: "auto", name: "Obsidian (follows your theme)" },
    {
        id: "popping", name: "Popping and Locking",
        dark: { bg: "#1C1D26", surface: "#262836", surface2: "#30334A", text: "#F2E5BC", text2: "#C9C2B2", text3: "#9A8F80", onAccent: "#1C1D26",
            accent: "#E9892B", positive: "#A3CF7E", negative: "#F7685B", warning: "#F5B83D", info: "#7DB3C9", orange: "#E9892B", purple: "#B995D8", pink: "#D3869B", cyan: "#8EC0B4", line: "rgba(242,229,188,0.11)" },
        light: { bg: "#F6F0DF", surface: "#FFFBEE", surface2: "#EFE7D0", text: "#2B2A33", text2: "#5C574C", text3: "#766F61", onAccent: "#FFFFFF",
            accent: "#B5470A", positive: "#3F7A1E", negative: "#B8322A", warning: "#915600", info: "#2D6C8C", orange: "#D9741A", purple: "#8A5DB5", pink: "#C2587A", cyan: "#3F9A8A", line: "rgba(60,48,20,0.13)" },
    },
    {
        id: "ocean", name: "Ocean",
        dark: { bg: "#101820", surface: "#1A2530", surface2: "#243241", text: "#EAF1F7", text2: "#A9B8C6", text3: "#7F90A0", onAccent: "#0B1218",
            accent: "#4DB6AC", positive: "#6FCF97", negative: "#EB5757", warning: "#F2C94C", info: "#56CCF2", orange: "#F2994A", purple: "#BB86FC", pink: "#FF7AA8", cyan: "#4DB6AC", line: "rgba(234,241,247,0.11)" },
        light: { bg: "#F4F8FB", surface: "#FFFFFF", surface2: "#EAF0F5", text: "#14202B", text2: "#4B5C6B", text3: "#66798A", onAccent: "#FFFFFF",
            accent: "#00796B", positive: "#1B7F46", negative: "#C62828", warning: "#8A6100", info: "#0A6C9A", orange: "#E07B20", purple: "#8E4EC6", pink: "#E0457F", cyan: "#12877B", line: "rgba(20,32,43,0.13)" },
    },
    {
        id: "sakura", name: "Sakura",
        dark: { bg: "#211922", surface: "#2D2230", surface2: "#3A2C3E", text: "#F7E8F0", text2: "#CDB6C4", text3: "#9C8696", onAccent: "#2A1020",
            accent: "#FF8FB1", positive: "#9ED8A5", negative: "#FF6B7A", warning: "#F7C873", info: "#8FC5E8", orange: "#FFA776", purple: "#C7A2F0", pink: "#FF8FB1", cyan: "#7DD3CB", line: "rgba(247,232,240,0.11)" },
        light: { bg: "#FBF3F6", surface: "#FFFFFF", surface2: "#F5E6EC", text: "#2B1B24", text2: "#5E4654", text3: "#7A6270", onAccent: "#FFFFFF",
            accent: "#C2185B", positive: "#2E7D32", negative: "#C62828", warning: "#8D5B00", info: "#1565A0", orange: "#D2691E", purple: "#7B4DB2", pink: "#C2185B", cyan: "#00796B", line: "rgba(43,27,36,0.13)" },
    },
    {
        id: "forest", name: "Forest",
        dark: { bg: "#141A16", surface: "#1D2620", surface2: "#27342B", text: "#E6F0E4", text2: "#B0C2B0", text3: "#86998A", onAccent: "#0E1A10",
            accent: "#8FD19E", positive: "#8FD19E", negative: "#F0776B", warning: "#E8C35C", info: "#7DC4D6", orange: "#E8955A", purple: "#B59AE0", pink: "#DB8CA8", cyan: "#6CC7B5", line: "rgba(230,240,228,0.11)" },
        light: { bg: "#F2F6EF", surface: "#FFFFFF", surface2: "#E6EEE2", text: "#18241A", text2: "#4A5E4C", text3: "#657A68", onAccent: "#FFFFFF",
            accent: "#2E7D32", positive: "#2E7D32", negative: "#B3261E", warning: "#8A6100", info: "#0A6C85", orange: "#C9651A", purple: "#6F4AAE", pink: "#B03A6C", cyan: "#00796B", line: "rgba(24,36,26,0.13)" },
    },
];

// The theme's variables for the current light / dark; none for "auto" (the app then uses Obsidian's colours).
export function themeVars(id: string, dark: boolean): Record<string, string> {
    const t = THEMES.find((x) => x.id === id);
    const k = t && (dark ? t.dark : t.light);
    if (!k) return {};
    return {
        "--mn-bg": k.bg, "--mn-card": k.surface, "--mn-card-hi": k.surface2, "--mn-text": k.text, "--mn-muted": k.text2, "--mn-faint": k.text3, "--mn-line": k.line,
        "--mn-accent": k.accent, "--interactive-accent": k.accent, "--text-on-accent": k.onAccent,
        "--color-green": k.positive, "--color-red": k.negative, "--color-yellow": k.warning, "--color-blue": k.info,
        "--color-orange": k.orange, "--color-purple": k.purple, "--color-pink": k.pink, "--color-cyan": k.cyan,
    };
}
