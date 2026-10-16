(() => {
  const BOOKS_DIR = 'books/';
  const MAX_PARALLEL = 3;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const grid = document.getElementById('grid');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const $ = id => document.getElementById(id);
  const covers = new Map();
  let books = [];

  const urlFor = path => BOOKS_DIR + path.split('/').map(encodeURIComponent).join('/');

  function parse(path) {
    const parts = path.split('/');
    const file = parts.pop();
    let base = file.replace(/\.pdf$/i, '').trim();
    const topic = parts.join(' / ');
    let edition = '';
    const e = base.match(/\[([^\]]*)\]\s*$/);
    if (e) { edition = e[1].trim(); base = base.slice(0, e.index).trim(); }
    const i = base.indexOf(' - ');
    const author = i > -1 ? base.slice(0, i).trim() : '';
    const title = i > -1 ? base.slice(i + 3).trim() : base;
    return { path, topic, title, edition, author };
  }

  function editionLabel(e) {
    const m = e.match(/(\d+)\s*(st|nd|rd|th)?/i);
    return m ? m[1] + (m[2] ? m[2].toLowerCase() : '') + ' ed.' : e;
  }

  async function walk(dirUrl, rel, out, seen) {
    if (seen.has(dirUrl)) return;
    seen.add(dirUrl);
    const r = await fetch(dirUrl);
    if (!r.ok) throw new Error('listing failed');
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    const base = new URL(dirUrl, location.href);
    const subdirs = [];
    for (const a of doc.querySelectorAll('a[href]')) {
      let u;
      try { u = new URL(a.getAttribute('href'), base); } catch (_) { continue; }
      if (u.origin !== base.origin || !u.pathname.startsWith(base.pathname) || u.pathname === base.pathname) continue;
      const name = decodeURIComponent(u.pathname.slice(base.pathname.length));
      if (name.endsWith('/')) {
        const dir = name.slice(0, -1);
        if (dir && !dir.includes('/')) subdirs.push(dir);
      } else if (/\.pdf$/i.test(name) && !name.includes('/')) {
        out.push(rel + name);
      }
    }
    await Promise.all(subdirs.map(d =>
      walk(base.pathname + encodeURIComponent(d) + '/', rel + d + '/', out, seen)));
  }

  async function listFiles() {
    try {
      const out = [];
      await walk(BOOKS_DIR, '', out, new Set());
      if (out.length) return out;
    } catch (_) {}
    const r = await fetch(BOOKS_DIR + 'books.json');
    if (!r.ok) throw new Error('no listing');
    return r.json();
  }

  function renderCover(path) {
    const task = pdfjsLib.getDocument({ url: urlFor(path), disableAutoFetch: true });
    const promise = (async () => {
      const pdf = await task.promise;
      const page = await pdf.getPage(1);
      const vp = page.getViewport({ scale: 600 / page.getViewport({ scale: 1 }).width });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const url = canvas.toDataURL('image/jpeg', 0.85);
      task.destroy();
      return url;
    })();
    return { promise, cancel: () => task.destroy() };
  }

  const queue = [];
  const running = new Map();
  let active = 0;

  function show(thumb, url) {
    const img = thumb.querySelector('img');
    img.onload = () => img.classList.add('ready');
    img.src = url;
  }

  function schedule(thumb) {
    const path = thumb.dataset.path;
    if (covers.has(path)) return show(thumb, covers.get(path));
    if (running.has(thumb) || queue.includes(thumb)) return;
    queue.push(thumb);
    pump();
  }

  function unschedule(thumb) {
    const i = queue.indexOf(thumb);
    if (i > -1) queue.splice(i, 1);
    const job = running.get(thumb);
    if (job) { job.cancelled = true; job.cancel(); }
  }

  function pump() {
    while (active < MAX_PARALLEL && queue.length) {
      const thumb = queue.pop();
      const { promise, cancel } = renderCover(thumb.dataset.path);
      const job = { cancel, cancelled: false };
      running.set(thumb, job);
      active++;
      thumb.classList.add('loading');
      promise
        .then(url => { if (!job.cancelled) { covers.set(thumb.dataset.path, url); show(thumb, url); } })
        .catch(() => {})
        .finally(() => {
          active--; running.delete(thumb);
          thumb.classList.remove('loading');
          pump();
        });
    }
  }

  const io = new IntersectionObserver(entries => {
    for (const e of entries) e.isIntersecting ? schedule(e.target) : unschedule(e.target);
  }, { rootMargin: '0px' });

  function makeCard(b) {
    const card = document.createElement('button');
    card.className = 'card';
    card.innerHTML = '<div class="thumb"><img alt=""></div><span class="name"></span>';
    card.querySelector('.name').textContent = b.title;
    const thumb = card.querySelector('.thumb');
    thumb.dataset.path = b.path;
    card.addEventListener('click', () => openModal(b));
    io.observe(thumb);
    return card;
  }

  function clear(container) {
    for (const t of container.querySelectorAll('.thumb')) { io.unobserve(t); unschedule(t); }
    container.innerHTML = '';
  }

  function render(list) {
    clear(grid);
    for (const b of list) grid.appendChild(makeCard(b));
    statusEl.textContent = list.length ? '' : 'No books found.';
  }

  const catList = $('cat-list');
  const catTitle = $('cat-title');
  const catBack = $('cat-back');
  const catStatus = $('cat-status');
  let groups = new Map();
  let currentTopic = '';

  function buildGroups() {
    groups = new Map();
    for (const b of books) {
      const key = b.topic || 'Uncategorized';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    }
  }
  const countText = n => n + (n === 1 ? ' book' : ' books');

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

  async function openModal(b) {
    $('m-title').textContent = b.title;
    $('m-author').textContent = b.author;
    $('m-edition').textContent = b.edition ? editionLabel(b.edition) : '';
    $('m-cover').src = '';
    $('m-open').href = urlFor(b.path);
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    try {
      const url = covers.get(b.path) || await renderCover(b.path).promise;
      covers.set(b.path, url);
      $('m-cover').src = url;
    } catch (_) {}
  }
  function closeModal() {
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

  listFiles()
    .then(files => {
      books = files.map(parse).sort((a, b) => a.title.localeCompare(b.title));
      render(books);
      buildGroups();
      showCategory(currentTopic);
    })
    .catch(() => {
      statusEl.textContent = 'Could not read the books folder. Serve this site over http (not file://) and make sure the server lists directories, or add books/books.json.';
    });
})();