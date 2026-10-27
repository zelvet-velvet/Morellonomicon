// Build output -> the vault's plugin folder (committed, so the phone gets it through sync) and enable it.
// Usage: npm run build && npm run install-vault [-- <vault path>]   (default: ../Morellonomicon Note)
import fs from "fs";
import path from "path";

const vault = path.resolve(process.argv[2] || process.env.VAULT || "../Morellonomicon Note");
const dir = path.join(vault, ".obsidian", "plugins", "morellonomicon");
fs.mkdirSync(dir, { recursive: true });
for (const f of ["main.js", "manifest.json", "styles.css"]) fs.copyFileSync(f, path.join(dir, f));
const list = path.join(vault, ".obsidian", "community-plugins.json");
const ids = fs.existsSync(list) ? JSON.parse(fs.readFileSync(list, "utf8")) : [];
if (!ids.includes("morellonomicon")) { ids.push("morellonomicon"); fs.writeFileSync(list, JSON.stringify(ids, null, 2)); }
console.log("installed into", dir);
