/* 云探校 · 后台前端
 * 纯原生 JS，没有框架。内容结构来自 content.json，
 * 字段定义在下面的 SCHEMA 里 —— 加一个字段只要在这里加一行。
 */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var S = { data: null, dirty: false, tab: 'layout' };

  /* ---------------- 接口 ---------------- */
  function api(path, opt) {
    opt = opt || {};
    var cfg = { method: opt.method || 'GET', credentials: 'same-origin', headers: {} };
    if (opt.body !== undefined) {
      cfg.headers['Content-Type'] = 'application/json';
      cfg.body = JSON.stringify(opt.body);
    }
    return fetch(path, cfg).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        // 登录接口的 401 是「口令不对」，不能当成登录过期，否则真正的错因会被盖掉
        if (r.status === 401 && path !== '/api/login') {
          showGate();
          throw new Error('登录已过期，请重新输入口令');
        }
        if (!r.ok) throw new Error(j.msg || ('请求失败 ' + r.status));
        return j;
      });
    }).catch(function (err) {
      // fetch 本身失败（不是 4xx/5xx）：多半是没启动服务，或者直接双击打开了文件
      if (err instanceof TypeError || /fetch/i.test(err.message)) {
        throw new Error(HINT);
      }
      throw err;
    });
  }

  /* 打不开的时候说人话，别只甩一个 Failed to fetch */
  var HINT = '连不上后台服务。请先在「源码」文件夹里执行 node server.mjs，'
    + '再打开 http://127.0.0.1:7717/admin/（不要直接双击 admin/index.html）。';

  /* ================= 两种模式 =================
   * local：从 127.0.0.1 打开，后面有 server.mjs 顶着，保存写本机文件，秒生效。
   * gh   ：从线上地址打开（github.io 等），没有服务，保存直接调 GitHub 接口
   *        提交到仓库，Pages 自动重建 —— 所以换台电脑、用手机也能改。
   * 界面、字段、操作两边完全一样，只有「保存走哪条路」不同。
   * 测试用：任意地址加 ?gh=1 可以强制走线上模式。
   */
  var LOCAL_HOST = { '127.0.0.1': 1, 'localhost': 1, '::1': 1, '[::1]': 1 };
  var MODE = (function () {
    if (/[?&]gh=1\b/.test(location.search)) return 'gh';
    if (location.protocol === 'file:') return 'offline';
    return LOCAL_HOST[location.hostname] ? 'local' : 'offline';
  })();

  /* ---------------- GitHub 通道 ---------------- */
  var GH = {
    owner: 'gxglad', repo: 'yyt', branch: 'main',
    tk: '', api: 'https://api.github.com'
  };
  var TK_KEY = 'yyt_gh_token';

  function ghLoad() {
    try { GH.tk = localStorage.getItem(TK_KEY) || ''; } catch (e) { GH.tk = ''; }
    return GH.tk;
  }
  function ghSaveTk(v) {
    GH.tk = v || '';
    try { v ? localStorage.setItem(TK_KEY, v) : localStorage.removeItem(TK_KEY); } catch (e) {}
  }

  function gh(path, opt) {
    opt = opt || {};
    var cfg = {
      method: opt.method || 'GET',
      headers: {
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };
    if (GH.tk) cfg.headers.Authorization = 'Bearer ' + GH.tk;
    if (opt.body !== undefined) {
      cfg.headers['Content-Type'] = 'application/json';
      cfg.body = JSON.stringify(opt.body);
    }
    var url = (opt.raw ? '' : GH.api) + path;
    return fetch(url, cfg).then(function (r) {
      return r.text().then(function (t) {
        var j = {};
        try { j = t ? JSON.parse(t) : {}; } catch (e) { j = { message: t }; }
        if (!r.ok) {
          var m = j.message || ('GitHub 返回 ' + r.status);
          var left = r.headers.get('x-ratelimit-remaining');
          if (r.status === 401) m = 'Token 不对或已过期，重新生成一个再试';
          else if (r.status === 403 && left === '0') {
            m = 'GitHub 的接口次数用完了（没登录时一小时只有 60 次），过一会儿再试，'
              + '或者确认 Token 已经填进去（填了以后次数多得多）';
          } else if (r.status === 403) m = 'Token 权限不够：需要对这个仓库的 Contents 读写权限';
          else if (r.status === 404) m = '找不到仓库 ' + GH.owner + '/' + GH.repo + '，或者 Token 没给它权限';
          else if (r.status === 409 || r.status === 422) m = '仓库刚被改过，请再点一次保存';
          throw new Error(m);
        }
        return j;
      });
    }).catch(function (err) {
      if (err instanceof TypeError || /fetch|network/i.test(err.message)) {
        throw new Error('连不上 GitHub（api.github.com）。检查一下网络；'
          + '如果是没填 Token 时被 GitHub 拒了（没登录一小时只有 60 次请求），'
          + '过一会儿再试，或者先把 Token 填上。');
      }
      throw err;
    });
  }

  var REPO = '/repos/' + GH.owner + '/' + GH.repo;

  /* UTF-8 字符串 ↔ base64（中文不能直接用 btoa） */
  function b64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }
  function unb64(s) {
    var bin = atob(String(s).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function fmtNow() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function dataJsText(data) {
    var stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    return '/* 自动生成，请勿手改 —— 改 content.json 后执行 node tools/build.mjs\n' +
      ' * 由后台保存时会自动重新生成。生成时间：' + stamp + ' */\n' +
      'window.__CONTENT__ = ' + JSON.stringify(data, null, 2) + ';\n';
  }

  function ghReadContent() {
    return gh(REPO + '/contents/content.json?ref=' + GH.branch).then(function (j) {
      return JSON.parse(unb64(j.content));
    });
  }

  /* 一次提交同时写 content.json 和 site-data.js —— 走 Git Data API，
     避免两个文件分开提交时中间那一瞬间对不上。 */
  function ghWriteContent(data) {
    data.meta = data.meta || {};
    data.meta.updatedAt = fmtNow();
    var json = JSON.stringify(data, null, 2);
    var jsData = dataJsText(data);
    var ref = null;
    return gh(REPO + '/git/ref/heads/' + GH.branch)
      .then(function (r) {
        ref = r;
        return gh(REPO + '/git/commits/' + ref.object.sha);
      })
      .then(function (cm) {
        var baseTree = cm.tree.sha;
        return Promise.all([
          gh(REPO + '/git/blobs', { method: 'POST', body: { content: b64(json), encoding: 'base64' } }),
          gh(REPO + '/git/blobs', { method: 'POST', body: { content: b64(jsData), encoding: 'base64' } })
        ]).then(function (bl) {
          return gh(REPO + '/git/trees', {
            method: 'POST',
            body: {
              base_tree: baseTree,
              tree: [
                { path: 'content.json', mode: '100644', type: 'blob', sha: bl[0].sha },
                { path: 'assets/js/site-data.js', mode: '100644', type: 'blob', sha: bl[1].sha }
              ]
            }
          });
        });
      })
      .then(function (tree) {
        return gh(REPO + '/git/commits', {
          method: 'POST',
          body: {
            message: '后台更新内容 · ' + fmtNow(),
            tree: tree.sha,
            parents: [ref.object.sha]
          }
        });
      })
      .then(function (commit) {
        return gh(REPO + '/git/refs/heads/' + GH.branch, {
          method: 'PATCH',
          body: { sha: commit.sha, force: false }
        });
      })
      .then(function () { return data; });
  }

  /* 本地模式用 0 字节的二进制转 base64 会溢出，分块处理 */
  function bytesToB64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  /* ---------------- 离线模式：不连服务，也不连 GitHub ----------------
   * 双击 admin/index.html 就能用。内容存在这台电脑的浏览器里（localStorage），
   * 前台在 file:// 下打开时也读同一份，所以改完刷新前台就变了。
   * 要交给别人 / 发布时，点「导出文件」，拿两个文件覆盖回「源码」文件夹即可。
   */
  var LS_KEY = 'yyt_content_v1';
  var PW_KEY = 'yyt_admin_pw';
  var DEF_PW = 'admin123';

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) {
    try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {}
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* 兜底内容：直接借前台那份编译好的 site-data.js，file:// 下也能加载 */
  function loadBundled() {
    return new Promise(function (res, rej) {
      if (window.__CONTENT__) { res(clone(window.__CONTENT__)); return; }
      var s = document.createElement('script');
      s.src = '../assets/js/site-data.js';
      s.onload = function () {
        window.__CONTENT__ ? res(clone(window.__CONTENT__))
          : rej(new Error('assets/js/site-data.js 里没有内容'));
      };
      s.onerror = function () { rej(new Error('读不到 assets/js/site-data.js，确认「源码」文件夹是完整的')); };
      document.head.appendChild(s);
    });
  }
  function offlineLoad() {
    return loadBundled().then(function (base) {
      var raw = lsGet(LS_KEY);
      if (raw) {
        try { var d = JSON.parse(raw); if (d && d.hero && d.theme) return d; } catch (e) {}
      }
      return base;
    });
  }
  function offlineSave(data) {
    data.meta = data.meta || {};
    data.meta.updatedAt = fmtNow();
    lsSet(LS_KEY, JSON.stringify(data));
    // 再单独记一个毫秒时间戳：前台靠它判断草稿和文件谁更新，避免同一分钟分不出先后
    try { localStorage.setItem(LS_KEY + '_ts', String(Date.now())); } catch (e) {}
    return { ok: true, updatedAt: data.meta.updatedAt };
  }
  /* 图片压到最大 1600px、jpeg 0.82，直接转成 data: 内嵌，不依赖任何服务 */
  function shrinkImage(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onerror = function () { rej(new Error('这张图读不出来')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { rej(new Error('这张图解码失败')); };
        img.onload = function () {
          var max = 1600;
          var w = img.naturalWidth, h = img.naturalHeight;
          var k = Math.min(1, max / Math.max(w, h));
          var cv = document.createElement('canvas');
          cv.width = Math.round(w * k); cv.height = Math.round(h * k);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          res(cv.toDataURL('image/jpeg', 0.82));
        };
        img.src = String(fr.result);
      };
      fr.readAsDataURL(file);
    });
  }

  function download(name, text, mime) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime || 'application/json' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  /* ---------------- 统一的数据通道 ---------------- */
  var NET = {
    mode: MODE,
    login: function (cred) {
      if (MODE === 'offline') {
        var pw = lsGet(PW_KEY) || DEF_PW;
        return String(cred) === pw
          ? Promise.resolve({ ok: true, mode: 'offline' })
          : Promise.reject(new Error('口令不对'));
      }
      if (MODE === 'gh') {
        if (!cred) return Promise.reject(new Error('先把 GitHub Token 粘进来'));
        ghSaveTk(cred);
        // 读一次确认 token 有效（顺便把内容拿回来）
        return ghReadContent().then(function (d) { return d; });
      }
      return api('/api/login', { method: 'POST', body: { pw: cred } });
    },
    load: function () {
      if (MODE === 'offline') return offlineLoad();
      if (MODE === 'gh') return ghReadContent();
      return api('/api/content');
    },
    save: function (data) {
      if (MODE === 'offline') {
        return new Promise(function (res, rej) {
          try { res(offlineSave(data)); } catch (e) { rej(e); }
        });
      }
      if (MODE === 'gh') return ghWriteContent(data).then(function (d) { return { ok: true, updatedAt: d.meta.updatedAt }; });
      return api('/api/content', { method: 'POST', body: data });
    },
    upload: function (name, bytes) {
      if (MODE === 'offline') return Promise.reject(new Error('离线模式请用「上传图片」里的内嵌方式'));
      if (MODE === 'gh') {
        var safe = 'assets/img/uploads/' + String(name).replace(/[^\w.\-]/g, '_').replace(/^\.+/, '');
        var body = { message: '后台换图 · ' + safe, content: bytesToB64(bytes), branch: GH.branch };
        return gh(REPO + '/contents/' + safe, { method: 'GET' })
          .then(function (j) { body.sha = j.sha; })
          .catch(function () {})
          .then(function () { return gh(REPO + '/contents/' + safe, { method: 'PUT', body: body }); })
          .then(function () { return { ok: true, src: safe }; });
      }
      return fetch('/api/upload?name=' + encodeURIComponent(name), {
        method: 'POST', body: bytes, credentials: 'same-origin',
        headers: { 'Content-Type': 'application/octet-stream' }
      }).then(function (r) { return r.json(); });
    },
    logout: function () {
      if (MODE === 'offline') { S.data = null; return Promise.resolve({ ok: true }); }
      if (MODE === 'gh') { ghSaveTk(''); return Promise.resolve({ ok: true }); }
      return api('/api/logout', { method: 'POST' });
    },
    setPw: function (v) {
      if (MODE === 'offline') {
        if (!v || String(v).length < 6) return Promise.reject(new Error('口令至少 6 位'));
        lsSet(PW_KEY, String(v));
        return Promise.resolve({ ok: true });
      }
      if (MODE === 'gh') return Promise.reject(new Error('线上模式没有口令，改用「换 Token」'));
      return api('/api/pw', { method: 'POST', body: { pw: v } });
    }
  };

  function toast(msg, isErr) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast is-on' + (isErr ? ' is-err' : '');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.className = 'toast'; }, 2200);
  }

  function markDirty(v) {
    S.dirty = v !== false;
    $('#dirtyDot').hidden = !S.dirty;
    var bar = $('#saveBar');
    if (bar) bar.hidden = !S.dirty;
  }

  /* ---------------- 登录 ---------------- */
  function showGate() {
    $('#gate').hidden = false;
    $('#app').hidden = true;
    $('#gatePw').focus();
  }
  function showApp() {
    $('#gate').hidden = true;
    $('#app').hidden = false;
  }
  $('#gateForm').addEventListener('submit', function (e) {
    e.preventDefault();
    $('#gateErr').textContent = '';
    var cred = $('#gatePw').value.trim();
    var b = $('#gateForm .gate__b');
    if (b) { b.disabled = true; b.textContent = '验证中…'; }
    NET.login(cred)
      .then(function (d) {
        if (b) { b.disabled = false; b.textContent = MODE === 'gh' ? '连上仓库' : '进入后台'; }
        if (MODE === 'gh' && d) { S.data = d; showApp(); render(); return; }
        showApp(); boot();
      })
      .catch(function (err) {
        if (b) { b.disabled = false; b.textContent = MODE === 'gh' ? '连上仓库' : '进入后台'; }
        $('#gateErr').textContent = err.message;
      });
  });

  /* ---------------- 数据读取 ---------------- */
  function get(path) {
    var cur = S.data;
    var parts = path.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function set(path, val) {
    var cur = S.data;
    var parts = path.split('.');
    for (var i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
    markDirty(true);
  }

  // 默认配色（出厂值，「恢复默认」用这一份，不是当前值）
  var THEME0 = {
    paper: '#FAF8F3', paper2: '#F2EDE1', ink: '#14151A',
    red: '#B0271D', gold: '#B08A4E', sky: '#BBD7EC',
    contrast: 1, density: 1, imgGray: 0.12
  };

  function boot() {
    NET.load().then(function (d) {
      S.data = d;
      render();
    }).catch(function (e) { toast(e.message, true); });
  }

  /* ---------------- 字段工厂 ---------------- */
  function fText(label, path, hint, rows) {
    var v = get(path) == null ? '' : get(path);
    var id = 'f_' + path.replace(/\./g, '_');
    if (rows) {
      return '<div class="f"><label for="' + id + '">' + label + '</label>' +
        '<textarea id="' + id + '" rows="' + rows + '" data-p="' + path + '">' + esc(String(v)) + '</textarea>' +
        (hint ? '<span class="f__hint">' + hint + '</span>' : '') + '</div>';
    }
    return '<div class="f"><label for="' + id + '">' + label + '</label>' +
      '<input id="' + id + '" type="text" value="' + esc(String(v)) + '" data-p="' + path + '">' +
      (hint ? '<span class="f__hint">' + hint + '</span>' : '') + '</div>';
  }

  function fNum(label, path, hint) {
    var v = get(path);
    return '<div class="f"><label>' + label + '</label>' +
      '<input type="number" step="any" value="' + (v == null ? '' : esc(String(v))) + '" data-p="' + path + '" data-num="1">' +
      (hint ? '<span class="f__hint">' + hint + '</span>' : '') + '</div>';
  }

  /* 颜色：色块 + 十六进制 + 一组预设 */
  var PRESET = {
    paper: [['宣纸', '#FAF8F3'], ['米白', '#F7F3EA'], ['冷白', '#F6F7F9'], ['灰纸', '#EFEEE9']],
    paper2: [['竹青', '#F2EDE1'], ['浅米', '#EDE6D6'], ['浅灰', '#E9EAEC']],
    ink: [['松烟', '#14151A'], ['藏青', '#1B2733'], ['深褐', '#2A211B']],
    red: [['朱砂', '#B0271D'], ['胭脂', '#A33048'], ['赭石', '#9C4A2F']],
    gold: [['金', '#B08A4E'], ['黄铜', '#A98135'], ['暗金', '#8C6B39']],
    sky: [['晴空', '#BBD7EC'], ['雾蓝', '#C8D6E0'], ['淡青', '#BFD9D2'], ['藕荷', '#D6CEE0']]
  };

  function fColor(label, path) {
    var v = get(path) == null ? '' : String(get(path));
    var key = path.split('.').pop();
    var pre = (PRESET[key] || []).map(function (p) {
      return '<button type="button" class="swatch' + (p[1].toUpperCase() === v.toUpperCase() ? ' is-on' : '') +
        '" data-swatch="' + path + '" data-v="' + p[1] + '" title="' + p[0] + '">' +
        '<i style="background:' + p[1] + '"></i><b>' + p[0] + '</b></button>';
    }).join('');
    return '<div class="f"><label>' + label + '</label>' +
      '<div class="colf"><input type="color" value="' + esc(v) + '" data-p="' + path + '" data-color="1">' +
        '<input type="text" value="' + esc(v) + '" data-p="' + path + '" data-color-txt="1" maxlength="7"></div>' +
      (pre ? '<div class="swatches">' + pre + '</div>' : '') +
      '</div>';
  }

  function fImg(label, path) {
    var v = get(path) == null ? '' : String(get(path));
    return '<div class="f"><label>' + label + '</label>' +
      '<div class="imgf">' +
        '<div class="imgf__pv">' + (v ? '<img src="../' + esc(v) + '" alt="">' : '<span>无图</span>') + '</div>' +
        '<div class="imgf__rt">' +
          '<input type="text" value="' + esc(v) + '" data-p="' + path + '" data-img="1" placeholder="assets/img/xxx.jpg">' +
          '<div style="display:flex;gap:6px">' +
            '<button class="btn" type="button" data-up="' + path + '">上传图片</button>' +
            '<button class="btn" type="button" data-pick="' + path + '">从已有里选</button>' +
          '</div>' +
        '</div>' +
      '</div></div>';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fList(label, path, hint) {
    var v = get(path);
    var list = Array.isArray(v) ? v : [];
    return '<div class="f"><label>' + label + '</label>' +
      '<textarea rows="3" data-p="' + path + '" data-list="1" placeholder="一行一条">' +
      esc(list.join('\n')) + '</textarea>' +
      (hint ? '<span class="f__hint">' + hint + '</span>' : '') + '</div>';
  }

  /* 组：可增删排序的子项 */
  function fGroup(label, path, fields, itemLabel) {
    var arr = get(path);
    if (!Array.isArray(arr)) arr = [];
    var rows = arr.map(function (it, i) {
      return '<div class="card" style="margin:8px 0">' +
        '<div class="card__hd"><span class="no">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<b>' + esc(itemLabel(it, i)) + '</b>' +
          '<span class="sp">' +
            '<button class="mini" data-mv="' + path + '" data-i="' + i + '" data-d="-1" title="上移"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button class="mini" data-mv="' + path + '" data-i="' + i + '" data-d="1" title="下移"' + (i === arr.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '<button class="mini mini--red" data-del="' + path + '" data-i="' + i + '" title="删除">×</button>' +
          '</span>' +
        '</div>' +
        '<div class="card__bd">' + fields(path + '.' + i) + '</div>' +
      '</div>';
    }).join('');
    return '<div class="f"><label>' + label + '</label>' +
      rows +
      '<div><button class="btn" type="button" data-add="' + path + '">+ 增加一条</button></div></div>';
  }

  /* ---------------- 各段字段定义 ---------------- */
  var SCHEMA = {
    wuxin: function () {
      return fText('小标签', 'wuxin.kicker') +
        '<div class="grid2">' + fText('标题前半', 'wuxin.head') + fText('标题红色后半', 'wuxin.headEm') + '</div>' +
        fText('导语', 'wuxin.lead', null, 3) +
        '<div class="grid2">' + fText('教育格言（横排那句）', 'wuxin.motto') + fText('寄语署名', 'wuxin.quote.by') + '</div>' +
        fText('校长寄语', 'wuxin.quote.t', null, 2) +
        fGroup('五心', 'wuxin.hearts', function (p) {
          return '<div class="grid3">' + fText('id（red/ren/heng/jiang/chuang，不要改）', p + '.id') +
              fText('序号', p + '.no') + fText('名称', p + '.nm') + '</div>' +
            '<div class="grid3">' + fText('动词（铸魂/修身…）', p + '.verb') + fText('英文', p + '.en') +
              fText('主色 #RRGGBB', p + '.color') + '</div>' +
            fText('体系表述（官方口径那句）', p + '.kernel', null, 3) +
            fText('一句话导语', p + '.lead', null, 2) +
            fGroup('在学校它长这样', p + '.inSchool', function (q) {
              return fText('标题', q + '.t') + fText('说明', q + '.d', null, 2);
            }, function (it) { return it.t || ''; }) +
            fList('落点（一行一个，与七站同名可互相跳）', p + '.places') +
            '<div class="grid3">' + fText('数字', p + '.metric.n') + fText('单位', p + '.metric.u') +
              fText('数字说明', p + '.metric.t') + '</div>' +
            fList('主要养这颗心的专业 id（一行一个：m01…）', p + '.majors');
        }, function (it) { return (it.nm || '') + (it.verb ? ' · ' + it.verb : ''); }) +
        fGroup('成长路径', 'wuxin.path.steps', function (p) {
          return '<div class="grid3">' + fText('序号', p + '.no') + fText('阶段（入学/课堂…）', p + '.st') +
              fText('标题', p + '.nm') + '</div>' +
            fText('说明', p + '.t', null, 2) +
            fList('涉及的五心 id（一行一个）', p + '.hearts');
        }, function (it) { return it.nm || ''; }) +
        '<div class="grid2">' + fText('路径小标签', 'wuxin.path.kicker') + fText('路径标题后半', 'wuxin.path.headEm') + '</div>' +
        fText('路径标题前半', 'wuxin.path.head') + fText('路径导语', 'wuxin.path.lead', null, 2);
    },
    hero: function () {
      return fText('年份小字', 'hero.kickerYear') + fText('顶部说明', 'hero.kicker') +
        '<div class="grid2">' + fText('主标题（前半）', 'hero.title') + fText('主标题（红色后半）', 'hero.titleEm') + '</div>' +
        fText('副标题', 'hero.sub') + fText('导语', 'hero.lead', '首屏那段两三行的话', 3) +
        '<div class="grid2">' + fText('竖排印章', 'hero.seal') + fText('下滚提示', 'hero.scroll') + '</div>' +
        fGroup('按钮', 'hero.actions', function (p) {
          return '<div class="grid3">' + fText('文字', p + '.t') + fText('链接', p + '.href', '#admit 或 设计说明.html') +
            fText('样式', p + '.style', 'solid 实心 / ghost 描边') + '</div>';
        }, function (it) { return it.t || '按钮'; }) +
        fGroup('首屏信息条', 'hero.meta', function (p) {
          return '<div class="grid2">' + fText('标签', p + '.k') + fText('内容', p + '.v') + '</div>';
        }, function (it) { return it.k || ''; });
    },
    pan: function () {
      return fText('小标签', 'pan.kicker') +
        '<div class="grid2">' + fText('标题前半', 'pan.head') + fText('标题红色后半', 'pan.headEm') + '</div>' +
        fText('底部说明', 'pan.footCap') + fText('右下角标注', 'pan.mark') +
        fGroup('长卷画面', 'pan.frames', function (p) {
          return '<div class="grid3">' + fText('年份', p + '.year') + fText('事件', p + '.event') + fText('画面说明', p + '.cap') + '</div>' +
            fText('一段话', p + '.text', null, 2) +
            fImg('图片', p + '.src') + fText('图片位置', p + '.pos', '例如 center 55%');
        }, function (it) { return (it.year || '') + ' ' + (it.event || ''); });
    },
    numbers: function () {
      return fText('小标签', 'numbers.kicker') +
        '<div class="grid2">' + fText('标题前半', 'numbers.head') + fText('标题红色后半', 'numbers.headEm') + '</div>' +
        fText('导语', 'numbers.lead', null, 2) +
        fGroup('数字', 'numbers.stats', function (p) {
          return '<div class="grid3">' + fText('数字', p + '.n') + fText('单位', p + '.unit') + fText('标签', p + '.t') + '</div>' +
            fText('家长问的那句话', p + '.q', '例如：学校有多大？') +
            fText('注释', p + '.d', null, 2);
        }, function (it) { return (it.q || '') + ' ' + (it.n || '') + ' ' + (it.t || ''); });
    },
    stops: function () {
      return fText('小标签', 'stops.kicker') +
        '<div class="grid2">' + fText('标题前半', 'stops.head') + fText('标题红色后半', 'stops.headEm') + '</div>' +
        fText('导语', 'stops.lead', null, 2) + fText('示意图右下标注', 'stops.planHint') +
        fGroup('七个站点', 'stops.items', function (p) {
          return '<div class="grid3">' + fText('序号', p + '.no') + fText('名称', p + '.nm') + fText('英文', p + '.block') + '</div>' +
            fText('描述', p + '.desc', null, 3) +
            fList('标签（一行一个）', p + '.tags') +
            fList('关联五心（一行一个：red / ren / heng / jiang / chuang）', p + '.hearts') +
            fText('末尾一句（由此 · 某心）', p + '.heart');
        }, function (it) { return (it.no || '') + ' ' + (it.nm || ''); });
    },
    majors: function () {
      return fText('小标签', 'majors.kicker') +
        '<div class="grid2">' + fText('标题前半', 'majors.head') + fText('标题红色后半', 'majors.headEm') + '</div>' +
        fText('导语', 'majors.lead', null, 2) +
        fGroup('顶部统计', 'majors.top', function (p) {
          return '<div class="grid3">' + fText('名称', p + '.t') + fText('数字', p + '.b') + fText('单位', p + '.u') + '</div>';
        }, function (it) { return (it.t || '') + ' ' + (it.b || ''); }) +
        fGroup('系部', 'majors.depts', function (p) {
          return '<div class="grid3">' + fText('序号', p + '.no') + fText('系名', p + '.nm') + fText('方向概览', p + '.sm') + '</div>' +
            fList('专业标签（一行一个）', p + '.chips') +
            fText('系部 id（jx / zk / xx / jm / ny，不要改）', p + '.id') +
            fList('系部主养五心（一行一个）', p + '.hearts') +
            fText('注释', p + '.note', null, 2);
        }, function (it) { return (it.no || '') + ' ' + (it.nm || ''); }) +
        fGroup('专业明细', 'majors.list', function (p) {
          return '<div class="grid3">' + fText('编号', p + '.id') + fText('专业名', p + '.nm') +
              fText('系部 id', p + '.dept') + '</div>' +
            '<div class="grid2">' + fText('层次 id', p + '.level', 'w5 五年一贯制 / gk 职教高考 / z3 三年制中专') +
              fText('一句话', p + '.one') + '</div>' +
            fList('主要养的五心（一行一个：red / ren / heng / jiang / chuang）', p + '.hearts');
        }, function (it) { return (it.id || '') + ' ' + (it.nm || ''); }) +
        fGroup('办学层次', 'majors.levels', function (p) {
          return fText('层次 id（w5 / gk / z3）', p + '.id') + fText('标题', p + '.b') +
            fText('说明', p + '.s', null, 2);
        }, function (it) { return it.b || ''; });
    },
    craft: function () {
      return fText('小标签', 'craft.kicker') +
        '<div class="grid2">' + fText('标题前半', 'craft.head') + fText('标题红色后半', 'craft.headEm') + '</div>' +
        fText('导语', 'craft.lead', null, 2) +
        fGroup('三个大数字', 'craft.big', function (p) {
          return '<div class="grid3">' + fText('数字', p + '.n') + fText('单位', p + '.u') + fText('标签', p + '.t') + '</div>';
        }, function (it) { return (it.n || '') + ' ' + (it.t || ''); }) +
        fGroup('时间线', 'craft.timeline', function (p) {
          return '<div class="grid2">' + fText('年份', p + '.y') + fText('事件', p + '.t') + '</div>';
        }, function (it) { return (it.y || '') + ' ' + (it.t || '').slice(0, 16); }) +
        fList('国际合作（一行一个）', 'craft.intl') +
        fGroup('新闻图', 'craft.news', function (p) {
          return fImg('图片', p + '.src') + fText('替代文字', p + '.alt') + fText('图注', p + '.cap');
        }, function (it) { return it.cap || ''; }) +
        fText('新闻说明', 'craft.newsNote', null, 2);
    },
    admit: function () {
      return fText('小标签', 'admit.kicker') +
        '<div class="grid2">' + fText('标题前半', 'admit.head') + fText('标题红色后半', 'admit.headEm') + '</div>' +
        fText('导语', 'admit.lead', null, 3) +
        fGroup('四个线上通道', 'admit.channels', function (p) {
          return '<div class="grid3">' + fText('序号', p + '.no') + fText('名称', p + '.t') +
              fText('按钮字', p + '.act') + '</div>' +
            fText('说明', p + '.d', null, 2) +
            fText('链接', p + '.href', '#applyForm / #visit / #quiz / #checkForm');
        }, function (it) { return (it.no || '') + ' ' + (it.t || ''); }) +
        fGroup('五步流程', 'admit.flow', function (p) {
          return '<div class="grid3">' + fText('序号', p + '.no') + fText('标题', p + '.t') + '</div>' +
            fText('说明', p + '.d', null, 2);
        }, function (it) { return (it.no || '') + ' ' + (it.t || ''); }) +
        fGroup('办学层次', 'admit.levels', function (p) {
          return fText('标题', p + '.b') + fText('说明', p + '.s', null, 2);
        }, function (it) { return it.b || ''; }) +
        fText('底部注释', 'admit.note', null, 3) +
        '<div class="grid2">' + fText('报名表单标题', 'admit.form.title') + fText('提交按钮', 'admit.form.submit') + '</div>' +
        fText('报名表单说明', 'admit.form.sub', null, 2) +
        '<div class="grid2">' + fText('查进度标题', 'admit.check.title') +
          fText('查进度说明', 'admit.check.sub') + '</div>' +
        fList('查进度四步（一行一步）', 'admit.check.steps') +
        fList('四步对应的说明（一行一条，与上面一一对应）', 'admit.check.desc') +
        fText('查不到时的提示', 'admit.check.miss', null, 3) +
        fImg('二维码', 'admit.contact.qr') + fText('二维码说明', 'admit.contact.qrAlt') +
        fGroup('联系方式', 'admit.contact.rows', function (p) {
          return '<div class="grid2">' + fText('项目', p + '.k') + fText('内容', p + '.v') + '</div>';
        }, function (it) { return (it.k || '') + '：' + (it.v || ''); });
    },
    quiz: function () {
      return fText('小标签', 'quiz.kicker') +
        '<div class="grid2">' + fText('标题前半', 'quiz.head') + fText('标题红色后半', 'quiz.headEm') + '</div>' +
        fText('导语', 'quiz.lead', null, 2) +
        fGroup('题目', 'quiz.questions', function (p) {
          return fText('题干', p + '.q', null, 2) +
            fGroup('选项', p + '.opts', function (q) {
              return fText('选项文字', q + '.t', null, 2) +
                '<div class="grid3">' + fText('加权·红心', q + '.w.red') + fText('加权·仁心', q + '.w.ren') +
                  fText('加权·恒心', q + '.w.heng') + '</div>' +
                '<div class="grid2">' + fText('加权·匠心', q + '.w.jiang') + fText('加权·创心', q + '.w.chuang') + '</div>';
            }, function (it) { return it.t || ''; });
        }, function (it) { return it.q || ''; });
    },
    visit: function () {
      return fText('小标签', 'visit.kicker') +
        '<div class="grid2">' + fText('标题前半', 'visit.head') + fText('标题红色后半', 'visit.headEm') + '</div>' +
        fText('导语', 'visit.lead', null, 2) +
        fGroup('探校场次', 'visit.slots', function (p) {
          return '<div class="grid3">' + fText('id（s1…，不要改）', p + '.id') + fText('日期', p + '.date') +
              fText('星期', p + '.wk') + '</div>' +
            '<div class="grid3">' + fText('时段', p + '.time') + fNum('名额', p + '.cap') +
              fNum('已约', p + '.booked') + '</div>';
        }, function (it) { return (it.date || '') + ' ' + (it.time || ''); }) +
        fGroup('四十分钟路线', 'visit.route', function (p) {
          return fText('名称', p + '.t') + fText('说明', p + '.d', null, 2) + fText('用时', p + '.min');
        }, function (it) { return it.t || ''; }) +
        fText('表单标题', 'visit.form.title') + fText('表单说明', 'visit.form.sub', null, 2) +
        fText('提交按钮文字', 'visit.form.submit') +
        fList('到校提醒（一行一条）', 'visit.tips') +
        '<div class="grid2">' + fText('集合地点标题', 'visit.place.t') +
          fText('集合地点内容', 'visit.place.v') + '</div>';
    },
    footer: function () {
      return fImg('校徽', 'footer.img') + fText('校名（两行用 <br>）', 'footer.name', null, 2) +
        fText('地址与荣誉', 'footer.sub', null, 2) +
        fGroup('链接栏', 'footer.cols', function (p) {
          return fText('栏目标题', p + '.h') +
            fGroup('链接', p + '.links', function (q) {
              return '<div class="grid2">' + fText('文字', q + '.t') + fText('链接', q + '.href') + '</div>';
            }, function (it) { return it.t || ''; });
        }, function (it) { return it.h || ''; }) +
        fText('版权行', 'footer.copy', '{year} 会自动换成当年', 2);
    },
    ask: function () {
      return fText('面板标题', 'ask.title') + fText('面板副标题', 'ask.sub') +
        fText('首次打开时的问候', 'ask.greeting', null, 2) +
        fText('答不上来时的兜底话', 'ask.fallback', null, 2) +
        fList('快捷问题（一行一个，最多 5 个）', 'ask.quick') +
        '<p class="hint">具体的问答条目在「问答库」里维护，这里只改面板的开场与兜底。</p>';
    },
    meta: function () {
      return fText('页面标题', 'meta.title', '浏览器标签上显示') +
        fText('描述', 'meta.desc', null, 2) +
        fText('作者', 'meta.author') + fText('年份', 'meta.year') +
        fText('图标', 'meta.favicon');
    },
    theme: function () {
      return '<div class="grid2">' +
          fColor('纸色（页面底色）', 'theme.paper') + fColor('次纸色（分段/页脚）', 'theme.paper2') + '</div>' +
        '<div class="grid2">' +
          fColor('墨色（正文/标题）', 'theme.ink') + fColor('主红（强调/按钮）', 'theme.red') + '</div>' +
        '<div class="grid2">' +
          fColor('金（线/描边）', 'theme.gold') + fColor('天空（首屏背景）', 'theme.sky') + '</div>' +
        '<div class="grid3">' +
          fNum('对比度', 'theme.contrast', '1 正常，1.15 更硬') +
          fNum('疏密', 'theme.density', '1 正常，1.15 更松') +
          fNum('图片灰度', 'theme.imgGray', '0 彩色，1 全灰') + '</div>' +
        '<div class="reset"><p class="hint">层次靠对比度、疏密、灰度三个数一起调；改完保存，前台立刻能看到。</p>' +
          '<button class="btn" type="button" id="themeReset">恢复默认配色</button></div>';
    },
    nav: function () {
      return fImg('校徽', 'nav.brandImg') +
        '<div class="grid2">' + fText('中文名', 'nav.brandCn') + fText('英文名', 'nav.brandEn') + '</div>' +
        '<div class="grid2">' + fText('右上按钮文字', 'nav.cta.t') + fText('右上按钮链接', 'nav.cta.href') + '</div>' +
        fGroup('导航项', 'nav.links', function (p) {
          return '<div class="grid2">' + fText('文字', p + '.t') + fText('链接', p + '.href') + '</div>';
        }, function (it) { return it.t || ''; }) +
        fText('抽屉底部', 'nav.drawerFoot', '两行用 <br>', 2);
    }
  };

  var SECTION_NAME = {
    hero: '首屏', wuxin: '五心育人', pan: '校园长卷', numbers: '五个问题', stops: '七站导览',
    majors: '系部与专业', craft: '匠心与荣誉', quiz: '专业自测', visit: '预约探校',
    admit: '线上招生', footer: '页脚', nav: '页头', ask: '问校园面板', meta: '页面信息', theme: '配色与疏密'
  };
  var SECTION_DESC = {
    hero: '第一屏：标题、副标题、两个按钮、四格信息',
    wuxin: '五心金字招牌：五个印章、五心详情、成长路径',
    pan: '滚到这一段自动拉开的红漆长卷',
    numbers: '五个家长提问 + 对应数字，进视口从 0 补间',
    stops: '七站手风琴 + 右侧校园示意图',
    majors: '五个系部 + 二十三个专业 + 办学层次',
    craft: '三个大数字、八行时间线、国际合作、新闻图',
    quiz: '六道题、五心画像、推荐专业',
    visit: '探校场次、四十分钟路线、预约表单',
    admit: '四个线上通道、五步流程、报名与查进度',
    footer: '页脚三栏链接与版权',
    nav: '固定页头与手机抽屉',
    ask: '右下角问答面板的开场和兜底',
    meta: '浏览器标题、描述、图标',
    theme: '纸色、次纸色、墨色、主红、金、天空、对比度、疏密、图片灰度'
  };

  /* ---------------- 渲染 ---------------- */
  function render() {
    var pane = $('#pane');
    if (S.tab === 'content') pane.innerHTML = viewContent();
    else if (S.tab === 'ask') pane.innerHTML = viewAsk();
    else pane.innerHTML = viewLayout();
    bindPane();
  }

  function viewLayout() {
    var secs = Array.isArray(S.data.sections) ? S.data.sections : [];
    var rows = secs.map(function (s, i) {
      return '<div class="lay__it' + (s.on === false ? ' is-off' : '') + '">' +
        '<span class="lay__no">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<div class="lay__nm">' + esc(s.label || SECTION_NAME[s.key] || s.key) +
          '<span>' + esc(s.key) + ' · ' + esc(SECTION_DESC[s.key] || '') + '</span></div>' +
        '<div class="lay__acts">' +
          '<button class="mini" data-smv="' + i + '" data-d="-1"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button class="mini" data-smv="' + i + '" data-d="1"' + (i === secs.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '</div>' +
        '<div class="sw' + (s.on !== false ? ' is-on' : '') + '" data-stog="' + i + '" title="显示/隐藏"></div>' +
      '</div>';
    }).join('');

    return '<div class="h"><h2>板块排版</h2><span>上下调整顺序，开关控制显隐</span></div>' +
      '<p class="hint">前台是按这个顺序从上往下铺的。关掉的板块不会出现在页面上，导航里对应的锚点也会失效，记得一起改。</p>' +
      '<div class="lay">' + rows + '</div>' +
      '<div class="h" style="margin-top:28px"><h2>配色与疏密</h2><span>改完点页面右上角黑色的「保存」</span></div>' +
      '<div class="card"><div class="card__bd">' + SCHEMA.theme() + '</div></div>';
  }

  function viewContent() {
    var order = ['nav', 'hero', 'wuxin', 'pan', 'numbers', 'stops', 'majors', 'craft', 'quiz', 'visit', 'admit', 'footer', 'ask', 'meta'];
    var cards = order.map(function (k) {
      return '<div class="card" data-sec="' + k + '">' +
        '<div class="card__hd"><b>' + SECTION_NAME[k] + '</b>' +
          '<span class="tag">' + esc(k) + '</span></div>' +
        '<div class="card__bd">' + SCHEMA[k]() + '</div>' +
      '</div>';
    }).join('');
    return '<div class="h"><h2>内容编辑</h2><span>改完点页面右上角黑色的「保存」</span></div>' +
      '<p class="hint">文字里可以夹 <code>&lt;b&gt;</code>、<code>&lt;br&gt;</code> 做加粗和换行；其他 HTML 会被当文字显示。</p>' +
      cards;
  }

  function viewAsk() {
    var entries = (S.data.ask && S.data.ask.entries) || [];
    var cats = {};
    entries.forEach(function (e) { cats[e.cat || '其他'] = (cats[e.cat || '其他'] || 0) + 1; });
    var catLine = Object.keys(cats).map(function (c) {
      return '<span class="tag">' + esc(c) + ' ' + cats[c] + '</span>';
    }).join(' ');

    var list = entries.map(function (e, i) {
      return '<div class="q' + (e.on === false ? ' is-off' : '') + '">' +
        '<div class="q__hd">' +
          '<span class="no" style="font-family:var(--mono);font-size:10px;color:var(--red)">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<div class="q__q">' + esc(e.q || '(未命名)') + '</div>' +
          '<span class="tag' + (e.on === false ? ' tag--off' : ' tag--on') + '">' + (e.on === false ? '停用' : '启用') + '</span>' +
          '<div class="acts" style="display:flex;gap:5px">' +
            '<button class="mini" data-qon="' + i + '" title="启用/停用">' + (e.on === false ? '启' : '停') + '</button>' +
            '<button class="mini" data-qmv="' + i + '" data-d="-1"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button class="mini" data-qmv="' + i + '" data-d="1"' + (i === entries.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '<button class="mini mini--red" data-qdel="' + i + '">×</button>' +
          '</div>' +
        '</div>' +
        '<div class="q__bd">' +
          '<div class="grid3">' +
            '<div class="f"><label>问题</label><input type="text" data-qp="' + i + '.q" value="' + esc(e.q || '') + '"></div>' +
            '<div class="f"><label>分类</label><input type="text" data-qp="' + i + '.cat" value="' + esc(e.cat || '') + '"></div>' +
            '<div class="f"><label>权重（越大越优先）</label><input type="number" data-qp="' + i + '.weight" data-num="1" value="' + (Number(e.weight) || 0) + '"></div>' +
          '</div>' +
          '<div class="f"><label>关键词（回车添加，点 × 删除）</label>' +
            '<div class="kws" data-kws="' + i + '">' +
              (e.keywords || []).map(function (k, j) {
                return '<span>' + esc(k) + '<i data-kwdel="' + i + '.' + j + '">×</i></span>';
              }).join('') +
              '<input type="text" data-kwadd="' + i + '" placeholder="加一个词，回车">' +
            '</div>' +
            '<span class="f__hint">访客的问题里只要出现关键词就算命中，词越长得分越高。</span>' +
          '</div>' +
          '<div class="f"><label>回答（可以带 &lt;b&gt; 加粗）</label>' +
            '<textarea rows="4" data-qp="' + i + '.answer">' + esc(e.answer || '') + '</textarea></div>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<div class="h"><h2>问答库</h2><span>共 ' + entries.length + ' 条</span></div>' +
      '<p class="hint">访客的问题会拿去和关键词比对，命中得分最高的那条。按分类看分布：' + catLine + '</p>' +
      '<button class="btn btn--solid" id="qAdd" style="margin-bottom:14px">+ 新增问答</button>' +
      (list || '<div class="empty">还没有问答条目</div>');
  }

  /* ---------------- 交互绑定 ---------------- */
  function bindPane() {
    var pane = $('#pane');

    // 普通输入
    $$('[data-p]', pane).forEach(function (inp) {
      inp.addEventListener('input', function () {
        var path = inp.getAttribute('data-p');
        var v = inp.value;
        if (inp.hasAttribute('data-num')) v = Number(v) || 0;
        if (inp.hasAttribute('data-list')) v = v.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
        set(path, v);
        if (inp.hasAttribute('data-img')) {
          var pv = inp.closest('.imgf').querySelector('.imgf__pv');
          pv.innerHTML = v ? '<img src="../' + esc(v) + '" alt="">' : '<span>无图</span>';
        }
      });
    });

    // 配色预设 / 取色器
    $$('[data-swatch]', pane).forEach(function (b) {
      b.addEventListener('click', function () {
        var path = b.getAttribute('data-swatch');
        var v = b.getAttribute('data-v');
        set(path, v);
        $$('[data-p="' + path + '"]', pane).forEach(function (i) {
          if (i.hasAttribute('data-p')) i.value = v;
        });
        $$('[data-swatch="' + path + '"]', pane).forEach(function (s) {
          s.classList.toggle('is-on', s === b);
        });
        markDirty(true);
      });
    });
    $$('[data-color]', pane).forEach(function (i) {
      i.addEventListener('input', function () {
        var path = i.getAttribute('data-p');
        set(path, i.value.toUpperCase());
        var t = pane.querySelector('[data-p="' + path + '"][data-color-txt]');
        if (t) t.value = i.value.toUpperCase();
        $$('[data-swatch="' + path + '"]', pane).forEach(function (s) {
          s.classList.toggle('is-on', s.getAttribute('data-v').toUpperCase() === i.value.toUpperCase());
        });
        markDirty(true);
      });
    });
    $$('[data-color-txt]', pane).forEach(function (i) {
      i.addEventListener('change', function () {
        var path = i.getAttribute('data-p');
        var v = i.value.trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(v)) {
          // 写错就退回当前值，别把错的留在框里
          i.value = get(path) || '';
          toast('颜色要写成 #RRGGBB，比如 #B0271D', true);
          return;
        }
        v = v.toUpperCase();
        i.value = v;
        set(path, v);
        var c = pane.querySelector('[data-p="' + path + '"][data-color]');
        if (c) c.value = v;
        $$('[data-swatch="' + path + '"]', pane).forEach(function (s) {
          s.classList.toggle('is-on', s.getAttribute('data-v').toUpperCase() === v);
        });
        markDirty(true);
      });
    });

    // 恢复默认配色
    var tr = $('#themeReset', pane);
    if (tr) {
      tr.addEventListener('click', function () {
        if (!confirm('把颜色、对比度、疏密、图片灰度都恢复成出厂默认？')) return;
        Object.keys(THEME0).forEach(function (k) { S.data.theme[k] = THEME0[k]; });
        markDirty(true);
        render();
        toast('已恢复默认，记得保存');
      });
    }

    // 图片上传
    $$('[data-up]', pane).forEach(function (b) {
      b.addEventListener('click', function () {
        var path = b.getAttribute('data-up');
        var file = document.createElement('input');
        file.type = 'file';
        file.accept = 'image/*';
        file.addEventListener('change', function () {
          var f = file.files && file.files[0];
          if (!f) return;
          var apply = function (src) {
            set(path, src);
            var inp = pane.querySelector('[data-p="' + path + '"]');
            if (inp) {
              inp.value = src.indexOf('data:') === 0 ? '（已内嵌的新图）' : src;
              var pv = inp.closest('.imgf').querySelector('.imgf__pv');
              pv.innerHTML = '<img src="' + esc(src.indexOf('data:') === 0 ? src : '../' + src) + '" alt="">';
            }
          };
          if (MODE === 'offline') {
            // 离线模式：不存文件，把图压小后直接内嵌进内容里
            shrinkImage(f).then(function (src) {
              apply(src);
              toast('图片已内嵌（约 ' + Math.round(src.length / 1024) + ' KB），记得保存');
            }).catch(function (e) { toast(e.message, true); });
            return;
          }
          var fr = new FileReader();
          fr.onload = function () {
            var bin = atob(String(fr.result).split(',')[1]);
            var buf = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
            NET.upload(f.name, buf).then(function (j) {
              if (!j.ok) throw new Error(j.msg || '上传失败');
              set(path, j.src);
              var inp = pane.querySelector('[data-p="' + path + '"]');
              if (inp) {
                inp.value = j.src;
                var pv = inp.closest('.imgf').querySelector('.imgf__pv');
                pv.innerHTML = '<img src="../' + esc(j.src) + '" alt="">';
              }
              toast(MODE === 'gh' ? '图片已提交，稍后生效' : '图片已上传');
            }).catch(function (e) { toast(e.message, true); });
          };
          fr.readAsDataURL(f);
        });
        file.click();
      });
    });

    // 从已有图片里选
    $$('[data-pick]', pane).forEach(function (b) {
      b.addEventListener('click', function () {
        var path = b.getAttribute('data-pick');
        var list = ['assets/img/campus-gate.jpg', 'assets/img/campus-aerial.jpg', 'assets/img/campus-green.jpg',
          'assets/img/campus-lawn.jpg', 'assets/img/campus-plaza.jpg', 'assets/img/campus-yard.jpg',
          'assets/img/emblem.png', 'assets/img/logo.png', 'assets/img/qr-wx.png',
          'assets/img/news-1.png', 'assets/img/news-2.jpg', 'assets/img/news-3.png',
          'assets/img/news-4.png', 'assets/img/news-5.png'];
        var v = prompt('填图片路径，或从下面挑一个：\n\n' + list.join('\n'), get(path) || '');
        if (v == null) return;
        set(path, v.trim());
        var inp = pane.querySelector('[data-p="' + path + '"]');
        if (inp) {
          inp.value = v.trim();
          var pv = inp.closest('.imgf').querySelector('.imgf__pv');
          pv.innerHTML = v.trim() ? '<img src="../' + esc(v.trim()) + '" alt="">' : '<span>无图</span>';
        }
      });
    });

    // 列表增删移
    $$('[data-add]', pane).forEach(function (b) {
      b.addEventListener('click', function () {
        var path = b.getAttribute('data-add');
        var arr = get(path);
        if (!Array.isArray(arr)) { set(path, []); arr = get(path); }
        var tpl = arr.length ? JSON.parse(JSON.stringify(arr[arr.length - 1])) : {};
        Object.keys(tpl).forEach(function (k) {
          if (Array.isArray(tpl[k])) tpl[k] = [];
          else if (typeof tpl[k] === 'string') tpl[k] = '';
          else if (typeof tpl[k] === 'number') tpl[k] = 0;
        });
        arr.push(tpl);
        markDirty(true);
        render();
        toast('已增加一条，记得填内容');
      });
    });
    $$('[data-del]', pane).forEach(function (b) {
      b.addEventListener('click', function () {
        var path = b.getAttribute('data-del');
        var i = Number(b.getAttribute('data-i'));
        var arr = get(path);
        if (!Array.isArray(arr)) return;
        if (!confirm('删掉第 ' + (i + 1) + ' 条？')) return;
        arr.splice(i, 1);
        markDirty(true);
        render();
      });
    });
    $$('[data-mv]', pane).forEach(function (b) {
      b.addEventListener('click', function () {
        var path = b.getAttribute('data-mv');
        var i = Number(b.getAttribute('data-i'));
        var d = Number(b.getAttribute('data-d'));
        var arr = get(path);
        var j = i + d;
        if (!Array.isArray(arr) || j < 0 || j >= arr.length) return;
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        markDirty(true);
        render();
      });
    });

    // 板块排序与显隐
    $$('[data-smv]', pane).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-smv'));
        var d = Number(b.getAttribute('data-d'));
        var arr = S.data.sections;
        var j = i + d;
        if (j < 0 || j >= arr.length) return;
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        markDirty(true);
        render();
      });
    });
    $$('[data-stog]', pane).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-stog'));
        var s = S.data.sections[i];
        s.on = s.on === false;
        markDirty(true);
        render();
      });
    });

    // 问答库
    var qa = $('#qAdd');
    if (qa) {
      qa.addEventListener('click', function () {
        S.data.ask = S.data.ask || {};
        S.data.ask.entries = S.data.ask.entries || [];
        S.data.ask.entries.unshift({
          id: 'e' + Date.now(), cat: '新增', on: true, weight: 0,
          q: '', keywords: [], answer: ''
        });
        markDirty(true);
        render();
      });
    }
    $$('[data-qp]', pane).forEach(function (inp) {
      inp.addEventListener('input', function () {
        var sp = inp.getAttribute('data-qp').split('.');
        var i = Number(sp[0]), k = sp[1];
        var e = S.data.ask.entries[i];
        e[k] = inp.hasAttribute('data-num') ? (Number(inp.value) || 0) : inp.value;
        markDirty(true);
      });
    });
    $$('[data-kwadd]', pane).forEach(function (inp) {
      inp.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Enter') return;
        ev.preventDefault();
        var i = Number(inp.getAttribute('data-kwadd'));
        var v = inp.value.trim();
        if (!v) return;
        var e = S.data.ask.entries[i];
        e.keywords = e.keywords || [];
        e.keywords.push(v);
        markDirty(true);
        render();
      });
    });
    $$('[data-kwdel]', pane).forEach(function (i2) {
      i2.addEventListener('click', function () {
        var sp = i2.getAttribute('data-kwdel').split('.');
        var e = S.data.ask.entries[Number(sp[0])];
        e.keywords.splice(Number(sp[1]), 1);
        markDirty(true);
        render();
      });
    });
    $$('[data-qon]', pane).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-qon'));
        var e = S.data.ask.entries[i];
        e.on = e.on === false;
        markDirty(true);
        render();
      });
    });
    $$('[data-qdel]', pane).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-qdel'));
        if (!confirm('删掉这条问答？')) return;
        S.data.ask.entries.splice(i, 1);
        markDirty(true);
        render();
      });
    });
    $$('[data-qmv]', pane).forEach(function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-qmv'));
        var d = Number(b.getAttribute('data-d'));
        var arr = S.data.ask.entries;
        var j = i + d;
        if (j < 0 || j >= arr.length) return;
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        markDirty(true);
        render();
      });
    });
  }

  /* ---------------- Tab / 保存 / 预览 ---------------- */
  function syncTabs() {
    $$('#tabs button').forEach(function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-tab') === S.tab);
    });
  }
  $$('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      S.tab = b.getAttribute('data-tab');
      syncTabs();
      render();
    });
  });

  function doSave() {
    var b = $('#saveBtn');
    b.disabled = true;
    b.textContent = '保存中…';
    NET.save(S.data).then(function (j) {
      markDirty(false);
      b.disabled = false;
      b.textContent = '保存';
      if (MODE === 'gh') {
        toast('已提交 · ' + (j.updatedAt || '') + ' · 约 1 分钟后线上生效');
        reloadPreview();
      } else if (MODE === 'offline') {
        var t = j.updatedAt || '';
        toast(location.protocol === 'file:'
          ? '已存到这台电脑 · ' + t + ' · 双击前台刷新就变了'
          : '已保存 · ' + t + ' · 前台刷新就看到（正式发布再点「导出文件」）');
        reloadPreview();
      } else {
        toast('已保存 · ' + (j.updatedAt || ''));
        reloadPreview();
      }
    }).catch(function (e) {
      b.disabled = false;
      b.textContent = '保存';
      toast(e.message, true);
    });
  }
  $('#saveBtn').addEventListener('click', doSave);
  var sb = $('#saveBarBtn');
  if (sb) sb.addEventListener('click', doSave);
  // Ctrl/Cmd + S 也能存
  window.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      if (!$('#app').hidden) doSave();
    }
  });

  function reloadPreview() {
    var f = $('#prevFrame');
    if (f) f.src = '../index.html?t=' + Date.now();
  }
  $('#previewBtn').addEventListener('click', function () { window.open('../index.html', '_blank'); });

  /* 离线模式：导出 / 导入（不需要 Node，也不需要账号） */
  $('#expBtn').addEventListener('click', function () {
    var data = JSON.parse(JSON.stringify(S.data));
    data.meta = data.meta || {};
    data.meta.updatedAt = fmtNow();
    download('content.json', JSON.stringify(data, null, 2), 'application/json');
    setTimeout(function () {
      download('site-data.js', dataJsText(data), 'text/javascript');
    }, 300);
    toast('已导出 content.json 和 site-data.js，覆盖回「源码」里的同名文件');
  });
  $('#impBtn').addEventListener('click', function () { $('#impFile').click(); });
  $('#impFile').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var d = JSON.parse(String(fr.result));
        if (!d || !d.hero || !d.theme) throw new Error('这个文件不像是 content.json');
        S.data = d;
        offlineSave(d);
        markDirty(false);
        render();
        reloadPreview();
        toast('已导入并保存');
      } catch (e) { toast(e.message, true); }
      $('#impFile').value = '';
    };
    fr.readAsText(f);
  });
  $('#prevRe').addEventListener('click', reloadPreview);
  $$('.prev__hd [data-w]').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.prev__hd [data-w]').forEach(function (x) { x.classList.remove('is-on'); });
      b.classList.add('is-on');
      var w = b.getAttribute('data-w');
      var f = $('#prevFrame');
      f.style.width = w === '390' ? '390px' : '100%';
      f.style.margin = w === '390' ? '0 auto' : '0';
    });
  });

  $('#outBtn').addEventListener('click', function () {
    NET.logout().then(function () {
      location.reload();
    });
  });
  $('#pwBtn').addEventListener('click', function () {
    if (MODE === 'gh') {
      var nv = prompt('换一个 GitHub Token（留空表示清除）');
      if (nv === null) return;
      ghSaveTk(nv.trim());
      toast(nv.trim() ? 'Token 已换，刷新后生效' : 'Token 已清除');
      setTimeout(function () { location.reload(); }, 900);
      return;
    }
    var v = prompt('新口令（至少 6 位）');
    if (!v) return;
    NET.setPw(v)
      .then(function () { toast('口令已改，请重新登录'); setTimeout(function () { location.reload(); }, 900); })
      .catch(function (e) { toast(e.message, true); });
  });

  window.addEventListener('beforeunload', function (e) {
    if (S.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------------- 启动 ---------------- */
  /* 三种打开方式：
   *   file:// 或普通网址 → 离线模式：双击就能用，内容存在这台电脑的浏览器里，
   *                        改完点「导出文件」再覆盖回「源码」即可，不用装任何东西
   *   127.0.0.1          → 本地模式：口令登录，直接写本机文件夹里的文件
   *   ?gh=1             → 线上模式（可选，需 GitHub Token）
   */
  function applyModeUI() {
    var lbl = document.querySelector('.gate__f span');
    var inp = $('#gatePw');
    var b = $('#gateForm .gate__b');
    var sub = document.querySelector('.gate__sub');
    var hd = document.querySelector('#app .top__l span');
    var pwB = $('#pwBtn');
    var expB = $('#expBtn');
    var impB = $('#impBtn');
    if (MODE === 'offline') {
      document.title = '内容后台 · 云探校';
      if (lbl) lbl.textContent = '口令';
      if (inp) { inp.type = 'password'; inp.placeholder = '首次为 admin123'; }
      if (b) b.textContent = '进入后台';
      if (sub) {
        sub.innerHTML = (location.protocol === 'file:'
          ? '免安装模式：双击就能用，不用装 Node、不用连网。<br>'
          : '网页版：内容存在这台电脑的浏览器里，不上传任何服务器。<br>')
          + '改完点「保存」前台刷新即变；要交给别人就点「导出文件」。';
      }
      if (hd) hd.textContent = '内容后台 · 离线';
      if (pwB) pwB.textContent = '改口令';
      if (expB) expB.hidden = false;
      if (impB) impB.hidden = false;
      var tip = document.querySelector('.prev__tip');
      if (tip) tip.textContent = '点「保存」后这里会自动刷新；双击前台文件也是改完的样子。';
    } else if (MODE === 'gh') {
      document.title = '内容后台（线上）· 云探校';
      if (lbl) lbl.textContent = 'GitHub Token';
      if (inp) {
        inp.type = 'password';
        inp.placeholder = '粘贴一个能写这个仓库的 token';
        inp.value = ghLoad();
      }
      if (b) b.textContent = '连上仓库';
      if (sub) sub.innerHTML = '线上模式：保存会提交到这个仓库，约 1 分钟后线上生效。<br>'
        + 'Token 只存在这台电脑的浏览器里，不会写进仓库。';
      if (hd) hd.textContent = '内容后台 · 线上';
      if (pwB) pwB.textContent = '换 Token';
      var how = $('#gateHow');
      if (how) how.hidden = false;
      var tip = document.querySelector('.prev__tip');
      if (tip) tip.textContent = '线上模式：这里显示的是已发布的版本，保存后约 1 分钟才会变。';
    } else if (MODE === 'local') {
      if (hd) hd.textContent = '内容后台 · 本地';
      if (pwB) pwB.textContent = '改口令';
    }
  }
  applyModeUI();

  if (MODE === 'offline') {
    showGate();
  } else if (MODE === 'gh') {
    // 有 token 就直接试读一次，读通了免登录进主界面
    if (ghLoad()) {
      ghReadContent().then(function (d) {
        S.data = d; showApp(); render();
      }).catch(function (err) {
        showGate();
        $('#gateErr').textContent = err.message;
      });
    } else {
      showGate();
    }
  } else {
    api('/api/me')
      .then(function () { showApp(); boot(); })
      .catch(function (err) {
        showGate();
        if (err && err.message === HINT) $('#gateErr').textContent = HINT;
      });
  }
})();
