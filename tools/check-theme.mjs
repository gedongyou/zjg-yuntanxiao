/* 验证配色预设与恢复默认 */
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

const port = 9900 + Math.floor(Math.random() * 90);
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check', '--force-device-scale-factor=1',
  `--remote-debugging-port=${port}`,
  '--user-data-dir=' + process.env.TEMP + '\\cdp-th-' + port,
  'about:blank',
], { stdio: 'ignore' });

async function httpJson(path) {
  for (let i = 0; i < 60; i++) {
    try { return await (await fetch(`http://127.0.0.1:${port}${path}`)).json(); }
    catch { await sleep(250); }
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
await send('Emulation.setDeviceMetricsOverride', { width: 1560, height: 1000, deviceScaleFactor: 1, mobile: false });

const loaded = new Promise((res) => {
  const on = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Page.loadEventFired') { ws.removeEventListener('message', on); res(); }
  };
  ws.addEventListener('message', on);
});
await send('Page.navigate', { url: 'http://127.0.0.1:7717/admin/' });
await Promise.race([loaded, sleep(8000)]);
await sleep(700);

async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}
async function shot(name) {
  const p = OUT + '\\' + name + '.png';
  const r = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(p, Buffer.from(r.data, 'base64'));
  return p;
}

await evalJs(`document.querySelector('#gatePw').value='admin123';
  document.querySelector('#gateForm').dispatchEvent(new Event('submit',{cancelable:true})); 1`);
await sleep(1400);

// 滚到配色区
const top = await evalJs(`(function(){var h=document.querySelectorAll('#pane .h');return Math.max(0,h[1].getBoundingClientRect().top+window.scrollY-20);})()`);
await evalJs(`window.scrollTo(0,${top}); 1`);
await sleep(400);

// 数一数预设按钮
const sw = await evalJs(`document.querySelectorAll('#pane .swatch').length`);
console.log('预设色块数 =', sw);

// 点「墨色」的第 2 个预设（藏青）
await evalJs(`document.querySelectorAll('[data-swatch="theme.ink"]')[1].click(); 1`);
await sleep(300);
const afterInk = await evalJs(`(function(){
  var t = document.querySelector('[data-p="theme.ink"][data-color-txt]');
  var c = document.querySelector('[data-p="theme.ink"][data-color]');
  return t.value + ' / ' + c.value + ' / on=' + document.querySelectorAll('[data-swatch="theme.ink"].is-on').length;
})()`);
console.log('点藏青后 =', afterInk);

// 点「主红」第 2 个预设（胭脂）
await evalJs(`document.querySelectorAll('[data-swatch="theme.red"]')[1].click(); 1`);
await sleep(300);
console.log('主红 =', await evalJs(`document.querySelector('[data-p="theme.red"][data-color-txt]').value`));

// 手动改十六进制
await evalJs(`(function(){
  var i = document.querySelector('[data-p="theme.paper"][data-color-txt]');
  i.value = '#F0EEE6';
  i.dispatchEvent(new Event('change',{bubbles:true}));
  return 1;
})()`);
await sleep(300);
console.log('手填纸色 =', await evalJs(`document.querySelector('[data-p="theme.paper"][data-color-txt]').value`));

// 非法值应被拦
await evalJs(`(function(){
  var i = document.querySelector('[data-p="theme.paper"][data-color-txt]');
  i.value = 'zzz';
  i.dispatchEvent(new Event('change',{bubbles:true}));
  return 1;
})()`);
await sleep(200);
console.log('非法值后 toast =', await evalJs(`document.querySelector('#toast').textContent`));

const shotBefore = await shot('t1-presets');
console.log(shotBefore);

// 恢复默认
await evalJs(`(function(){
  window.confirm = function(){ return true; };
  document.querySelector('#themeReset').click();
  return 1;
})()`);
await sleep(500);
const afterReset = await evalJs(`(function(){
  var o = {};
  ['paper','paper2','ink','red','gold'].forEach(function(k){
    o[k] = document.querySelector('[data-p="theme.'+k+'"][data-color-txt]').value;
  });
  o.contrast = document.querySelector('[data-p="theme.contrast"]').value;
  o.density = document.querySelector('[data-p="theme.density"]').value;
  o.gray = document.querySelector('[data-p="theme.imgGray"]').value;
  o.onCount = document.querySelectorAll('#pane .swatch.is-on').length;
  o.dirty = !document.querySelector('#dirtyDot').hidden;
  return o;
})()`);
console.log('恢复默认后 =', JSON.stringify(afterReset));
console.log(await shot('t2-reset'));

ws.close();
proc.kill();
process.exit(0);
