// The card in parents outside the native views (a grid or horizontal stack, layout-card): it neither falls to its
// borders where it is sized by its content nor overflows a narrow track. Rendered in Chromium when Playwright and a
// browser are available (CHROMIUM_PATH, or `npx playwright install chromium`); skipped otherwise.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { mockStatistics, NOW, states } from "../scripts/mock-states.mjs";

const source = readFileSync(new URL("../src/utility-meter-card.js", import.meta.url), "utf8");

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}
const browser = await chromium?.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}).catch(() => null);

const HA_CARD = `customElements.define("ha-card", class extends HTMLElement { constructor() { super();
  this.attachShadow({ mode: "open" }).innerHTML = "<style>:host{display:block;border:1px solid #ddd;overflow:hidden}</style><slot></slot>"; } });`;

const CONTEXTS = [];
for (const w of [320, 600]) {
  CONTEXTS.push([`inline-block ${w}`, w, "display:inline-block", 1]);
  CONTEXTS.push([`flex 1 1 0 ${w}`, w, "display:flex", 2, "flex:1 1 0"]);
}
for (const w of [320, 500]) CONTEXTS.push([`grid 1fr 1fr ${w}`, w, "display:grid;grid-template-columns:1fr 1fr;gap:8px", 2]);

for (const type of ["utility-meter-card", "utility-meter-mini-card"]) {
  test(`${type} keeps a width and stays inside shrink-to-fit, grid and flex parents`, { skip: !browser && "no Chromium" }, async () => {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, timezoneId: "UTC" });
    try {
      await page.clock.setFixedTime(new Date(NOW));
      await page.setContent('<!doctype html><body style="margin:0;font-family:Arial,sans-serif"></body>');
      await page.addScriptTag({ content: HA_CARD });
      await page.addScriptTag({ content: `window.mockStatistics = ${mockStatistics};` });
      await page.addScriptTag({ content: source });
      const results = await page.evaluate(
        async ({ type, CONTEXTS, states }) => {
          const hass = { states, language: "en", locale: { language: "en" }, config: { currency: "EUR" }, themes: {}, callWS: async (m) => window.mockStatistics(m) };
          const runs = [];
          for (const [name, width, parentStyle, count, itemStyle = ""] of CONTEXTS) {
            const outer = document.body.appendChild(document.createElement("div"));
            outer.style.width = `${width}px`;
            const parent = outer.appendChild(document.createElement("div"));
            parent.style.cssText = parentStyle;
            const cards = [];
            for (let i = 0; i < count; i++) {
              const card = document.createElement(type);
              card.setConfig({ type: `custom:${type}`, entity: "sensor.water_meter", price: 4 });
              card.hass = hass;
              card.style.cssText = itemStyle;
              parent.appendChild(card);
              cards.push(card);
            }
            runs.push({ name, outer, cards });
          }
          await new Promise((r) => setTimeout(r, 50));
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          return runs.map(({ name, outer, cards }) => ({
            name,
            cards: cards.map((card) => {
              const box = outer.getBoundingClientRect();
              const haCard = card.shadowRoot.querySelector("ha-card").getBoundingClientRect();
              let inside = 0;
              for (const e of card.shadowRoot.querySelectorAll("ha-card *")) {
                if (e.closest("svg") || e.tagName === "STYLE") continue;
                const r = e.getBoundingClientRect();
                if (r.width) inside = Math.max(inside, Math.round(r.right - haCard.right));
              }
              return { width: Math.round(haCard.width), overflow: Math.round(haCard.right - box.right), inside };
            }),
          }));
        },
        { type, CONTEXTS, states },
      );
      const natural = type === "utility-meter-card" ? 360 : 300;
      for (const { name, cards } of results) {
        for (const { width, overflow, inside } of cards) {
          assert.ok(overflow <= 0, `${name}: the card overflows its parent by ${overflow} px (width ${width})`);
          assert.ok(width >= 100, `${name}: the card falls to ${width} px`);
          assert.ok(inside <= 0, `${name}: content ${inside} px outside the card (width ${width})`);
        }
        if (/^inline-block 600/.test(name)) assert.equal(cards[0].width, natural, name);
      }
    } finally {
      await page.close();
    }
  });
}

test.after(() => browser?.close());
