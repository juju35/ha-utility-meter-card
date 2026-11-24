// In a real browser (Chromium through Playwright; CHROMIUM_PATH, or skipped without one): a state update patches the
// card's shadow DOM in place instead of rebuilding it (no node replaced when only values change, none touched by
// another entity's update), and with a Lit-like <ha-card> (its content laid out a microtask after it is connected,
// as Home Assistant's) the status pill is placed right from the first frame.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mockStatistics, NOW, states } from "../scripts/mock-states.mjs";
import { source } from "./source.mjs";


let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {}
const browser = await chromium?.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}).catch(() => null);

// Lit-like: the slot (and so the content's layout) only after a microtask, with hasUpdated / updateComplete.
const HA_CARD = `customElements.define("ha-card", class extends HTMLElement {
  constructor() { super(); this.hasUpdated = false; this.attachShadow({ mode: "open" }); }
  connectedCallback() { if (this.hasUpdated) return; this.updateComplete = Promise.resolve().then(() => {
    this.shadowRoot.innerHTML = "<style>:host{display:block;border:1px solid #ddd;overflow:hidden}</style><slot></slot>"; this.hasUpdated = true; return true; }); }
});`;

const run = async (fn, arg) => {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, timezoneId: "UTC" });
  try {
    await page.clock.setFixedTime(new Date(NOW));
    await page.setContent('<!doctype html><body style="margin:0;font-family:Roboto,Arial,sans-serif"></body>');
    await page.addScriptTag({ content: HA_CARD });
    await page.addScriptTag({ content: `window.mockStatistics = ${mockStatistics};` });
    await page.addScriptTag({ content: source });
    return await page.evaluate(fn, arg);
  } finally {
    await page.close();
  }
};

for (const type of ["utility-meter-card", "utility-meter-mini-card"]) {
  test(`${type}: updates patch the shadow DOM in place`, { skip: !browser && "no Chromium" }, async () => {
    const out = await run(
      async ({ type, states }) => {
        const settle = async () => {
          await new Promise((r) => setTimeout(r, 80));
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        };
        const hass = (s) => ({ states: s, language: "en", locale: { language: "en" }, config: { currency: "EUR" }, themes: {}, callWS: async (m) => window.mockStatistics(m) });
        const outer = document.body.appendChild(document.createElement("div"));
        outer.style.width = "400px";
        const card = outer.appendChild(document.createElement(type));
        card.setConfig({ type: `custom:${type}`, entity: "sensor.water_meter", price: 4 });
        let s = { ...states };
        card.hass = hass(s);
        await settle();
        const haCard = card.shadowRoot.querySelector("ha-card");
        let removed = 0;
        let mutations = 0;
        const obs = new MutationObserver((list) => {
          for (const m of list) {
            mutations++;
            for (const n of m.removedNodes) if (n.nodeType === 1) removed++;
          }
        });
        obs.observe(card.shadowRoot, { subtree: true, childList: true, attributes: true, characterData: true });
        // Another entity: nothing touched.
        for (let i = 0; i < 10; i++) {
          s = { ...s, "sensor.unrelated": { entity_id: "sensor.unrelated", state: String(i), attributes: {} } };
          card.hass = hass(s);
          await settle();
        }
        obs.takeRecords();
        const foreign = mutations;
        // The card's own meter: its values change, its nodes stay.
        const base = Number(states["sensor.water_meter"].state);
        for (let i = 1; i <= 10; i++) {
          s = { ...s, "sensor.water_meter": { ...states["sensor.water_meter"], state: (base + i / 1000).toFixed(3) } };
          card.hass = hass(s);
          await settle();
        }
        for (const m of obs.takeRecords()) for (const n of m.removedNodes) if (n.nodeType === 1) removed++;
        obs.disconnect();
        return { foreign, removed, same: card.shadowRoot.querySelector("ha-card") === haCard };
      },
      { type, states },
    );
    assert.equal(out.foreign, 0, "another entity's update touches nothing");
    assert.equal(out.removed, 0, "no element replaced when only the meter's value changes");
    assert.ok(out.same, "the same <ha-card> after the updates");
  });

  test(`${type}: with a Lit-like <ha-card>, the pill is placed from the first frame`, { skip: !browser && "no Chromium" }, async () => {
    const out = await run(
      async ({ type, states }) => {
        const frame = () => new Promise((r) => requestAnimationFrame(r));
        const hass = { states, language: "en", locale: { language: "en" }, config: { currency: "EUR" }, themes: {}, callWS: async (m) => window.mockStatistics(m) };
        const res = [];
        for (const [w, title] of [
          [400, undefined],
          [300, "Holiday home water meter in the garage"],
        ]) {
          const outer = document.body.appendChild(document.createElement("div"));
          outer.style.width = `${w}px`;
          const card = outer.appendChild(document.createElement(type));
          card.setConfig({ type: `custom:${type}`, entity: "sensor.water_meter", price: 4, ...(title ? { title } : {}) });
          card.hass = hass;
          await frame();
          const first = [...card.shadowRoot.querySelectorAll(".titles")].map((t) => t.className);
          await new Promise((r) => setTimeout(r, 150));
          await frame();
          await frame();
          const later = [...card.shadowRoot.querySelectorAll(".titles")].map((t) => t.className);
          res.push({ w, first, later });
        }
        return res;
      },
      { type, states },
    );
    for (const r of out) assert.deepEqual(r.first, r.later, `${r.w}px: the pill's place at the first frame`);
  });
}

test.after(() => browser?.close());
