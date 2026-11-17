// The status pill rule, in a real browser (Chromium through Playwright; CHROMIUM_PATH, or skipped without one):
// in every header (illustrated or classic) of the full and the mini card (compact and expanded), in English, French,
// German, Hungarian, Greek and Russian, from 190 to 500 px: on the title row only with the whole title beside it,
// otherwise under the subtitle (cut to one line); its whole label or its dot alone (always the dot at 200 px or less);
// nothing below the top of the banner's ground strip nor out of the banner.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { mockStatistics, NOW, states } from "../scripts/mock-states.mjs";

const source = readFileSync(new URL("../src/utility-meter-card.js", import.meta.url), "utf8");
const CHECK = "// Page-side check of the status pill rule on one rendered card: returns the problems found.\nwindow.__pillCheck = (card, width) => {\n  const out = [];\n  let seen = 0;\n  const root = card.shadowRoot;\n  const box = (e) => e.getBoundingClientRect();\n  const mid = (b) => b.top + b.height / 2;\n  for (const t of root.querySelectorAll(window.__PILL_TITLES || \".titles\")) {\n    const chips = [...t.querySelectorAll(window.__PILL_CHIP || \".chip\")].filter((c) => box(c).width);\n    const name = t.querySelector(window.__PILL_NAME || \".name\");\n    if (!chips.length || !name || !box(name).width) continue;\n    const chip = chips[0];\n    seen++;\n    const text = chip.querySelector(window.__PILL_TEXT || \".chip-text\");\n    const dot = !text || getComputedStyle(text).display === \"none\" || !box(text).width;\n    const n = box(name), c = box(chip), tb = box(t);\n    const inline = Math.abs(mid(c) - mid(n)) <= 3 && c.left >= n.right - 0.5;\n    const nameWhole = name.scrollWidth <= name.clientWidth + 1;\n    if (!dot && text.scrollWidth > text.clientWidth + 1) out.push(\"pill label cut\");\n    if (width <= 200 && !dot) out.push(\"pill label shown at <= 200 px\");\n    if (inline && !dot && !nameWhole) out.push(\"title ellipsised with the pill beside it\");\n    if (!inline) {\n      if (c.top < n.bottom - 0.5) out.push(\"pill neither on the title row nor below\");\n      const gap = 8;\n      const fits = name.scrollWidth + gap + c.width <= tb.width - 0.5;\n      if (fits) out.push(`pill below although it fits (${name.scrollWidth}+${c.width} <= ${tb.width})`);\n      if (name.scrollWidth <= tb.width - 0.5 && !nameWhole) out.push(\"title ellipsised although it fits alone\");\n    }\n    if (c.right > tb.right + 1) out.push(\"pill outside the title block\");\n    const banner = t.closest(window.__PILL_BANNER || \".banner\");\n    if (banner) {\n      const b = box(banner);\n      const g = banner.querySelector(window.__PILL_GROUND || \".ground\");\n      const floor = b.bottom - (g ? box(g).height : 10);\n      for (const e of [name, chip, ...t.querySelectorAll(window.__PILL_SUB || \".sub\")]) {\n        const r = box(e);\n        if (!r.height || getComputedStyle(e).display === \"none\") continue;\n        if (r.bottom > floor + 0.5) out.push(`${e.className} below the ground strip top (${r.bottom - floor})`);\n        if (r.top < b.top - 0.5 || r.right > b.right + 0.5 || r.left < b.left - 0.5) out.push(`${e.className} outside the banner`);\n      }\n    }\n    for (const s of t.querySelectorAll(window.__PILL_SUB || \".sub\")) {\n      if (!inline && box(s).height > 24 && getComputedStyle(s).display !== \"none\") out.push(\"subtitle on more than one line with the pill below\");\n    }\n  }\n  if (!seen) out.push(\"no status pill found\");\n  return out;\n};\n";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}
const browser = await chromium?.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}).catch(() => null);

const LANGS = ["en", "fr", "de", "hu", "el", "ru"];
const WIDTHS = [190, 245, 300, 400, 460, 500];
const HA_CARD = `customElements.define("ha-card", class extends HTMLElement { constructor() { super();
  this.attachShadow({ mode: "open" }).innerHTML = "<style>:host{display:block;border:1px solid #ddd;overflow:hidden}</style><slot></slot>"; } });`;
// A normal meter, a leak ("Leak suspected", the longest label) and a long title.
const CONFIGS = [
  { entity: "sensor.water_meter", price: 4 },
  { entity: "sensor.cottage_water_meter", leak_entity: "binary_sensor.cottage_leak", price: 3.9 },
  { entity: "sensor.gas_meter", title: "Holiday home gas meter in the garage" },
];
const DATA = { states };

for (const [type, mini] of [["utility-meter-card", false], ["utility-meter-mini-card", true]]) {
  for (const illustration of [true, false]) {
    test(`${type}${illustration ? "" : " (classic header)"}: the status pill follows the placement rule`, { skip: !browser && "no Chromium" }, async () => {
      const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, timezoneId: "UTC" });
      try {
        await page.clock.setFixedTime(new Date(NOW));
        await page.setContent('<!doctype html><body style="margin:0;font-family:Roboto,Arial,sans-serif"></body>');
        await page.addScriptTag({ content: HA_CARD });
        await page.addScriptTag({ content: `window.mockStatistics = ${mockStatistics};` });
        await page.addScriptTag({ content: CHECK });
        await page.addScriptTag({ content: source });
        const problems = await page.evaluate(
          async ({ type, mini, illustration, LANGS, WIDTHS, CONFIGS, DATA }) => {
            const hassFor = (lang) => ({ states: DATA.states, language: lang, locale: { language: lang }, config: { currency: "EUR" }, themes: {}, callWS: async (m) => window.mockStatistics(m) });
            const cards = [];
            for (const lang of LANGS) {
              for (const config of CONFIGS) {
                for (const w of WIDTHS) {
                  for (const zoom of mini ? [false, true] : [false]) {
                    const outer = document.body.appendChild(document.createElement("div"));
                    outer.style.width = `${w}px`;
                    const card = outer.appendChild(document.createElement(type));
                    card.setConfig({ type: `custom:${type}`, ...config, language: lang, illustration });
                    card.hass = hassFor(lang);
                    cards.push({ card, w, zoom, name: `${lang} ${w}px ${JSON.stringify(config).slice(0, 60)}${zoom ? " expanded" : ""}` });
                  }
                }
              }
            }
            const settle = async () => {
              await new Promise((r) => setTimeout(r, 80));
              await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            };
            await settle();
            for (const c of cards) if (c.zoom) c.card._setZoom(true);
            await settle();
            const out = [];
            for (const { card, w, name } of cards) for (const p of window.__pillCheck(card, w)) out.push(`${name}: ${p}`);
            return out;
          },
          { type, mini, illustration, LANGS, WIDTHS, CONFIGS, DATA },
        );
        assert.deepEqual(problems, []);
      } finally {
        await page.close();
      }
    });
  }
}

test.after(() => browser?.close());
