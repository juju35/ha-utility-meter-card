// Bundles the ES modules of src/ (entry src/index.js, assembled by scripts/bundle.mjs) into the single file dist/utility-meter-card.js (the drawn meters are inline SVG:
// the card needs no extra resource).
// Usage: node scripts/build.mjs  (dist/ is not committed: CI and the release workflow build it)
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { splitDist } from "./i18n-split.mjs";
import { bundle } from "./bundle.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8"));

const out = bundle("src/index.js").replace("__VERSION__", pkg.version);

mkdirSync(`${root}dist`, { recursive: true });
writeFileSync(`${root}dist/utility-meter-card.js`, out);
console.log(`Built dist/utility-meter-card.js (${(out.length / 1024).toFixed(1)} KB)`);

// Translations: English stays in the bundle, each other language goes to dist/utility-meter-card.i18n.<lang>.js,
// fetched when a card needs it (scripts/i18n-split.mjs).
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) splitDist(`${root}dist`, "utility-meter-card.js", { version: pkg.version });
