import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:\\Users\\gx\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const port = 9933;
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${port}`, '--user-data-dir=' + process.env.TEMP + '\\cdp-gate-' + port, 'about:blank'], { stdio: 'ignore' });
async function j(p) { for (let i = 0; i < 60; i++) { try { return await (await fetch(`http://127.0.0.1:${port}${p}`)).json(); } catch { await sleep(250); } } throw new Error('no chrome'); }
const tg = await j('/json/list');
const ws = new WebSocket(tg.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r, e) => { ws.onopen = r; ws.onerror = e; });
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pend.set(i, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
await send('Page.enable'); await send('Runtime.enable');

const probe = `JSON.stringify({
  url: location.href,
  gateShown: !document.querySelector('#gate').hidden,
  pwHidden: document.querySelector('#gatePw').closest('.gate__f').hidden,
  btnHidden: document.querySelector('#gateForm .gate__b').hidden,
  err: document.querySelector('#gateErr').textContent
})`;

for (const [label, url] of [
  ['file:// 打开', pathToFileURL('C:\\Users\\gx\\OneDrive\\Desktop\\殷宇彤\\源码\\admin\\index.html').href],
  ['本地服务 127.0.0.1', 'http://127.0.0.1:7717/admin/'],
]) {
  await send('Page.navigate', { url });
  await sleep(3000);
  console.log(label + ' → ' + await ev(probe));
}
ws.close(); proc.kill(); process.exit(0);
