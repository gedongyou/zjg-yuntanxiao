/* 云探校 · 内容后台
 * 零依赖（只用 Node 自带的 http / fs / crypto），不需要 npm install。
 *
 * 启动：node server.mjs
 * 打开：http://127.0.0.1:7717/admin/    （前台是 http://127.0.0.1:7717/）
 *
 * 后台能做四件事：
 *   1. 改前台每一段的文案、数字、图片，存盘后前台刷新即变
 *   2. 调整板块顺序与显隐
 *   3. 维护"问校园"的问答库（增删改关键词与答案），并看访客没问到答案的问题
 *   4. 图片上传、历史版本回滚、导出可直接发布的静态包
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT || 7717);
const HOST = '127.0.0.1';

const P = {
  content: path.join(ROOT, 'content.json'),
  data: path.join(ROOT, 'assets', 'js', 'site-data.js'),
  cfg: path.join(ROOT, 'admin.config.json'),
  vers: path.join(ROOT, 'content.versions'),
  misses: path.join(ROOT, 'content.misses.json'),
  uploads: path.join(ROOT, 'assets', 'img', 'uploads'),
  admin: path.join(ROOT, 'admin'),
  dist: path.join(ROOT, 'dist'),
};

/* ---------------- 口令与会话 ---------------- */
function hash(pw, salt) {
  return crypto.scryptSync(String(pw), salt, 32).toString('hex');
}
async function loadCfg() {
  try {
    const c = JSON.parse(await fsp.readFile(P.cfg, 'utf8'));
    if (c && c.salt && c.hash) return c;
  } catch {}
  const salt = crypto.randomBytes(16).toString('hex');
  const c = { salt, hash: hash('admin123', salt), at: new Date().toISOString() };
  await fsp.writeFile(P.cfg, JSON.stringify(c, null, 2), 'utf8');
  console.log('\n  首次启动，已生成默认口令：admin123');
  console.log('  改口令：后台右上角「改口令」\n');
  return c;
}
let CFG = await loadCfg();

const SESS = new Map(); // token -> exp
const DAY = 864e5;
function newSess() {
  const t = crypto.randomBytes(24).toString('hex');
  SESS.set(t, Date.now() + 7 * DAY);
  return t;
}
function okSess(req) {
  const m = /(?:^|;\s*)yy_token=([a-f0-9]{48})/.exec(req.headers.cookie || '');
  if (!m) return false;
  const exp = SESS.get(m[1]);
  if (!exp || exp < Date.now()) { SESS.delete(m[1]); return false; }
  return true;
}

/* ---------------- 读写内容 ---------------- */
async function readContent() {
  return JSON.parse(await fsp.readFile(P.content, 'utf8'));
}
function fmtNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
async function writeContent(data) {
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  data.meta = data.meta || {};
  data.meta.updatedAt = fmtNow();
  const json = JSON.stringify(data, null, 2);
  await fsp.writeFile(P.content, json, 'utf8');
  await writeData(data, stamp);
  await snapshot(data);
  return data;
}
async function writeData(data, stamp) {
  const js =
    '/* 自动生成，请勿手改 —— 改 content.json 后执行 node tools/build.mjs\n' +
    ' * 由后台保存时会自动重新生成。生成时间：' + (stamp || new Date().toISOString().slice(0, 19).replace('T', ' ')) + ' */\n' +
    'window.__CONTENT__ = ' + JSON.stringify(data, null, 2) + ';\n';
  await fsp.writeFile(P.data, js, 'utf8');
}
async function snapshot(data) {
  await fsp.mkdir(P.vers, { recursive: true });
  const name = new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  await fsp.writeFile(path.join(P.vers, name), JSON.stringify(data, null, 2), 'utf8');
  const list = (await fsp.readdir(P.vers)).filter((f) => f.endsWith('.json')).sort();
  for (const f of list.slice(0, Math.max(0, list.length - 40))) {
    await fsp.unlink(path.join(P.vers, f)).catch(() => {});
  }
}

/* ---------------- 未命中的提问 ---------------- */
async function readMisses() {
  try { return JSON.parse(await fsp.readFile(P.misses, 'utf8')); } catch { return []; }
}
async function addMiss(q) {
  const list = await readMisses();
  const found = list.find((x) => x.q === q);
  if (found) { found.n += 1; found.last = new Date().toISOString(); }
  else list.unshift({ q, n: 1, last: new Date().toISOString(), done: false });
  await fsp.writeFile(P.misses, JSON.stringify(list.slice(0, 400), null, 2), 'utf8');
}

/* ---------------- 小工具 ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.zip': 'application/zip',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};
function send(res, code, body, type) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  res.writeHead(code, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(buf);
}
function json(res, code, obj) {
  send(res, code, JSON.stringify(obj), 'application/json; charset=utf-8');
}
async function body(req, limit = 24 * 1024 * 1024) {
  const chunks = [];
  let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > limit) throw new Error('请求体太大');
    chunks.push(c);
  }
  if (!chunks.length) return '';
  return Buffer.concat(chunks).toString('utf8');
}
async function bodyJson(req) {
  const s = await body(req);
  return s ? JSON.parse(s) : {};
}
function safeJoin(root, urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/\\/g, '/');
  const p = path.resolve(root, '.' + (clean.startsWith('/') ? clean : '/' + clean));
  if (!p.startsWith(root)) return null;
  return p;
}

/* ---------------- 导出静态包 ---------------- */
const COPY_ITEMS = ['index.html', '设计说明.html', 'content.json', 'assets'];
async function copyInto(srcRoot, dstRoot, rel) {
  const s = path.join(srcRoot, rel), d = path.join(dstRoot, rel);
  const st = await fsp.stat(s);
  if (st.isDirectory()) {
    await fsp.mkdir(d, { recursive: true });
    for (const f of await fsp.readdir(s)) await copyInto(srcRoot, dstRoot, path.join(rel, f));
  } else {
    await fsp.mkdir(path.dirname(d), { recursive: true });
    await fsp.copyFile(s, d);
    if (rel.startsWith('assets' + path.sep + 'js')) return;
  }
}
async function exportDist() {
  await fsp.rm(P.dist, { recursive: true, force: true });
  await fsp.mkdir(P.dist, { recursive: true });
  for (const it of COPY_ITEMS) {
    if (fs.existsSync(path.join(ROOT, it))) await copyInto(ROOT, P.dist, it);
  }
  await fsp.copyFile(P.content, path.join(P.dist, 'content.json'));
  await fsp.copyFile(P.data, path.join(P.dist, 'assets', 'js', 'site-data.js'));

  // 打一个不压缩的 zip（零依赖实现）
  const files = [];
  async function walk(rel) {
    const st = await fsp.stat(path.join(P.dist, rel));
    if (st.isDirectory()) {
      for (const f of await fsp.readdir(path.join(P.dist, rel))) await walk(path.join(rel, f));
    } else files.push(rel);
  }
  for (const it of await fsp.readdir(P.dist)) await walk(it);
  const zip = await makeZip(P.dist, files);
  const out = path.join(ROOT, '云探校-发布包.zip');
  await fsp.writeFile(out, zip);
  return { dir: P.dist, zip: out, files: files.length };
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
async function makeZip(root, files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const rel of files) {
    const data = await fsp.readFile(path.join(root, rel));
    const name = Buffer.from(rel.replace(/\\/g, '/'), 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, data);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, name);

    offset += local.length + name.length + data.length;
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cenBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cenBuf, end]);
}

/* ---------------- 路由 ---------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + HOST);
  const p = url.pathname;

  try {
    /* --- 公开接口 --- */
    if (p === '/api/ask-miss' && req.method === 'POST') {
      const b = await bodyJson(req);
      if (b && b.q) await addMiss(String(b.q).slice(0, 80));
      return json(res, 200, { ok: true });
    }
    if (p === '/api/login' && req.method === 'POST') {
      const b = await bodyJson(req);
      if (!b || !b.pw) return json(res, 400, { ok: false, msg: '请输入口令' });
      const hh = hash(b.pw, CFG.salt);
      const a = Buffer.from(hh), c = Buffer.from(CFG.hash);
      const same = a.length === c.length && crypto.timingSafeEqual(a, c);
      if (!same) return json(res, 401, { ok: false, msg: '口令不对' });
      const t = newSess();
      res.setHeader('Set-Cookie', `yy_token=${t}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 86400}`);
      return json(res, 200, { ok: true });
    }

    /* --- 需要登录的接口 --- */
    if (p.startsWith('/api/')) {
      if (!okSess(req)) return json(res, 401, { ok: false, msg: '请先登录' });

      if (p === '/api/logout' && req.method === 'POST') {
        res.setHeader('Set-Cookie', 'yy_token=; Path=/; Max-Age=0');
        return json(res, 200, { ok: true });
      }
      if (p === '/api/me') return json(res, 200, { ok: true });

      if (p === '/api/pw' && req.method === 'POST') {
        const b = await bodyJson(req);
        if (!b.pw || String(b.pw).length < 6) return json(res, 400, { ok: false, msg: '新口令至少 6 位' });
        const salt = crypto.randomBytes(16).toString('hex');
        CFG = { salt, hash: hash(b.pw, salt), at: new Date().toISOString() };
        await fsp.writeFile(P.cfg, JSON.stringify(CFG, null, 2), 'utf8');
        SESS.clear();
        res.setHeader('Set-Cookie', 'yy_token=; Path=/; Max-Age=0');
        return json(res, 200, { ok: true, relogin: true });
      }

      if (p === '/api/content' && req.method === 'GET') return json(res, 200, await readContent());

      if (p === '/api/content' && req.method === 'POST') {
        const b = await bodyJson(req);
        if (!b || typeof b !== 'object') return json(res, 400, { ok: false, msg: '内容格式不对' });
        const saved = await writeContent(b);
        return json(res, 200, { ok: true, updatedAt: saved.meta.updatedAt });
      }

      if (p === '/api/versions' && req.method === 'GET') {
        await fsp.mkdir(P.vers, { recursive: true });
        const list = (await fsp.readdir(P.vers)).filter((f) => f.endsWith('.json')).sort().reverse();
        const out = [];
        for (const f of list.slice(0, 30)) {
          const st = await fsp.stat(path.join(P.vers, f));
          out.push({ f, at: st.mtime.toISOString(), kb: Math.round(st.size / 1024) });
        }
        return json(res, 200, out);
      }
      if (p === '/api/restore' && req.method === 'POST') {
        const b = await bodyJson(req);
        const name = String(b.f || '');
        if (!/^[\w.\-:]+\.json$/.test(name)) return json(res, 400, { ok: false, msg: '版本名不合法' });
        const raw = await fsp.readFile(path.join(P.vers, name), 'utf8');
        const data = JSON.parse(raw);
        await writeContent(data);
        return json(res, 200, { ok: true });
      }

      if (p === '/api/misses' && req.method === 'GET') return json(res, 200, await readMisses());
      if (p === '/api/misses' && req.method === 'POST') {
        const b = await bodyJson(req);
        await fsp.writeFile(P.misses, JSON.stringify(Array.isArray(b) ? b : [], null, 2), 'utf8');
        return json(res, 200, { ok: true });
      }

      if (p === '/api/upload' && req.method === 'POST') {
        const name = String(url.searchParams.get('name') || 'up-' + Date.now() + '.jpg');
        const ext = path.extname(name).toLowerCase();
        if (!/^\.(png|jpe?g|webp|gif|svg)$/.test(ext)) return json(res, 400, { ok: false, msg: '只收图片' });
        const raw = await readRaw(req, 12 * 1024 * 1024);
        await fsp.mkdir(P.uploads, { recursive: true });
        const safe = 'u' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + ext;
        await fsp.writeFile(path.join(P.uploads, safe), raw);
        return json(res, 200, { ok: true, src: 'assets/img/uploads/' + safe });
      }

      if (p === '/api/export' && req.method === 'POST') {
        const r = await exportDist();
        return json(res, 200, { ok: true, ...r });
      }
    }

    /* --- 静态文件 --- */
    if (p === '/' || p === '/index.html') {
      return send(res, 200, await fsp.readFile(path.join(ROOT, 'index.html')), MIME['.html']);
    }
    if (p === '/admin' || p === '/admin/') {
      return send(res, 200, await fsp.readFile(path.join(P.admin, 'index.html')), MIME['.html']);
    }

    const file = safeJoin(ROOT, p);
    if (!file) return send(res, 403, 'forbidden');

    // 只对外提供这几类路径；server.mjs / admin.config.json / 版本快照等一律不外发
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const OK_TOP = new Set(['index.html', '设计说明.html', 'content.json', '云探校-发布包.zip']);
    const OK_DIR = ['assets/', 'admin/', 'dist/'];
    const allowed = OK_TOP.has(rel) || OK_DIR.some((d) => rel.startsWith(d));
    if (!allowed) return send(res, 404, '404 ' + p);

    let st;
    try { st = await fsp.stat(file); } catch { return send(res, 404, '404 ' + p); }
    if (st.isDirectory()) {
      const idx = path.join(file, 'index.html');
      if (fs.existsSync(idx)) return send(res, 200, await fsp.readFile(idx), MIME['.html']);
      return send(res, 404, '404 ' + p);
    }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const buf = await fsp.readFile(file);
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': buf.length, 'Cache-Control': 'no-cache' });
    res.end(buf);
  } catch (err) {
    console.error('处理失败：', req.method, p, err.message);
    if (!res.headersSent) json(res, 500, { ok: false, msg: err.message });
    else res.end();
  }
});

/* 读原始二进制（上传用） */
function readRaw(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > limit) { reject(new Error('图片太大（上限 12MB）')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  云探校 内容后台');
  console.log('  前台  http://' + HOST + ':' + PORT + '/');
  console.log('  后台  http://' + HOST + ':' + PORT + '/admin/');
  console.log('  口令  见 admin.config.json（首次为 admin123）');
  console.log('');
});
