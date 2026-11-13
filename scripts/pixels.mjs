// Pixel comparison for the screenshot script: a capture is written only when its decoded pixels differ from the
// file already there, so a run that renders the same picture (a PNG or GIF encoded to other bytes) leaves the file,
// and git, untouched. The comparison is exact: any pixel that changed rewrites the capture.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

// Every frame of an image or animation as raw RGBA, with its size: { width, height, frames, data }.
export function decode(path) {
  const [width, height] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path])
    .toString()
    .trim()
    .split(",")
    .map(Number);
  const data = execFileSync("ffmpeg", ["-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 30 });
  return { width, height, frames: data.length / (width * height * 4), data };
}

// True when the two decoded images have the same size, frame count and pixels.
export function samePixels(a, b) {
  if (!a || !b || a.width !== b.width || a.height !== b.height || a.data.length !== b.data.length) return false;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) return false;
  return true;
}

// True when `fresh` (a new render) shows the same pixels as `target` (the committed file); false when the target
// does not exist yet. SCREENSHOTS_FORCE=1 rewrites every capture.
export const unchanged = (fresh, target) =>
  !process.env.SCREENSHOTS_FORCE && existsSync(target) && samePixels(decode(fresh), decode(target));
