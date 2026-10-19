(() => {
  const $ = id => document.getElementById(id);
  const grid = $('grid'), statusEl = $('status'), overlay = $('overlay');
  const coverUrl = id => 'covers/' + id + '.jpg';
  let books = [];

  // entry: { id, topic, name: "Authors - Title [Edition].pdf", url, size }
  function parse(e) {
    let base = e.name.replace(/\.pdf$/i, '').trim();
    let edition = '';
    const m = base.match(/\[([^\]]*)\]\s*$/);
    if (m) { edition = m[1].trim(); base = base.slice(0, m.index).trim(); }
    const i = base.indexOf(' - ');            // first " - " separates authors from title
    return { id: e.id, url: e.url, size: e.size, name: e.name, topic: e.topic || '', edition,
             author: i > -1 ? base.slice(0, i).trim() : '', title: i > -1 ? base.slice(i + 3).trim() : base };
  }
  function editionLabel(e) {
    const m = e.match(/(\d+)\s*(st|nd|rd|th)?/i);
    return m ? m[1] + (m[2] ? m[2].toLowerCase() : '') + ' ed.' : e;
  }
  const sizeText = n => n ? (n >= 1048576 ? (n / 1048576).toFixed(n >= 10485760 ? 0 : 1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB') : '';

  // Covers are small pre-made images, requested only when their card is on screen.
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const img = e.target.querySelector('img');
      img.onload = () => img.classList.add('ready');
      img.onerror = () => e.target.classList.add('nocover');
      img.src = coverUrl(e.target.dataset.id);
    }
  });

  function makeCard(b) {
    const card = document.createElement('button');
    card.className = 'card';
    card.innerHTML = '<div class="thumb"><img alt=""></div><span class="name"></span>';
    card.querySelector('.name').textContent = b.title;
    const thumb = card.querySelector('.thumb');
    thumb.dataset.id = b.id;
    thumb.dataset.title = b.title;
    card.addEventListener('click', () => openModal(b));
    io.observe(thumb);
    return card;
  }
  function clear(container) {
    for (const t of container.querySelectorAll('.thumb')) io.unobserve(t);
    container.innerHTML = '';
  }
  function render(list) {
    clear(grid);
    for (const b of list) grid.appendChild(makeCard(b));
    statusEl.textContent = list.length ? '' : 'No books found.';
  }

  // ---- categories: topic tiles -> click one to see its books ----
  const catList = $('cat-list'), catTitle = $('cat-title'), catBack = $('cat-back'), catStatus = $('cat-status');
  let groups = new Map(), currentTopic = '';
  const countText = n => n + (n === 1 ? ' book' : ' books');
  function buildGroups() {
    groups = new Map();
    for (const b of books) {
      const key = b.topic || 'Uncategorized';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    }
  }
  function showCategory(topic) {
    currentTopic = topic || '';
    clear(catList);
    catList.className = '';
    if (!books.length) return;
    if (currentTopic && groups.has(currentTopic)) {
      const items = groups.get(currentTopic);
      catTitle.textContent = currentTopic;
      catBack.hidden = false;
      catStatus.textContent = countText(items.length);
      catList.className = 'grid';
      for (const b of items) catList.appendChild(makeCard(b));
      return;
    }
    catTitle.textContent = 'Categories';
    catBack.hidden = true;
    const names = [...groups.keys()].sort((x, y) =>
      x === 'Uncategorized' ? 1 : y === 'Uncategorized' ? -1 : x.localeCompare(y));
    catStatus.textContent = names.length ? '' : 'No books found.';
    catList.className = 'tiles';
    for (const name of names) {
      const tile = document.createElement('a');
      tile.className = 'tile';
      tile.href = '#categories/' + encodeURIComponent(name);
      tile.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><strong></strong><small></small>';
      tile.querySelector('strong').textContent = name;
      tile.querySelector('small').textContent = countText(groups.get(name).length);
      catList.appendChild(tile);
    }
  }

  // ---- popup ----
  const app = window.LibraryApp || null;   // only exists inside the Android app
  const busy = new Map();                  // book name -> download percent (inside the app)
  let current = null;                      // book shown in the popup

  function refreshPopup() {
    if (!current) return;
    const b = current, dl = $('m-open');
    const saved = !!(app && app.hasBook(b.name));
    dl.hidden = saved;                     // already in the Library Books folder: no second download
    $('m-saved').hidden = !saved;
    const pct = busy.get(b.name);
    dl.classList.toggle('busy', pct !== undefined);
    dl.textContent = pct !== undefined ? (pct > 0 ? 'Downloading ' + pct + '%' : 'Downloading\u2026')
                                       : 'Download' + (b.size ? ' \u00b7 ' + sizeText(b.size) : '');
  }
  function openModal(b) {
    current = b;
    $('m-title').textContent = b.title;
    $('m-author').textContent = b.author;
    $('m-edition').textContent = b.edition ? editionLabel(b.edition) : '';
    const rd = $('m-read'), dl = $('m-open');
    rd.href = dl.href = b.url;
    dl.setAttribute('download', b.name);
    rd.onclick = app ? e => { e.preventDefault(); app.readBook(b.url, b.name); } : null;
    dl.onclick = app ? e => { e.preventDefault(); if (!busy.has(b.name)) app.downloadBook(b.url, b.name); } : null;
    refreshPopup();
    const img = $('m-cover');
    img.onerror = () => img.removeAttribute('src');
    img.src = coverUrl(b.id);
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }
  function closeModal() {
    current = null;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }
  $('close').addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  $('search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    render(books.filter(b => (b.title + ' ' + b.author + ' ' + b.topic).toLowerCase().includes(q)));
  });

  // ---- download page: app releases (releases.json is built from GitHub Releases) ----
  function md(src) {   // small, safe markdown: everything is escaped before any tags are added
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const inline = s => esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    const out = []; let list = null, code = null, para = [];
    const flushPara = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
    const flushList = () => { if (list) { out.push('</' + list + '>'); list = null; } };
    for (const line of String(src).replace(/\r\n?/g, '\n').split('\n')) {
      if (code !== null) {
        if (/^```/.test(line)) { out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>'); code = null; }
        else code.push(line);
        continue;
      }
      let m;
      if (/^```/.test(line)) { flushPara(); flushList(); code = []; }
      else if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { flushPara(); flushList(); const n = Math.min(m[1].length + 2, 6); out.push('<h' + n + '>' + inline(m[2]) + '</h' + n + '>'); }
      else if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) { flushPara(); if (list !== 'ul') { flushList(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(m[1]) + '</li>'); }
      else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flushPara(); if (list !== 'ol') { flushList(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(m[1]) + '</li>'); }
      else if (!line.trim()) { flushPara(); flushList(); }
      else { flushList(); para.push(line); }
    }
    if (code !== null) out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>');
    flushPara(); flushList();
    return out.join('');
  }

  // Inside the app the file button installs the update instead of just downloading it.
  const ver = s => ((String(s).match(/\d+(?:\.\d+)*/) || ['0'])[0]).split('.').map(Number);
  const cmpVer = (x, y) => {
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const d = (x[i] || 0) - (y[i] || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    return 0;
  };
  let apkPct;                              // percent while an update downloads
  const apkButtons = [];
  function paintApk() {
    for (const b of apkButtons) {
      const active = !!b.dataset.act;
      b.classList.toggle('busy', apkPct !== undefined || !active);
      b.textContent = apkPct !== undefined && active
        ? (apkPct > 0 ? 'Downloading ' + apkPct + '%' : 'Downloading\u2026') : b.dataset.label;
    }
  }
  function appButton(btn, r, a) {
    const c = cmpVer(ver(r.tag), ver(app.versionName()));
    btn.removeAttribute('download');
    btn.dataset.label = c > 0 ? 'Update' : c === 0 ? 'Installed' : 'Older version';
    if (c > 0) btn.dataset.act = '1';
    btn.addEventListener('click', e => {
      e.preventDefault();
      if (c > 0 && apkPct === undefined) app.installUpdate(a.url);
    });
    apkButtons.push(btn);
    paintApk();
  }
  window.onLibraryEvent = ev => {          // progress messages from the app
    if (ev.name === 'apk') { apkPct = ev.type === 'progress' ? ev.pct : undefined; paintApk(); return; }
    if (ev.type === 'progress') busy.set(ev.name, ev.pct); else if (ev.name) busy.delete(ev.name);
    refreshPopup();
  };

  const appsEl = $('apps');
  function renderApps(list) {
    appsEl.innerHTML = '';
    if (!list.length) {
      appsEl.innerHTML = '<div class="empty"><strong>No downloadable apps yet.</strong><span>Check back soon.</span></div>';
      return;
    }
    list.forEach((r, i) => {
      const el = document.createElement('article');
      el.className = 'rel';
      el.innerHTML = '<header class="rel-head"><span class="tag"></span><h3></h3><time></time></header><ul class="files"></ul>';
      el.querySelector('.tag').textContent = r.tag;
      const title = el.querySelector('h3');
      if (r.name && r.name !== r.tag) title.textContent = r.name; else title.remove();
      const head = el.querySelector('.rel-head');
      for (const label of [i === 0 && 'Latest', r.prerelease && 'Pre-release']) {
        if (!label) continue;
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = label;
        head.insertBefore(chip, el.querySelector('time'));
      }
      const d = r.date ? new Date(r.date) : null;
      const time = el.querySelector('time');
      if (d && !isNaN(d)) time.textContent = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); else time.remove();
      const files = el.querySelector('.files');
      for (const a of r.assets) {
        const li = document.createElement('li');
        li.innerHTML = '<div class="file"><span class="fname"></span><small></small></div><a class="read-btn" download>Download</a>';
        li.querySelector('.fname').textContent = a.name;
        li.querySelector('small').textContent = sizeText(a.size);
        const btn = li.querySelector('a');
        btn.href = a.url;
        if (app) appButton(btn, r, a);
        files.appendChild(li);
      }
      if ((r.notes || '').trim()) {
        const box = document.createElement('details');
        box.className = 'notes-box';
        if (i === 0) box.open = true;
        box.innerHTML = '<summary>Release notes</summary><div class="notes"></div>';
        box.querySelector('.notes').innerHTML = md(r.notes);
        el.appendChild(box);
      }
      appsEl.appendChild(el);
    });
  }
  const releasesP = fetch('releases.json?t=' + Date.now(), { cache: 'no-store' })
    .then(r => r.ok ? r.json() : [])
    .catch(() => [])
    .then(list => Array.isArray(list) ? list : []);
  releasesP.then(renderApps);
  releasesP.then(list => {                 // "update available" bar, inside the app only
    if (!app) return;
    const newest = list.find(r => !r.prerelease);
    if (newest && cmpVer(ver(newest.tag), ver(app.versionName())) > 0) {
      const bar = $('update-bar');
      bar.textContent = 'Update available: ' + newest.tag + '. Tap to update.';
      bar.hidden = false;
    }
  });

  // ---- navigation ----
  const VIEWS = ['home', 'categories', 'download', 'about'];
  function route() {
    const raw = location.hash.slice(1);
    const i = raw.indexOf('/');
    const head = i > -1 ? raw.slice(0, i) : raw;
    const sub = i > -1 ? decodeURIComponent(raw.slice(i + 1)) : '';
    const name = VIEWS.includes(head) ? head : 'home';
    for (const v of VIEWS) $('view-' + v).hidden = v !== name;
    for (const a of document.querySelectorAll('.nav a')) a.classList.toggle('active', a.dataset.view === name);
    if (name === 'categories') showCategory(sub);
    closeModal();
    scrollTo(0, 0);
  }
  addEventListener('hashchange', route);
  route();

  fetch('books.json?t=' + Date.now(), { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(list => {
      books = list.map(parse).sort((a, b) => a.title.localeCompare(b.title));
      render(books);
      buildGroups();
      showCategory(currentTopic);
    })
    .catch(() => {
      statusEl.textContent = 'Could not load books.json. Serve the site over http (not file://) and make sure books.json exists.';
    });
})();
