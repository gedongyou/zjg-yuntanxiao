/* 构建：content.json → assets/js/site-data.js
 * 为什么要有这一步：file:// 直接打开时浏览器不允许 fetch 本地 json，
 * 所以内容先落成一个 js 变量，双击 index.html 也能读。
 *
 * 用法：node tools/build.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'content.json');
const out = path.join(root, 'assets', 'js', 'site-data.js');

const raw = await readFile(src, 'utf8');
let data;
try {
  data = JSON.parse(raw);
} catch (err) {
  console.error('content.json 不是合法 JSON：' + err.message);
  process.exit(1);
}

const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
const js =
  '/* 自动生成，请勿手改 —— 改 content.json 后执行 node tools/build.mjs\n' +
  ' * 由后台保存时会自动重新生成。生成时间：' + stamp + ' */\n' +
  'window.__CONTENT__ = ' + JSON.stringify(data, null, 2) + ';\n';

await writeFile(out, js, 'utf8');
console.log('已生成 assets/js/site-data.js（' + (js.length / 1024).toFixed(1) + ' KB）');
