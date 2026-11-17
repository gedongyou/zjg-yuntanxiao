/* 后台登录实测：用真实地址打开后台，输口令，确认进得去、三个 tab 都在
 * 用法：node tools/check-admin-login.mjs
 */
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = 'C:\\Users\\gx\\OneDrive\\Desktop\\殷宇彤\\_chk';
await mkdir(OUT, { recursive: true });

const CHROME = [
  'C:\\Users\\gx\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

const port = 9500 + Math.floor(Math.random() * 300);
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--force-device-scale-factor=1',
  `--remote-debugging-port=${port}`,
  '--user-data-dir=' + process.env.TEMP + '\\cdp-chk-' + port,
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
  if (r.exceptionDetails) return { err: r.exceptionDetails.exception?.description || r.exceptionDetails.text };
  return r.result.value;
};
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(OUT + '\\' + name + '.png', Buffer.from(r.data, 'base64'));
  console.log(OUT + '\\' + name + '.png');
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1560, height: 1000, deviceScaleFactor: 1, mobile: false });

const out = {};

/* 1. 正常走一遍：打开后台地址 -> 输口令 -> 进主界面 */
await send('Page.navigate', { url: 'http://127.0.0.1:7717/admin/' });
await sleep(2200);
out.gateVisible = await ev("!document.querySelector('#gate').hidden");
out.errText = await ev("document.querySelector('#gateErr').textContent");

out.type = await ev(`(() => {
  const i = document.querySelector('#gatePw');
  i.value = 'admin123';
  document.querySelector('#gateForm').dispatchEvent(new Event('submit', { cancelable: true }));
  return 'submitted';
})()`);
await sleep(2000);
out.afterLogin = await ev(`(() => ({
  gate: !document.querySelector('#gate').hidden,
  app: !document.querySelector('#app').hidden,
  err: document.querySelector('#gateErr').textContent,
  tabs: [...document.querySelectorAll('.tabs button')].map(b => b.textContent.trim()),
  cards: document.querySelectorAll('.card').length,
  iframe: (document.querySelector('#prevFrame') || {}).src
}))()`);
await shot('ok-1-after-login');

/* 2. 故意输错口令，看提示 */
await ev("localStorage.clear(); 1");
await send('Page.navigate', { url: 'http://127.0.0.1:7717/admin/' });
await sleep(1200);
await ev(`document.cookie = 'yy_token=; Max-Age=0; path=/'; 1`);
await send('Page.navigate', { url: 'http://127.0.0.1:7717/admin/' });
await sleep(1500);
out.badType = await ev(`(() => {
  const i = document.querySelector('#gatePw');
  i.value = 'wrongpass';
  document.querySelector('#gateForm').dispatchEvent(new Event('submit', { cancelable: true }));
  return 'submitted';
})()`);
await sleep(1200);
out.badResult = await ev(`(() => ({
  gate: !document.querySelector('#gate').hidden,
  err: document.querySelector('#gateErr').textContent
}))()`);
await shot('ok-2-bad-pw');

/* 3. 模拟"直接双击 admin/index.html"（file:// 打开）—— 离线模式，应该能直接进 */
await send('Page.navigate', { url: 'file:///C:/Users/gx/OneDrive/Desktop/%E6%AE%B7%E5%AE%87%E5%BD%A4/%E6%BA%90%E7%A0%81/admin/index.html' });
await sleep(1800);
out.fileMode = await ev(`(() => ({
  gate: !document.querySelector('#gate').hidden,
  mode: (document.querySelector('.top__l span') || {}).textContent,
  exp: !document.querySelector('#expBtn').hidden,
  imp: !document.querySelector('#impBtn').hidden,
  err: document.querySelector('#gateErr').textContent
}))()`);
out.fileLogin = await ev(`(() => {
  const i = document.querySelector('#gatePw');
  i.value = 'admin123';
  document.querySelector('#gateForm').dispatchEvent(new Event('submit', { cancelable: true }));
  return 'submitted';
})()`);
await sleep(1800);
out.fileAfter = await ev(`(() => ({
  gate: !document.querySelector('#gate').hidden,
  app: !document.querySelector('#app').hidden,
  err: document.querySelector('#gateErr').textContent,
  cards: document.querySelectorAll('.card').length,
  theme: (() => { const s = document.querySelector('#pane .card:last-child'); return !!s; })()
}))()`);
await shot('ok-3-offline');

console.log(JSON.stringify(out, null, 1));

ws.close();
proc.kill();
process.exit(0);
