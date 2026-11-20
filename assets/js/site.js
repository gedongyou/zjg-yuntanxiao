/* 云探校 · 渲染层
 * 内容来自 assets/js/site-data.js（由后台从 content.json 生成），
 * 页面结构在运行时拼出来 —— 后台改内容，前台刷新就变。
 */
(function () {
  'use strict';

  var D = window.__CONTENT__;

  /* 浏览器里可能存着后台改过的草稿（双击 admin/index.html 或用网址打开后台时保存的）。
   * 只有当它比编译好的 site-data.js 更新时才用它 —— 这样用「启动后台.bat」改文件之后，
   * 旧的浏览器草稿不会把新内容盖回去。 */
  (function () {
    try {
      var raw = localStorage.getItem('yyt_content_v1');
      if (!raw || !D) return;
      var lo = JSON.parse(raw);
      if (!lo || !lo.hero || !lo.theme) return;
      // 草稿的保存时刻（毫秒）。没有就退回用 meta.updatedAt 的字符串比。
      var ts = parseInt(localStorage.getItem('yyt_content_v1_ts') || '0', 10) || 0;
      var built = String((D.meta || {}).updatedAt || '');
      var builtMs = built ? (Date.parse(built.replace(' ', 'T') + ':00') || 0) : 0;
      var newer;
      if (ts > 0) newer = ts > builtMs;
      else newer = String((lo.meta || {}).updatedAt || '') > built;
      if (newer) D = lo;
    } catch (e) {}
  })();

  /* 后台在另一个标签页里保存时，这里自动刷新一下，不用手动按 F5。
   * storage 事件只在"别的标签页"改动时触发，正好对应这种场景。 */
  window.addEventListener('storage', function (e) {
    if (e.key === 'yyt_content_v1' || e.key === 'yyt_content_v1_ts') location.reload();
  });
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  if (!D) {
    var app0 = $('#app');
    if (app0) {
      app0.innerHTML = '<div class="wrap" style="padding:140px 0">' +
        '<p class="kicker">DATA MISSING</p>' +
        '<h1 class="sec__h" style="margin-top:18px">没有读到内容数据</h1>' +
        '<p class="sec__lead" style="margin-top:16px">缺少 <code>assets/js/site-data.js</code>。' +
        '在后台点一次「保存」会重新生成；或者用后台的「导出静态包」拿到完整文件夹。</p></div>';
    }
    return;
  }

  /* ---------- 小工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function setHTML(node, html) { if (node) node.innerHTML = html == null ? '' : html; }
  function setTx(node, tx) { if (node) node.textContent = tx == null ? '' : tx; }

  /* ---------- 主题与文档头 ---------- */
  var T = D.theme || {};
  var R = document.documentElement.style;
  if (T.paper) { R.setProperty('--paper', T.paper); }
  if (T.paper2) { R.setProperty('--paper-2', T.paper2); }
  if (T.ink) { R.setProperty('--ink', T.ink); }
  if (T.red) { R.setProperty('--red', T.red); }
  if (T.gold) { R.setProperty('--gold', T.gold); }
  if (T.sky) { R.setProperty('--sky', T.sky); }
  if (T.contrast && T.contrast !== 1) { R.setProperty('--contrast', T.contrast); }
  if (T.density && T.density !== 1) { R.setProperty('--density', T.density); }
  var gray = (typeof T.imgGray === 'number') ? T.imgGray : T.imageGray;
  if (typeof gray === 'number') { R.setProperty('--img-gray', gray); }

  var M = D.meta || {};
  if (M.title) document.title = M.title;
  if (M.favicon) { var fav = $('link[rel="icon"]'); if (fav) fav.href = M.favicon; }
  if (M.themeColor) { var tc = $('meta[name="theme-color"]'); if (tc) tc.content = M.themeColor; }
  if (M.desc) { var ds = $('meta[name="description"]'); if (ds) ds.content = M.desc; }

  /* ---------- 页头 ---------- */
  var N = D.nav || {};
  if (N.brandImg) { var bi = $('#brandImg'); if (bi) bi.src = N.brandImg; }
  setTx($('#brandCn'), N.brandCn || '');
  setTx($('#brandEn'), N.brandEn || '');
  setTx($('#navCtaTx'), (N.cta && N.cta.t) || '');
  if (N.cta && N.cta.href) { var nc = $('#navCta'); if (nc) nc.href = N.cta.href; }

  var navLinks = arr(N.links).map(function (l) {
    return '<a href="' + esc(l.href) + '">' + esc(l.t) + '</a>';
  }).join('');
  setHTML($('#navLinks'), navLinks);

  var drawerLinks = arr(N.links).map(function (l) {
    return '<a href="' + esc(l.href) + '">' + esc(l.t) + '</a>';
  }).join('') + '<a href="设计说明.html">设计说明</a>';
  setHTML($('#drawerNav'), drawerLinks);
  setHTML($('#drawerFoot'), N.drawerFoot || '');

  /* ---------- 各段的渲染函数 ---------- */
  function secHead(kicker, head, headEm, lead, extra) {
    return '<div class="sec__head">' +
      '<div class="reveal">' +
        '<p class="kicker">' + esc(kicker) + '</p>' +
        '<h2 class="sec__h">' + esc(head) + (headEm ? '<br><em>' + esc(headEm) + '</em>' : '') + '</h2>' +
      '</div>' +
      (lead ? '<p class="sec__lead reveal" data-d="1">' + esc(lead) + '</p>' : '') +
      (extra || '') +
    '</div>';
  }

  var RENDER = {};

  RENDER.hero = function (h) {
    var actions = arr(h.actions).map(function (a) {
      var arrow = a.arrow === 'down'
        ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 3v10M4 9l4 4 4-4"/></svg>'
        : '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4"/></svg>';
      return '<a class="btn btn--' + esc(a.style || 'ghost') + '" href="' + esc(a.href) + '">' +
        esc(a.t) + arrow + '</a>';
    }).join('');

    var meta = arr(h.meta).map(function (m) {
      return '<div><dt>' + esc(m.k) + '</dt><dd>' + esc(m.v) + '</dd></div>';
    }).join('');

    return '<section class="hero" id="hero">' +
      '<div class="hero__seal" aria-hidden="true"><span>' + esc(h.seal || '云探校') + '</span></div>' +
      '<div class="wrap hero__inner">' +
        '<p class="hero__tag"><b>' + esc(h.kickerYear || '') + '</b>' + esc(h.kicker || '') + '</p>' +
        '<h1 class="hero__title">' + esc(h.title || '') + '<span>' + esc(h.titleEm || '') + '</span></h1>' +
        '<div class="hero__row">' +
          '<div>' +
            '<p class="hero__sub">' + esc(h.sub || '') + '</p>' +
            '<p class="hero__lead">' + esc(h.lead || '') + '</p>' +
          '</div>' +
          '<div class="hero__acts">' + actions + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="wrap"><dl class="hero__meta">' + meta + '</dl></div>' +
      '<div class="hero__scroll">' + esc(h.scroll || '向下看') + '<i></i></div>' +
    '</section>';
  };

  RENDER.pan = function (p) {
    var frames = arr(p.frames).map(function (f, i) {
      if (f.type === 'img') {
        return '<div class="unroll__img' + (i === 0 ? ' is-on' : '') + '" data-cap="' + esc(f.cap) + '" ' +
          'style="background-image:url(\'' + esc(f.src) + '\');background-position:' + esc(f.pos || 'center 55%') + '"></div>';
      }
      return '<div class="unroll__card' + (i === 0 ? ' is-on' : '') + '" data-cap="' + esc(f.cap) + '">' +
        '<div class="unroll__cin">' +
          '<span class="unroll__yr">' + esc(f.year) + '</span>' +
          '<h3 class="unroll__ev">' + esc(f.event) + '</h3>' +
          '<p class="unroll__tx">' + esc(f.text) + '</p>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<section class="unroll" id="pan">' +
      '<div class="unroll__sticky">' +
        '<div class="unroll__head">' +
          '<p class="kicker">' + esc(p.kicker || 'SCROLL') + '</p>' +
          '<h2>' + esc(p.head || '') + (p.headEm ? '<br><em>' + esc(p.headEm) + '</em>' : '') + '</h2>' +
        '</div>' +
        '<div class="unroll__stage">' +
          '<div class="unroll__band" id="unrollBand">' +
            '<span class="roller roller--l" aria-hidden="true"></span>' +
            '<div class="unroll__frame">' + frames + '</div>' +
            '<span class="roller roller--r" aria-hidden="true"></span>' +
          '</div>' +
        '</div>' +
        '<div class="unroll__foot">' +
          '<p class="unroll__cap" id="panCap">' + esc(p.footCap || '') + '</p>' +
          '<p class="unroll__mark">' + esc(p.mark || '') + '</p>' +
        '</div>' +
      '</div>' +
    '</section>';
  };

  RENDER.numbers = function (n) {
    var stats = arr(n.stats).map(function (s, i) {
      return '<div class="stat reveal" data-d="' + (i % 4) + '">' +
        (s.q ? '<p class="stat__q">' + esc(s.q) + '</p>' : '') +
        '<p class="stat__n"><span data-count="' + esc(s.n) + '">0</span><i>' + esc(s.unit || '') + '</i></p>' +
        '<p class="stat__t">' + esc(s.t) + '</p>' +
      '</div>';
    }).join('');

    return '<section class="sec sec--paper" id="numbers">' +
      '<div class="wrap">' +
        secHead(n.kicker, n.head, n.headEm, n.lead) +
        '<div class="stats' + (arr(n.stats).length % 4 === 0 ? '' : ' stats--fit') + '">' + stats + '</div>' +
      '</div>' +
    '</section>';
  };

  /* ---------- 五心育人：首页招牌，可点进详情 ---------- */
  var HEART_NAME = { red: '红心', ren: '仁心', heng: '恒心', jiang: '匠心', chuang: '创心' };

  function hchipList(ids, onClick) {
    var hs = arr(D.wuxin && D.wuxin.hearts);
    return arr(ids).map(function (id) {
      var h = null;
      for (var i = 0; i < hs.length; i++) { if (hs[i].id === id) { h = hs[i]; break; } }
      if (!h) return '';
      return '<button class="hchip" type="button" style="--hc:' + esc(h.color) + '" ' +
        'data-heart="' + esc(h.id) + '"' + (onClick ? '' : ' tabindex="-1"') + '>' +
        '<i></i>' + esc(h.nm) + '</button>';
    }).join('');
  }

  RENDER.path = function (w) {
    var path = w || {};
    var steps = arr(path.steps).map(function (s) {
      return '<li class="pstep reveal">' +
        '<div class="pstep__top"><span>' + esc(s.no) + '</span><b>' + esc(s.st) + '</b></div>' +
        '<h4>' + esc(s.nm) + '</h4>' +
        '<p>' + esc(s.t) + '</p>' +
        '<div class="pstep__hs">' + hchipList(s.hearts, true) + '</div>' +
      '</li>';
    }).join('');

    return '<section class="sec sec--path" id="path">' +
      '<div class="wrap">' +
        secHead(path.kicker, path.head, path.headEm, path.lead) +
        '<ol class="ppath">' + steps + '</ol>' +
      '</div>' +
    '</section>';
  };

  RENDER.quiz = function (q) {
    return '<section class="sec sec--paper" id="quiz">' +
      '<div class="wrap">' +
        secHead(q.kicker, q.head, q.headEm, q.lead) +
        '<div class="qz" id="quizBox">' +
          '<noscript><p>这个自测需要浏览器开启 JavaScript。</p></noscript>' +
        '</div>' +
      '</div>' +
    '</section>';
  };

  /* ---------- 预约探校 ---------- */
  RENDER.visit = function (v) {
    var slots = arr(v.slots).map(function (s) {
      var left = Math.max(0, (s.cap || 0) - (s.booked || 0));
      var pct = Math.round(((s.booked || 0) / (s.cap || 1)) * 100);
      return '<button class="slot' + (left === 0 ? ' is-full' : '') + '" type="button" data-slot="' + esc(s.id) + '"' +
        (left === 0 ? ' disabled' : '') + '>' +
        '<span class="slot__d">' + esc(s.date) + '<i>' + esc(s.wk || '') + '</i></span>' +
        '<span class="slot__t">' + esc(s.time) + '</span>' +
        '<span class="slot__bar"><i style="width:' + pct + '%"></i></span>' +
        '<span class="slot__l">' + (left === 0 ? '已约满' : '余 ' + left + ' 组') + '</span>' +
      '</button>';
    }).join('');

    var route = arr(v.route).map(function (r, i) {
      return '<li class="rt"><span class="rt__no">' + ('0' + (i + 1)).slice(-2) + '</span>' +
        '<div><b>' + esc(r.t) + '</b><p>' + esc(r.d) + '</p></div>' +
        '<span class="rt__m">' + esc(r.min || '') + '</span></li>';
    }).join('');

    var tips = arr(v.tips).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    var f = v.form || {};

    return '<section class="sec" id="visit">' +
      '<div class="wrap">' +
        secHead(v.kicker, v.head, v.headEm, v.lead) +
        '<div class="visit">' +
          '<div class="reveal">' +
            '<h4 class="blk__h">选一个场次</h4>' +
            '<div class="slots" id="slotList">' + slots + '</div>' +
            '<h4 class="blk__h">四十分钟怎么走</h4>' +
            '<ol class="route">' + route + '</ol>' +
            '<ul class="tips">' + tips + '</ul>' +
          '</div>' +
          '<div class="reveal" data-d="1">' +
            '<form class="vform" id="visitForm" novalidate>' +
              '<h4>' + esc(f.title || '') + '</h4>' +
              '<p class="vform__sub">' + esc(f.sub || '') + '</p>' +
              '<label class="fd"><span>学生姓名 *</span><input name="nm" required maxlength="20" placeholder="和户口本一致"></label>' +
              '<label class="fd"><span>手机号 *</span><input name="tel" required inputmode="numeric" maxlength="11" placeholder="11 位手机号"></label>' +
              '<label class="fd"><span>同行人数</span><select name="ppl"><option value="1">1 位学生 + 1 位家长</option><option value="2">1 位学生 + 2 位家长</option><option value="3">1 位学生 + 3 位家长</option></select></label>' +
              '<label class="fd"><span>想看的系部</span><select name="dept">' +
                arr(D.majors && D.majors.depts).map(function (d) { return '<option value="' + esc(d.nm) + '">' + esc(d.nm) + '</option>'; }).join('') +
                '<option value="都看">都想看看</option>' +
              '</select></label>' +
              '<div class="fd fd--slot"><span>已选场次</span><b id="slotPicked">还没选，请在左边点一个</b></div>' +
              '<button class="btn btn--solid vform__btn" type="submit">' + esc(f.submit || '提交预约') + '</button>' +
              '<p class="vform__note">提交后会生成一组预约码，凭码到校签到。信息只用于本次探校安排。</p>' +
              '<p class="vform__ok" id="visitOk" hidden></p>' +
            '</form>' +
            '<div class="place"><b>' + esc((v.place || {}).t || '') + '</b><span>' + esc((v.place || {}).v || '') + '</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  };

  /* ---------- 线上招生：登记 / 查进度 / 流程 ---------- */
  RENDER.stops = function (s) {
    var items = arr(s.items).map(function (it, i) {
      return '<article class="walk__it' + (i === 0 ? ' is-open' : '') + '" data-nm="' + esc(it.nm) + '">' +
        '<button class="walk__hd" type="button" aria-expanded="' + (i === 0 ? 'true' : 'false') + '">' +
          '<span class="walk__no">' + esc(it.no) + '</span>' +
          '<span class="walk__nm">' + esc(it.nm) + '</span>' +
          '<span class="walk__en">' + esc(it.block || '').toUpperCase() + '</span>' +
          '<span class="walk__ic" aria-hidden="true"></span>' +
        '</button>' +
        '<div class="walk__bd"><div class="walk__in"><div class="walk__body">' +
          '<p class="walk__desc">' + esc(it.desc) + '</p>' +
          (it.heart ? '<p class="walk__heart">' + esc(it.heart) + '</p>' : '') +
          '<div class="walk__hs">' + hchipList(it.hearts, true) + '</div>' +
        '</div></div></div>' +
      '</article>';
    }).join('');

    return '<section class="walk" id="stops">' +
      '<div class="wrap">' +
        secHead(s.kicker, s.head, s.headEm, s.lead) +
        '<div class="walk__list" id="walkList">' + items + '</div>' +
      '</div>' +
    '</section>';
  };

  RENDER.majors = function (m) {
    var list = arr(m.list);
    var hs = arr(D.wuxin && D.wuxin.hearts);

    var top = arr(m.top).map(function (t) {
      return '<span>' + esc(t.t) + ' <b>' + esc(t.b) + '</b> ' + esc(t.u || '') + '</span>';
    }).join('');

    var filter = '<button class="fbtn is-on" type="button" data-fh="">全部 <i>' + list.length + '</i></button>' +
      hs.map(function (h) {
        var n = list.filter(function (x) { return arr(x.hearts).indexOf(h.id) > -1; }).length;
        return '<button class="fbtn" type="button" data-fh="' + esc(h.id) + '" style="--hc:' + esc(h.color) + '">' +
          '<em></em>' + esc(h.nm) + ' <i>' + n + '</i></button>';
      }).join('');

    var depts = arr(m.depts).map(function (d, i) {
      var mine = list.filter(function (x) { return x.dept === d.id; });
      var rows = mine.map(function (x) {
        var lv = '';
        arr(m.levels).forEach(function (l) { if (l.id === x.level) lv = l.b; });
        return '<li class="mrow" data-major="' + esc(x.id) + '" data-hearts="' + esc(arr(x.hearts).join(' ')) + '">' +
          '<div class="mrow__hd"><b>' + esc(x.nm) + '</b><span>' + esc(lv) + '</span></div>' +
          '<p>' + esc(x.one || '') + '</p>' +
          '<div class="mrow__hs">' + hchipList(x.hearts, true) + '</div>' +
        '</li>';
      }).join('');
      return '<div class="dept' + (i === 0 ? ' is-open' : '') + '" data-dept="' + esc(d.id) + '" data-hearts="' + esc(arr(d.hearts).join(' ')) + '">' +
        '<button class="dept__hd" aria-expanded="' + (i === 0 ? 'true' : 'false') + '">' +
          '<span class="dept__no">' + esc(d.no) + '</span>' +
          '<span class="dept__nm">' + esc(d.nm) + '</span>' +
          '<span class="dept__sm">' + esc(d.sm || '') + '</span>' +
          '<span class="dept__n">' + mine.length + ' 个方向</span>' +
          '<span class="dept__ic"></span>' +
        '</button>' +
        '<div class="dept__bd"><div class="dept__in"><div>' +
          '<ul class="chips">' + arr(d.chips).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
          '<p class="dept__note">' + esc(d.note || '') + '</p>' +
          '<ul class="mrows">' + rows + '</ul>' +
        '</div></div></div>' +
      '</div>';
    }).join('');


    return '<section class="sec" id="majors">' +
      '<div class="wrap">' +
        secHead(m.kicker, m.head, m.headEm, m.lead) +
        (top ? '<div class="majors__top reveal">' + top + '</div>' : '') +
        '<div class="mfilter reveal" id="mFilter">' + filter + '</div>' +
        '<div class="majors__list" id="depts">' + depts + '</div>' +
        '<p class="mempty" id="mEmpty" hidden>没有同时养这颗心的专业。换成「全部」再看。</p>' +
      '</div>' +
    '</section>';
  };

  RENDER.craft = function (c) {
    var big = arr(c.big).map(function (b) {
      return '<div><b>' + esc(b.n) + '<i>' + esc(b.u) + '</i></b><span>' + esc(b.t) + '</span></div>';
    }).join('');

    var news = arr(c.news).map(function (n) {
      return '<figure>' +
        '<img src="' + esc(n.src) + '" alt="' + esc(n.alt) + '" loading="lazy">' +
        '<figcaption>' + esc(n.cap) + '</figcaption>' +
      '</figure>';
    }).join('');

    return '<section class="sec" id="craft">' +
      '<div class="wrap">' +
        secHead(c.kicker, c.head, c.headEm, c.lead) +
        '<div class="craft__big reveal">' + big + '</div>' +
        '<div class="news reveal" data-d="1">' + news + '</div>' +
        (c.newsNote ? '<p class="craft__note">' + esc(c.newsNote) + '</p>' : '') +
      '</div>' +
    '</section>';
  };

  RENDER.admit = function (a) {
    var channels = arr(a.channels).map(function (c) {
      return '<a class="chn" href="' + esc(c.href) + '">' +
        '<span class="chn__no">' + esc(c.no) + '</span>' +
        '<b>' + esc(c.t) + '</b>' +
        '<p>' + esc(c.d) + '</p>' +
        '<span class="chn__act">' + esc(c.act || '去办') +
          '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4"/></svg>' +
        '</span>' +
      '</a>';
    }).join('');

    var flow = arr(a.flow).map(function (f) {
      return '<li><b>' + esc(f.no) + '</b><div><h4>' + esc(f.t) + '</h4>' +
        (f.d ? '<p>' + esc(f.d) + '</p>' : '') + '</div></li>';
    }).join('');


    var contact = a.contact || {};
    var crows = arr(contact.rows).map(function (r) {
      return '<dt>' + esc(r.k) + '</dt><dd>' + esc(r.v) + '</dd>';
    }).join('');

    var f = a.form || {};
    var ck = a.check || {};
    var steps = arr(ck.steps).map(function (s, i) {
      return '<li data-i="' + i + '"><b>' + esc(s) + '</b></li>';
    }).join('');

    return '<section class="sec sec--admit" id="admit">' +
      '<div class="wrap">' +
        secHead(a.kicker, a.head, a.headEm, a.lead) +

        '<div class="chns">' + channels + '</div>' +

        '<div class="admit">' +
          '<div class="reveal">' +
            '<h4 class="blk__h">五步走完</h4>' +
            '<ol class="flow">' + flow + '</ol>' +
            '<p class="slot__note">' + esc(a.note || '') + '</p>' +
          '</div>' +

          '<div class="reveal" data-d="1">' +
            '<form class="aform" id="applyForm" novalidate>' +
              '<h4>' + esc(f.title || '在线报名登记') + '</h4>' +
              '<p class="aform__sub">' + esc(f.sub || '') + '</p>' +
              '<div class="aform__row">' +
                '<label class="fd"><span>学生姓名 *</span><input name="nm" required maxlength="20" placeholder="和户口本一致"></label>' +
                '<label class="fd"><span>手机号 *</span><input name="tel" required inputmode="numeric" maxlength="11" placeholder="11 位手机号"></label>' +
              '</div>' +
              '<div class="aform__row">' +
                '<label class="fd"><span>初中学校 *</span><input name="sch" required maxlength="30" placeholder="如：张家港市第X中学"></label>' +
                '<label class="fd"><span>所在区县</span><input name="area" maxlength="20" placeholder="张家港 / 常熟 / 苏州城区…"></label>' +
              '</div>' +
              '<label class="fd"><span>想报的层次 *</span><select name="lv" required>' +
                arr(a.levels).map(function (l) { return '<option value="' + esc(l.b) + '">' + esc(l.b) + '</option>'; }).join('') +
              '</select></label>' +
              '<div class="fd"><span>想报的专业（可多选）</span><div class="picks" id="majorPicks">' +
                arr(D.majors && D.majors.list).map(function (m) {
                  return '<button type="button" class="pk" data-id="' + esc(m.id) + '">' + esc(m.nm) + '</button>';
                }).join('') +
              '</div></div>' +
              '<label class="fd"><span>想问的问题（选填）</span><textarea name="q" rows="3" maxlength="200" placeholder="比如：多少分能进？住宿怎么安排？能不能升本？"></textarea></label>' +
              '<button class="btn btn--solid aform__btn" type="submit">' + esc(f.submit || '提交登记') + '</button>' +
              '<p class="aform__note">线上预登记不占招生计划、不收费，也不替代教育局统一志愿填报。信息只用于招生咨询。</p>' +
              '<div class="aform__ok" id="applyOk" hidden></div>' +
            '</form>' +

            '<form class="cform" id="checkForm" novalidate>' +
              '<h4>' + esc(ck.title || '报名进度查询') + '</h4>' +
              '<p class="aform__sub">' + esc(ck.sub || '') + '</p>' +
              '<div class="aform__row">' +
                '<label class="fd"><span>报名号 *</span><input name="no" required maxlength="14" placeholder="如 YT20271123001" style="letter-spacing:.06em"></label>' +
                '<label class="fd"><span>手机号 *</span><input name="tel" required inputmode="numeric" maxlength="11" placeholder="登记时填的手机号"></label>' +
              '</div>' +
              '<button class="btn btn--ghost cform__btn" type="submit">查进度</button>' +
              '<div class="track" id="trackBox" hidden>' +
                '<div class="track__hd"><b id="trackNo"></b><span id="trackLv"></span></div>' +
                '<ol class="track__steps">' + steps + '</ol>' +
                '<p class="track__d" id="trackDesc"></p>' +
              '</div>' +
              '<p class="cform__miss" id="trackMiss" hidden>' + esc(ck.miss || '') + '</p>' +
            '</form>' +

            '<div class="contact">' +
              '<img src="' + esc(contact.qr) + '" alt="' + esc(contact.qrAlt) + '" loading="lazy">' +
              '<dl>' + crows + '</dl>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  };


  /* ---------- 按后台设定的顺序与显隐装配 ---------- */
  var ORDER = ['hero', 'path', 'pan', 'numbers', 'stops', 'majors', 'craft', 'quiz', 'visit', 'admit'];
  var secCfg = arr(D.sections);
  if (!secCfg.length) {
    secCfg = ORDER.map(function (k) { return { key: k, on: true }; });
  }
  var html = secCfg.filter(function (s) { return s.on !== false; })
    .map(function (s) {
      var fn = RENDER[s.key];
      var data = D[s.key];
      if (!fn || !data) return '';
      return fn(data);
    }).join('');
  $('#app').innerHTML = html;

  /* ---------- 页脚 ---------- */
  var F = D.footer || {};
  var fcols = arr(F.cols).map(function (c) {
    var links = arr(c.links).map(function (l) {
      return '<li><a href="' + esc(l.href) + '"' +
        (l.ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(l.t) + '</a></li>';
    }).join('');
    return '<div><h5>' + esc(c.h) + '</h5><ul>' + links + '</ul></div>';
  }).join('');

  setHTML($('#foot'),
    '<div class="wrap">' +
      '<div class="foot__top">' +
        '<div class="foot__brand">' +
          '<img src="' + esc(F.img || 'assets/img/emblem.png') + '" alt="校徽">' +
          '<div><b>' + (F.name || '') + '</b><span>' + (F.sub || '') + '</span></div>' +
        '</div>' + fcols +
      '</div>' +
      '<div class="foot__bot"><p>' + (F.copy || '').replace('{year}', new Date().getFullYear()) + '</p></div>' +
    '</div>');

  /* ---------- 交互：导航 ---------- */
  var nav = $('#nav');
  var burger = $('#burger');
  var drawer = $('#drawer');
  var drawerClose = $('#drawerClose');

  function onNavScroll() {
    if (!nav) return;
    nav.classList.toggle('is-stuck', window.pageYOffset > 40);
  }
  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add('is-open');
    document.body.classList.add('is-locked');
    if (burger) burger.setAttribute('aria-expanded', 'true');
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    if (burger) burger.setAttribute('aria-expanded', 'false');
  }
  if (burger) burger.addEventListener('click', openDrawer);
  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  $$('#drawerNav a').forEach(function (a) { a.addEventListener('click', closeDrawer); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

  /* ---------- 交互：进场动画 ---------- */
  var revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    revealEls.forEach(function (e) { io.observe(e); });

    var tl = $('#timeline');
    if (tl) {
      var tio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          $$('#timeline li').forEach(function (li, i) {
            setTimeout(function () { li.classList.add('is-on'); }, i * 90);
          });
          tio.disconnect();
        });
      }, { threshold: 0.2 });
      tio.observe(tl);
    }
  } else {
    revealEls.forEach(function (e) { e.classList.add('is-in'); });
    $$('#timeline li').forEach(function (li) { li.classList.add('is-on'); });
  }

  /* ---------- 交互：数字补间 ---------- */
  var counters = $$('[data-count]');
  var counted = false;
  function runCounters() {
    if (counted) return;
    counted = true;
    counters.forEach(function (node) {
      var target = parseFloat(node.getAttribute('data-count'));
      if (isNaN(target)) return;
      var dur = 1300;
      var t0 = performance.now();
      (function step(now) {
        var p = clamp((now - t0) / dur, 0, 1);
        var e = 1 - Math.pow(1 - p, 3);
        node.textContent = Math.round(target * e);
        if (p < 1) requestAnimationFrame(step);
        else node.textContent = target;
      })(t0);
    });
  }
  if (counters.length) {
    if ('IntersectionObserver' in window && !reduce) {
      var nio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { runCounters(); nio.disconnect(); }
        });
      }, { threshold: 0.25 });
      var statsBox = $('.stats');
      if (statsBox) nio.observe(statsBox);
    } else {
      runCounters();
    }
  }

  /* ---------- 交互：长卷 ---------- */
  var unroll = $('#pan');
  var band = $('#unrollBand');
  var frameBox = band ? band.querySelector('.unroll__frame') : null;
  var frames = frameBox ? [].slice.call(frameBox.children) : [];
  var capBox = $('#panCap');
  var capText = capBox ? capBox.textContent : '';
  var opened = false;

  function showFrame(i) {
    frames.forEach(function (node, k) { node.classList.toggle('is-on', k === i); });
  }
  function setCap(txt) {
    if (!capBox || !txt || txt === capText) return;
    capText = txt;
    capBox.style.opacity = '0';
    setTimeout(function () {
      capBox.textContent = txt;
      capBox.style.opacity = '1';
    }, 180);
  }
  function openUnroll() {
    if (opened || !unroll || !band) return;
    opened = true;
    unroll.classList.add('is-open');
    band.style.width = '100%';
    var last = frames.length - 1;
    if (last < 1) return;
    var step = reduce ? 0 : Math.round(6000 / frames.length);
    var i = 0;
    var timer = setInterval(function () {
      i += 1;
      if (i >= last) {
        clearInterval(timer);
        showFrame(last);
        setCap(frames[last].getAttribute('data-cap'));
        return;
      }
      showFrame(i);
    }, Math.max(80, step));
  }
  if (unroll) {
    if ('IntersectionObserver' in window) {
      var uio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { openUnroll(); uio.disconnect(); }
        });
      }, { threshold: 0.35 });
      uio.observe(unroll);
    } else {
      openUnroll();
    }
  }

  /* ---------- 交互：七站 ---------- */
  var walkItems = $$('.walk__it');

  function openWalk(item, nudge) {
    walkItems.forEach(function (it) {
      var on = it === item;
      it.classList.toggle('is-open', on);
      var hd = $('.walk__hd', it);
      if (hd) hd.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    if (!nudge) return;
    setTimeout(function () {
      var rect = item.getBoundingClientRect();
      var top = 96;
      if (rect.top < top - 8 || rect.bottom > window.innerHeight - 40) {
        window.scrollTo({ top: window.pageYOffset + rect.top - top, behavior: 'smooth' });
      }
    }, 380);
  }
  walkItems.forEach(function (item) {
    var hd = $('.walk__hd', item);
    if (!hd) return;
    hd.addEventListener('click', function () {
      if (item.classList.contains('is-open')) {
        item.classList.remove('is-open');
        hd.setAttribute('aria-expanded', 'false');
        return;
      }
      openWalk(item, true);
    });
  });
  if (walkItems.length) openWalk(walkItems[0]);

  /* ---------- 交互：系部手风琴 ---------- */
  $$('.dept__hd').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var dept = btn.parentNode;
      var isOpen = dept.classList.contains('is-open');
      $$('.dept').forEach(function (d) {
        d.classList.remove('is-open');
        var h = $('.dept__hd', d);
        if (h) h.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        dept.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ---------- 轻提示 ---------- */
  var toastEl = null, toastTimer = 0;
  function toast(msg) {
    if (!toastEl) {
      toastEl = el('div', 'toast');
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
  }

  function goTo(sel) {
    var t = document.querySelector(sel);
    if (!t) return;
    var y = t.getBoundingClientRect().top + window.pageYOffset - 84;
    window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  }

  /* ---------- 心性小签：点了按这颗心筛专业 ---------- */
  function heartOf(id) {
    var hs = arr(D.wuxin && D.wuxin.hearts);
    for (var i = 0; i < hs.length; i++) { if (hs[i].id === id) return hs[i]; }
    return null;
  }

  document.addEventListener('click', function (e) {
    var chip = e.target.closest ? e.target.closest('.hchip') : null;
    if (!chip || chip.getAttribute('tabindex') === '-1') return;
    var id = chip.getAttribute('data-heart');
    var btn = null;
    $$('#mFilter .fbtn').forEach(function (b) { if (b.getAttribute('data-fh') === id) btn = b; });
    goTo('#majors');
    setTimeout(function () {
      if (btn) btn.click();
      else filterMajors('');
    }, 380);
    var h = heartOf(id);
    toast(h ? ('已筛出主要养' + h.nm + '的专业') : '已定位到系部专业');
  });

  /* 落点标签：跳到七站 / 三维导览 */
  document.addEventListener('click', function (e) {
    var p = e.target.closest ? e.target.closest('.pl') : null;
    if (!p) return;
    var nm = p.getAttribute('data-place') || '';
    var target = null;
    $$('.walk__it').forEach(function (it) {
      if (it.getAttribute('data-nm') === nm) target = it;
    });
    if (target) {
      $$('.walk__it').forEach(function (it) { it.classList.remove('is-open'); });
      target.classList.add('is-open');
      var hd = $('.walk__hd', target);
      if (hd) hd.setAttribute('aria-expanded', 'true');
      openWalk(target, true);
      toast('已跳到「' + nm + '」这一站');
    } else {
      goTo('#majors');
      toast('「' + nm + '」在这个页面上没有独立一站，先看系部专业');
    }
  });

  /* 五心详情里的专业按钮 -> 系部专业里定位 */
  document.addEventListener('click', function (e) {
    var m = e.target.closest ? e.target.closest('.mj') : null;
    if (!m) return;
    var id = m.getAttribute('data-major');
    goTo('#majors');
    setTimeout(function () {
      $$('.dept').forEach(function (d) {
        var hit = false;
        $$('.mrow', d).forEach(function (r) {
          var on = r.getAttribute('data-major') === id;
          r.classList.toggle('is-hit', on);
          if (on) hit = true;
        });
        d.classList.toggle('is-open', hit);
        var h = $('.dept__hd', d);
        if (h && hit) h.setAttribute('aria-expanded', 'true');
      });
    }, 420);
    toast('已定位到该专业');
  });

  /* ---------- 系部专业：按五心筛选 ---------- */
  var fbtns = $$('#mFilter .fbtn');
  function filterMajors(fh) {
    fbtns.forEach(function (b) { b.classList.toggle('is-on', (b.getAttribute('data-fh') || '') === fh); });
    var any = false;
    $$('.dept').forEach(function (d) {
      var dHit = false;
      $$('.mrow', d).forEach(function (r) {
        var hs = (r.getAttribute('data-hearts') || '').split(' ');
        var on = !fh || hs.indexOf(fh) > -1;
        r.hidden = !on;
        if (on) { dHit = true; any = true; }
      });
      d.hidden = !dHit;
      if (dHit) {
        d.classList.add('is-open');
        var h = $('.dept__hd', d);
        if (h) h.setAttribute('aria-expanded', 'true');
      }
    });
    var empty = $('#mEmpty');
    if (empty) empty.hidden = any;
  }
  fbtns.forEach(function (b) {
    b.addEventListener('click', function () { filterMajors(b.getAttribute('data-fh') || ''); });
  });

  /* ---------- 专业自测 ---------- */
  var QZ = D.quiz || {};
  var QS = arr(QZ.questions);
  var qzBox = $('#quizBox');
  var qzIdx = 0;
  var qzPick = [];
  var LETTER = ['A', 'B', 'C', 'D', 'E'];

  function qzStart() {
    qzIdx = 0; qzPick = [];
    qzRender();
  }

  function qzRender() {
    if (!qzBox || !QS.length) return;
    if (qzIdx >= QS.length) { qzResult(); return; }
    var q = QS[qzIdx] || {};
    var opts = arr(q.opts).map(function (o, i) {
      return '<button class="qo" type="button" data-i="' + i + '">' +
        '<em>' + LETTER[i] + '</em><span>' + esc(o.t) + '</span></button>';
    }).join('');
    var pct = Math.round((qzIdx / QS.length) * 100);
    qzBox.innerHTML =
      '<div class="qz__meter"><span>' + ('0' + (qzIdx + 1)).slice(-2) + ' / ' + ('0' + QS.length).slice(-2) + '</span>' +
        '<div class="qz__bar"><i style="width:' + pct + '%"></i></div></div>' +
      '<p class="qz__q">' + esc(q.q) + '</p>' +
      '<div class="qz__opts">' + opts + '</div>' +
      (qzIdx > 0 ? '<button class="qz__back" type="button" data-back="1">上一题</button>' : '');

    $$('.qo', qzBox).forEach(function (b) {
      b.addEventListener('click', function () {
        qzPick[qzIdx] = Number(b.getAttribute('data-i'));
        qzIdx += 1;
        qzRender();
      });
    });
    var back = $('[data-back]', qzBox);
    if (back) back.addEventListener('click', function () { qzIdx = Math.max(0, qzIdx - 1); qzRender(); });
  }

  function qzResult() {
    var hs = arr(D.wuxin && D.wuxin.hearts);
    var sum = {};
    hs.forEach(function (h) { sum[h.id] = 0; });
    QS.forEach(function (q, i) {
      var o = arr(q.opts)[qzPick[i]];
      if (!o || !o.w) return;
      Object.keys(o.w).forEach(function (k) {
        sum[k] = (sum[k] || 0) + Number(o.w[k]);
      });
    });
    var max = 1;
    Object.keys(sum).forEach(function (k) { if (sum[k] > max) max = sum[k]; });

    var ranked = hs.slice().sort(function (a, b) { return (sum[b.id] || 0) - (sum[a.id] || 0); });
    var top2 = ranked.slice(0, 2).map(function (h) { return h.id; });

    var majors = arr(D.majors && D.majors.list).map(function (m) {
      var sc = 0;
      arr(m.hearts).forEach(function (h, i) {
        if (top2.indexOf(h) > -1) sc += (3 - i) * 2;
        sc += (sum[h] || 0) * .1;
      });
      return { m: m, s: sc };
    }).filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 3);

    var bars = hs.map(function (h) {
      var v = sum[h.id] || 0;
      var w = Math.round((v / max) * 100);
      return '<div class="qz__bar-row" style="--hc:' + esc(h.color) + '">' +
        '<b>' + esc(h.nm) + '</b>' +
        '<div class="qz__bar"><i style="width:' + w + '%"></i></div>' +
        '<span>' + v + '</span>' +
      '</div>';
    }).join('');

    var majHtml = majors.map(function (x) {
      var lv = '';
      arr(D.majors && D.majors.levels).forEach(function (l) { if (l.id === x.m.level) lv = l.b; });
      return '<button class="qz__maj" type="button" data-major="' + esc(x.m.id) + '">' +
        '<b>' + esc(x.m.nm) + '</b><span>' + esc(lv) + '</span>' +
        '<p>' + esc(x.m.one || '') + '</p>' +
      '</button>';
    }).join('');

    var topNames = top2.map(function (id) {
      var h = heartOf(id);
      return h ? h.nm : '';
    }).join('、');

    qzBox.innerHTML =
      '<div class="qz__res">' +
        '<h3>你的画像：<em>' + esc(topNames) + '</em></h3>' +
        '<p>这两个心在你身上更明显。下面三个专业主要养的就是它们——但专业选不选，还要看你能不能接受它每天要做的事。</p>' +
        '<div class="qz__bars">' + bars + '</div>' +
        '<h4 class="blk__h">推荐专业</h4>' +
        '<div class="qz__majs">' + (majHtml || '<p style="padding:18px">没算出来，回去随便选一个也行。</p>') + '</div>' +
        '<div class="qz__act">' +
          '<a class="btn btn--solid" href="#applyForm" data-go="#applyForm">拿这个结果去报名' +
            '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4"/></svg></a>' +
          '<button class="btn btn--ghost" type="button" data-restart="1">重做一遍</button>' +
        '</div>' +
      '</div>';

    $$('.qz__maj', qzBox).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-major');
        goTo('#majors');
        setTimeout(function () {
          $$('.dept').forEach(function (d) {
            var hit = false;
            $$('.mrow', d).forEach(function (r) {
              var on = r.getAttribute('data-major') === id;
              r.classList.toggle('is-hit', on);
              if (on) hit = true;
            });
            d.classList.toggle('is-open', hit);
          });
        }, 420);
        toast('已定位到该专业');
      });
    });
    var rs = $('[data-restart]', qzBox);
    if (rs) rs.addEventListener('click', function () { qzStart(); goTo('#quiz'); });
    var g = $('[data-go]', qzBox);
    if (g) g.addEventListener('click', function (e) { e.preventDefault(); goTo('#applyForm'); });
    qzBox.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }
  qzStart();
  qzBox && qzBox.addEventListener('click', function () {});

  /* ---------- 预约探校 ---------- */
  var VST = D.visit || {};
  var vSlots = arr(VST.slots);
  var pickedSlot = '';
  var slotBtns = $$('#slotList .slot');
  var slotPicked = $('#slotPicked');

  slotBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      slotBtns.forEach(function (x) { x.classList.remove('is-pick'); });
      b.classList.add('is-pick');
      pickedSlot = b.getAttribute('data-slot');
      var s = null;
      vSlots.forEach(function (x) { if (x.id === pickedSlot) s = x; });
      if (slotPicked) {
        slotPicked.textContent = s ? (s.date + '（' + s.wk + '）' + s.time) : '';
        slotPicked.classList.add('is-set');
      }
    });
  });

  var vForm = $('#visitForm');
  if (vForm) {
    vForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var nm = vForm.elements.nm, tel = vForm.elements.tel;
      var bad = false;
      [nm, tel].forEach(function (f) { f.classList.remove('is-bad'); });
      if (!nm.value.trim()) { nm.classList.add('is-bad'); bad = true; }
      if (!/^1\d{10}$/.test(tel.value.trim())) { tel.classList.add('is-bad'); bad = true; }
      if (!pickedSlot) { toast('先在左边选一个场次'); bad = true; }
      if (bad) return;
      var s = null;
      vSlots.forEach(function (x) { if (x.id === pickedSlot) s = x; });
      var code = 'V' + (s ? s.id.toUpperCase() : 'X') + '-' +
        String(Math.floor(Math.random() * 9000) + 1000);
      try {
        localStorage.setItem('yyt_visit_v1', JSON.stringify({
          code: code, nm: nm.value.trim(), tel: tel.value.trim(),
          slot: pickedSlot, dept: vForm.elements.dept.value, at: Date.now()
        }));
      } catch (err) {}
      var ok = $('#visitOk');
      ok.hidden = false;
      ok.innerHTML = '预约成功，请记下预约码：<b>' + esc(code) + '</b>' +
        '场次：' + esc(s ? s.date + '（' + s.wk + '）' + s.time : '') +
        '<br>到校在正门签到时报这个码和姓名。如需改期，凭码重新约一场即可。';
      vForm.querySelector('button[type=submit]').disabled = true;
      toast('预约成功');
      ok.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  /* ---------- 在线报名登记 ---------- */
  var aForm = $('#applyForm');
  var pickedMajors = [];

  $$('#majorPicks .pk').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = b.getAttribute('data-id');
      var i = pickedMajors.indexOf(id);
      if (i > -1) { pickedMajors.splice(i, 1); b.classList.remove('is-pick'); }
      else { pickedMajors.push(id); b.classList.add('is-pick'); }
    });
  });

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  if (aForm) {
    aForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = aForm.elements;
      var nm = f.nm, tel = f.tel, sch = f.sch;
      [nm, tel, sch].forEach(function (x) { x.classList.remove('is-bad'); });
      var bad = false;
      if (!nm.value.trim()) { nm.classList.add('is-bad'); bad = true; }
      if (!/^1\d{10}$/.test(tel.value.trim())) { tel.classList.add('is-bad'); bad = true; }
      if (!sch.value.trim()) { sch.classList.add('is-bad'); bad = true; }
      if (bad) { toast('还有必填项没填好'); return; }

      var d = new Date();
      var no = 'YT' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
        pad((d.getMonth() + 1) * 13 % 60 + d.getHours());
      var rec = {
        no: no, nm: nm.value.trim(), tel: tel.value.trim(),
        sch: sch.value.trim(), area: f.area.value.trim(),
        lv: f.lv.value, majors: pickedMajors.slice(),
        q: f.q.value.trim(), step: 1, at: Date.now()
      };
      var all = [];
      try { all = JSON.parse(localStorage.getItem('yyt_apply_v1') || '[]'); } catch (err) { all = []; }
      all.unshift(rec);
      try { localStorage.setItem('yyt_apply_v1', JSON.stringify(all.slice(0, 20))); } catch (err) {}

      var ok = $('#applyOk');
      ok.hidden = false;
      ok.innerHTML = '登记成功，你的报名号是：<b>' + esc(no) + '</b>' +
        '请截图保存。招生老师会在 1 个工作日内拨打 ' + esc(rec.tel) + '。' +
        '<br>之后用报名号 + 手机号，在下面这一栏随时查进度。';
      aForm.querySelector('button[type=submit]').disabled = true;
      toast('登记成功，报名号 ' + no);

      var cn = $('#checkForm').elements.no;
      if (cn) cn.value = no;
    });
  }

  /* ---------- 报名进度查询 ---------- */
  var cForm = $('#checkForm');
  if (cForm) {
    cForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var no = cForm.elements.no.value.trim().toUpperCase();
      var tel = cForm.elements.tel.value.trim();
      var all = [];
      try { all = JSON.parse(localStorage.getItem('yyt_apply_v1') || '[]'); } catch (err) { all = []; }
      var hit = null;
      all.forEach(function (r) { if (r.no === no && r.tel === tel) hit = r; });

      var box2 = $('#trackBox'), miss = $('#trackMiss');
      if (!hit) {
        box2.hidden = true; miss.hidden = false;
        return;
      }
      miss.hidden = true; box2.hidden = false;
      $('#trackNo').textContent = hit.no;
      var ck = D.admit && D.admit.check ? D.admit.check : {};
      var labels = arr(ck.steps);
      var step = Math.min(hit.step || 1, labels.length);
      $('#trackLv').textContent = labels[step - 1] || '';
      $$('.track__steps li').forEach(function (li, i) {
        li.classList.toggle('is-on', i < step);
      });
      $('#trackDesc').textContent = arr(ck.desc)[step - 1] || '';
      toast('查到一条记录');
    });
  }

  /* 所有页内锚点：平滑滚动并留出导航高度 */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href === '#' || href.length < 2) return;
    var t = document.querySelector(href);
    if (!t) return;
    e.preventDefault();
    goTo(href);
  });

  /* ---------- 交互：滚动 ---------- */
  var ticking = false;
  function frame() {
    ticking = false;
    onNavScroll();
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  window.addEventListener('load', frame);
  frame();

  /* ---------- 问校园 ---------- */
  var A = D.ask || {};
  var box = $('#askbox');
  var log = $('#askLog');
  var form = $('#askForm');
  var input = $('#askInput');
  var openBtn = $('#askOpen');
  var chips = $('#askChips');
  setTx($('#askTitle'), A.title || '问校园');
  setTx($('#askSub'), A.sub || '');

  var FALLBACK = A.fallback || '这个我不太清楚。';
  var GREETING = A.greeting || '你好。';
  var KNOW = arr(A.entries).filter(function (e) { return e.on !== false; })
    .map(function (e) {
      return {
        id: e.id,
        cat: e.cat || '',
        q: e.q || '',
        k: arr(e.keywords),
        a: e.answer || '',
        w: Number(e.weight) || 0
      };
    });

  /* 评分：关键词按长度加权 + 整句相似 + 后台权重；同一档再按目录偏好排序 */
  function score(entry, q) {
    var hit = 0;
    var matched = 0;
    for (var j = 0; j < entry.k.length; j++) {
      var kw = entry.k[j];
      if (!kw) continue;
      if (q.indexOf(kw) > -1) { hit += kw.length; matched += 1; }
    }
    var s = hit + matched * 2 + entry.w;
    if (entry.q && q.indexOf(entry.q) > -1) s += entry.q.length * 2;
    return s;
  }

  function answer(q) {
    var best = null, bestScore = 0;
    for (var i = 0; i < KNOW.length; i++) {
      var s = score(KNOW[i], q);
      if (s > bestScore) { bestScore = s; best = KNOW[i]; }
    }
    if (!best || bestScore < 2) return { html: FALLBACK, miss: q };
    return { html: best.a, hit: best.id };
  }

  function renderMsg(who, html) {
    var m = el('div', 'msg' + (who === 'me' ? ' msg--me' : ''));
    m.appendChild(el('span', 'msg__av', who === 'me' ? '我' : '问'));
    var b = el('div', 'msg__b', html);
    m.appendChild(b);
    log.appendChild(m);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  function ask(text) {
    var q = String(text || '').trim();
    if (!q) return;
    renderMsg('me', esc(q));
    var b = renderMsg('bot', '<span class="msg__dots"><i></i><i></i><i></i></span>');
    var res = answer(q);
    setTimeout(function () {
      b.innerHTML = res.html;
      log.scrollTop = log.scrollHeight;
    }, 520);
  }

  var greeted = false;
  function greet() {
    if (greeted) return;
    greeted = true;
    renderMsg('bot', esc(GREETING));
  }

  arr(A.quick).forEach(function (t) {
    var c = el('button', 'chip', esc(t));
    c.type = 'button';
    c.addEventListener('click', function () { ask(t); });
    chips.appendChild(c);
  });

  function openAsk() {
    box.classList.add('is-open');
    box.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.body.classList.add('is-asking');
    requestAnimationFrame(function () { box.classList.add('is-in'); });
    setTimeout(function () { greet(); input.focus(); }, 220);
  }
  function closeAsk() {
    box.classList.remove('is-in');
    box.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.body.classList.remove('is-asking');
    setTimeout(function () { box.classList.remove('is-open'); }, 420);
    if (openBtn) openBtn.focus();
  }
  var clearBtn = $('#askClear');
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      log.innerHTML = '';
      greeted = false;
      greet();
      input.focus();
    });
  }
  if (openBtn) openBtn.addEventListener('click', openAsk);
  $$('[data-ask-close]').forEach(function (b) { b.addEventListener('click', closeAsk); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && box.classList.contains('is-in')) closeAsk();
  });
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      ask(input.value);
      input.value = '';
    });
  }
})();
