/* 后台截图：登录后台并逐页截图
 * 用法：node tools/shot-admin.mjs
 */
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = 'C:\\Users\\gx\\OneDrive\\Desktop\\殷宇彤\\_shots';
await mkdir(OUT, { recursive: true });

const CHROME = [
  'C:\\Users\\gx\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => existsSync(p));

const port = 9600 + Math.floor(Math.random() * 300);
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check',
  '--force-device-scale-factor=1',
  `--remote-debugging-port=${port}`,
  '--user-data-dir=' + process.env.TEMP + '\\cdp-admin-' + port,
  'about:blank',
], { stdio: 'ignore' });

async function httpJson(path) {
  for (let i = 0; i < 60; i++) {
    try {
      return await (await fetch(`http://127.0.0.1:${port}${path}`)).json();
    } catch { await sleep(250); }
  }
  throw new Error('Chrome 没起来');
}

const targets = await httpJson('/json/list');
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
  }
};
function send(method, params = {}) {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((resolve, reject) => pending.set(mid, { resolve, reject }));
}

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1560, height: 1000, deviceScaleFactor: 1, mobile: false,
});

const loaded = new Promise((res) => {
  const on = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Page.loadEventFired') { ws.removeEventListener('message', on); res(); }
  };
  ws.addEventListener('message', on);
});
await send('Page.navigate', { url: 'http://127.0.0.1:7717/admin/' });
await Promise.race([loaded, sleep(8000)]);
await sleep(800);

async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + JSON.stringify(r.exceptionDetails.exception || {}));
  return r.result.value;
}

async function shot(name, full = false) {
  const p = OUT + '\\' + name + '.png';
  const args = { format: 'png' };
  if (full) {
    const m = await send('Page.getLayoutMetrics');
    args.captureBeyondViewport = true;
    args.clip = { x: 0, y: 0, width: 1560, height: Math.ceil(m.cssContentSize.height), scale: 1 };
  }
  const r = await send('Page.captureScreenshot', args);
  await writeFile(p, Buffer.from(r.data, 'base64'));
  console.log(p);
}

// 登录页
await shot('a0-login');

// 登录
await evalJs(`(function(){
  document.querySelector('#gatePw').value='admin123';
  document.querySelector('#gateForm').dispatchEvent(new Event('submit',{cancelable:true}));
  return 1;
})()`);
await sleep(1500);
await shot('a1-layout');

// 逐个 tab
const tabs = ['content', 'ask'];
for (let i = 0; i < tabs.length; i++) {
  await evalJs(`document.querySelector('#tabs [data-tab="${tabs[i]}"]').click(); 1`);
  await sleep(700);
  await shot('a' + (i + 2) + '-' + tabs[i]);
}

// 回到排版页，单独截配色卡片（含六个颜色、预设与恢复默认按钮）
await evalJs(`document.querySelector('#tabs [data-tab="layout"]').click(); 1`);
await sleep(500);
// 卡片在 #pane 自己的滚动容器里，captureBeyondViewport 撑不开它 ——
// 把窗口临时调高，让整张卡一次进视口，再截
await send('Emulation.setDeviceMetricsOverride', { width: 1560, height: 1500, deviceScaleFactor: 1, mobile: false });
await sleep(400);
const themeBox = await evalJs(`(function(){
  var cards = document.querySelectorAll('#pane .card');
  var card = cards[cards.length - 1];
  if (!card) return null;
  card.scrollIntoView({ block: 'start' });
  var r = card.getBoundingClientRect();
  return { y: Math.round(r.top + window.scrollY - 10), h: Math.round(r.height + 20) };
})()`);
await sleep(400);
if (themeBox) {
  const r = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: Math.max(0, themeBox.y), width: 900, height: themeBox.h, scale: 1 },
  });
  await writeFile(OUT + '\\a4-theme.png', Buffer.from(r.data, 'base64'));
  console.log(OUT + '\\a4-theme.png  h=' + themeBox.h);
}
await send('Emulation.setDeviceMetricsOverride', { width: 1560, height: 1000, deviceScaleFactor: 1, mobile: false });

// 检查有没有 JS 报错
const errs = await evalJs(`(window.__errs||[]).join('|')`);

const check = await evalJs(`(function(){
  var o = {};
  o.gateHidden = document.querySelector('#gate').hidden;
  o.appShown = !document.querySelector('#app').hidden;
  o.paneLen = document.querySelector('#pane').innerHTML.length;
  o.cards = document.querySelectorAll('#pane .card').length;
  o.iframeSrc = document.querySelector('#prevFrame').src;
  return o;
})()`);
console.log('检查：', JSON.stringify(check));
console.log('错误：', errs || '(无)');

ws.close();
proc.kill();
process.exit(0);
