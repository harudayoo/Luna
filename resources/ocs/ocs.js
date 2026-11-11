/* Orchid City Software motion helpers. Needs window.anime (Anime.js 4.5.0, loaded before this file).
   Every behavior has two personalities: LIGHT = paper and blueprint, DARK = glow and code. */
(function () {
  'use strict';
  var A = function () { return window.anime; };
  var root = document.documentElement;
  var reduced = function () { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  var isDark = function () { return root.getAttribute('data-theme') === 'dark'; };
  var token = function (name) { return getComputedStyle(root).getPropertyValue('--' + name).trim(); };
  var ms = function (name, fallback) { var v = parseFloat(token(name)); return isNaN(v) ? fallback : v; };
  var springBack = function () { return A().spring({ bounce: 0.55, duration: 650 }); };

  function labelOf(el) {
    var l = el.querySelector('.ocs-btn-label');
    if (!l) { l = document.createElement('span'); l.className = 'ocs-btn-label'; while (el.firstChild) l.appendChild(el.firstChild); el.appendChild(l); }
    return l;
  }

  /* DARK: drifts toward the pointer, label drifts further, springs home.
     LIGHT: lifts up and left off its hard paper shadow, like a cutout picked up. */
  function magnetic(el, opts) {
    var s = (opts && opts.strength) || 0.3;
    var label = labelOf(el);
    el.addEventListener('pointerenter', function (e) {
      if (reduced() || isDark() || e.pointerType === 'touch') return;
      A().animate(el, { x: -3, y: -3, duration: ms('dur-base', 320), ease: 'outBack(2)' });
    });
    el.addEventListener('pointermove', function (e) {
      if (reduced() || !isDark() || e.pointerType === 'touch') return;
      var r = el.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      A().animate(el, { x: dx * s, y: dy * s, duration: 260, ease: 'outQuad' });
      A().animate(label, { x: dx * s * 0.6, y: dy * s * 0.6, duration: 260, ease: 'outQuad' });
    });
    el.addEventListener('pointerleave', function () {
      A().animate([el, label], { x: 0, y: 0, ease: isDark() ? springBack() : 'outQuad', duration: isDark() ? undefined : 220 });
    });
  }

  /* DARK: letters hop in a wave.  LIGHT: a pencil underline draws in from the left, letters lean right a touch. */
  function wave(el) {
    var label = labelOf(el);
    var text = label.textContent;
    el.setAttribute('aria-label', el.getAttribute('aria-label') || text);
    label.textContent = '';
    var spans = [];
    for (var i = 0; i < text.length; i++) {
      var sp = document.createElement('span');
      sp.className = 'ocs-char'; sp.setAttribute('aria-hidden', 'true');
      sp.textContent = text[i] === ' ' ? ' ' : text[i];
      label.appendChild(sp); spans.push(sp);
    }
    var bar = document.createElement('span'); bar.className = 'ocs-underline'; bar.setAttribute('aria-hidden', 'true');
    el.appendChild(bar);
    var busy = false;
    el.addEventListener('pointerenter', function () {
      if (reduced()) return;
      if (!isDark()) {
        A().animate(bar, { scaleX: [0, 1], duration: ms('dur-base', 320), ease: 'outCubic' });
        A().animate(spans, { skewX: [{ to: -8, duration: 120 }, { to: 0, duration: 260 }], delay: A().stagger(14), ease: 'outQuad' });
        return;
      }
      if (busy) return;
      busy = true;
      A().animate(spans, {
        y: [{ to: -6, duration: 160, ease: 'outQuad' }, { to: 0, duration: 380, ease: 'outBounce' }],
        rotate: [{ to: -8, duration: 160 }, { to: 0, duration: 300 }],
        delay: A().stagger(28),
        onComplete: function () { busy = false; }
      });
    });
    el.addEventListener('pointerleave', function () {
      if (!isDark()) A().animate(bar, { scaleX: 0, duration: 200, ease: 'inQuad' });
    });
  }

  /* DARK: label scrambles through code characters, then resolves.
     LIGHT: label is erased and retyped like a typewriter, with a caret. */
  var GLYPHS = '01<>/{}[]=;:$#_+*&|~';
  function decode(el) {
    var label = labelOf(el);
    var text = label.textContent;
    el.setAttribute('aria-label', el.getAttribute('aria-label') || text);
    el.style.minWidth = el.offsetWidth + 'px';
    var state = { p: 0 }, anim = null;
    el.addEventListener('pointerenter', function () {
      if (reduced()) return;
      if (anim) anim.pause();
      state.p = 0;
      var dark = isDark();
      anim = A().animate(state, {
        p: 1, duration: dark ? ms('dur-slow', 560) : text.length * 45 + 120, ease: dark ? 'linear' : A().steps(text.length + 2),
        onUpdate: function () {
          var done = Math.floor(state.p * text.length), out = '';
          if (!dark) { label.textContent = text.slice(0, done) + '▍'; return; }
          for (var i = 0; i < text.length; i++) {
            out += (i < done || text[i] === ' ') ? text[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
          }
          label.textContent = out;
        },
        onComplete: function () { label.textContent = text; }
      });
    });
  }

  /* DARK: jelly squish.  LIGHT: stamp, the button slams down onto its shadow and pops back. */
  function squish(el) {
    el.addEventListener('pointerdown', function () {
      if (reduced()) return;
      if (isDark()) A().animate(el, { scaleX: 1.06, scaleY: 0.9, duration: ms('dur-fast', 160), ease: 'outQuad' });
      else { el.classList.add('ocs-pressed'); A().animate(el, { x: 2, y: 2, duration: 90, ease: 'outQuad' }); }
    });
    var release = function () {
      if (el.classList.contains('ocs-pressed')) {
        el.classList.remove('ocs-pressed');
        var hovered = el.matches(':hover');
        A().animate(el, { x: hovered ? -3 : 0, y: hovered ? -3 : 0, ease: 'outBack(3)', duration: 260 });
      } else {
        A().animate(el, { scaleX: 1, scaleY: 1, ease: A().spring({ bounce: 0.6, duration: 700 }) });
      }
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointerleave', release);
  }

  /* DARK: tilts toward the pointer with a soft spotlight.
     LIGHT: picked up like a sheet of paper, lifts and turns a degree off its hard shadow. */
  function tilt(el, opts) {
    var max = (opts && opts.max) || 4;
    if (el.parentElement && !el.parentElement.style.perspective) el.parentElement.style.perspective = '900px';
    el.addEventListener('pointerenter', function (e) {
      if (reduced() || isDark() || e.pointerType === 'touch') return;
      A().animate(el, { x: -4, y: -4, rotate: (Math.random() < 0.5 ? -1 : 1) * 0.8, duration: ms('dur-base', 320), ease: 'outBack(1.6)' });
    });
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', (px * 100) + '%');
      el.style.setProperty('--my', (py * 100) + '%');
      if (reduced() || !isDark() || e.pointerType === 'touch') return;
      A().animate(el, { rotateY: (px - 0.5) * max * 2, rotateX: (0.5 - py) * max * 2, duration: 300, ease: 'outQuad' });
    });
    el.addEventListener('pointerleave', function () {
      if (isDark()) A().animate(el, { rotateX: 0, rotateY: 0, ease: springBack() });
      else A().animate(el, { x: 0, y: 0, rotate: 0, duration: 240, ease: 'outQuad' });
    });
  }

  /* Card opens a centered detail panel.
     DARK: the card grows into the panel (FLIP), content rises in.
     LIGHT: a sheet drops onto the desk with a small turn and settles, content slides in from the left like it is being written. */
  function expand(card, opts) {
    opts = opts || {};
    var open = function () {
      var dark = isDark();
      var from = card.getBoundingClientRect();
      var backdrop = document.createElement('div'); backdrop.className = 'ocs-backdrop';
      var panel = document.createElement('div'); panel.className = 'ocs-detail';
      panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
      panel.innerHTML = typeof opts.render === 'function' ? opts.render(card) : card.innerHTML;
      document.body.appendChild(backdrop); document.body.appendChild(panel); init(panel);
      var vw = window.innerWidth, vh = window.innerHeight;
      var w = Math.min(opts.width || 560, vw - 32);
      panel.style.width = w + 'px'; panel.style.height = 'auto';
      var h = Math.min(panel.scrollHeight || 320, vh - 32);
      var to = { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
      var dur = reduced() ? 0 : ms('dur-slow', 560);
      var bits = panel.querySelectorAll('.ocs-reveal');
      A().animate(backdrop, { opacity: [0, 1], duration: dur * 0.6, ease: 'outQuad' });
      if (dark) {
        card.style.visibility = 'hidden';
        panel.style.left = from.left + 'px'; panel.style.top = from.top + 'px';
        panel.style.width = from.width + 'px'; panel.style.height = from.height + 'px';
        A().set(bits, { opacity: 0, y: 12 });
        A().animate(panel, { left: [from.left, to.left], top: [from.top, to.top], width: [from.width, to.width], height: [from.height, to.height], duration: dur, ease: 'outExpo' });
        A().animate(bits, { opacity: 1, y: 0, delay: A().stagger(45, { start: dur * 0.45 }), duration: dur * 0.6, ease: 'outQuad' });
      } else {
        panel.style.left = to.left + 'px'; panel.style.top = to.top + 'px';
        panel.style.width = to.width + 'px'; panel.style.height = to.height + 'px';
        A().set(bits, { opacity: 0, x: -10 });
        A().animate(panel, { y: [-40, 0], rotate: [-3, 0], opacity: [0, 1], duration: dur, ease: dur ? A().spring({ bounce: 0.35, duration: dur * 1.4 }) : 'linear' });
        A().animate(bits, { opacity: 1, x: 0, delay: A().stagger(70, { start: dur * 0.35 }), duration: dur * 0.5, ease: 'outCubic' });
      }
      var focusBack = document.activeElement;
      var close = function () {
        document.removeEventListener('keydown', onKey);
        var done = function () { backdrop.remove(); panel.remove(); card.style.visibility = ''; if (focusBack) focusBack.focus(); };
        A().animate(bits, { opacity: 0, duration: dur * 0.25 });
        A().animate(backdrop, { opacity: 0, duration: dur * 0.6 });
        if (dark) {
          var back = card.getBoundingClientRect();
          A().animate(panel, { left: back.left, top: back.top, width: back.width, height: back.height, duration: dur * 0.8, ease: 'inOutQuart', onComplete: done });
        } else {
          A().animate(panel, { y: 30, rotate: 2, opacity: 0, duration: dur * 0.5, ease: 'inQuad', onComplete: done });
        }
      };
      var onKey = function (e) { if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', onKey);
      backdrop.addEventListener('click', close);
      panel.querySelectorAll('[data-ocs-close]').forEach(function (b) { b.addEventListener('click', close); });
      var first = panel.querySelector('[data-ocs-close], button, a');
      if (first) setTimeout(function () { first.focus(); }, dur);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  }

  /* Theme switch.
     To DARK: night spreads as a circle from the click point.
     To LIGHT: a fresh sheet of paper slides in from the left edge. */
  function setTheme(t) {
    root.setAttribute('data-theme', t);
    try { localStorage.setItem('ocs-theme', t); } catch (e) {}
    document.dispatchEvent(new CustomEvent('ocs:theme', { detail: t }));
  }
  function initialTheme() {
    var t = null;
    try { t = localStorage.getItem('ocs-theme'); } catch (e) {}
    if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return t;
  }
  function themeToggle(btn) {
    var icon = btn.querySelector('.ocs-theme-icon') || btn;
    var sync = function () { btn.setAttribute('aria-pressed', String(isDark())); };
    sync();
    btn.addEventListener('click', function (e) {
      var next = isDark() ? 'light' : 'dark';
      if (!reduced()) {
        if (next === 'dark') A().animate(icon, { rotate: '+=360', scale: [{ to: 0.6, duration: 160 }, { to: 1, duration: 420, ease: 'outBack' }], duration: 580, ease: 'outQuart' });
        else A().animate(icon, { y: [{ to: 10, duration: 160, ease: 'inQuad' }, { to: 0, duration: 420, ease: 'outBounce' }] });
      }
      var x = e.clientX || window.innerWidth / 2, y = e.clientY || 0;
      if (!document.startViewTransition || reduced()) { setTheme(next); sync(); return; }
      var r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      var vt = document.startViewTransition(function () { setTheme(next); sync(); });
      vt.ready.then(function () {
        var frames = next === 'dark'
          ? ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)']
          : ['inset(0 100% 0 0)', 'inset(0 0 0 0)'];
        root.animate({ clipPath: frames },
          { duration: ms('dur-slow', 560), easing: next === 'dark' ? 'cubic-bezier(.65,0,.35,1)' : 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::view-transition-new(root)' });
      });
    });
  }

  /* Background.
     DARK: a drifting dependency graph with code glyphs. Nodes shy away from the pointer and link to it,
           a click bursts brackets, scroll adds parallax.
     LIGHT: a blueprint grid. The pointer leaves a fading ink trail with faint guide lines,
           a click drops measuring rings with its coordinates, scroll slides the grid. */
  var CODE = ['{ }', '</>', '=>', 'fn', '[ ]', '0x', '&&', '//', '::', '#', '++', '!='];
  function background(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var dpr = 1, W = 0, H = 0, nodes = [], bursts = [], rings = [], trail = [], colors = {};
    var mouse = { x: -9999, y: -9999 }, scrollY = 0, raf = 0;
    var host = opts.host || window;
    var readColors = function () { colors = { line: token('line'), node: token('node'), primary: token('primary'), accent: token('accent'), muted: token('muted'), mono: token('font-mono') || 'monospace' }; };
    var resize = function () {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2); W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var count = Math.max(14, Math.min(opts.max || 70, Math.round(W * H / 16000)));
      nodes = [];
      for (var i = 0; i < count; i++) {
        nodes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
          r: 1.5 + Math.random() * 1.5, g: Math.random() < 0.28 ? CODE[(Math.random() * CODE.length) | 0] : null, z: 0.4 + Math.random() * 0.6 });
      }
      draw();
    };

    var drawBlueprint = function () {
      var step = 24, off = (scrollY * 0.3) % step, major = step * 5, offM = (scrollY * 0.3) % major, x, y;
      ctx.strokeStyle = colors.line; ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7; ctx.beginPath();
      for (x = 0.5; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (y = -off + 0.5; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = 1.5; ctx.beginPath();
      for (x = 0.5; x < W; x += major) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (y = -offM + 0.5; y < H; y += major) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      if (mouse.x > -999) {
        ctx.setLineDash([4, 6]); ctx.strokeStyle = colors.accent; ctx.globalAlpha = 0.25; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(mouse.x, 0); ctx.lineTo(mouse.x, H); ctx.moveTo(0, mouse.y); ctx.lineTo(W, mouse.y); ctx.stroke();
        ctx.setLineDash([]);
      }
      var now = performance.now();
      while (trail.length && now - trail[0].t > 700) trail.shift();
      ctx.lineCap = 'round'; ctx.strokeStyle = colors.node;
      for (var i = 1; i < trail.length; i++) {
        var age = (now - trail[i].t) / 700;
        ctx.globalAlpha = Math.max(0, 1 - age); ctx.lineWidth = 2.5 * (1 - age) + 0.5;
        ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
      }
      ctx.lineCap = 'butt';
      ctx.font = '10px ' + colors.mono; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      for (i = 0; i < rings.length; i++) {
        var g = rings[i];
        ctx.globalAlpha = g.o; ctx.strokeStyle = colors.accent; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(g.x, g.y, g.r * 0.55, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = colors.primary; ctx.beginPath();
        ctx.moveTo(g.x - 8, g.y); ctx.lineTo(g.x + 8, g.y); ctx.moveTo(g.x, g.y - 8); ctx.lineTo(g.x, g.y + 8); ctx.stroke();
        ctx.fillStyle = colors.primary; ctx.fillText('x ' + Math.round(g.x) + '  y ' + Math.round(g.y), g.x + 10, g.y + 8);
      }
      ctx.globalAlpha = 1;
    };

    var drawGraph = function () {
      var LINK = 120, near = 150, i, j, a, b;
      ctx.lineWidth = 1;
      for (i = 0; i < nodes.length; i++) { a = nodes[i]; a._y = ((a.y - scrollY * 0.12 * a.z) % H + H) % H; }
      ctx.strokeStyle = colors.line;
      for (i = 0; i < nodes.length; i++) {
        a = nodes[i];
        for (j = i + 1; j < nodes.length; j++) {
          b = nodes[j];
          var d = Math.hypot(a.x - b.x, a._y - b._y);
          if (d < LINK) { ctx.globalAlpha = 1 - d / LINK; ctx.beginPath(); ctx.moveTo(a.x, a._y); ctx.lineTo(b.x, b._y); ctx.stroke(); }
        }
        var dm = Math.hypot(a.x - mouse.x, a._y - mouse.y);
        if (dm < near) {
          ctx.globalAlpha = (1 - dm / near) * 0.5; ctx.strokeStyle = colors.primary;
          ctx.beginPath(); ctx.moveTo(a.x, a._y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          ctx.strokeStyle = colors.line;
        }
      }
      ctx.globalAlpha = 1; ctx.fillStyle = colors.node;
      ctx.font = '11px ' + colors.mono; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (i = 0; i < nodes.length; i++) {
        a = nodes[i];
        if (a.g) ctx.fillText(a.g, a.x, a._y);
        else { ctx.beginPath(); ctx.arc(a.x, a._y, a.r, 0, Math.PI * 2); ctx.fill(); }
      }
      for (i = 0; i < bursts.length; i++) {
        var p = bursts[i];
        ctx.globalAlpha = p.o; ctx.fillStyle = p.c; ctx.fillText(p.g, p.x, p.y);
      }
      ctx.globalAlpha = 1;
    };

    var draw = function () { ctx.clearRect(0, 0, W, H); if (isDark()) drawGraph(); else drawBlueprint(); };

    var step = function () {
      if (isDark()) {
        for (var i = 0; i < nodes.length; i++) {
          var a = nodes[i];
          var dx = a.x - mouse.x, dy = (a._y || a.y) - mouse.y, d = Math.hypot(dx, dy);
          if (d < 110 && d > 0.1) { a.vx += dx / d * 0.04; a.vy += dy / d * 0.04; }
          a.vx *= 0.985; a.vy *= 0.985;
          if (Math.hypot(a.vx, a.vy) < 0.08) { a.vx += (Math.random() - 0.5) * 0.02; a.vy += (Math.random() - 0.5) * 0.02; }
          a.x += a.vx; a.y += a.vy;
          if (a.x < -10) a.x = W + 10; if (a.x > W + 10) a.x = -10;
          if (a.y < -10) a.y += H + 20; if (a.y > H + 10) a.y -= H + 20;
        }
      }
      draw();
      raf = requestAnimationFrame(step);
    };
    var toLocal = function (e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    var onMove = function (e) {
      var p = toLocal(e); mouse.x = p.x; mouse.y = p.y;
      if (!isDark() && !reduced() && p.x >= 0 && p.y >= 0 && p.x <= W && p.y <= H) trail.push({ x: p.x, y: p.y, t: performance.now() });
      if (reduced()) draw();
    };
    var onLeave = function () { mouse.x = mouse.y = -9999; };
    var onClick = function (e) {
      if (reduced()) return;
      var p = toLocal(e);
      if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) return;
      if (!isDark()) {
        var ring = { x: p.x, y: p.y, r: 4, o: 1 };
        rings.push(ring);
        A().animate(ring, { r: 70, o: 0, duration: 1100, ease: 'outCubic', onComplete: function () { rings.splice(rings.indexOf(ring), 1); } });
        return;
      }
      var glyphs = ['{', '}', '<', '>', '/', ';', '(', ')'];
      glyphs.forEach(function (g, k) {
        var ang = (k / glyphs.length) * Math.PI * 2 + Math.random() * 0.4;
        var item = { g: g, x: p.x, y: p.y, o: 1, c: k % 2 ? colors.accent : colors.primary };
        bursts.push(item);
        A().animate(item, { x: p.x + Math.cos(ang) * (40 + Math.random() * 30), y: p.y + Math.sin(ang) * (40 + Math.random() * 30), o: 0, duration: 900, ease: 'outExpo',
          onComplete: function () { bursts.splice(bursts.indexOf(item), 1); } });
      });
    };
    var onScroll = function () { scrollY = host === window ? window.scrollY : host.scrollTop; if (reduced()) draw(); };
    readColors(); resize();
    new MutationObserver(function () { readColors(); trail = []; draw(); }).observe(root, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('click', onClick);
    host.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) cancelAnimationFrame(raf); else if (!reduced()) raf = requestAnimationFrame(step);
    });
    if (!reduced()) raf = requestAnimationFrame(step);
    return { redraw: draw, stop: function () { cancelAnimationFrame(raf); } };
  }

  /* Wire everything with data-ocs="magnetic squish" style attributes. */
  var MAP = { magnetic: magnetic, wave: wave, decode: decode, squish: squish, tilt: tilt, 'theme-toggle': themeToggle };
  function init(scope) {
    (scope || document).querySelectorAll('[data-ocs]').forEach(function (el) {
      if (el.__ocs) return; el.__ocs = true;
      el.getAttribute('data-ocs').split(/\s+/).forEach(function (k) { if (MAP[k]) MAP[k](el); });
    });
  }

  window.OrchidCity = { init: init, magnetic: magnetic, wave: wave, decode: decode, squish: squish, tilt: tilt, expand: expand,
    themeToggle: themeToggle, setTheme: setTheme, initialTheme: initialTheme, background: background, reduced: reduced, isDark: isDark };
})();
