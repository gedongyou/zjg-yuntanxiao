/* 云探校 · 后台前端
 * 纯原生 JS，没有框架。内容结构来自 content.json，
 * 字段定义在下面的 SCHEMA 里 —— 加一个字段只要在这里加一行。
 */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var S = { data: null, dirty: false, tab: 'layout', misses: [], versions: [] };

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
        if (r.status === 401) { showGate(); throw new Error('登录已过期'); }
        if (!r.ok) throw new Error(j.msg || ('请求失败 ' + r.status));
        return j;
      });
    });
  }

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
    api('/api/login', { method: 'POST', body: { pw: $('#gatePw').value } })
      .then(function () { showApp(); boot(); })
      .catch(function (err) { $('#gateErr').textContent = err.message; });
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

  function boot() {
    api('/api/content').then(function (d) {
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
            fText('注释', p + '.d', null, 2);
        }, function (it) { return (it.n || '') + ' ' + (it.t || ''); });
    },
    stops: function () {
      return fText('小标签', 'stops.kicker') +
        '<div class="grid2">' + fText('标题前半', 'stops.head') + fText('标题红色后半', 'stops.headEm') + '</div>' +
        fText('导语', 'stops.lead', null, 2) + fText('示意图右下标注', 'stops.planHint') +
        fGroup('七个站点', 'stops.items', function (p) {
          return '<div class="grid3">' + fText('序号', p + '.no') + fText('名称', p + '.nm') + fText('英文', p + '.block') + '</div>' +
            fText('描述', p + '.desc', null, 3) +
            fList('标签（一行一个）', p + '.tags') +
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
            fText('注释', p + '.note', null, 2);
        }, function (it) { return (it.no || '') + ' ' + (it.nm || ''); }) +
        fGroup('办学层次', 'majors.levels', function (p) {
          return fText('标题', p + '.b') + fText('说明', p + '.s', null, 2);
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
        fText('导语', 'admit.lead', null, 2) +
        fGroup('五步流程', 'admit.flow', function (p) {
          return '<div class="grid3">' + fText('序号', p + '.no') + fText('标题', p + '.t') + '</div>' +
            fText('说明', p + '.d', null, 2);
        }, function (it) { return (it.no || '') + ' ' + (it.t || ''); }) +
        fText('场次表标题', 'admit.slot.title') +
        fGroup('场次表行', 'admit.slot.rows', function (p) {
          return '<div class="grid2">' + fText('项目', p + '.k') + fText('内容', p + '.v') + '</div>';
        }, function (it) { return (it.k || '') + '：' + (it.v || ''); }) +
        fText('场次表注释', 'admit.slot.note', null, 2) +
        fImg('二维码', 'admit.contact.qr') + fText('二维码说明', 'admit.contact.qrAlt') +
        fGroup('联系方式', 'admit.contact.rows', function (p) {
          return '<div class="grid2">' + fText('项目', p + '.k') + fText('内容', p + '.v') + '</div>';
        }, function (it) { return (it.k || '') + '：' + (it.v || ''); });
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
      return '<div class="grid3">' +
          fText('纸色', 'theme.paper') + fText('次纸色', 'theme.paper2') + fText('墨色', 'theme.ink') + '</div>' +
        '<div class="grid3">' +
          fText('主红', 'theme.red') + fText('金', 'theme.gold') + '</div>' +
        '<div class="grid3">' +
          fNum('对比度', 'theme.contrast', '1 正常，1.15 更硬') +
          fNum('疏密', 'theme.density', '1 正常，1.15 更松') +
          fNum('图片灰度', 'theme.imgGray', '0 彩色，1 全灰') + '</div>' +
        '<p class="hint">层次靠对比度、疏密、灰度三个数一起调；改完保存，前台立刻能看到。</p>';
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
    hero: '首屏', pan: '校园长卷', numbers: '可核对的数字', stops: '七站导览',
    majors: '系部与专业', craft: '匠心与荣誉', admit: '招生信息',
    footer: '页脚', nav: '页头', ask: '问校园面板', meta: '页面信息', theme: '配色与疏密'
  };
  var SECTION_DESC = {
    hero: '第一屏：标题、副标题、两个按钮、四格信息',
    pan: '滚到这一段自动拉开的红漆长卷',
    numbers: '八个数字，进视口从 0 补间',
    stops: '七站手风琴 + 右侧校园示意图',
    majors: '五个系部手风琴 + 办学层次',
    craft: '三个大数字、八行时间线、国际合作、新闻图',
    admit: '五步流程、场次表、地址与二维码',
    footer: '页脚三栏链接与版权',
    nav: '固定页头与手机抽屉',
    ask: '右下角问答面板的开场和兜底',
    meta: '浏览器标题、描述、图标',
    theme: '纸色、墨色、主红、对比度、疏密、图片灰度'
  };

  /* ---------------- 渲染 ---------------- */
  function render() {
    var pane = $('#pane');
    if (S.tab === 'layout') pane.innerHTML = viewLayout();
    else if (S.tab === 'content') pane.innerHTML = viewContent();
    else if (S.tab === 'ask') pane.innerHTML = viewAsk();
    else if (S.tab === 'miss') { pane.innerHTML = viewMiss(); loadMisses(); }
    else if (S.tab === 'hist') { pane.innerHTML = viewHist(); loadVersions(); }
    else pane.innerHTML = viewOut();
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
      '<div class="h" style="margin-top:28px"><h2>配色与疏密</h2><span>老师说的层次，主要靠这三个数</span></div>' +
      '<div class="card"><div class="card__bd">' + SCHEMA.theme() + '</div></div>';
  }

  function viewContent() {
    var order = ['nav', 'hero', 'pan', 'numbers', 'stops', 'majors', 'craft', 'admit', 'footer', 'ask', 'meta'];
    var cards = order.map(function (k) {
      return '<div class="card" data-sec="' + k + '">' +
        '<div class="card__hd"><b>' + SECTION_NAME[k] + '</b>' +
          '<span class="tag">' + esc(k) + '</span></div>' +
        '<div class="card__bd">' + SCHEMA[k]() + '</div>' +
      '</div>';
    }).join('');
    return '<div class="h"><h2>内容编辑</h2><span>改完点右上角「保存」</span></div>' +
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
      '<p class="hint">访客的问题会拿去和关键词比对，命中得分最高的那条。答不上来的问题会进「访客提问」，从那里可以直接转成新条目。分类分布：' + catLine + '</p>' +
      '<button class="btn btn--solid" id="qAdd" style="margin-bottom:14px">+ 新增问答</button>' +
      (list || '<div class="empty">还没有问答条目</div>');
  }

  function viewMiss() {
    return '<div class="h"><h2>访客提问</h2><span>答不上来的问题都记在这里</span></div>' +
      '<p class="hint">前台答不上来时会把原问题发回来。这里能看到问了什么、问了几次。点「转成问答」会带着这句话去新增一条。</p>' +
      '<div id="missBox"><div class="empty">读取中…</div></div>';
  }

  function viewHist() {
    return '<div class="h"><h2>历史版本</h2><span>每次保存都会留一份，最多 40 份</span></div>' +
      '<p class="hint">改坏了就回到上一版。点「恢复」会用那一版覆盖当前内容，恢复前建议先保存一次。</p>' +
      '<div class="card"><div id="verBox"><div class="empty">读取中…</div></div></div>';
  }

  function viewOut() {
    return '<div class="h"><h2>导出与发布</h2><span>把后台改完的东西变成能发出去的静态包</span></div>' +
      '<div class="out">' +
        '<div class="out__box"><h3>1. 导出静态包</h3>' +
          '<p>生成 <code>dist/</code> 文件夹和一个 <code>云探校-发布包.zip</code>。里面是纯静态文件，双击能开，也能直接丢到 GitHub Pages。</p>' +
          '<button class="btn btn--solid" id="exportBtn">生成发布包</button>' +
          '<div id="exportOut" style="margin-top:12px"></div>' +
        '</div>' +
        '<div class="out__box"><h3>2. 发布到 GitHub Pages</h3>' +
          '<p>仓库是 <code>gxglad/yyt</code>。把 dist 里的东西拷进仓库根目录，提交推送即可。国内网络记得走代理。</p>' +
          '<div class="code">cd 源码\n' +
'git add -A\n' +
'git commit -m "后台改版：内容可维护"\n' +
'git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin main</div>' +
        '</div>' +
        '<div class="out__box"><h3>3. 答辩时怎么演示后台</h3>' +
          '<p>现场开两个窗口：左边后台改一句文案，点保存；右边前台刷新，字变了。再打开「问答库」加一条新问答，回前台问一句，答案就出来了。</p>' +
          '<div class="code">node server.mjs\n前台 http://127.0.0.1:7717/\n后台 http://127.0.0.1:7717/admin/</div>' +
        '</div>' +
      '</div>';
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
          var fr = new FileReader();
          fr.onload = function () {
            var bin = atob(String(fr.result).split(',')[1]);
            var buf = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
            fetch('/api/upload?name=' + encodeURIComponent(f.name), {
              method: 'POST', body: buf, credentials: 'same-origin',
              headers: { 'Content-Type': 'application/octet-stream' }
            }).then(function (r) { return r.json(); }).then(function (j) {
              if (!j.ok) throw new Error(j.msg || '上传失败');
              set(path, j.src);
              var inp = pane.querySelector('[data-p="' + path + '"]');
              if (inp) {
                inp.value = j.src;
                var pv = inp.closest('.imgf').querySelector('.imgf__pv');
                pv.innerHTML = '<img src="../' + esc(j.src) + '" alt="">';
              }
              toast('图片已上传');
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
        api('/api/content').then(function () {
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

    // 版本恢复
    $$('[data-ver]', pane).forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-ver');
        if (!confirm('用这一版覆盖当前内容？')) return;
        api('/api/restore', { method: 'POST', body: { f: f } })
          .then(function () { return api('/api/content'); })
          .then(function (d) { S.data = d; markDirty(false); render(); toast('已恢复'); })
          .catch(function (e) { toast(e.message, true); });
      });
    });

    // 导出
    var ex = $('#exportBtn');
    if (ex) {
      ex.addEventListener('click', function () {
        ex.disabled = true;
        ex.textContent = '正在打包…';
        api('/api/export', { method: 'POST' }).then(function (j) {
          $('#exportOut').innerHTML = '<div class="code">已生成：\n' + esc(j.dir) +
            '\n' + esc(j.zip) + '\n共 ' + j.files + ' 个文件</div>';
          ex.disabled = false;
          ex.textContent = '重新生成';
        }).catch(function (e) {
          toast(e.message, true);
          ex.disabled = false;
          ex.textContent = '生成发布包';
        });
      });
    }

    // 未命中：转成问答
    $$('[data-tomiss]', pane).forEach(function (b) {
      b.addEventListener('click', function () {
        var q = b.getAttribute('data-tomiss');
        S.data.ask.entries.unshift({
          id: 'e' + Date.now(), cat: '待补', on: true, weight: 0,
          q: q, keywords: [q], answer: '（在这里写答案，前台马上就能答上）'
        });
        markDirty(true);
        S.tab = 'ask';
        syncTabs();
        render();
        toast('已加到问答库，填好答案后记得保存');
      });
    });
    $$('[data-mdel]', pane).forEach(function (b) {
      b.addEventListener('click', function () {
        var q = b.getAttribute('data-mdel');
        S.misses = S.misses.filter(function (x) { return x.q !== q; });
        api('/api/misses', { method: 'POST', body: S.misses }).then(function () { render(); });
      });
    });
  }

  /* ---------------- 未命中 / 版本 ---------------- */
  function loadMisses() {
    api('/api/misses').then(function (list) {
      S.misses = list || [];
      var box = $('#missBox');
      if (!box) return;
      if (!S.misses.length) {
        box.innerHTML = '<div class="empty">还没有人问到答不上来的问题。<br>前台问一句没收录的，这里就会出现。</div>';
        return;
      }
      box.innerHTML = S.misses.map(function (m) {
        return '<div class="ver">' +
          '<div style="flex:1;min-width:0"><b style="font-family:var(--sans);font-size:13px">' + esc(m.q) + '</b>' +
          '<span style="display:block;font-size:11.5px;color:var(--ink-3)">问了 ' + (m.n || 1) + ' 次 · ' +
          (m.last ? new Date(m.last).toLocaleString('zh-CN') : '') + '</span></div>' +
          '<button class="btn" data-tomiss="' + esc(m.q) + '">转成问答</button>' +
          '<button class="mini mini--red" data-mdel="' + esc(m.q) + '">×</button>' +
        '</div>';
      }).join('');
      bindPane();
    }).catch(function () {});
  }

  function loadVersions() {
    api('/api/versions').then(function (list) {
      S.versions = list || [];
      var box = $('#verBox');
      if (!box) return;
      if (!S.versions.length) { box.innerHTML = '<div class="empty">还没有历史版本</div>'; return; }
      box.innerHTML = S.versions.map(function (v) {
        return '<div class="ver">' +
          '<b>' + new Date(v.at).toLocaleString('zh-CN') + '</b>' +
          '<span>' + v.kb + ' KB</span>' +
          '<div style="margin-left:auto"><button class="btn" data-ver="' + esc(v.f) + '">恢复</button></div>' +
        '</div>';
      }).join('');
      bindPane();
    }).catch(function () {});
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

  $('#saveBtn').addEventListener('click', function () {
    var b = $('#saveBtn');
    b.disabled = true;
    b.textContent = '保存中…';
    api('/api/content', { method: 'POST', body: S.data }).then(function (j) {
      markDirty(false);
      b.disabled = false;
      b.textContent = '保存';
      toast('已保存 · ' + (j.updatedAt || ''));
      reloadPreview();
    }).catch(function (e) {
      b.disabled = false;
      b.textContent = '保存';
      toast(e.message, true);
    });
  });

  function reloadPreview() {
    var f = $('#prevFrame');
    if (f) f.src = '../index.html?t=' + Date.now();
  }
  $('#previewBtn').addEventListener('click', function () { window.open('../index.html', '_blank'); });
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
    api('/api/logout', { method: 'POST' }).then(function () {
      location.reload();
    });
  });
  $('#pwBtn').addEventListener('click', function () {
    var v = prompt('新口令（至少 6 位）');
    if (!v) return;
    api('/api/pw', { method: 'POST', body: { pw: v } })
      .then(function () { toast('口令已改，请重新登录'); setTimeout(function () { location.reload(); }, 900); })
      .catch(function (e) { toast(e.message, true); });
  });

  window.addEventListener('beforeunload', function (e) {
    if (S.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------------- 启动 ---------------- */
  api('/api/me').then(function () { showApp(); boot(); }).catch(function () { showGate(); });
})();
