// Screenshot card.html into public/og.png, the image link previews show for every page.
//
//   node scripts/og/render.mjs      # from site/, with Chrome installed
//
// Uses headless Chrome over the DevTools protocol, so it needs no extra package. Set CHROME to
// the browser's path if it isn't in the default Windows location.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const card = pathToFileURL(join(here, 'card.html')).href;
const out = resolve(here, '../../public/og.png');
const chromePath = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9341;

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--allow-file-access-from-files',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'og-'))}`,
  'about:blank',
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    targets = await fetch(`http://127.0.0.1:${port}/json`)
      .then((r) => r.json())
      .catch(() => sleep(200));
  }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    pending.get(m.id)?.(m);
    pending.delete(m.id);
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      pending.set(++id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1200,
    height: 630,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.enable');
  await send('Page.navigate', { url: card });
  await sleep(800);
  await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log(`wrote ${out}`);
} finally {
  chrome.kill();
}
