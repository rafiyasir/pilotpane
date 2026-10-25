/* Download page script. Two optional extras, the page is complete without it:
   1. the theme picker, remembered in localStorage;
   2. the live download count, one call to the GitHub API, cached for 5 minutes in sessionStorage.
   Plain ES2020, classic script, no packages. The pure functions are also loaded by Node
   (scripts/lib/release.mjs and its tests), so the page and the release script share one implementation. */
(function () {
  var REPO = 'rafiyasir/pilotpane';
  var RELEASES_URL = 'https://api.github.com/repos/' + REPO + '/releases?per_page=100';
  var THEMES = ['cockpit', 'daylight', 'midnight', 'contrast'];
  var THEME_KEY = 'pilotpane-site-theme';
  var COUNT_KEY = 'pilotpane-site-downloads';
  var COUNT_TTL_MS = 5 * 60 * 1000;
  var FETCH_TIMEOUT_MS = 8000;

  /** Total downloads of the installer and zip across published releases. The checksum file is not counted. */
  function sumDownloads(releases) {
    if (!Array.isArray(releases)) return 0;
    var total = 0;
    releases.forEach(function (release) {
      if (!release || release.draft || !Array.isArray(release.assets)) return;
      release.assets.forEach(function (asset) {
        if (!asset || typeof asset.name !== 'string' || !/\.(exe|zip)$/i.test(asset.name)) return;
        var n = asset.download_count;
        if (typeof n === 'number' && isFinite(n) && n > 0) total += Math.floor(n);
      });
    });
    return total;
  }

  /** 1284 -> "1,284". Written by hand so Node and old browsers agree. */
  function formatCount(n) {
    return String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { sumDownloads: sumDownloads, formatCount: formatCount };
    return;
  }

  function readStore(store, key) {
    try {
      return window[store].getItem(key);
    } catch (e) {
      return null;
    }
  }

  function writeStore(store, key, value) {
    try {
      window[store].setItem(key, value);
    } catch (e) {
      /* storage can be blocked; the page works without it */
    }
  }

  function setTheme(name) {
    document.documentElement.setAttribute('data-pp', name);
    var buttons = document.querySelectorAll('[data-theme-name]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', String(buttons[i].getAttribute('data-theme-name') === name));
    }
  }

  function initThemes() {
    var bar = document.getElementById('theme-bar');
    if (!bar) return;
    bar.hidden = false;
    var saved = readStore('localStorage', THEME_KEY);
    if (saved && THEMES.indexOf(saved) !== -1) setTheme(saved);
    bar.addEventListener('click', function (event) {
      var target = event.target;
      var button = target && target.closest ? target.closest('[data-theme-name]') : null;
      if (!button) return;
      var name = button.getAttribute('data-theme-name');
      if (THEMES.indexOf(name) === -1) return;
      setTheme(name);
      writeStore('localStorage', THEME_KEY, name);
    });
  }

  function showCount(n) {
    var line = document.getElementById('count');
    var number = document.getElementById('count-n');
    if (!line || !number || !(n > 0)) return;
    number.textContent = formatCount(n);
    line.hidden = false;
  }

  function cachedCount() {
    var raw = readStore('sessionStorage', COUNT_KEY);
    if (!raw) return null;
    try {
      var saved = JSON.parse(raw);
      if (saved && typeof saved.n === 'number' && Date.now() - saved.t < COUNT_TTL_MS) return saved.n;
    } catch (e) {
      /* ignore a damaged cache entry */
    }
    return null;
  }

  function initCount() {
    var cached = cachedCount();
    if (cached !== null) {
      showCount(cached);
      return;
    }
    if (typeof fetch !== 'function') return;
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller
      ? setTimeout(function () {
          controller.abort();
        }, FETCH_TIMEOUT_MS)
      : null;
    fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller ? controller.signal : undefined
    })
      .then(function (response) {
        if (!response.ok) throw new Error('status ' + response.status);
        return response.json();
      })
      .then(function (releases) {
        var n = sumDownloads(releases);
        writeStore('sessionStorage', COUNT_KEY, JSON.stringify({ t: Date.now(), n: n }));
        showCount(n);
      })
      .catch(function () {
        /* offline, rate limited or blocked: the number written at release time stays */
      })
      .then(function () {
        if (timer) clearTimeout(timer);
      });
  }

  function start() {
    initThemes();
    initCount();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
