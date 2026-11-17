/* 交互检查：打开问答面板、问两句、展开一站、展开一个系部
 * 用法：node tools/interact.mjs
 */
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = 'C:\\Users\\gx\\OneDrive\\Desktop\\殷宇彤\\_shots';

const CHROME = 'C:\\Users\\gx\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const port = 9700 + Math.floor(Math.random() * 200);
const proc = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--remote-debugging-port=${port}`,
  '--user-data-dir=' + process.env.TEMP + '\\cdp-it-' + port,
  'about:blank',
], { stdio: 'ignore' });

async function j(p) {
  for (let i = 0; i < 80; i++) {
    try { return await (await fetch(`http://127.0.0.1:${port}${p}`)).json(); } catch { await sleep(250); }
  }
  throw new Error('chrome');
}
const list = await j('/json/list');
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r, e) => { ws.onopen = r; ws.onerror = e; });
let id = 0;
const pend = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pend.has(m.id)) {
    const p = pend.get(m.id);
    pend.delete(m.id);
    m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
  }
};
const send = (method, params = {}) => {
  const i = ++id;
  ws.send(JSON.stringify({ id: i, method, params }));
  return new Promise((res, rej) => pend.set(i, { res, rej }));
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://127.0.0.1:7717/' });
await sleep(2600);

const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) {
    return 'ERR: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  }
  return r.result.value;
};
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(OUT + '\\' + name + '.png', Buffer.from(r.data, 'base64'));
  console.log(OUT + '\\' + name + '.png');
}

const out = {};

out.open = await ev("document.querySelector('#askOpen').click(); 'ok'");
await sleep(900);
await shot('i1-ask-open');

out.send1 = await ev(`(() => {
  const inp = document.querySelector('#askInput');
  inp.value = '食堂有几个';
  document.querySelector('#askForm').dispatchEvent(new Event('submit', { cancelable: true }));
  return 'sent';
})()`);
await sleep(1400);
out.answer1 = await ev(`(() => {
  const b = document.querySelectorAll('#askLog .msg__b');
  return b.length ? b[b.length - 1].textContent.trim().slice(0, 100) : '(none)';
})()`);
await shot('i2-ask-answer');

out.send2 = await ev(`(() => {
  const inp = document.querySelector('#askInput');
  inp.value = '学校能不能带手机';
  document.querySelector('#askForm').dispatchEvent(new Event('submit', { cancelable: true }));
  return 'sent';
})()`);
await sleep(1400);
out.answer2 = await ev(`(() => {
  const b = document.querySelectorAll('#askLog .msg__b');
  return b.length ? b[b.length - 1].textContent.trim().slice(0, 100) : '(none)';
})()`);
await shot('i3-ask-fallback');

out.close = await ev("document.querySelector('[data-ask-close]').click(); 'ok'");
await sleep(500);
out.walkClick = await ev(`(() => {
  const w = document.querySelectorAll('.walk__it');
  if (!w[1]) return 'no walk item';
  w[1].querySelector('.walk__hd').click();
  return 'clicked ' + w.length;
})()`);
await sleep(900);
out.walkOpen = await ev(`[...document.querySelectorAll('.walk__it')].map(x => x.classList.contains('is-open'))`);

out.deptClick = await ev(`(() => {
  const d = document.querySelectorAll('.dept');
  if (!d[2]) return 'no dept';
  d[2].querySelector('.dept__hd').click();
  return 'clicked ' + d.length;
})()`);
await sleep(900);
out.deptOpen = await ev(`[...document.querySelectorAll('.dept')].map(x => x.classList.contains('is-open'))`);

console.log(JSON.stringify(out, null, 1));

ws.close();
proc.kill();
process.exit(0);
