/**
 * Renders the app icons and iPhone splash screens (Step 1.5): the FOQUS wordmark on the background
 * color. Run once with `node scripts/make-icons.cjs` (needs Playwright with Chromium installed);
 * the PNGs are committed, so builds never need this.
 */
const path = require("path");
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("/opt/node22/lib/node_modules/playwright"));
}

const BG = "#0E0F12";
const ACCENT = "#FFB020";
const TEXT = "#F2F3F5";
const out = (...p) => path.join(__dirname, "..", "public", ...p);

/** The wordmark: "FOQUS" with the O as an accent ring (a focus target). */
const page = (w, h, size) => `<!doctype html><html><body style="margin:0;width:${w}px;height:${h}px;background:${BG};display:flex;align-items:center;justify-content:center">
<div style="font:800 ${size}px/1 'DejaVu Sans','Helvetica Neue',Arial,sans-serif;letter-spacing:${size * 0.04}px;color:${TEXT};display:flex;align-items:center">
F<span style="display:inline-block;width:${size * 0.78}px;height:${size * 0.78}px;border:${size * 0.16}px solid ${ACCENT};border-radius:50%;box-sizing:border-box;margin:0 ${size * 0.03}px"></span>QUS
</div></body></html>`;

const ICONS = [
  { file: "icon-192.png", px: 192, scale: 0.19 },
  { file: "icon-512.png", px: 512, scale: 0.19 },
  // Maskable: the wordmark stays inside the 80% safe zone.
  { file: "icon-maskable-512.png", px: 512, scale: 0.14 },
  { file: "apple-touch-icon.png", px: 180, scale: 0.19 },
];

/** iPhone portrait sizes (CSS points × pixel ratio) for apple-touch-startup-image. */
const SPLASH = [
  [375, 667, 2],
  [375, 812, 3],
  [390, 844, 3],
  [393, 852, 3],
  [402, 874, 3],
  [414, 896, 2],
  [414, 896, 3],
  [428, 926, 3],
  [430, 932, 3],
  [440, 956, 3],
];

(async () => {
  const browser = await chromium.launch();
  for (const i of ICONS) {
    const p = await browser.newPage({ viewport: { width: i.px, height: i.px } });
    await p.setContent(page(i.px, i.px, Math.round(i.px * i.scale)));
    await p.screenshot({ path: out("icons", i.file) });
    await p.close();
  }
  for (const [w, h, r] of SPLASH) {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: r });
    await p.setContent(page(w, h, 40));
    await p.screenshot({ path: out("splash", `splash-${w * r}x${h * r}.png`) });
    await p.close();
  }
  await browser.close();
  console.log("Icons and splash screens written to public/icons and public/splash.");
})();
