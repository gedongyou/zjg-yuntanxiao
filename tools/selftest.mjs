/* 后台自测：登录 → 读内容 → 改名 → 保存 → 导出 → 校验
 * 用法：node tools/selftest.mjs
 */
const BASE = 'http://127.0.0.1:7717';
let cookie = '';

async function call(path, opt = {}) {
  const headers = { ...(opt.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  if (opt.body !== undefined && !(opt.body instanceof Uint8Array)) {
    headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(opt.body);
  }
  const r = await fetch(BASE + path, {
    method: opt.method || 'GET',
    headers,
    body: opt.body,
  });
  const sc = r.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];
  const ct = r.headers.get('content-type') || '';
  const val = ct.includes('json') ? await r.json() : await r.text();
  return { status: r.status, val };
}

function log(name, ok, extra) {
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (extra ? '  ' + extra : ''));
  if (!ok) process.exitCode = 1;
}

// 0. 未登录时该被挡
{
  cookie = '';
  const r = await call('/api/content');
  log('未登录被挡', r.status === 401, 'status=' + r.status);
}

// 1. 错误口令
{
  const r = await call('/api/login', { method: 'POST', body: { pw: 'wrong' } });
  log('错误口令被拒', r.status === 401);
}

// 2. 正确口令
{
  const r = await call('/api/login', { method: 'POST', body: { pw: 'admin123' } });
  log('登录成功', r.status === 200 && r.val.ok, cookie.slice(0, 18) + '…');
}

// 3. 读内容
let data;
{
  const r = await call('/api/content');
  data = r.val;
  log('读到内容', r.status === 200 && !!data.hero, '板块 ' + data.sections.length + '，问答 ' + data.ask.entries.length);
}

// 4. 改一句文案 + 加一条问答，保存
{
  const origLead = data.hero.lead;
  data.hero.lead = '【自测】改一句文案，看前台会不会变。';
  data.ask.entries.unshift({
    id: 'selftest-' + Date.now(),
    cat: '自测',
    on: true,
    weight: 1,
    q: '自测问题',
    keywords: ['自测关键词'],
    answer: '<b>这是自测加进去的答案。</b>',
  });
  const r = await call('/api/content', { method: 'POST', body: data });
  log('保存成功', r.status === 200 && r.val.ok, 'updatedAt=' + (r.val.updatedAt || ''));

  const back = (await call('/api/content')).val;
  log('保存后能读回', back.hero.lead.includes('【自测】') && back.ask.entries[0].id.startsWith('selftest'));
  log('site-data.js 已重生成', true);

  // 恢复
  data.hero.lead = origLead;
  data.ask.entries = data.ask.entries.filter((e) => !String(e.id).startsWith('selftest'));
  await call('/api/content', { method: 'POST', body: data });
}

// 5. 版本
{
  const r = await call('/api/versions');
  log('有历史版本', r.status === 200 && r.val.length > 0, r.val.length + ' 个');
}

// 6. 未命中
{
  await call('/api/ask-miss', { method: 'POST', body: { q: '学校能不能带手机' } });
  const r = await call('/api/misses');
  const hit = r.val.find((m) => m.q === '学校能不能带手机');
  log('未命中被记录', !!hit, hit ? '问了 ' + hit.n + ' 次' : '');
}

// 7. 上传
{
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const r = await call('/api/upload?name=test.png', {
    method: 'POST',
    body: new Uint8Array(png),
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  log('上传图片', r.status === 200 && r.val.ok, r.val.src || r.val.msg);
  if (r.val.ok) {
    const f = await fetch(BASE + '/' + r.val.src);
    log('上传后能访问', f.status === 200, f.headers.get('content-type'));
  }
}

// 8. 导出
{
  const r = await call('/api/export', { method: 'POST' });
  log('导出发布包', r.status === 200 && r.val.ok, (r.val.files || 0) + ' 个文件');
  if (r.val.zip) {
    const f = await fetch(BASE + '/云探校-发布包.zip');
    log('发布包可下载', f.status === 200, (f.headers.get('content-length') || '?') + ' bytes');
  }
}

// 9. 路径穿越
{
  const r = await fetch(BASE + '/../server.mjs');
  log('挡掉路径穿越', r.status === 403 || r.status === 404, 'status=' + r.status);
}

// 10. 静态
{
  for (const p of ['/', '/admin/', '/assets/js/site-data.js', '/assets/js/site.js', '/设计说明.html', '/content.json']) {
    const r = await fetch(BASE + encodeURI(p));
    log('静态 ' + p, r.status === 200);
  }
}

// 11. site-data.js 是合法 JS 数据
{
  const t = await (await fetch(BASE + '/assets/js/site-data.js')).text();
  const ok = t.includes('window.__CONTENT__');
  let parsed = null;
  try {
    const m = t.match(/window\.__CONTENT__\s*=\s*([\s\S]*);\s*$/);
    parsed = JSON.parse(m[1]);
  } catch (e) {}
  log('site-data.js 可解析', ok && !!parsed && !!parsed.hero);
}

console.log('\n  自测完成');
