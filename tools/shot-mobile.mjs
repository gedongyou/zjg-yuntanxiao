/* 手机端按板块截图（390 宽）
 * 用法：node tools/shot-mobile.mjs <outDir>
 */
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = process.argv[2] || 'C:\\Users\\gx\\OneDrive\\Desktop\\殷宇彤\\素材\\截图\\第二版\\手机端';
await mkdir(OUT, { recursive: true });

const CHROME = [
  'C:\\Users\\gx\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

const port = 9333 + Math.floor(Math.random() * 400);
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--force-device-scale-factor=1',
  `--remote-debugging-port=${port}`,
  '--user-data-dir=' + process.env.TEMP + '\\cdp-mob-' + port,
  'about:blank',
], { stdio: 'ignore' });

async function httpJson(p) {
  for (let i = 0; i < 60; i++) {
    try { return await (await fetch(`http://127.0.0.1:${port}${p}`)).json(); } catch { await sleep(250); }
  }
  throw new Error('Chrome 没有起来');
}
const targets = await httpJson('/json/list');
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r, e) => { ws.onopen = r; ws.onerror = e; });
let id = 0;
const pend = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) {
    const p = pend.get(m.id); pend.delete(m.id);
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
  }
};
const send = (method, params = {}) => {
  const i = ++id;
  ws.send(JSON.stringify({ id: i, method, params }));
  return new Promise((res, rej) => pend.set(i, { res, rej }));
};
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true });
await send('Page.navigate', { url: 'http://127.0.0.1:7717/' });
await sleep(2600);

await ev(`(function(){
  document.querySelectorAll('.reveal').forEach(function(e){ e.classList.add('is-in'); });
  document.querySelectorAll('#timeline li').forEach(function(e){ e.classList.add('is-on'); });
  var u = document.getElementById('pan');
  if (u) { u.classList.add('is-open'); var b = document.getElementById('unrollBand'); if (b) b.style.width='100%'; }
  var fr = document.querySelectorAll('.unroll__frame > *');
  fr.forEach(function(e,i){ e.classList.toggle('is-on', i===fr.length-1); });
  document.querySelectorAll('[data-count]').forEach(function(e){ e.textContent = e.getAttribute('data-count'); });
  document.querySelectorAll('img[loading="lazy"]').forEach(function(e){ e.loading='eager'; });
  window.scrollTo(0,0);
})()`);
for (let i = 0; i < 30; i++) {
  const bad = await ev(`[].slice.call(document.images).filter(function(x){return !x.complete||!x.naturalWidth;}).length`);
  if (!bad) break;
  await sleep(200);
}
await sleep(400);

const info = await ev(`(function(){
  var out = [];
  document.querySelectorAll('main > section, main > div').forEach(function(s){
    var r = s.getBoundingClientRect();
    if (r.height < 80) return;
    out.push({ key: (s.id||s.className.split(' ')[0]||''), y: Math.round(r.top + window.scrollY), h: Math.round(r.height) });
  });
  return { secs: out, total: Math.round(document.documentElement.scrollHeight), w: Math.round(document.documentElement.scrollWidth) };
})()`);
console.log(JSON.stringify(info, null, 1));

const names = { hero:'01-首屏', pan:'02-校园长卷', numbers:'03-数字', stops:'04-七站导览',
                majors:'05-系部专业', craft:'06-匠心与荣誉', admit:'07-招生信息' };
for (const s of info.secs) {
  const r = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: Math.max(0, s.y - 20), width: 390, height: Math.min(s.h + 40, 3000), scale: 1 },
  });
  const f = OUT + '\\' + (names[s.key] || s.key) + '.png';
  await writeFile(f, Buffer.from(r.data, 'base64'));
  console.log(f);
}

ws.close();
proc.kill();
process.exit(0);
