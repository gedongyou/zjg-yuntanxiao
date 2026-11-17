/* 截图工具：用 CDP 驱动本地 Chrome，做整页截图（桌面 / 手机）。
 * 用法：node tools/shot.mjs <url> <out.png> [宽] [高] [mobile]
 * 依赖：Node 22+ 自带的全局 WebSocket，无第三方包。
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const [url, out, wArg, hArg, mobileArg] = process.argv.slice(2);
if (!url || !out) {
  console.error('用法: node tools/shot.mjs <url> <out.png> [宽] [高] [mobile]');
  process.exit(1);
}
const W = Number(wArg || 1440);
const H = Number(hArg || 960);
const MOBILE = mobileArg === 'mobile';

const CHROME = [
  'C:\\Users\\gx\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

const port = 9333 + Math.floor(Math.random() * 400);
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check',
  '--force-device-scale-factor=1',
  `--remote-debugging-port=${port}`,
  '--user-data-dir=' + process.env.TEMP + '\\cdp-shot-' + port,
  'about:blank',
], { stdio: 'ignore' });

async function httpJson(path) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}${path}`);
      return await r.json();
    } catch { await sleep(250); }
  }
  throw new Error('Chrome 没有起来');
}

const targets = await httpJson('/json/list');
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
};
function send(method, params = {}) {
  const mid = ++id;
  ws.send(JSON.stringify({ id: mid, method, params }));
  return new Promise((resolve, reject) => pending.set(mid, { resolve, reject }));
}

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: W, height: H, deviceScaleFactor: 1, mobile: MOBILE,
});
if (MOBILE) {
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await send('Emulation.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
}

const loaded = new Promise((res) => {
  const onMsg = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Page.loadEventFired') { ws.removeEventListener('message', onMsg); res(); }
  };
  ws.addEventListener('message', onMsg);
});
await send('Page.navigate', { url });
await Promise.race([loaded, sleep(8000)]);
await sleep(1200);

// 让所有 .reveal 与滚动触发的动画都跑完，并把懒加载图片都拉下来
await send('Runtime.evaluate', {
  expression: `
    (function(){
      document.querySelectorAll('.reveal').forEach(function(e){ e.classList.add('is-in'); });
      document.querySelectorAll('#timeline li').forEach(function(e){ e.classList.add('is-on'); });
      var u = document.getElementById('pan');
      if (u) { u.classList.add('is-open'); var b = document.getElementById('unrollBand'); if (b) b.style.width = '100%'; }
      var fr = document.querySelectorAll('.unroll__frame > *');
      fr.forEach(function(e,i){ e.classList.toggle('is-on', i === fr.length - 1); });
      document.querySelectorAll('[data-count]').forEach(function(e){ e.textContent = e.getAttribute('data-count'); });
      // 截图不受视口限制，但 loading=lazy 的图在没有滚过时不会请求，这里直接全部改成 eager
      document.querySelectorAll('img[loading="lazy"]').forEach(function(e){ e.loading = 'eager'; });
      window.scrollTo(0, 0);
    })();
  `,
});
// 等图片真的解码完（最多 6 秒）
for (let i = 0; i < 30; i++) {
  const st = await send('Runtime.evaluate', {
    expression: `(function(){var a=[].slice.call(document.images);return {n:a.length,bad:a.filter(function(x){return !x.complete||!x.naturalWidth;}).map(function(x){return x.getAttribute('src');})};})()`,
    returnByValue: true,
  });
  if (!st.result.value.bad.length) break;
  await sleep(200);
}
await sleep(500);

const metrics = await send('Page.getLayoutMetrics');
const width = Math.ceil(metrics.cssContentSize.width);
const height = Math.ceil(metrics.cssContentSize.height);

const shot = await send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
  clip: { x: 0, y: 0, width, height, scale: 1 },
});
await writeFile(out, Buffer.from(shot.data, 'base64'));
console.log(`${out}  ${width}×${height}`);

// 额外：按 y 区间切片，方便逐段核对（参数 y0 y1，单位 CSS px）
const y0 = Number(process.argv[7] || 0);
const y1 = Number(process.argv[8] || 0);
if (y1 > y0) {
  const part = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: y0, width, height: Math.min(y1 - y0, 3000), scale: 1 },
  });
  const partOut = out.replace(/\.png$/, `-${y0}-${y1}.png`);
  await writeFile(partOut, Buffer.from(part.data, 'base64'));
  console.log(`${partOut}`);
}

ws.close();
proc.kill();
process.exit(0);
