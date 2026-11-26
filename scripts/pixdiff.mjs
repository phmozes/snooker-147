// Dev tool (night 4): compare two PNG screenshots pixel by pixel in headless Chrome.
// node scripts/pixdiff.mjs a.png b.png [tolerance 0..255, default 8] -> share of pixels that differ by more than that.
import { readFileSync } from 'node:fs';
import { launch } from './shot.mjs';

export async function pixdiff(a, b, tol = 8) {
  const br = await launch();
  const p = await br.newPage();
  const url = (f) => 'data:image/png;base64,' + readFileSync(f).toString('base64');
  const res = await p.evaluate(async (ua, ub, t) => {
    const load = (u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = u; });
    const [ia, ib] = await Promise.all([load(ua), load(ub)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { error: `size ${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` };
    const px = (i) => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
    const da = px(ia), db = px(ib);
    let n = 0, max = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let k = 0; k < da.length; k += 4) {
      const d = Math.max(Math.abs(da[k] - db[k]), Math.abs(da[k + 1] - db[k + 1]), Math.abs(da[k + 2] - db[k + 2]));
      if (d > max) max = d;
      if (d > t) { n++; const x = (k / 4) % ia.width, y = Math.floor(k / 4 / ia.width); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
    return { differ: n, of: da.length / 4, share: n / (da.length / 4), maxDiff: max, box: n ? [x0, y0, x1, y1] : null };
  }, url(a), url(b), tol);
  await br.close();
  return res;
}

if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const [a, b, t = '8'] = process.argv.slice(2);
  console.log(JSON.stringify(await pixdiff(a, b, Number(t))));
}
