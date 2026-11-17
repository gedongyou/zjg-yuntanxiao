/* 线上模式（gh）客户端逻辑的端到端验证
 *
 * 真实写仓库需要 token，这里用 CDP 在页面里注入一个假 GitHub，
 * 把 admin.js 发出的请求全部拦下来，检查它到底提交了什么：
 *   - 是不是一次提交同时写了 content.json 与 site-data.js
 *   - base64 里的中文有没有坏
 *   - 分支更新是否指向新 commit
 *   - token 是否只放在 Authorization 头、没写进仓库
 *
 * 用法：node tools/check-gh-mode.mjs
 *   服务不用起（走 ?gh=1 强制线上模式，页面从本地 7717 取，静态文件由 server 提供）
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = ['C:\\Users\\gx\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find((p) => existsSync(p));
const port = 9600 + Math.floor(Math.random() * 90);
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${port}`, '--user-data-dir=' + process.env.TEMP + '\\cdp-gh-' + port,
  'about:blank'], { stdio: 'ignore' });

async function j(p) {
  for (let i = 0; i < 80; i++) {
    try { return await (await fetch(`http://127.0.0.1:${port}${p}`)).json(); } catch { await sleep(250); }
  }
  throw new Error('chrome 没起来');
}
const tg = await j('/json/list');
const ws = new WebSocket(tg.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r, e) => { ws.onopen = r; ws.onerror = e; });
let id = 0; const pend = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
};
const send = (method, params = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params })); return new Promise((res, rej) => pend.set(i, { res, rej })); };
const ev = async (x) => {
  const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + JSON.stringify(r.exceptionDetails.exception || {}));
  return r.result.value;
};

await send('Page.enable'); await send('Runtime.enable');

/* 假 GitHub：把请求记在 window.__GHLOG，按端点回假数据 */
const STUB = `
(function(){
  window.__GHLOG = [];
  var OLD = 'a'.repeat(40);
  var baseContent = window.__BASE_CONTENT__;
  function b64(s){ var b=new TextEncoder().encode(s); var t=''; for(var i=0;i<b.length;i+=0x8000){t+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));} return btoa(t); }
  window.fetch = function(url, cfg){
    cfg = cfg || {};
    var m = (cfg.method || 'GET').toUpperCase();
    var u = String(url);
    if (u.indexOf('api.github.com') < 0) { return Promise.reject(new TypeError('mock: only github allowed')); }
    var path = u.replace('https://api.github.com', '');
    var body = cfg.body ? JSON.parse(cfg.body) : null;
    window.__GHLOG.push({ method: m, path: path, body: body, auth: !!(cfg.headers && cfg.headers.Authorization) });
    function ok(o){ return Promise.resolve({ ok:true, status:200, text:function(){ return Promise.resolve(JSON.stringify(o)); } }); }
    if (path.indexOf('/git/ref/heads/main') >= 0 && m === 'GET') return ok({ object:{ sha: OLD } });
    if (path.indexOf('/git/commits/' + OLD) >= 0 && m === 'GET') return ok({ sha: OLD, tree:{ sha: 'b'.repeat(40) } });
    if (path === '/repos/gxglad/yyt/git/blobs' && m === 'POST') return ok({ sha: 'c' + window.__GHLOG.length });
    if (path === '/repos/gxglad/yyt/git/trees' && m === 'POST') return ok({ sha: 'd'.repeat(40) });
    if (path === '/repos/gxglad/yyt/git/commits' && m === 'POST') return ok({ sha: 'e'.repeat(40) });
    if (path.indexOf('/git/refs/heads/main') >= 0 && m === 'PATCH') return ok({ ref:'refs/heads/main', object:{ sha: body.sha } });
    if (path.indexOf('/contents/content.json') >= 0 && m === 'GET') return ok({ sha:'f'.repeat(40), content: b64(JSON.stringify(baseContent)) });
    return ok({});
  };
})();
`;

const nav = async (url) => { await send('Page.navigate', { url }); await sleep(1600); };

// 先取一份真实内容，给假 GitHub 当返回值
await nav('http://127.0.0.1:7717/content.json');
const base = await ev(`document.body.innerText`);
const baseOk = base && base.length > 1000 && JSON.parse(base).hero;
console.log('取到本地 content.json：' + (baseOk ? 'ok' : '失败'));

// 装 stub，再进线上模式
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: 'window.__BASE_CONTENT__ = ' + JSON.stringify(JSON.parse(base)) + ';\n' + STUB,
});
await nav('http://127.0.0.1:7717/admin/?gh=1');

const gateUI = await ev(`JSON.stringify({
  mode: /Token/.test(document.querySelector('.gate__f span').textContent),
  btn: document.querySelector('#gateForm .gate__b').textContent,
  sub: document.querySelector('.gate__sub').textContent.slice(0, 12),
  err: document.querySelector('#gateErr').textContent
})`);
console.log('登录界面：' + gateUI);

// 用假 token 登录
await ev(`document.querySelector('#gatePw').value='ghp_faketoken123';document.querySelector('#gateForm').dispatchEvent(new Event('submit',{cancelable:true}));1`);
await sleep(1500);

const after = await ev(`JSON.stringify({
  appShown: !document.querySelector('#app').hidden,
  gateHidden: document.querySelector('#gate').hidden,
  tabs: Array.prototype.map.call(document.querySelectorAll('#tabs [data-tab]'), function(b){return b.getAttribute('data-tab')}),
  hd: document.querySelector('#app .top__l span').textContent,
  pwBtn: document.querySelector('#pwBtn').textContent,
  title: document.querySelector('#askTitle') ? 'has' : 'no'
})`);
console.log('登录后：' + after);

// 改一处文案再保存
await ev(`(function(){
  document.querySelector('#tabs [data-tab="content"]').click();
  return 1;
})()`);
await sleep(800);
const changed = await ev(`(function(){
  var i = document.querySelector('#pane [data-p="hero.title"]') || document.querySelector('#pane [data-p^="hero."]');
  if (!i) return 'no field';
  i.value = '线上模式测试标题';
  i.dispatchEvent(new Event('input', { bubbles: true }));
  return i.getAttribute('data-p') + ' = ' + i.value;
})()`);
console.log('改字段：' + changed);
await sleep(300);
await ev(`document.querySelector('#saveBtn').click(); 1`);
await sleep(2500);

const log = await ev(`JSON.stringify(window.__GHLOG)`);
const L = JSON.parse(log || '[]');
console.log('\n=== 发给 GitHub 的请求 ===');
L.forEach((r) => console.log('  ' + r.method.padEnd(6) + r.path + (r.body && r.body.message ? '  · ' + r.body.message : '') + (r.auth ? '  [带 token]' : '  [无 token]')));

// 检查点
const treeReq = L.find((r) => r.path.endsWith('/git/trees'));
const paths = treeReq && treeReq.body.tree ? treeReq.body.tree.map((t) => t.path) : [];
const blobReqs = L.filter((r) => r.path.endsWith('/git/blobs'));
let decoded = {};
blobReqs.forEach((b, i) => {
  try {
    const bin = atob(b.body.content);
    const by = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) by[k] = bin.charCodeAt(k);
    decoded[i] = new TextDecoder().decode(by);
  } catch (e) { decoded[i] = 'DECODE FAIL'; }
});
const jsonBlob = Object.values(decoded).find((s) => s && s.trim().startsWith('{'));
const jsBlob = Object.values(decoded).find((s) => s && s.indexOf('window.__CONTENT__') >= 0);
const refPatch = L.find((r) => r.path.indexOf('/git/refs/heads/main') >= 0 && r.method === 'PATCH');
const commitReq = L.find((r) => r.path === '/repos/gxglad/yyt/git/commits' && r.method === 'POST');

const checks = [
  ['一次提交同时写两个文件', paths.length === 2 && paths.indexOf('content.json') >= 0 && paths.indexOf('assets/js/site-data.js') >= 0],
  ['base_tree 用的是当前分支', treeReq && treeReq.body.base_tree === 'b'.repeat(40)],
  ['content.json 中文没坏', jsonBlob && jsonBlob.indexOf('线上模式测试标题') >= 0],
  ['site-data.js 也带上了改动', jsBlob && jsBlob.indexOf('线上模式测试标题') >= 0],
  ['commit 的 parent 是原分支头', commitReq && commitReq.body.parents[0] === 'a'.repeat(40)],
  ['分支已指向新 commit', refPatch && refPatch.body.sha === 'e'.repeat(40) && refPatch.body.force === false],
  ['每个请求都带了 token', L.every((r) => r.auth)],
  ['token 没被写进提交内容', JSON.stringify(L).indexOf('ghp_faketoken123') < 0],
  ['三个 tab 都在', after.indexOf('layout') >= 0 && after.indexOf('content') >= 0 && after.indexOf('ask') >= 0],
];
console.log('\n=== 检查 ===');
let bad = 0;
checks.forEach(([n, ok]) => { if (!ok) bad++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + n); });

const toastTx = await ev(`document.querySelector('#toast').textContent`);
console.log('\n保存提示：' + toastTx);
console.log(bad === 0 ? '\n全部通过' : '\n有 ' + bad + ' 项未通过');

ws.close(); proc.kill(); process.exit(bad === 0 ? 0 : 1);
