// PilotPane learning journal viewer. Plain script (no modules or fetch) so it works from file://.
// Data: roadmap.js (versions), specs/manifest.js (file list), specs/NNN.js (one page each).
(function () {
  'use strict';

  // Swatch colours copied from apps/viewer/src/theme.css (bg and accent of each theme).
  const THEMES = [
    { id: 'cockpit', name: 'Cockpit', bg: '#0e1726', accent: '#f5a524' },
    { id: 'daylight', name: 'Daylight', bg: '#f4f6fa', accent: '#a85a0a' },
    { id: 'midnight', name: 'Midnight', bg: '#000000', accent: '#ffb547' },
    { id: 'contrast', name: 'Contrast', bg: '#000000', accent: '#ffe500' },
  ];
  const THEME_KEY = 'pp-journal-theme';
  const root = document.documentElement;
  const app = document.getElementById('app');

  // ---------- Themes ----------

  function savedTheme() {
    try {
      const t = localStorage.getItem(THEME_KEY);
      return THEMES.some((x) => x.id === t) ? t : null;
    } catch (e) {
      return null;
    }
  }
  function systemTheme() {
    return window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches
      ? 'daylight'
      : 'cockpit';
  }
  function applyTheme(id) {
    root.setAttribute('data-theme', id);
    const box = document.getElementById('themes');
    box.innerHTML = THEMES.map(
      (t) =>
        `<button type="button" data-theme-id="${t.id}" aria-label="${t.name} theme" title="${t.name}"` +
        ` aria-pressed="${t.id === id}" style="background:${t.bg}"><span style="background:${t.accent}"></span></button>`,
    ).join('');
  }
  document.getElementById('themes').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-theme-id]');
    if (!btn) return;
    try {
      localStorage.setItem(THEME_KEY, btn.dataset.themeId);
    } catch (err) {
      /* storage blocked: the choice lasts until reload */
    }
    applyTheme(btn.dataset.themeId);
  });
  if (window.matchMedia) {
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (!savedTheme()) applyTheme(systemTheme());
    });
  }
  applyTheme(savedTheme() || systemTheme());

  // ---------- Helpers ----------

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  // Prose: escape, then `code` and **bold**.
  function md(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  }
  const PATHS = {
    check: '<path d="M5 12l5 5L20 7"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    bug: '<path d="M8 8a4 4 0 0 1 8 0v7a4 4 0 0 1-8 0z"/><path d="M4 13h4M16 13h4M5 7l3 2M19 7l-3 2M5 20l3-2M19 20l-3-2M12 9v10"/>',
    commit: '<circle cx="12" cy="12" r="4"/><path d="M3 12h5M16 12h5"/>',
    quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17h.01"/>',
  };
  function icon(name, size = 16, color = 'accent') {
    return (
      `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"` +
      ` stroke-linejoin="round" aria-hidden="true" style="stroke: var(--${color})">${PATHS[name]}</svg>`
    );
  }
  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  function fmtDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
  }
  const NUM_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
  function count(n) {
    return NUM_WORDS[n] || String(n);
  }

  // Small highlighter: comments, strings and keywords. Everything else is escaped as is.
  const TOKENS =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|(?:^|(?<=\s))#[^\n]*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(export|import|from|const|let|type|interface|class|function|async|await|return|new|extends|private|readonly|if|else|throw|try|catch|finally|as|true|false|null)\b/gm;
  function highlight(src) {
    let out = '';
    let last = 0;
    String(src).replace(TOKENS, (m, c, s, k, off) => {
      out += esc(src.slice(last, off));
      out += `<span class="tk-${c ? 'c' : s ? 's' : 'k'}">${esc(m)}</span>`;
      last = off + m.length;
      return m;
    });
    return out + esc(String(src).slice(last));
  }

  // ---------- Data ----------

  const versions = (window.JOURNAL_ROADMAP && window.JOURNAL_ROADMAP.versions) || [];
  const plan = []; // every roadmap spec in order: { number, title, version }
  versions.forEach((m) =>
    m.specs.forEach(([number, title]) => plan.push({ number, title, version: m.id })),
  );
  let specs = []; // journal pages, sorted by number
  let byNum = {};
  let failed = [];

  function versionOf(id) {
    return versions.find((m) => m.id === id) || { id, name: '', note: '', specs: [] };
  }
  function planTitle(num) {
    const p = plan.find((x) => x.number === num);
    return p ? p.title : byNum[num] ? byNum[num].title : '';
  }
  function nextSpec() {
    return plan.find((p) => !byNum[p.number]);
  }
  function concepts() {
    const seen = {};
    const list = [];
    specs.forEach((s) =>
      (s.concepts || []).forEach((c) => {
        const key = c.name.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        list.push({ name: c.name, level: c.level, spec: s.number });
      }),
    );
    return list;
  }
  function progressBar(current) {
    return `<div class="bar" aria-hidden="true">${plan
      .map((p) => {
        const cls = p.number === current ? 'cur' : byNum[p.number] ? 'done' : '';
        return `<span class="${cls}"></span>`;
      })
      .join('')}</div>`;
  }
  function loadError() {
    return failed.length
      ? `<div class="card empty" style="margin-top: 24px; border-color: var(--accent)">Could not load ${failed
          .map((f) => `<code>specs/${esc(f)}</code>`)
          .join(
            ', ',
          )}. Check that the file exists and that its name in <code>specs/manifest.js</code> is right.</div>`
      : '';
  }

  // ---------- Timeline ----------

  function viewTimeline() {
    const next = nextSpec();
    const latest = specs[specs.length - 1];
    const learned = concepts();
    const doneCount = specs.length;

    const latestCard = latest
      ? `<a href="#spec-${esc(latest.number)}" class="card latest">
          <div class="latest-main">
            <span class="d" style="font-weight: 700; color: var(--accent)">SPEC ${esc(latest.number)}, ${esc(latest.version)}</span>
            <span class="d latest-title">${esc(latest.title)}</span>
            <span class="mu" style="font-size: 16px; line-height: 1.6">${md(latest.oneLine)}</span>
            <span class="read-more">Read the page ${icon('arrow', 18)}</span>
          </div>
          <div class="latest-points">${((latest.why && latest.why.decisions) || [])
            .slice(0, 3)
            .map((d) => `<div class="point">${icon('check', 16, 'info')}${md(d.chose)}</div>`)
            .join('')}</div>
        </a>`
      : `<div class="card empty">No journal pages yet. After a spec merges, add <code>specs/NNN.js</code> and list it in <code>specs/manifest.js</code>.</div>`;

    const lanes = versions
      .map((m) => {
        const tiles = m.specs
          .map(([num, title]) => {
            if (byNum[num]) {
              return `<a href="#spec-${num}" class="card tile done">
                <span class="tile-top"><span class="d num">${num}</span>${icon('check', 16, 'info')}</span>
                <b>${esc(title)}</b></a>`;
            }
            if (next && next.number === num) {
              return `<div class="tile next"><span class="d num">${num}</span><b>${esc(title)}</b>
                <span class="mu" style="font-size: 12px">Up next</span></div>`;
            }
            return `<div class="tile todo"><span class="d num mu">${num}</span><span>${esc(title)}</span></div>`;
          })
          .join('');
        return `<div class="lane">
          <div class="lane-name"><b class="d">${esc(m.id)} ${esc(m.name)}</b><span class="mu">${esc(m.note)}</span></div>
          <div class="tiles">${tiles}</div></div>`;
      })
      .join('');

    const cloud = learned.length
      ? learned
          .map(
            (c) =>
              `<a href="#spec-${esc(c.spec)}" class="chip${c.level === 'Core' ? ' hot' : ''}" title="First met in spec ${esc(c.spec)}">${esc(c.name)}</a>`,
          )
          .join('')
      : '<span class="mu">Concepts appear here as specs are added.</span>';

    return `${loadError()}
      <section class="hero">
        <div class="hero-text">
          <span class="eyebrow">PilotPane, built spec by spec</span>
          <h1 class="d">What we built, and why.</h1>
          <p class="mu lead">Every merged spec adds a page: what changed, the decisions behind it, how it works and where to learn more.</p>
        </div>
        <div class="card stats">
          <div class="stat"><b class="d" style="color: var(--info)">${doneCount}</b><span class="mu">specs done</span></div>
          <div class="stat"><b class="d">${Math.max(plan.length - doneCount, 0)}</b><span class="mu">to go</span></div>
          <div class="stat"><b class="d" style="color: var(--accent)">${learned.length}</b><span class="mu">concepts learned</span></div>
          ${progressBar(next && next.number)}
        </div>
      </section>
      <section class="section"><span class="eyebrow">Latest</span>${latestCard}</section>
      <section class="section" style="gap: 0">
        <div class="row-head" style="padding-bottom: 12px"><span class="eyebrow">Timeline</span><span class="mu" style="font-size: 13px">Done specs open their page</span></div>
        ${lanes}
      </section>
      <section class="section">
        <div class="row-head"><span class="eyebrow">Concepts learned so far</span><span class="mu" style="font-size: 13px">Core ideas are highlighted</span></div>
        <div class="chips">${cloud}</div>
      </section>`;
  }

  // ---------- Spec page ----------

  function secHead(n, iconName, label, title) {
    return `<div class="sec-head"><span class="d">${n}</span><div>
      <span class="eyebrow">${icon(iconName, 15)}${label}</span>
      <h2 class="d">${esc(title)}</h2></div></div>`;
  }

  function partGroup(p) {
    if (p.path.startsWith('apps/')) return 'Apps';
    if (p.path.startsWith('packages/')) return 'Packages';
    return 'Repo and tooling';
  }
  function repoMap(parts) {
    const groups = ['Apps', 'Packages', 'Repo and tooling']
      .map((g) => ({ g, items: parts.filter((p) => partGroup(p) === g) }))
      .filter((x) => x.items.length);
    const box = (p) =>
      `<div class="part${p.changed ? ' changed' : ''}"><b class="mono">${esc(p.path)}</b><span class="mu">${md(p.note)}</span></div>`;
    return groups
      .map(
        (x, i) =>
          (i === 1 && groups[0].g === 'Apps' && x.g === 'Packages'
            ? `<div class="mu" style="display: flex; justify-content: center; align-items: center; gap: 8px; font-size: 13px">${icon('down', 18, 'muted')}apps import packages</div>`
            : '') +
          `<div class="mu group-label">${x.g}</div><div class="parts">${x.items.map(box).join('')}</div>`,
      )
      .join('');
  }

  function specLink(num) {
    const title = planTitle(num);
    const label = `<b>${esc(num)}</b>${title ? ' ' + esc(title) : ''}`;
    return byNum[num] ? `<a href="#spec-${esc(num)}">${label}</a>` : label;
  }

  function journey(s) {
    const m = versionOf(s.version);
    const n = m.specs.length || 1;
    const idx = m.specs.findIndex(([num]) => num === s.number);
    const unlocks = ((s.when && s.when.unlocks) || []).map((u) => u.spec);
    const pos = plan.findIndex((p) => p.number === s.number) + 1;
    const half = 50 / n;
    const steps = m.specs
      .map(([num, title]) => {
        const cls =
          num === s.number ? 'cur' : byNum[num] ? 'done' : unlocks.includes(num) ? 'unl' : '';
        const inner = `<b class="d">${num}</b><span>${esc(title)}</span>`;
        return byNum[num] && num !== s.number
          ? `<a href="#spec-${num}" class="step ${cls}">${inner}</a>`
          : `<div class="step ${cls}">${inner}</div>`;
      })
      .join('');
    const list = (items, empty) =>
      items.length
        ? `<ul>${items.map((x) => `<li>${specLink(x.spec)}: ${md(x.note)}</li>`).join('')}</ul>`
        : `<span>${empty}</span>`;
    return `<div class="card journey">
      <div class="row-head"><span style="font-weight: 700">Version ${esc(m.id)}: ${esc(m.name)}</span>
        <span class="mu" style="font-size: 13px">Spec ${pos || '?'} of ${plan.length}</span></div>
      <div class="stepper"><div class="stepper-in" style="min-width: ${n * 72}px">
        <span class="stepper-line" style="left: ${half}%; right: ${half}%"></span>
        ${idx > 0 ? `<span class="stepper-line fill" style="left: ${half}%; width: ${(idx * 100) / n}%"></span>` : ''}
        ${steps}
      </div></div>
      <div class="links">
        <div class="link-box"><span class="mu" style="font-size: 12px; font-weight: 700">BUILT ON</span>
          ${list((s.when && s.when.dependsOn) || [], 'Nothing before it: this is the starting point.')}</div>
        <div class="link-box unlocks"><span style="font-size: 12px; font-weight: 700; color: var(--accent)">UNLOCKS</span>
          ${list(unlocks.length ? s.when.unlocks : [], 'Nothing yet.')}</div>
      </div></div>`;
  }

  function codeCard(c) {
    return `<div class="card code">
      <div class="code-file">${icon('code')}<span class="mono">${esc(c.file)}</span></div>
      <pre><code style="padding: 0; background: none; font-size: inherit">${highlight(c.excerpt)}</code></pre>
      <div class="code-note">${icon('bulb', 18, 'info')}<span>${md(c.explanation)}</span></div></div>`;
  }

  const REPO_URL = 'https://github.com/rafiyasir/pilotpane';
  // Specs are tagged spec-NNN-done when they merge; a page shows the range since the previous spec.
  function compareUrl(s) {
    const idx = plan.findIndex((p) => p.number === s.number);
    const prev = idx > 0 ? plan[idx - 1] : null;
    return prev
      ? `${REPO_URL}/compare/spec-${prev.number}-done...spec-${s.number}-done`
      : `${REPO_URL}/commits/spec-${s.number}-done`;
  }

  function viewSpec(s) {
    const i = specs.indexOf(s);
    const prev = specs[i - 1];
    const nextPage = specs[i + 1];
    const upcoming = nextSpec();
    const parts = (s.what && s.what.partsTouched) || [];
    const changed = parts.filter((p) => p.changed);
    const decisions = (s.why && s.why.decisions) || [];
    const steps = (s.how && s.how.steps) || [];
    const code = s.code || [];
    const quiz = s.quiz || [];
    const bugs = s.bugs || [];
    const commits = s.commits || [];
    let secNo = 4; // sections 1 to 4 always show; optional ones shift the numbers
    const sec = () => ++secNo;

    const headChips = changed
      .slice(0, 3)
      .map((p) => `<span class="chip mono">${esc(p.path)}</span>`)
      .join('');
    const moreChips =
      changed.length > 3 ? `<span class="chip">+${changed.length - 3} more</span>` : '';
    const coreNames = (s.concepts || [])
      .filter((c) => c.level === 'Core')
      .map((c) => c.name.toLowerCase());

    const pager = `<nav class="pager" aria-label="Spec navigation">
      ${
        prev
          ? `<a href="#spec-${esc(prev.number)}" class="card"><span class="mu">Previous</span><b class="d">${esc(prev.number)} ${esc(prev.title)}</b></a>`
          : `<a href="#" class="card"><span class="mu">Back to</span><b class="d">Timeline</b></a>`
      }
      ${
        nextPage
          ? `<a href="#spec-${esc(nextPage.number)}" class="card right"><span class="mu">Next</span><b class="d">${esc(nextPage.number)} ${esc(nextPage.title)}</b></a>`
          : upcoming
            ? `<div class="card right off"><span class="mu">Next, once merged</span><b class="d">${esc(upcoming.number)} ${esc(upcoming.title)}</b></div>`
            : ''
      }</nav>`;

    return `${loadError()}
      <section class="spec-top">
        <div class="spec-meta">
          <span class="d spec-num">SPEC ${esc(s.number)}</span>
          <span class="chip">${esc(s.version)} ${esc(versionOf(s.version).name)}</span>
          ${headChips}${moreChips}
          ${s.mergedDate ? `<span class="mu" style="font-size: 14px">Merged ${fmtDate(s.mergedDate)}</span>` : ''}
        </div>
        <h1 class="d">${esc(s.title)}</h1>
        <div class="callout">${icon('bulb', 24)}<p><b>In one line:</b> ${md(s.oneLine)}</p></div>
        <div class="progress">${progressBar(s.number)}
          <span class="mu">Project progress: ${specs.length} of ${plan.length} specs</span></div>
        <div class="chips">${(s.technologies || [])
          .map(
            (t) =>
              `<span class="chip${coreNames.includes(t.toLowerCase()) ? ' hot' : ''}">${esc(t)}</span>`,
          )
          .join('')}</div>
      </section>

      <section class="sec">
        ${secHead(1, 'map', 'What', 'What we built and where it lives')}
        ${s.what && s.what.summary ? `<p class="summary">${md(s.what.summary)}</p>` : ''}
        <div class="card map">
          <div class="row-head"><span style="font-weight: 700">pilotpane/</span>
            <span class="mu legend"><span><i class="changed"></i>Changed in this spec</span><span><i class="untouched"></i>Untouched</span></span></div>
          ${repoMap(parts)}
        </div>
      </section>

      <section class="sec">
        ${secHead(2, 'bulb', 'Why', `${count(decisions.length)} decision${decisions.length === 1 ? '' : 's'} and the reasons behind them`)}
        <div class="decisions">${decisions
          .map(
            (d) => `<div class="card decision">
              <div><span class="tag" style="color: var(--info)">${icon('check', 15, 'info')}WE CHOSE</span><span class="d chose">${md(d.chose)}</span></div>
              <div class="instead"><span class="tag mu">INSTEAD OF</span><s>${md(d.insteadOf)}</s></div>
              <div class="reason">${md(d.reason)}</div></div>`,
          )
          .join('')}</div>
      </section>

      <section class="sec">
        ${secHead(3, 'clock', 'When', 'Where this sits in the journey')}
        ${journey(s)}
      </section>

      <section class="sec">
        ${secHead(4, 'arrow', 'How', 'How it works when it runs')}
        <div class="how">
          <div class="card steps">${steps
            .map(
              (st, n) =>
                `<div class="how-step"><b class="d">${n + 1}</b><div><strong>${md(st.title)}</strong><span class="mu">${md(st.explanation)}</span></div></div>`,
            )
            .join('')}</div>
          ${code[0] ? codeCard(code[0]) : ''}
        </div>
      </section>

      ${
        code.length > 1
          ? `<section class="sec">${secHead(sec(), 'code', 'Code', 'More of the real code, explained')}
              <div class="code-list">${code.slice(1).map(codeCard).join('')}</div></section>`
          : ''
      }

      ${
        bugs.length
          ? `<section class="sec">${secHead(sec(), 'bug', 'Bugs', `${count(bugs.length)} thing${bugs.length === 1 ? '' : 's'} that went wrong, and the fix`)}
              <div class="bugs">${bugs
                .map(
                  (b) => `<div class="card bug">
                    <div><span class="tag mu">SYMPTOM</span>${md(b.symptom)}</div>
                    <div><span class="tag mu">CAUSE</span>${md(b.cause)}</div>
                    <div><span class="tag" style="color: var(--info)">${icon('check', 15, 'info')}FIX</span>${md(b.fix)}</div></div>`,
                )
                .join('')}</div></section>`
          : ''
      }

      <section class="sec">
        ${secHead(sec(), 'book', 'Learn', 'Concepts to go deeper')}
        <div class="concepts">${(s.concepts || [])
          .map(
            (c) => `<div class="card concept">
              <div class="concept-head"><h3 class="d">${esc(c.name)}</h3><span class="level">${esc(c.level)}</span></div>
              <p class="mu">${md(c.explanation)}</p>
              <div class="resources">${(c.resources || [])
                .map(
                  (r) =>
                    `<a href="${esc(r.url)}" target="_blank" rel="noopener">${icon('link', 15)}${esc(r.title)}</a>`,
                )
                .join('')}</div></div>`,
          )
          .join('')}</div>
      </section>

      <section class="sec">
        ${secHead(sec(), 'quiz', 'Check yourself', `${count(quiz.length)} quick question${quiz.length === 1 ? '' : 's'}`)}
        <div class="quiz">${quiz
          .map(
            (
              q,
            ) => `<details class="card"><summary><span>${md(q.question)}</span><i aria-hidden="true">+</i></summary>
              <p class="mu">${md(q.answer)}</p></details>`,
          )
          .join('')}</div>
      </section>
      ${
        commits.length || s.commitsNote
          ? `<section class="sec">${secHead(sec(), 'commit', 'Commits', 'What was committed')}
              <div class="card commits">
                ${commits.length ? `<ul>${commits.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
                ${s.commitsNote ? `<p class="mu" style="margin: 0">${md(s.commitsNote)}</p>` : ''}
                <a class="btn" href="${esc(compareUrl(s))}" target="_blank" rel="noopener">${icon('link', 15)}View on GitHub</a>
              </div></section>`
          : ''
      }
      ${pager}`;
  }

  function viewMissing(num) {
    return `<section class="spec-top"><span class="d spec-num">SPEC ${esc(num)}</span>
      <h1 class="d">No page yet</h1>
      <p class="mu lead">Spec ${esc(num)} has no journal page yet. It appears here after the spec merges.</p>
      <p><a href="#">Back to the timeline</a></p></section>`;
  }

  // ---------- Routing ----------

  function render(scroll) {
    const hash = location.hash;
    const latest = specs[specs.length - 1];
    let m = /^#spec-(\d{3})$/.exec(hash);
    if (hash === '#latest' && latest) m = [null, latest.number];
    const navTimeline = document.getElementById('nav-timeline');
    const navLatest = document.getElementById('nav-latest');
    if (latest) navLatest.setAttribute('href', `#spec-${latest.number}`);

    if (m) {
      const s = byNum[m[1]];
      app.className = 'wrap narrow';
      app.innerHTML = s ? viewSpec(s) : viewMissing(m[1]);
      document.title = s ? `Spec ${s.number}: ${s.title} | PilotPane journal` : 'Learning journal';
      navTimeline.removeAttribute('aria-current');
      if (s && s === latest) navLatest.setAttribute('aria-current', 'page');
      else navLatest.removeAttribute('aria-current');
    } else {
      app.className = 'wrap';
      app.innerHTML = viewTimeline();
      document.title = 'PilotPane journal';
      navTimeline.setAttribute('aria-current', 'page');
      navLatest.removeAttribute('aria-current');
    }
    if (scroll) window.scrollTo(0, 0);
  }

  function loadSpecs(files) {
    return Promise.all(
      files.map(
        (f) =>
          new Promise((resolve) => {
            const el = document.createElement('script');
            el.src = 'specs/' + f;
            el.onload = () => resolve(null);
            el.onerror = () => resolve(f);
            document.body.appendChild(el);
          }),
      ),
    );
  }

  window.JOURNAL = window.JOURNAL || [];
  loadSpecs(window.JOURNAL_FILES || []).then((results) => {
    failed = results.filter(Boolean);
    specs = window.JOURNAL.filter((s) => s && s.number).sort((a, b) =>
      a.number.localeCompare(b.number),
    );
    byNum = {};
    specs.forEach((s) => (byNum[s.number] = s));
    render(false);
    window.addEventListener('hashchange', () => render(true));
  });
})();
