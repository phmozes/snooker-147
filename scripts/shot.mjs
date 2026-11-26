// Dev tool (night 4): screenshots of dev-server pages with the system's Chrome (puppeteer-core, no browser download).
// node scripts/shot.mjs <url> <out.png> [width] [height] [waitExpr]
// waitExpr: a JavaScript expression that must become true before the picture (default window.__ready).
import puppeteer from 'puppeteer-core';

export const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export async function launch() {
  return puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
}

if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const [url, out, w = '390', h = '844', wait = 'window.__ready === true'] = process.argv.slice(2);
  const b = await launch();
  const p = await b.newPage();
  p.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: 1 });
  await p.goto(url, { waitUntil: 'networkidle0', timeout: 120000 });
  await p.waitForFunction(wait, { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 500));
  await p.screenshot({ path: out });
  await b.close();
  console.log('saved', out);
}
