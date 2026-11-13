import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { gifs, shots } from "../scripts/screenshot-list.mjs";

const twinOf = (list, s) => list.find((t) => t.file === `${s.file}-${s.theme === "light" ? "dark" : "light"}`);
const rest = ({ file, theme, ...r }) => r;

for (const [kind, list] of [
  ["screenshot", shots],
  ["animation", gifs],
]) {
  test(`every ${kind} has a twin in the other theme showing the same state`, () => {
    const paired = new Set();
    for (const s of list) {
      if (paired.has(s.file)) continue;
      const twin = twinOf(list, s);
      assert.ok(twin, `${s.file} has no ${s.theme === "light" ? "-dark" : "-light"} twin`);
      assert.notEqual(twin.theme, s.theme, `${s.file} and ${twin.file} use the same theme`);
      // Same card, config, mock states and clicks: only the theme may change.
      assert.deepEqual(rest(twin), rest(s), `${twin.file} does not show the same state as ${s.file}`);
      paired.add(s.file).add(twin.file);
    }
    assert.equal(paired.size, list.length);
  });
}

test("every file in screenshots/ is rendered by the screenshot script", () => {
  const rendered = new Set([...shots.map((s) => `${s.file}.png`), ...gifs.map((g) => `${g.file}.gif`)]);
  const files = readdirSync(new URL("../screenshots/", import.meta.url));
  assert.deepEqual(files.filter((f) => !rendered.has(f)), []);
  assert.deepEqual([...rendered].filter((f) => !files.includes(f)), []);
});

// The screenshot script rewrites a capture only when its decoded pixels change (see scripts/pixels.mjs): exactly.
test("captures are compared by their exact pixels, size and frame count included", async () => {
  const { samePixels } = await import("../scripts/pixels.mjs");
  const img = (w, h, bytes) => ({ width: w, height: h, frames: bytes.length / (w * h * 4), data: Uint8Array.from(bytes) });
  const a = img(1, 2, [10, 20, 30, 255, 40, 50, 60, 255]);
  assert.equal(samePixels(a, img(1, 2, [10, 20, 30, 255, 40, 50, 60, 255])), true, "same pixels, other bytes on disk");
  assert.equal(samePixels(a, img(1, 2, [11, 20, 30, 255, 40, 50, 60, 255])), false, "no tolerance");
  assert.equal(samePixels(a, img(2, 1, [10, 20, 30, 255, 40, 50, 60, 255])), false, "another size");
  assert.equal(samePixels(a, img(1, 2, [10, 20, 30, 255, 40, 50, 60, 255, 10, 20, 30, 255, 40, 50, 60, 255])), false, "another frame count");
  assert.equal(samePixels(a, undefined), false);
});

test("the screenshot script writes a capture only through the pixel comparison", () => {
  const src = readFileSync(new URL("../scripts/screenshots.mjs", import.meta.url), "utf8");
  assert.match(src, /from "\.\/pixels\.mjs"/);
  // No capture goes straight to screenshots/: Playwright and ffmpeg write to a temporary file first.
  assert.doesNotMatch(src, /path:\s*`\$\{root\}screenshots\//);
  assert.doesNotMatch(src, /const out = `\$\{root\}screenshots\//);
  assert.match(src, /unchanged\(/);
});
