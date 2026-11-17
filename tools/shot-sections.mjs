/* 按板块逐个截图：先量每段的 top/height，再按段落切片，文件名带段名与序号
 * 用法：node tools/shot-sections.mjs <outDir>
 */
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = process.argv[2] || 'C:\\Users\\gx\\OneDrive\\Desktop\\殷宇彤\\素材\\截图\\第二版';
const URL = process.argv[3] || 'http://127.0.0.1:7717/';
await mkdir(OUT, { recursive: true });

const CHROME = [
  'C:\\Users\\gx\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

const port = 9333 + Math.floor(Math.random() * 400);
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--force-device-scale-factor=1',
  `--remote-debugging-port=${port}`,
  '--user-data-dir=' + process.env.TEMP + '\\cdp-sec-' + port,
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
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL });
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

const sections = await ev(`(function(){
  var out = [];
  var names = { hero:'01-首屏', pan:'02-校园长卷', numbers:'03-数字', walk:'04-七站导览',
                majors:'05-系部专业', craft:'06-匠心与荣誉', admit:'07-招生信息' };
  document.querySelectorAll('main > section, main > div').forEach(function(s){
    var r = s.getBoundingClientRect();
    var y = r.top + window.scrollY;
    if (r.height < 80) return;
    var key = (s.id || '') || (s.className.split(' ')[0] || '');
    out.push({ key: key, name: names[key] || key, y: Math.round(y), h: Math.round(r.height) });
  });
  return { secs: out, total: Math.round(document.documentElement.scrollHeight) };
})()`);
console.log(JSON.stringify(sections, null, 1));

const full = await send('Page.captureScreenshot', {
  format: 'png', captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: 1440, height: sections.total, scale: 1 },
});
await writeFile(OUT + '\\00-整页.png', Buffer.from(full.data, 'base64'));
console.log(OUT + '\\00-整页.png');

for (const s of sections.secs) {
  const y0 = Math.max(0, s.y - 40);
  const h = Math.min(s.h + 80, 3000);
  const r = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: y0, width: 1440, height: h, scale: 1 },
  });
  const f = OUT + '\\' + s.name + '.png';
  await writeFile(f, Buffer.from(r.data, 'base64'));
  console.log(f + '  h=' + h);
}

ws.close();
proc.kill();
process.exit(0);
