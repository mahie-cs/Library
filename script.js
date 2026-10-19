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
  function openModal(b) {
    $('m-title').textContent = b.title;
    $('m-author').textContent = b.author;
    $('m-edition').textContent = b.edition ? editionLabel(b.edition) : '';
    $('m-read').href = b.url;
    const dl = $('m-open');
    dl.href = b.url;
    dl.setAttribute('download', b.name);
    dl.textContent = 'Download' + (b.size ? ' \u00b7 ' + sizeText(b.size) : '');
    const img = $('m-cover');
    img.onerror = () => img.removeAttribute('src');
    img.src = coverUrl(b.id);
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
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
