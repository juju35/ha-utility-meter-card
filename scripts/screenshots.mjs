// Renders the cards with mock meters and statistics and saves the README screenshots, on a fixed clock (NOW) and
// in UTC, so that the same code draws the same pictures any day.
// Usage: npm run build && npm run screenshots
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { mockStatistics, NOW, states } from "./mock-states.mjs";
import { unchanged } from "./pixels.mjs";
import { gifs, shots } from "./screenshot-list.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
mkdirSync(`${root}screenshots`, { recursive: true });

// Every capture is rendered to a temporary file and copied over screenshots/<file> only when its decoded pixels
// differ (scripts/pixels.mjs): a run that draws the same pictures changes no file, so the workflow commits nothing.
const work = mkdtempSync(join(tmpdir(), "um-shots-"));
const keep = (fresh, name) => {
  const target = `${root}screenshots/${name}`;
  if (unchanged(fresh, target)) return console.log(`screenshots/${name} (unchanged)`);
  copyFileSync(fresh, target);
  console.log(`screenshots/${name}`);
};
const cardJs = readFileSync(`${root}dist/utility-meter-card.js`, "utf8");

// Every uncaught page error is collected here; the script exits non-zero when any occurred.
const pageErrors = [];

const THEMES = {
  light: {
    "--primary-background-color": "#e8eaed",
    "--secondary-background-color": "#ececec",
    "--card-background-color": "#ffffff",
    "--primary-text-color": "#212121",
    "--secondary-text-color": "#727272",
    "--divider-color": "rgba(0,0,0,.12)",
  },
  dark: {
    "--primary-background-color": "#111111",
    "--secondary-background-color": "#282828",
    "--card-background-color": "#1c1c1c",
    "--primary-text-color": "#e1e1e1",
    "--secondary-text-color": "#9b9b9b",
    "--divider-color": "rgba(225,225,225,.12)",
  },
};

// Minimal stand-in for Home Assistant's <ha-card>.
const HA_CARD = `customElements.define("ha-card", class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML =
      "<style>:host{display:block;background:var(--card-background-color);border-radius:12px;" +
      "border:1px solid var(--divider-color);color:var(--primary-text-color);overflow:hidden}</style><slot></slot>";
  }
});`;

const page_html = (theme, width) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  :root { ${Object.entries(THEMES[theme])
    .map(([k, v]) => `${k}:${v};`)
    .join("")} }
  body { margin: 0; padding: 16px; background: var(--primary-background-color); color: var(--primary-text-color);
         font-family: Roboto, "Segoe UI", Helvetica, Arial, sans-serif; width: ${width}px; }
</style></head><body><div id="root"></div></body></html>`;

// Opens a card on a fresh page (its script declares top-level names, which cannot be evaluated twice in one page)
// and mounts it with the mock hass; `overrides` patch the mock states for this shot only.
async function openCard(browser, { file, type, config, theme, width, overrides }) {
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1000, height: 2000 }, timezoneId: "UTC", locale: "en-US" });
  page.on("pageerror", (err) => {
    console.error(`pageerror (${file}): ${err.message}`);
    pageErrors.push(`${file}: ${err.message}`);
  });
  await page.clock.setFixedTime(new Date(NOW));
  await page.setContent(page_html(theme, width));
  await page.addScriptTag({ content: HA_CARD });
  await page.addScriptTag({ content: `window.mockStatistics = ${mockStatistics};` });
  await page.addScriptTag({ content: cardJs });
  await page.evaluate(
    async ({ type, config, states, overrides, theme }) => {
      const st = structuredClone(states);
      for (const [id, o] of Object.entries(overrides || {})) st[id] = { ...st[id], ...o };
      const el = document.createElement(type);
      el.setConfig({ type: `custom:${type}`, ...config });
      el.hass = {
        states: st,
        entities: {},
        devices: {},
        language: "en",
        locale: { language: "en", first_weekday: "monday" },
        config: { currency: "EUR", time_zone: "UTC" },
        themes: { darkMode: theme === "dark" },
        callService: () => {},
        callWS: async (msg) => window.mockStatistics(msg),
      };
      document.getElementById("root").appendChild(el);
      // The statistics arrive asynchronously: let them in before the capture.
      await new Promise((r) => setTimeout(r, 50));
    },
    { type, config, states, overrides, theme },
  );
  return page;
}

// Every animation of the page: those of the document and of the card's shadow root (document.getAnimations()
// leaves out the shadow trees).
const animations = () => {
  const card = document.querySelector("#root").firstElementChild.shadowRoot;
  return [document, card].flatMap((r) => r.getAnimations());
};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
for (const s of shots) {
  const page = await openCard(browser, s);
  for (const sel of s.clicks || []) {
    // A mouse click (detail 1), not .click(): a keyboard-like click would move the focus and show its ring.
    await page.evaluate(
      (sel) =>
        document
          .querySelector("#root")
          .firstElementChild.shadowRoot.querySelector(sel)
          .dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 })),
      sel,
    );
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(500);
  const box = await page.locator("#root").boundingBox();
  await page.screenshot({
    path: join(work, `${s.file}.png`),
    clip: { x: 0, y: 0, width: s.width + 32, height: Math.ceil(box.height) + 32 },
    animations: "disabled",
  });
  keep(join(work, `${s.file}.png`), `${s.file}.png`);
  await page.close();
}

// Records one animated state as a looping GIF (screenshots/<gif.file>.gif) — needs ffmpeg on PATH.
// Every animation is paused and stepped frame by frame, so the GIF is identical whatever the machine's speed.
async function makeGif(browser, gif, { fps = 20, seconds = 3 } = {}) {
  const page = await openCard(browser, gif);
  await page.waitForTimeout(300);
  const box = await page.locator("#root").boundingBox();
  const clip = { x: 0, y: 0, width: gif.width + 32, height: Math.ceil(box.height) + 32 };
  const dir = mkdtempSync(join(tmpdir(), "um-frames-"));
  const frames = Math.round(fps * seconds);
  for (let i = 0; i < frames; i++) {
    const n = await page.evaluate(
      ({ t, src }) => {
        const all = new Function(`return (${src})()`)();
        for (const a of all) {
          a.pause();
          a.currentTime = t;
        }
        return all.length;
      },
      { t: (i * 1000) / fps, src: animations.toString() },
    );
    // An animated state with no animation to step would record frames at the machine's speed again.
    if (!n) throw new Error(`${gif.file}: no animation found to step`);
    await page.screenshot({ path: join(dir, `f${String(i).padStart(3, "0")}.png`), clip });
  }
  await page.close();
  const out = join(work, `${gif.file}.gif`);
  // Halve the retina capture and build a per-clip palette; Bayer dithering is an ordered pattern, so the same frames
  // give the same GIF.
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-framerate",
    String(fps),
    "-i",
    join(dir, "f%03d.png"),
    "-vf",
    `scale=${clip.width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
    "-loop",
    "0",
    out,
  ]);
  rmSync(dir, { recursive: true });
  keep(out, `${gif.file}.gif`);
}

for (const g of gifs) await makeGif(browser, g);
await browser.close();
rmSync(work, { recursive: true });

if (pageErrors.length) {
  console.error(`\n${pageErrors.length} page error(s) while rendering:`);
  for (const e of pageErrors) console.error(`  ${e}`);
  process.exitCode = 1;
}
