/* 线上模式的界面截图（用假 GitHub，不需要真 token）
 * 用法：node tools/shot-gh.mjs   → _shots/g0-gate.png / g1-layout.png
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const OUT = 'C:\\Users\\gx\\OneDrive\\Desktop\\殷宇彤\\_shots';
await mkdir(OUT, { recursive: true });
const CHROME = ['C:\\Users\\gx\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find((p) => existsSync(p));
const port = 9700 + Math.floor(Math.random() * 90);
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--remote-debugging-port=${port}`, '--user-data-dir=' + process.env.TEMP + '\\cdp-ghs-' + port, 'about:blank'], { stdio: 'ignore' });
async function j(p) { for (let i = 0; i < 80; i++) { try { return await (await fetch(`http://127.0.0.1:${port}${p}`)).json(); } catch { await sleep(250); } } throw new Error('no chrome'); }
const tg = await j('/json/list');
const ws = new WebSocket(tg.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r, e) => { ws.onopen = r; ws.onerror = e; });
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pend.set(i, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); await writeFile(OUT + '\\' + n + '.png', Buffer.from(r.data, 'base64')); console.log(OUT + '\\' + n + '.png'); };

await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1560, height: 1000, deviceScaleFactor: 1, mobile: false });

await send('Page.navigate', { url: 'http://127.0.0.1:7717/content.json' });
await sleep(1400);
const base = await ev('document.body.innerText');

await send('Page.addScriptToEvaluateOnNewDocument', {
  source: 'window.__BASE_CONTENT__ = ' + base + `;
(function(){
  function b64(s){ var b=new TextEncoder().encode(s); var t=''; for(var i=0;i<b.length;i+=0x8000){t+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));} return btoa(t); }
  window.fetch = function(url, cfg){
    cfg=cfg||{}; var m=(cfg.method||'GET').toUpperCase(); var u=String(url);
    if(u.indexOf('api.github.com')<0) return Promise.reject(new TypeError('mock'));
    var p=u.replace('https://api.github.com','');
    function ok(o){ return Promise.resolve({ok:true,status:200,text:function(){return Promise.resolve(JSON.stringify(o));}}); }
    if(p.indexOf('/contents/content.json')>=0&&m==='GET') return ok({sha:'f'.repeat(40),content:b64(JSON.stringify(window.__BASE_CONTENT__))});
    if(p.indexOf('/git/ref/heads/main')>=0&&m==='GET') return ok({object:{sha:'a'.repeat(40)}});
    if(p.indexOf('/git/commits/')>=0&&m==='GET') return ok({sha:'a'.repeat(40),tree:{sha:'b'.repeat(40)}});
    if(p.indexOf('/git/blobs')>=0) return ok({sha:'c'.repeat(40)});
    if(p.indexOf('/git/trees')>=0) return ok({sha:'d'.repeat(40)});
    if(p.indexOf('/git/commits')>=0&&m==='POST') return ok({sha:'e'.repeat(40)});
    return ok({});
  };
})();`,
});

await send('Page.navigate', { url: 'http://127.0.0.1:7717/admin/?gh=1' });
await sleep(2000);
await shot('g0-gate');

await ev(`document.querySelector('#gatePw').value='ghp_demo';document.querySelector('#gateForm').dispatchEvent(new Event('submit',{cancelable:true}));1`);
await sleep(1800);
await shot('g1-layout');

const st = await ev(`JSON.stringify({
  app: !document.querySelector('#app').hidden,
  tabs: Array.prototype.map.call(document.querySelectorAll('#tabs [data-tab]'),function(b){return b.getAttribute('data-tab')}),
  hd: document.querySelector('#app .top__l span').textContent,
  pw: document.querySelector('#pwBtn').textContent
})`);
console.log('状态：' + st);
ws.close(); proc.kill(); process.exit(0);
