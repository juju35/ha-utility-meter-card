// Keyboard access, readable state colors and reduced motion.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { mockStatistics, states } from "../scripts/mock-states.mjs";
import { flush, load, makeHass } from "./load.mjs";

const um = load();
const source = readFileSync(new URL("../src/utility-meter-card.js", import.meta.url), "utf8");

const render = async (Card, config) => {
  const card = new Card();
  card.setConfig({ collapsed: [], ...config });
  card.hass = makeHass(JSON.parse(JSON.stringify(states)), mockStatistics);
  await flush();
  return card;
};

// Opening tags of the elements a click acts on: an entity (more-info) or an action.
const clickables = (html) => html.match(/<[a-z-]+\b[^>]*\bdata-(?:entity|action)="[^"]*"[^>]*>/g) || [];

test("every clickable element of the full and mini cards can be reached and used from the keyboard", async () => {
  const full = await render(um.Card, { entity: "sensor.cottage_water_meter", leak_entity: "binary_sensor.cottage_leak", flow_entity: "sensor.water_flow", price: 2 });
  const mini = await render(um.MiniCard, { entity: "sensor.water_meter", flow_entity: "sensor.water_flow" });
  for (const card of [full, mini]) {
    const tags = clickables(card.shadowRoot.innerHTML).filter((tag) => !/data-action="popup_backdrop"/.test(tag));
    assert.ok(tags.length > 5, "the card has clickable elements");
    for (const tag of tags) {
      if (tag.startsWith("<button")) continue;
      assert.match(tag, /\brole="button"/, tag);
      assert.match(tag, /\btabindex="0"/, tag);
    }
  }
});

test("Enter and Space on an element with the button role click it", async () => {
  const card = await render(um.Card, { entity: "sensor.water_meter" });
  let clicks = 0;
  const target = { getAttribute: (a) => (a === "role" ? "button" : null), click: () => clicks++ };
  for (const key of ["Enter", " ", "a"]) card.shadowRoot.listeners.keydown({ key, target, preventDefault() {} });
  assert.equal(clicks, 2);
});

test("the chart bars and the picture have a text alternative", async () => {
  const card = await render(um.Card, { entity: "sensor.water_meter" });
  const html = card.shadowRoot.innerHTML;
  for (const tag of html.match(/<div class="slot[^>]*>/g)) assert.match(tag, /aria-label="[^"]+: [^"]+"/);
  assert.match(html, /<div class="picture clickable[^"]*" role="button" tabindex="0" aria-label="Water meter · Normal"/);
});

test("animations only run in an animated state, and every one stops with prefers-reduced-motion", () => {
  assert.match(source, /@media \(prefers-reduced-motion: reduce\) \{ \*, \*::before, \*::after \{ transition: none !important; animation: none !important; \} \}/);
  const uses = [...source.matchAll(/^\s*([^{}\n]+)\{[^}]*\banimation: um-/gm)].map((m) => m[1].trim());
  assert.ok(uses.length >= 6, uses.join(" | "));
  for (const sel of uses) assert.match(sel, /\.(active|leak|crit)\b/, sel);
});

test("state colors in text are mixed with the text color for contrast", () => {
  for (const m of source.matchAll(/color: color-mix\(in srgb, var\(--(?:c|um-[a-z]+)[^)]*\) (\d+)%, ([^)]+)\)/g)) {
    assert.ok(Number(m[1]) <= 65, m[0]);
    assert.match(m[2], /var\(--primary-text-color|transparent/, m[0]);
  }
});
