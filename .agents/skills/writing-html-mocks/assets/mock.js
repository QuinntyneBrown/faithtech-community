/* mock.js — tiny runtime for HTML mocks. No framework, no build step.
   - theme: ?theme=light|dark, localStorage, the mock bar toggle, or the `t` key
   - chrome: ?chrome=0 hides the mock bar and notes (used for screenshots)
   - data-state links: elements with [data-set-state] swap data-state on a target
   Everything degrades gracefully when JavaScript is off. */
(function () {
  var root = document.documentElement;
  var params = new URLSearchParams(location.search);

  function readStored(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function store(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* private mode */ } }

  function currentTheme() {
    if (root.dataset.theme === 'dark' || root.dataset.theme === 'light') return root.dataset.theme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function applyTheme(theme, persist) {
    root.dataset.theme = theme;
    if (persist) store('mock-theme', theme);
    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      button.textContent = theme === 'dark' ? '☀ Light' : '☾ Dark';
      button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    });
  }

  var requested = params.get('theme');
  if (requested === 'light' || requested === 'dark') applyTheme(requested, false);
  else if (readStored('mock-theme')) applyTheme(readStored('mock-theme'), false);
  else applyTheme(currentTheme(), false);

  if (params.get('chrome') === '0') root.dataset.chrome = 'off';

  document.addEventListener('click', function (event) {
    var toggle = event.target.closest('[data-theme-toggle]');
    if (toggle) { applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true); return; }
    var chrome = event.target.closest('[data-chrome-toggle]');
    if (chrome) { root.dataset.chrome = root.dataset.chrome === 'off' ? 'on' : 'off'; return; }
    var setter = event.target.closest('[data-set-state]');
    if (setter) {
      var target = document.querySelector(setter.getAttribute('data-target') || 'body');
      if (target) target.dataset.state = setter.getAttribute('data-set-state');
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.target.matches('input, textarea, select, [contenteditable]')) return;
    if (event.key === 't' && !event.metaKey && !event.ctrlKey && !event.altKey) applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true);
    if (event.key === 'Escape') {
      var open = document.querySelector('[data-dismiss-on-escape]');
      if (open) open.hidden = true;
    }
  });

  // Carry the current theme across sibling-state links so a review stays consistent.
  document.querySelectorAll('.mock-bar a[href]').forEach(function (link) {
    link.addEventListener('click', function () {
      try {
        var url = new URL(link.href);
        url.searchParams.set('theme', currentTheme());
        if (root.dataset.chrome === 'off') url.searchParams.set('chrome', '0');
        link.href = url.toString();
      } catch (e) { /* relative file URLs in some viewers */ }
    });
  });
})();
