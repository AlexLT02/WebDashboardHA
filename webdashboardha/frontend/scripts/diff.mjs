// Edge overlay of a render against its mockup (both 2048 x 1536):
//   white = edge in both, cyan = only in the mockup (Soll), red = only in the render (Ist).
// Usage: node scripts/diff.mjs <soll.png> <ist.png> <out.png>
// Runs in the own headless Chrome (canvas), no image library needed.
import { readFileSync, writeFileSync } from "node:fs";
import { launch } from "./cdp.mjs";

const [soll, ist, out] = process.argv.slice(2);
if (!soll || !ist || !out) {
  console.error("usage: node scripts/diff.mjs <soll.png> <ist.png> <out.png>");
  process.exit(2);
}
const url = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
const c = await launch({ touch: false });
try {
  const res = await c.eval(`(async () => {
    const load = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
    const [a, b] = await Promise.all([load(${JSON.stringify(url(soll))}), load(${JSON.stringify(url(ist))})]);
    const w = a.width, h = a.height;
    const px = (img) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.drawImage(img, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
    const edges = (d) => { const e = new Uint8Array(w * h); const lum = (i) => (d[i] * 3 + d[i + 1] * 6 + d[i + 2]) / 10;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = (y * w + x) * 4;
        const gx = lum(i + 4) - lum(i - 4), gy = lum(i + w * 4) - lum(i - w * 4);
        if (gx * gx + gy * gy > 400) e[y * w + x] = 1; } return e; };
    const ea = edges(px(a)), eb = edges(px(b));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
    const img = g.createImageData(w, h); let both = 0, onlyA = 0, onlyB = 0;
    for (let p = 0; p < w * h; p++) { const o = p * 4; img.data[o + 3] = 255;
      if (ea[p] && eb[p]) { img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; both++; }
      else if (ea[p]) { img.data[o + 1] = 200; img.data[o + 2] = 255; onlyA++; }
      else if (eb[p]) { img.data[o] = 255; img.data[o + 1] = 60; img.data[o + 2] = 60; onlyB++; } }
    g.putImageData(img, 0, 0);
    return { png: cv.toDataURL('image/png'), both, onlyA, onlyB, w, h };
  })()`);
  writeFileSync(out, Buffer.from(res.png.split(",")[1], "base64"));
  console.log(JSON.stringify({ out, size: `${res.w}x${res.h}`, both: res.both, onlySoll: res.onlyA, onlyIst: res.onlyB }));
} finally {
  c.close();
}
