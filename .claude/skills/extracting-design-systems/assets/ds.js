/* ds.js — behaviour for the design-system docs. No dependencies.
   - theme toggle (persisted; ?theme= forces), `t` shortcut
   - [data-token] cells show the resolved value for the current theme
   - [data-contrast="--fg|--bg"] shows the live WCAG ratio and pass/fail
   - .ds-copy buttons copy a token name or value
   - .ds-motion-demo buttons replay a transition
   - current-page highlighting in the sidebar */
(function () {
  var root = document.documentElement;
  var params = new URLSearchParams(location.search);

  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function store(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
  function theme() {
    if (root.dataset.theme === 'dark' || root.dataset.theme === 'light') return root.dataset.theme;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function apply(next, persist) {
    root.dataset.theme = next;
    if (persist) store('ds-theme', next);
    document.querySelectorAll('.ds-theme-toggle').forEach(function (b) {
      b.setAttribute('aria-pressed', next === 'dark');
      b.textContent = next === 'dark' ? '☀ Light' : '☾ Dark';
    });
    refresh();
  }

  function resolve(name, scope) {
    var value = getComputedStyle(scope || root).getPropertyValue(name).trim();
    return value;
  }

  function parseColor(text) {
    var probe = document.createElement('span');
    probe.style.color = text;
    document.body.appendChild(probe);
    var rgb = getComputedStyle(probe).color;
    probe.remove();
    var m = rgb.match(/[\d.]+/g);
    if (!m) return null;
    return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 };
  }
  function luminance(c) {
    function ch(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  }
  function composite(fg, bg) {
    return { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 };
  }
  function ratio(fgText, bgText) {
    var fg = parseColor(fgText), bg = parseColor(bgText);
    if (!fg || !bg) return null;
    if (bg.a < 1) bg = composite(bg, { r: 255, g: 255, b: 255, a: 1 });
    fg = composite(fg, bg);
    var l1 = luminance(fg), l2 = luminance(bg);
    var light = Math.max(l1, l2), dark = Math.min(l1, l2);
    return (light + 0.05) / (dark + 0.05);
  }

  function refresh() {
    document.querySelectorAll('[data-token]').forEach(function (el) {
      var scope = el.closest('[data-theme]') || root;
      var value = resolve(el.getAttribute('data-token'), scope);
      if (el.hasAttribute('data-swatch')) { el.style.setProperty('--swatch', value); el.setAttribute('title', value); }
      else el.textContent = value || '(unset)';
    });
    document.querySelectorAll('[data-contrast]').forEach(function (el) {
      var parts = el.getAttribute('data-contrast').split('|');
      var scope = el.closest('[data-theme]') || root;
      var fg = resolve(parts[0], scope), bg = resolve(parts[1], scope);
      var min = parseFloat(el.getAttribute('data-min') || '4.5');
      var r = ratio(fg, bg);
      if (r === null) { el.textContent = 'n/a'; return; }
      el.textContent = r.toFixed(2) + ':1';
      el.setAttribute('data-pass', r >= min ? 'true' : 'false');
      el.setAttribute('title', (r >= min ? 'Passes' : 'Fails') + ' the ' + min + ':1 minimum');
      var pair = el.closest('.ds-pair');
      if (pair) { pair.style.setProperty('--pair-fg', fg); pair.style.setProperty('--pair-bg', bg); }
    });
  }

  var requested = params.get('theme');
  apply(requested === 'dark' || requested === 'light' ? requested : (read('ds-theme') || theme()), false);

  document.addEventListener('click', function (event) {
    var toggle = event.target.closest('.ds-theme-toggle');
    if (toggle) { apply(theme() === 'dark' ? 'light' : 'dark', true); return; }
    var copy = event.target.closest('.ds-copy');
    if (copy) {
      var text = copy.getAttribute('data-copy') || copy.previousElementSibling && copy.previousElementSibling.textContent || '';
      if (navigator.clipboard) navigator.clipboard.writeText(text.trim());
      var original = copy.textContent; copy.textContent = 'Copied';
      setTimeout(function () { copy.textContent = original; }, 1200);
      return;
    }
    var run = event.target.closest('[data-motion-run]');
    if (run) {
      var demo = run.closest('.ds-motion-demo');
      demo.dataset.run = 'false';
      requestAnimationFrame(function () { requestAnimationFrame(function () { demo.dataset.run = 'true'; }); });
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 't' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.matches('input, textarea, select')) apply(theme() === 'dark' ? 'light' : 'dark', true);
  });

  // On narrow screens collapse nav groups except the one holding the current page.
  if (matchMedia('(max-width: 63.99rem)').matches) {
    document.querySelectorAll('.ds-nav details').forEach(function (d) { d.open = false; });
  }
  var here = location.pathname.split('/').pop();
  document.querySelectorAll('.ds-nav a[href]').forEach(function (a) {
    var target = a.getAttribute('href').split('/').pop().split('#')[0];
    if (target && target === here) {
      a.setAttribute('aria-current', 'page');
      var group = a.closest('details'); if (group) group.open = true;
    }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh); else refresh();
})();
