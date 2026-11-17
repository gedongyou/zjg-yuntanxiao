/* 真机验证：线上页面能不能跨域读 GitHub 仓库 + 线上后台是不是 Token 模式
 *
 * 注意：没填 Token 时 GitHub 对这个 IP 只给一小时 60 次请求，
 * 反复跑这个脚本会撞到 403 rate limit —— 那是次数用完了，不是配置错了，
 * 过一小时再试，或者填上 Token 跑。
 * 用法：node tools/check-gh-live.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = ['C:\\Users\\gx\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find((p) => existsSync(p));
const port = 9800 + Math.floor(Math.random() * 90);
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${port}`, '--user-data-dir=' + process.env.TEMP + '\\cdp-ghl-' + port,
  '--proxy-server=http://127.0.0.1:7897', 'about:blank'], { stdio: 'ignore' });
async function j(p) { for (let i = 0; i < 100; i++) { try { return await (await fetch(`http://127.0.0.1:${port}${p}`)).json(); } catch { await sleep(300); } } throw new Error('no chrome'); }
const tg = await j('/json/list');
const ws = new WebSocket(tg.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r, e) => { ws.onopen = r; ws.onerror = e; });
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); } };
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pend.set(i, { res, rej })); };
const ev = async (x) => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return { err: r.exceptionDetails.text + ' ' + JSON.stringify(r.exceptionDetails.exception || {}) }; return r.result.value; };

await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: 'https://gxglad.github.io/yyt/admin/?v=' + Date.now() });
await sleep(3500);

const here = await ev('location.href');
console.log('页面：' + here);

// 1) 线上页面能不能不登录就读到仓库文件（CORS 实测）
const read = await ev(`(async function(){
  try {
    var r = await fetch('https://api.github.com/repos/gxglad/yyt/contents/content.json?ref=main', {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'yyt-check' }
    });
    if (!r.ok) return { http: r.status, rl: r.headers.get('x-ratelimit-remaining'), note: r.status === 403 ? '请求次数用完了（一小时 60 次），不是配置错' : '' };
    var j = await r.json();
    var s = j.content.replace(/\\n/g, '');
    var bin = atob(s); var by = new Uint8Array(bin.length);
    for (var i=0;i<bin.length;i++) by[i]=bin.charCodeAt(i);
    var txt = new TextDecoder().decode(by);
    var o = JSON.parse(txt);
    return { http: r.status, sha: (j.sha||'').slice(0,8), bytes: by.length, entries: (o.ask.entries||[]).length, title: o.hero && o.hero.title };
  } catch (e) { return { err: String(e) }; }
})()`);
console.log('跨域读取仓库：' + JSON.stringify(read));

// 2) 后台本身：应显示 Token 输入框（线上模式）
const ui = await ev(`JSON.stringify({
  label: (document.querySelector('.gate__f span')||{}).textContent,
  btn: (document.querySelector('#gateForm .gate__b')||{}).textContent,
  sub: ((document.querySelector('.gate__sub')||{}).textContent||'').slice(0, 20),
  err: (document.querySelector('#gateErr')||{}).textContent,
  hidden: document.querySelector('#gate').hidden
})`);
console.log('后台界面：' + ui);

ws.close(); proc.kill(); process.exit(0);
