/* 云探校 · 渲染层
 * 内容来自 assets/js/site-data.js（由后台从 content.json 生成），
 * 页面结构在运行时拼出来 —— 后台改内容，前台刷新就变。
 */
(function () {
  'use strict';

  var D = window.__CONTENT__;
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
  if (T.contrast && T.contrast !== 1) { R.setProperty('--contrast', T.contrast); }
  if (T.density && T.density !== 1) { R.setProperty('--density', T.density); }
  if (typeof T.imageGray === 'number') { R.setProperty('--img-gray', T.imageGray); }

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
        '<p class="stat__n"><span data-count="' + esc(s.n) + '">0</span><i>' + esc(s.unit || '') + '</i></p>' +
        '<p class="stat__t">' + esc(s.t) + '</p>' +
        '<p class="stat__d">' + esc(s.d || '') + '</p>' +
      '</div>';
    }).join('');

    return '<section class="sec sec--paper" id="numbers">' +
      '<div class="wrap">' +
        secHead(n.kicker, n.head, n.headEm, n.lead) +
        '<div class="stats">' + stats + '</div>' +
      '</div>' +
    '</section>';
  };

  RENDER.stops = function (s) {
    var items = arr(s.items).map(function (it, i) {
      var tags = arr(it.tags).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
      return '<article class="walk__it' + (i === 0 ? ' is-open' : '') + '" data-block="' + esc(it.block) + '" data-nm="' + esc(it.nm) + '">' +
        '<button class="walk__hd" type="button" aria-expanded="' + (i === 0 ? 'true' : 'false') + '">' +
          '<span class="walk__no">' + esc(it.no) + '</span>' +
          '<span class="walk__nm">' + esc(it.nm) + '</span>' +
          '<span class="walk__en">' + esc(it.block || '').toUpperCase() + '</span>' +
          '<span class="walk__ic" aria-hidden="true"></span>' +
        '</button>' +
        '<div class="walk__bd"><div class="walk__in"><div class="walk__body">' +
          '<p class="walk__desc">' + esc(it.desc) + '</p>' +
          '<ul class="walk__tags">' + tags + '</ul>' +
          '<p class="walk__heart"><b>' + esc(it.heart || '') + '</b></p>' +
        '</div></div></div>' +
      '</article>';
    }).join('');

    var roads = arr(s.planRoads).map(function (d) {
      return '<path class="plan__road" d="' + esc(d) + '"/>';
    }).join('');

    var blocks = arr(s.items).map(function (it) {
      var p = it.plan || {};
      var shape = p.oval
        ? '<rect class="plan__b" data-block="' + esc(it.block) + '" x="' + esc(p.x) + '" y="' + esc(p.y) +
          '" width="' + esc(p.w) + '" height="' + esc(p.h) + '" rx="42"/>'
        : '<rect class="plan__b" data-block="' + esc(it.block) + '" x="' + esc(p.x) + '" y="' + esc(p.y) +
          '" width="' + esc(p.w) + '" height="' + esc(p.h) + '" rx="2"/>';
      var labelY = Number(p.y || 0) + Number(p.h || 0) / 2 + 6;
      var label = '<text class="plan__l" x="' + (Number(p.x || 0) + Number(p.w || 0) / 2).toFixed(0) +
        '" y="' + labelY.toFixed(0) + '">' + esc(p.label || it.nm) + '</text>';
      return shape + label + (p.oval
        ? '<ellipse class="plan__road" cx="' + esc(p.x + p.w / 2) + '" cy="' + esc(p.y + p.h / 2) +
          '" rx="' + esc(s.planOval ? s.planOval.rx : 26) + '" ry="' + esc(s.planOval ? s.planOval.ry : 46) + '"/>'
        : '');
    }).join('');

    return '<section class="walk" id="stops">' +
      '<div class="wrap">' +
        secHead(s.kicker, s.head, s.headEm, s.lead) +
        '<div class="walk__grid">' +
          '<div class="walk__list" id="walkList">' + items + '</div>' +
          '<aside class="walk__side">' +
            '<div class="walk__num"><span id="walkNo">' + esc((arr(s.items)[0] || {}).no || '01') + '</span>' +
              '<b id="walkNm">' + esc((arr(s.items)[0] || {}).nm || '') + '</b></div>' +
            '<div class="plan" aria-label="校园导览示意图">' +
              '<svg viewBox="0 0 ' + esc((s.planFrame || {}).w || 360) + ' ' + esc((s.planFrame || {}).h || 300) + '" role="img">' +
                '<rect class="plan__frame" x="8" y="8" width="344" height="284" rx="4"/>' +
                roads + blocks +
                '<circle class="plan__dot" id="planDot" cx="213" cy="49" r="3.4"/>' +
              '</svg>' +
            '</div>' +
            '<p class="plan__hint">' + esc(s.planHint || '') + '</p>' +
          '</aside>' +
        '</div>' +
      '</div>' +
    '</section>';
  };

  RENDER.majors = function (m) {
    var top = arr(m.top).map(function (t) {
      return '<span>' + esc(t.t) + ' <b>' + esc(t.b) + '</b> ' + esc(t.u || '') + '</span>';
    }).join('');

    var depts = arr(m.depts).map(function (d, i) {
      var chips = arr(d.chips).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('');
      return '<div class="dept' + (i === 0 ? ' is-open' : '') + '">' +
        '<button class="dept__hd" aria-expanded="' + (i === 0 ? 'true' : 'false') + '">' +
          '<span class="dept__no">' + esc(d.no) + '</span>' +
          '<span class="dept__nm">' + esc(d.nm) + '</span>' +
          '<span class="dept__sm">' + esc(d.sm || '') + '</span>' +
          '<span class="dept__ic"></span>' +
        '</button>' +
        '<div class="dept__bd"><div class="dept__in"><div>' +
          '<ul class="chips">' + chips + '</ul>' +
          '<p class="dept__note">' + esc(d.note || '') + '</p>' +
        '</div></div></div>' +
      '</div>';
    }).join('');

    var levels = arr(m.levels).map(function (l) {
      return '<div class="level"><b>' + esc(l.b) + '</b><span>' + esc(l.s) + '</span></div>';
    }).join('');

    return '<section class="sec" id="majors">' +
      '<div class="wrap">' +
        secHead(m.kicker, m.head, m.headEm, m.lead) +
        '<div class="majors__top reveal">' + top + '</div>' +
        '<div class="majors__list" id="depts">' + depts + '</div>' +
        '<div class="levels reveal">' + levels + '</div>' +
      '</div>' +
    '</section>';
  };

  RENDER.craft = function (c) {
    var big = arr(c.big).map(function (b) {
      return '<div><b>' + esc(b.n) + '<i>' + esc(b.u) + '</i></b><span>' + esc(b.t) + '</span></div>';
    }).join('');

    var tl = arr(c.timeline).map(function (t) {
      return '<li><b>' + esc(t.y) + '</b><p>' + esc(t.t) + '</p></li>';
    }).join('');

    var intl = arr(c.intl).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');

    var news = arr(c.news).map(function (n) {
      return '<figure>' +
        '<img src="' + esc(n.src) + '" alt="' + esc(n.alt) + '" loading="lazy">' +
        '<figcaption>' + esc(n.cap) + '</figcaption>' +
      '</figure>';
    }).join('');

    return '<section class="sec" id="craft">' +
      '<div class="wrap">' +
        secHead(c.kicker, c.head, c.headEm, c.lead) +
        '<div class="craft">' +
          '<div class="reveal">' +
            '<div class="craft__big">' + big + '</div>' +
            '<ul class="tl" id="timeline">' + tl + '</ul>' +
            '<ul class="intl">' + intl + '</ul>' +
          '</div>' +
          '<div class="reveal" data-d="1">' +
            '<div class="news">' + news + '</div>' +
            '<p class="dept__note" style="margin-top:22px">' + esc(c.newsNote || '') + '</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  };

  RENDER.admit = function (a) {
    var flow = arr(a.flow).map(function (f) {
      return '<li><b>' + esc(f.no) + '</b><div><h4>' + esc(f.t) + '</h4>' +
        (f.d ? '<p>' + esc(f.d) + '</p>' : '') + '</div></li>';
    }).join('');

    var rows = arr((a.slot || {}).rows).map(function (r) {
      return '<tr><th>' + esc(r.k) + '</th><td>' + esc(r.v) + '</td></tr>';
    }).join('');

    var contact = a.contact || {};
    var crows = arr(contact.rows).map(function (r) {
      return '<dt>' + esc(r.k) + '</dt><dd>' + esc(r.v) + '</dd>';
    }).join('');

    return '<section class="sec" id="admit">' +
      '<div class="wrap">' +
        secHead(a.kicker, a.head, a.headEm, a.lead) +
        '<div class="admit">' +
          '<div class="reveal"><ol class="flow">' + flow + '</ol></div>' +
          '<div class="reveal" data-d="1">' +
            '<div class="slot">' +
              '<h4>' + esc((a.slot || {}).title) + '</h4>' +
              '<table>' + rows + '</table>' +
              '<p class="slot__note">' + esc((a.slot || {}).note) + '</p>' +
            '</div>' +
            '<div class="contact">' +
              '<img src="' + esc(contact.qr) + '" alt="' + esc(contact.qrAlt) + '">' +
              '<dl>' + crows + '</dl>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  };

  /* ---------- 按后台设定的顺序与显隐装配 ---------- */
  var ORDER = ['hero', 'pan', 'numbers', 'stops', 'majors', 'craft', 'admit'];
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
  var planBlocks = $$('.plan__b');
  var planDot = $('#planDot');
  var walkNo = $('#walkNo');
  var walkNm = $('#walkNm');

  function planTo(name) {
    var b = null;
    planBlocks.forEach(function (node) {
      var hit = node.getAttribute('data-block') === name;
      node.classList.toggle('is-on', hit);
      if (hit) b = node;
    });
    if (!b || !planDot) return;
    planDot.setAttribute('cx', parseFloat(b.getAttribute('x')) + parseFloat(b.getAttribute('width')) - 11);
    planDot.setAttribute('cy', parseFloat(b.getAttribute('y')) + 11);
  }
  function openWalk(item, nudge) {
    walkItems.forEach(function (it) {
      var on = it === item;
      it.classList.toggle('is-open', on);
      var hd = $('.walk__hd', it);
      if (hd) hd.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    planTo(item.getAttribute('data-block'));
    var no = $('.walk__no', item);
    if (walkNo && no) walkNo.textContent = no.textContent;
    if (walkNm) walkNm.textContent = item.getAttribute('data-nm') || '';
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
      report(q, res);
    }, 520);
  }

  /* 未命中的问题记到后台，方便老师补问答（静态部署时静默失败） */
  function report(q, res) {
    if (res.hit) return;
    try {
      if (location.protocol === 'file:') return;
      fetch('api/ask-miss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: q, at: new Date().toISOString() })
      }).catch(function () {});
    } catch (e) {}
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
