/* 导出静态发布包：生成 dist/ 和 云探校-发布包.zip
 * 不依赖 server.mjs，改完内容直接跑就行。
 *
 * 用法：node tools/export.mjs
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const ZIP = path.join(ROOT, '云探校-发布包.zip');

const COPY_ITEMS = ['index.html', '设计说明.html', 'content.json', 'assets'];
/* 后台自己用的东西不进发布包 */
const SKIP = [
  path.join('assets', 'img', 'uploads'),
];

function skipped(rel) {
  return SKIP.some((s) => rel === s || rel.startsWith(s + path.sep));
}

async function copyInto(rel) {
  const s = path.join(ROOT, rel);
  const d = path.join(DIST, rel);
  const st = await fsp.stat(s);
  if (st.isDirectory()) {
    await fsp.mkdir(d, { recursive: true });
    for (const f of await fsp.readdir(s)) await copyInto(path.join(rel, f));
  } else {
    await fsp.mkdir(path.dirname(d), { recursive: true });
    await fsp.copyFile(s, d);
  }
}

/* ---- 零依赖 zip（不压缩，直接存） ---- */
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

/* ---- 跑 ---- */
if (!fs.existsSync(path.join(ROOT, 'assets', 'js', 'site-data.js'))) {
  console.error('缺少 assets/js/site-data.js，先执行 node tools/build.mjs');
  process.exit(1);
}

await fsp.rm(DIST, { recursive: true, force: true });
await fsp.mkdir(DIST, { recursive: true });
for (const it of COPY_ITEMS) {
  if (fs.existsSync(path.join(ROOT, it))) await copyInto(it);
}

/* 再刷一遍最新内容进 dist */
await fsp.copyFile(path.join(ROOT, 'content.json'), path.join(DIST, 'content.json'));
await fsp.copyFile(
  path.join(ROOT, 'assets', 'js', 'site-data.js'),
  path.join(DIST, 'assets', 'js', 'site-data.js')
);

/* 收集文件（跳过后台自用的上传目录） */
const files = [];
async function walk(rel) {
  const st = await fsp.stat(path.join(DIST, rel));
  if (st.isDirectory()) {
    for (const f of await fsp.readdir(path.join(DIST, rel))) await walk(path.join(rel, f));
  } else files.push(rel);
}
for (const it of await fsp.readdir(DIST)) await walk(it);

const zip = await makeZip(DIST, files);
await fsp.writeFile(ZIP, zip);

const bytes = files.reduce((n, f) => n + fs.statSync(path.join(DIST, f)).size, 0);
console.log('已生成 ' + DIST);
console.log('已生成 ' + ZIP + '（' + files.length + ' 个文件，' + (bytes / 1024).toFixed(0) + ' KB）');
