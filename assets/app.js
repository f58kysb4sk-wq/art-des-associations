/* L’Art des Associations — application publique */
(function () {
  'use strict';
  var A = window.ADA, esc = A.esc, fmt = A.fmt, pad = A.pad, contrast = A.contrast;
  var el = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };

  var cat = null, list = [], byId = {}, total = 0;
  var favs = new Set(store.get('ada:favoris', []));
  var current = null, device = 'desktop', lastList = [], homeScroll = 0;
  var isPreview = /[?&]apercu=1/.test(location.search);

  /* ---------- Chargement des données ---------- */
  function loadCatalogue() {
    if (isPreview) {
      var draft = store.get('ada:draft', null);
      if (draft && draft.catalogue) { el('previewBanner').hidden = false; return Promise.resolve(draft.catalogue); }
    }
    return fetch('data/catalogue.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function setCatalogue(c) {
    cat = A.normalize(c);
    cat.palettes.forEach(function (p) {
      p._fam = A.paletteFamilyIds(p, cat.families);
      p._int = A.paletteIntensityIds(p, cat.intensities);
      p._search = A.plain([p.name, p.id, p.description].concat(p.colors).join(' ')) + ' ' +
        A.plain(cat.families.filter(function (f) { return p._fam.indexOf(f.id) > -1; }).map(function (f) { return f.name; }).join(' '));
    });
    list = cat.palettes.filter(function (p) { return p.published; });
    byId = {}; cat.palettes.forEach(function (p) { byId[p.id] = p; });
    total = list.length;
    // On ne garde que les favoris qui existent encore
    favs.forEach(function (id) { if (!byId[id]) favs.delete(id); });
  }

  /* ---------- Textes et apparence ---------- */
  function vars() { return { total: total, colors: list.reduce(function (n, p) { return n + p.colors.length; }, 0) }; }
  function applySite() {
    var s = cat.site, v = vars(), t = s.theme || {};
    var root = document.documentElement.style;
    if (t.ink) root.setProperty('--ink', t.ink);
    if (t.paper) { root.setProperty('--paper', t.paper); document.querySelector('meta[name=theme-color]').content = t.paper; }
    if (t.line) root.setProperty('--line', t.line);
    if (t.accent) root.setProperty('--accent', t.accent);
    if (s.logo) el('brandText').innerHTML = '<img class="brand-logo" src="' + esc(s.logo) + '" alt="' + esc(s.brand) + '">';
    else el('brandText').textContent = s.brand || '';
    el('brandSub').textContent = s.brandSub || '';
    el('heroEyebrow').innerHTML = fmt(s.heroEyebrow, v);
    el('heroTitle').innerHTML = fmt(s.heroTitle, v);
    el('heroText').innerHTML = fmt(s.heroText, v);
    el('heroCta').innerHTML = fmt(s.heroCta, v);
    el('heroArtLabel').innerHTML = fmt(s.heroArtLabel, v);
    el('heroArtLabelSub').innerHTML = fmt(s.heroArtLabelSub, v);
    el('heroArtText').innerHTML = fmt(s.heroArtText, v);
    el('heroArtIndex').innerHTML = fmt(s.heroArtIndex, v);
    var art = el('heroArt');
    art.classList.toggle('has-image', !!s.heroImage);
    art.style.backgroundImage = s.heroImage ? 'url("' + s.heroImage.replace(/"/g, '') + '")' : '';
    el('familiesTitle').innerHTML = fmt(s.familiesTitle, v);
    el('familiesHint').innerHTML = fmt(s.familiesHint, v);
    el('galleryEyebrow').innerHTML = fmt(s.galleryEyebrow, v);
    el('galleryTitle').innerHTML = fmt(s.galleryTitle, v);
    el('galleryText').innerHTML = fmt(s.galleryText, v);
    el('galleryNote').innerHTML = fmt(s.galleryNote, v);
    el('mockupNote').innerHTML = fmt(s.mockupNote, v);
    el('footerText').innerHTML = fmt(s.footer, v);
    el('familiesBlock').hidden = s.showFamilies === false;
    el('allGallery').hidden = s.showGallery === false;
    renderContact();
    var opts = '<option value="">Toutes les intensités</option>' + cat.intensities.map(function (i) { return '<option value="' + esc(i.id) + '">' + esc(i.name) + '</option>'; }).join('');
    ['intensityAll', 'intensityFam'].forEach(function (id) { var s2 = el(id), keep = s2.value; s2.innerHTML = opts; s2.value = keep; });
  }

  function renderContact() {
    var c = cat.site.contact || {}, items = [];
    if (c.email) items.push('<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>');
    if (c.phone) items.push('<a href="tel:' + esc(c.phone.replace(/\s/g, '')) + '">' + esc(c.phone) + '</a>');
    if (c.website) items.push('<a href="' + esc(/^https?:/.test(c.website) ? c.website : 'https://' + c.website) + '" target="_blank" rel="noopener">' + esc(c.website.replace(/^https?:\/\//, '')) + '</a>');
    if (c.instagram) items.push('<a href="https://instagram.com/' + esc(c.instagram.replace(/^@/, '')) + '" target="_blank" rel="noopener">Instagram @' + esc(c.instagram.replace(/^@/, '')) + '</a>');
    var b = el('contactBlock');
    b.hidden = !items.length;
    b.innerHTML = items.length ? '<div class="eyebrow">Contact</div><h2>' + fmt(c.name || cat.site.brand) + '</h2><p class="muted">' + fmt(c.message) + '</p><div class="contact-links">' + items.join('') + '</div>' : '';
  }

  /* ---------- Rendu des familles et des vignettes ---------- */
  function visibleFamilies() { return cat.families.filter(function (f) { return f.visible !== false && !f.parent; }); }
  function renderFamilies() {
    var fams = visibleFamilies();
    el('familiesCount').textContent = pad(fams.length) + ' familles · ' + total + ' associations';
    el('families').innerHTML = fams.map(function (f) {
      var n = A.familyMembers(f.id, cat, list).length;
      return '<button class="family" data-action="fam" data-id="' + esc(f.id) + '"><div class="band">' + f.swatches.map(function (z) { return '<span style="background:' + esc(z) + '"></span>'; }).join('') + '</div><div class="info"><div><strong>' + esc(f.name) + '</strong><br><em>' + n + ' associations</em></div><span aria-hidden="true">↗</span></div></button>';
    }).join('');
  }

  function tile(x) {
    var c = x.colors;
    return '<button class="tile" data-action="open" data-id="' + x.id + '"><div class="mini" style="background:' + c[0] + '"><div class="mini-copy" style="color:' + contrast(c[0]) + '"><small>CONCEPT ' + pad(x.id) + '</small><b>' + esc(x.name) + '</b><i style="background:' + c[3] + '"></i></div><div class="mini-art" style="background:' + c[1] + ';color:' + c[4] + '"></div></div><div class="swatches">' + c.map(function (z) { return '<span style="background:' + z + '"></span>'; }).join('') + '</div><div class="tile-meta"><div><small>PALETTE ' + pad(x.id) + ' / ' + total + '</small><h3>' + esc(x.name) + '</h3></div><span aria-hidden="true">↗</span></div></button>';
  }
  function matchIntensity(x, mode) { return !mode || x._int.indexOf(mode) > -1; }
  function matchQuery(x, q) {
    if (!q) return true;
    return q.split(/\s+/).every(function (w) { return x._search.indexOf(w) > -1; });
  }

  function renderAll() {
    var q = A.plain(el('allSearch').value.trim()), mode = el('intensityAll').value;
    var arr = list.filter(function (x) { return matchQuery(x, q) && matchIntensity(x, mode); });
    el('allCount').textContent = arr.length + ' / ' + total + ' palettes';
    el('allTiles').innerHTML = arr.map(tile).join('') || '<p>Aucune palette trouvée.</p>';
    if (!el('home').classList.contains('hidden')) lastList = arr;
  }

  var activeFam = '';
  function panelPool() {
    if (activeFam === 'favoris') return list.filter(function (x) { return favs.has(x.id); });
    return A.familyMembers(activeFam, cat, list);
  }
  function renderTiles() {
    var q = A.plain(el('search').value.trim()), mode = el('intensityFam').value;
    var arr = panelPool().filter(function (x) { return matchQuery(x, q) && matchIntensity(x, mode); });
    el('panelCount').textContent = arr.length + ' associations';
    el('tiles').innerHTML = arr.map(tile).join('') || (activeFam === 'favoris' ? '<p class="empty">Aucune palette enregistrée pour le moment. Ouvrez une palette puis touchez « ♡ Enregistrer ».</p>' : '<p>Aucune palette trouvée.</p>');
    lastList = arr;
  }

  /* ---------- Navigation (adresses partageables) ---------- */
  function show(view) {
    el('home').classList.toggle('hidden', view !== 'home');
    el('panel').classList.toggle('active', view === 'panel');
    el('detail').classList.toggle('active', view === 'detail');
  }
  var stack = [];
  function track() {
    var h = location.hash || '#/';
    if (stack.length > 1 && stack[stack.length - 2] === h) stack.pop();
    else if (stack[stack.length - 1] !== h) stack.push(h);
  }
  function route() {
    track();
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    if (h === 'installer') { openInstall(); h = ''; }
    var parts = h.split('/');
    var wasHome = !el('home').classList.contains('hidden');
    if (parts[0] === 'palette' && byId[parts[1]] && (byId[parts[1]].published || isPreview)) {
      if (wasHome) homeScroll = window.scrollY;
      openDetail(+parts[1]); return;
    }
    if (parts[0] === 'collection' || parts[0] === 'favoris') {
      var id = parts[0] === 'favoris' ? 'favoris' : parts[1];
      if (id === 'favoris' || cat.families.some(function (f) { return f.id === id; })) {
        if (wasHome) homeScroll = window.scrollY;
        var changed = activeFam !== id; openFam(id, changed); return;
      }
    }
    show('home'); renderAll(); document.title = 'L’Art des Associations — Bibliothèque de couleurs';
    requestAnimationFrame(function () { window.scrollTo(0, homeScroll); });
  }
  function go(hash) { location.hash = hash; }

  function openFam(id, reset) {
    activeFam = id;
    if (reset) { el('search').value = ''; }
    var f = cat.families.filter(function (x) { return x.id === id; })[0];
    el('panelTitle').textContent = id === 'favoris' ? 'Mes inspirations' : f.name;
    el('panelEyebrow').textContent = id === 'favoris' ? 'Favoris / Enregistrés sur cet appareil' : (f.parent ? 'Collection / ' + famName(f.parent) : 'Collection / Explorer');
    el('panelDesc').textContent = (f && f.description) || '';
    var subs = id === 'favoris' ? [] : cat.families.filter(function (x) { return x.parent === id && x.visible !== false; });
    el('subfams').innerHTML = subs.map(function (s) { return '<button class="btn" data-action="fam" data-id="' + esc(s.id) + '">' + esc(s.name) + '</button>'; }).join('');
    show('panel'); renderTiles();
    document.title = el('panelTitle').textContent + ' — L’Art des Associations';
    if (reset) window.scrollTo(0, 0);
  }
  function famName(id) { var f = cat.families.filter(function (x) { return x.id === id; })[0]; return f ? f.name : ''; }

  /* ---------- Fiche palette et simulation ---------- */
  function variantOf(x) { var v = x.mockup && x.mockup.variant; return (v === undefined || v === 'auto' || v === '') ? x.id % 6 : (+v % 6); }

  function mockupHTML(x) {
    var c = x.colors, v = variantOf(x), m = cat.site.mockup;
    var title = esc((x.mockup && x.mockup.title) || m.titles[v]);
    var label = esc((x.mockup && x.mockup.label) || m.labels[v]);
    var dark = contrast(c[4]);
    return '<div class="site-announcement" style="background:' + c[4] + ';color:' + contrast(c[4]) + '">COLLECTION SIGNATURE <span>—</span> DÉCOUVREZ NOTRE UNIVERS <span>↗</span></div><nav style="border-bottom:1px solid ' + c[4] + '22"><strong>' + label + '</strong><div><span>Accueil</span><span>Univers</span><span>Projets</span><span>À propos</span><span>Contact</span></div><span class="site-nav-pill" style="border:1px solid ' + c[4] + ';color:' + c[4] + '">Prendre contact ↗</span></nav><div class="site-hero"><div class="site-copy"><small style="font-size:10px;letter-spacing:.16em">COLLECTION 0' + (v + 1) + ' / ÉDITION PRIVÉE</small><h3>' + title + '</h3><p>Un univers pensé pour celles et ceux qui cherchent l’élégance, le caractère et la singularité.</p><span class="site-cta" style="background:' + c[4] + ';color:' + dark + '">Découvrir la collection ↗</span><span class="site-link" style="border-bottom:1px solid ' + c[4] + '">Notre histoire ↗</span><div class="site-hero-caption">01 — L’EXPRESSION D’UN SAVOIR-FAIRE</div></div><div class="site-art" style="background:' + c[1] + ';color:' + c[3] + '"><div class="site-art-corner" style="background:' + c[2] + '">STUDIO<br>ÉDITION<br>2026</div><div class="editorial-stage" style="--a:' + c[0] + ';--b:' + c[1] + ';--c:' + c[2] + ';--d:' + c[3] + ';--e:' + c[4] + '"><div class="stage-orb"></div><div class="stage-plinth"></div><div class="stage-vase"></div><div class="stage-line"></div><div class="stage-stamp">ÉDITION<br>LIMITÉE<br>✳</div><div class="stage-number">0' + (v + 1) + '</div></div><span class="site-art-caption" style="background:' + c[4] + ';color:' + contrast(c[4]) + '">L\'ART DU DÉTAIL &nbsp; ↗</span></div></div><div class="site-ticker" style="background:' + c[3] + ';color:' + contrast(c[3]) + '">CRÉATIVITÉ &nbsp; ✳ &nbsp; SINGULARITÉ &nbsp; ✳ &nbsp; ÉLÉGANCE &nbsp; ✳ &nbsp; SAVOIR-FAIRE &nbsp; ✳ &nbsp; CRÉATIVITÉ</div><div class="site-intro" style="background:' + c[2] + ';color:' + contrast(c[2]) + '"><div><small>01 / NOTRE VISION</small><h4>Chaque détail<br><em>compte.</em></h4></div><div><p>Une identité singulière, une expérience raffinée. Découvrez un savoir-faire où les nuances dialoguent et les contrastes trouvent leur équilibre.</p><span class="site-outline" style="border-color:currentColor">Explorer notre approche ↗</span></div></div><div class="site-section-head"><div><small>02 / LA SÉLECTION</small><h4>Nos univers</h4></div><span>TOUT DÉCOUVRIR ↗</span></div><div class="site-bottom">' + ['Notre histoire', 'Nos créations', 'Notre univers'].map(function (z, i) { var bg = c[[1, 3, 4][i]]; return '<div style="background:' + bg + ';color:' + contrast(bg) + '"><span class="site-card-no">0' + (i + 1) + ' / SIGNATURE</span><div class="site-card-deco" style="border-color:' + c[[0, 2, 1][i]] + '"></div><strong>' + z + '</strong><span class="site-card-arrow">↗</span></div>'; }).join('') + '</div><div class="site-visual-intro" style="--a:' + c[0] + ';--b:' + c[1] + ';--c:' + c[2] + ';--d:' + c[3] + ';--e:' + c[4] + '"><div class="site-visual-scene"><div class="window"></div><div class="disc"></div><div class="block"></div></div><div class="site-visual-copy" style="background:' + c[3] + ';color:' + contrast(c[3]) + '"><small>ÉDITORIAL / L’INSPIRATION</small><h4>La beauté des contrastes.</h4><p>Une direction artistique où la couleur devient matière, volume et émotion. Chaque nuance joue son rôle.</p><span class="micro">DÉCOUVRIR L’UNIVERS &nbsp; ↗</span></div></div><div class="site-section-head"><div><small>03 / OBJETS DE DÉSIR</small><h4>La sélection du studio</h4></div><span>VOIR LA COLLECTION ↗</span></div><div class="site-product-grid">' + ['Édition Lumière', 'Forme Libre', 'Objet Signature'].map(function (lab, i) { var bg = c[[2, 3, 1][i]], tg = c[[0, 2, 4][i]]; return '<div class="site-product"><div class="site-product-visual" style="background:' + bg + ';color:' + contrast(bg) + ';--item:' + c[[4, 0, 3][i]] + ';--trim:' + c[[1, 4, 2][i]] + ';--angle:' + [-12, 9, -20][i] + 'deg"><span class="product-index">Nº 0' + (i + 1) + '</span><span class="product-tag" style="background:' + tg + ';color:' + contrast(tg) + '">DÉCOUVRIR ↗</span></div><div class="site-product-meta"><strong>' + lab + '</strong><span>EXPLORER ↗</span></div></div>'; }).join('') + '</div><div class="site-mosaic" style="--c:' + c[2] + ';--e:' + c[4] + '"><div class="site-mosaic-copy" style="background:' + c[1] + ';color:' + contrast(c[1]) + '"><small>04 / L’ART DE COMPOSER</small><h4>Oser la couleur.<br>Créer l’émotion.</h4><p>Une identité mémorable se construit avec des aplats, des contrastes, de la typographie et des détails soigneusement orchestrés.</p><span class="site-cta" style="background:' + c[4] + ';color:' + contrast(c[4]) + ';align-self:start">DÉCOUVRIR NOTRE VISION ↗</span></div><div class="site-mosaic-art" style="background:' + c[3] + '"></div></div><div class="site-strip" style="grid-template-columns:repeat(' + c.length + ',1fr)">' + c.map(function (z) { return '<span style="background:' + z + '"></span>'; }).join('') + '</div><div class="site-feature" style="background:' + c[4] + ';color:' + contrast(c[4]) + '"><div><small>03 / LA DIFFÉRENCE</small><h4>Des idées qui<br><em>prennent forme.</em></h4><p>Du premier regard à la dernière impression, chaque élément raconte une histoire.</p><span class="site-cta" style="background:' + c[3] + ';color:' + contrast(c[3]) + '">Parler de votre projet ↗</span></div><div class="site-feature-art" style="background:' + c[3] + '"><div style="background:' + c[1] + '"></div><span style="background:' + c[2] + '"></span><i style="border-color:' + c[0] + '"></i></div></div><div class="site-testimonial" style="background:' + c[0] + ';color:' + c[4] + '"><small>04 / TÉMOIGNAGE</small><div class="site-stars" style="color:' + c[3] + '">✦ ✦ ✦ ✦ ✦</div><blockquote>« Une expérience pensée avec soin, jusque dans les moindres détails. »</blockquote><span>— TÉMOIGNAGE FICTIF · APERÇU DE MISE EN PAGE</span></div><div class="site-contact" style="background:' + c[1] + ';color:' + contrast(c[1]) + '"><div><small>05 / CONTACT</small><h4>Imaginons<br>la suite.</h4></div><span class="site-contact-button" style="background:' + c[4] + ';color:' + contrast(c[4]) + '">Échangeons ensemble ↗</span></div><div class="site-footer" style="background:' + c[4] + ';color:' + contrast(c[4]) + '"><strong>' + label + '</strong><span>INSTAGRAM &nbsp; · &nbsp; CONTACT &nbsp; · &nbsp; MENTIONS LÉGALES</span><small>© 2026 · MAQUETTE CONCEPTUELLE</small></div>';
  }

  function openDetail(id) {
    var x = byId[id]; if (!x) return;
    current = x;
    if (!lastList.length || lastList.indexOf(x) < 0) lastList = list;
    var c = x.colors, v = variantOf(x);
    show('detail');
    el('detailNumber').textContent = 'PALETTE ' + pad(x.id) + ' / ' + total + ' · COLOR STORY';
    el('detailName').textContent = x.name;
    el('detailDesc').innerHTML = fmt(x.description || cat.site.detailDefaultDescription);
    el('detailTags').innerHTML = cat.families.filter(function (f) { return x._fam.indexOf(f.id) > -1 && f.visible !== false; }).map(function (f) { return '<a href="#/collection/' + encodeURIComponent(f.id) + '">' + esc(f.name) + '</a>'; }).concat(cat.intensities.filter(function (i) { return x._int.indexOf(i.id) > -1; }).map(function (i) { return '<span>' + esc(i.name) + '</span>'; })).join('');
    el('colorList').innerHTML = c.map(function (z, i) { return '<button class="color-row" data-action="copy" data-hex="' + z + '"><span class="color-chip" style="display:block;background:' + z + '"></span><span><b>' + (A.ROLES[i] || 'Complément') + '</b><small>' + z + '</small></span></button>'; }).join('');
    el('colorList').style.setProperty('--n', c.length);
    updateFavBtn();
    var site = el('site');
    site.className = 'site variant-' + v;
    site.style.background = c[0]; site.style.color = c[4];
    site.innerHTML = mockupHTML(x);
    renderDevice();
    var imgs = (x.images || []).filter(function (m) { return m && m.src; });
    el('situations').hidden = !imgs.length;
    el('situationsGrid').innerHTML = imgs.map(function (m) { return '<figure><img src="' + esc(m.src) + '" alt="' + esc(m.alt || x.name) + '" loading="lazy" decoding="async">' + (m.caption ? '<figcaption>' + esc(m.caption) + '</figcaption>' : '') + '</figure>'; }).join('');
    document.title = x.name + ' — L’Art des Associations';
    window.scrollTo(0, 0);
  }

  function renderDevice() {
    var mob = device === 'mobile', frame = el('siteMobile');
    el('browserFrame').classList.toggle('is-mobile', mob);
    el('site').hidden = mob; frame.hidden = !mob;
    document.querySelectorAll('[data-action=device]').forEach(function (b) { var on = b.dataset.device === device; b.classList.toggle('dark', on); b.setAttribute('aria-pressed', on); });
    if (mob && current) {
      var s = el('site');
      var base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
      frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="' + esc(base) + '"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"><link rel="stylesheet" href="assets/app.css"><style>body{margin:0;background:' + current.colors[0] + '}</style></head><body><div class="' + s.className + '" style="' + esc(s.getAttribute('style')) + '">' + s.innerHTML + '</div></body></html>';
    }
  }

  function updateFavBtn() { if (!current) return; el('favBtn').textContent = favs.has(current.id) ? '♥ Enregistrée' : '♡ Enregistrer'; el('favCount').textContent = favs.size; }
  function toggleFav() {
    if (!current) return;
    favs.has(current.id) ? favs.delete(current.id) : favs.add(current.id);
    store.set('ada:favoris', Array.from(favs));
    updateFavBtn();
    toast(favs.has(current.id) ? 'Ajoutée à vos inspirations ♥' : 'Retirée de vos inspirations');
  }

  function copyText(txt, done) {
    var ok = function () { done && done(); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok, function () { fallbackCopy(txt); ok(); });
    else { fallbackCopy(txt); ok(); }
  }
  function fallbackCopy(txt) { var t = document.createElement('textarea'); t.value = txt; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) { } t.remove(); }

  var toastTimer;
  function toast(msg, actionLabel, action) {
    var t = el('toast');
    t.innerHTML = esc(msg) + (actionLabel ? ' <button class="btn" data-action="toast-action">' + esc(actionLabel) + '</button>' : '');
    t.hidden = false; t._action = action;
    clearTimeout(toastTimer);
    if (!actionLabel) toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function step(dir) {
    if (!current) return;
    var arr = lastList.length ? lastList : list, i = arr.indexOf(current);
    var n = arr[(i + dir + arr.length) % arr.length];
    if (n) { stack.pop(); location.replace('#/palette/' + n.id); }
  }

  /* ---------- Installation ---------- */
  var deferredPrompt = null;
  var standalone = function () { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; };
  function platform() {
    var ua = navigator.userAgent, touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    if (/iPhone|iPod/.test(ua)) return 'iphone';
    if (/iPad/.test(ua) || touchMac) return 'ipad';
    if (/Android/.test(ua)) return 'android';
    if (/Macintosh/.test(ua)) return /Chrome|Edg\//.test(ua) ? 'desktop-chromium' : (/Firefox/.test(ua) ? 'desktop-firefox' : 'mac-safari');
    if (/Windows|Linux|CrOS/.test(ua)) return /Firefox/.test(ua) ? 'desktop-firefox' : 'desktop-chromium';
    return 'other';
  }
  var STEPS = {
    iphone: ['Sur iPhone', ['Ouvrez ce lien dans <b>Safari</b> (ou un autre navigateur proposant le bouton Partager).', 'Touchez le bouton <b>Partager</b> <span class="ico">⬆︎</span> en bas de l’écran.', 'Choisissez <b>Sur l’écran d’accueil</b> (faites défiler si besoin), puis <b>Ajouter</b>.', 'L’icône <b>Associations</b> apparaît sur votre écran d’accueil : elle s’ouvre en plein écran.']],
    ipad: ['Sur iPad', ['Ouvrez ce lien dans <b>Safari</b>.', 'Touchez <b>Partager</b> <span class="ico">⬆︎</span> en haut à droite.', 'Choisissez <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.']],
    android: ['Sur Android', ['Ouvrez ce lien dans <b>Chrome</b>, <b>Edge</b> ou <b>Samsung Internet</b>.', 'Touchez le bouton <b>Installer</b> ci-dessus s’il apparaît.', 'Sinon, ouvrez le menu <b>⋮</b> puis <b>Installer l’application</b> (ou <b>Ajouter à l’écran d’accueil</b>).']],
    'mac-safari': ['Sur Mac avec Safari', ['Safari 17 ou plus récent (macOS Sonoma ou ultérieur) est nécessaire.', 'Dans la barre de menus, choisissez <b>Fichier → Ajouter au Dock…</b> (ou le bouton Partager → <b>Ajouter au Dock</b>).', 'Cliquez sur <b>Ajouter</b> : l’application s’ouvre ensuite depuis le Dock, dans sa propre fenêtre.']],
    'desktop-chromium': ['Sur ordinateur avec Chrome ou Edge', ['Cliquez sur le bouton <b>Installer</b> ci-dessus s’il apparaît.', 'Sinon, cliquez sur l’icône d’installation <span class="ico">⊕</span> à droite de la barre d’adresse.', 'Ou ouvrez le menu <b>⋮</b> / <b>…</b> puis <b>Installer L’Art des Associations</b> (Edge : <b>Applications → Installer ce site en tant qu’application</b>).']],
    'desktop-firefox': ['Avec Firefox', ['Firefox ne propose pas l’installation d’applications web sur tous les systèmes.', 'Ouvrez ce lien dans <b>Chrome</b> ou <b>Edge</b> (Windows, Mac) ou dans <b>Safari</b> (Mac) pour l’installer.', 'Le catalogue reste entièrement utilisable ici, dans le navigateur.']],
    other: ['Sur votre appareil', ['Ouvrez ce lien dans Safari, Chrome ou Edge.', 'Cherchez l’option <b>Installer</b> ou <b>Ajouter à l’écran d’accueil</b> dans le menu du navigateur.']]
  };
  function stepsHTML(key) { var s = STEPS[key]; return '<h3>' + s[0] + '</h3><ol>' + s[1].map(function (li) { return '<li>' + li + '</li>'; }).join('') + '</ol>'; }
  function openInstall() {
    var p = platform();
    if (standalone()) { el('installSteps').innerHTML = '<p class="installed">✓ L’application est déjà installée et ouverte depuis son icône.</p>'; }
    else el('installSteps').innerHTML = deferredPrompt ? '' : stepsHTML(p);
    el('installNow').hidden = !deferredPrompt;
    el('installAll').innerHTML = ['iphone', 'ipad', 'android', 'mac-safari', 'desktop-chromium'].filter(function (k) { return k !== p; }).map(stepsHTML).join('');
    el('installSheet').hidden = false;
    document.body.classList.add('sheet-open');
    setTimeout(function () { (deferredPrompt ? el('installNow') : el('installSheet').querySelector('.sheet-close')).focus(); }, 50);
  }
  function closeInstall() { el('installSheet').hidden = true; document.body.classList.remove('sheet-open'); if (location.hash === '#installer') history.replaceState(null, '', location.pathname + location.search + '#/'); }
  function installNow() {
    if (!deferredPrompt) { openInstall(); return; }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function (r) {
      deferredPrompt = null; el('installNow').hidden = true;
      if (r.outcome === 'accepted') { closeInstall(); toast('Installation en cours ✓'); }
    });
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; el('installBtn').hidden = false; });
  window.addEventListener('appinstalled', function () { el('installBtn').hidden = true; deferredPrompt = null; toast('L’Art des Associations est installée ✓'); });

  /* ---------- Service worker et mises à jour ---------- */
  function registerSW() {
    if (!('serviceWorker' in navigator) || isPreview) return;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      function waiting(w) { toast('Une nouvelle version est disponible.', 'Mettre à jour', function () { w.postMessage('SKIP_WAITING'); }); }
      if (reg.waiting && navigator.serviceWorker.controller) waiting(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing;
        nw && nw.addEventListener('statechange', function () { if (nw.state === 'installed' && navigator.serviceWorker.controller) waiting(nw); });
      });
      setInterval(function () { reg.update().catch(function () { }); }, 60 * 60 * 1000);
    }).catch(function () { });
    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (!reloaded) { reloaded = true; location.reload(); } });
  }

  // Nouvelles palettes publiées : rafraîchissement discret au retour dans l’application
  var lastCheck = Date.now();
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || isPreview || Date.now() - lastCheck < 5 * 60 * 1000) return;
    lastCheck = Date.now();
    loadCatalogue().then(function (c) {
      if (c.updatedAt && c.updatedAt !== cat.updatedAt) { setCatalogue(c); applySite(); renderFamilies(); route(); toast('Le catalogue a été mis à jour ✓'); }
    }).catch(function () { });
  });

  /* ---------- Événements ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action]'); if (!b) return;
    var a = b.dataset.action;
    if (a === 'home') { e.preventDefault(); homeScroll = 0; if (location.hash.replace(/^#\/?/, '')) go('#/'); else { route(); window.scrollTo(0, 0); } }
    else if (a === 'favs') go('#/favoris');
    else if (a === 'fam') go('#/collection/' + encodeURIComponent(b.dataset.id));
    else if (a === 'open') go('#/palette/' + b.dataset.id);
    else if (a === 'back') { if (stack.length > 1) history.back(); else go('#/'); }
    else if (a === 'prev') step(-1);
    else if (a === 'next') step(1);
    else if (a === 'fav') toggleFav();
    else if (a === 'copy') copyText(b.dataset.hex, function () { var s = b.querySelector('small'); s.textContent = 'COPIÉ ✓'; setTimeout(function () { s.textContent = b.dataset.hex; }, 1000); });
    else if (a === 'copy-all' && current) copyText(current.name + ' — ' + current.colors.join(' · '), function () { toast('Codes copiés ✓'); });
    else if (a === 'share' && current) {
      var url = location.href.replace(/[?].*?(#|$)/, '$1').replace(/#.*$/, '') + '#/palette/' + current.id;
      if (navigator.share) navigator.share({ title: current.name + ' — L’Art des Associations', text: current.colors.join(' · '), url: url }).catch(function () { });
      else copyText(url, function () { toast('Lien de la palette copié ✓'); });
    }
    else if (a === 'device') { device = b.dataset.device; renderDevice(); }
    else if (a === 'clear-all') { el('allSearch').value = ''; el('intensityAll').value = ''; renderAll(); }
    else if (a === 'install') { if (deferredPrompt) installNow(); else openInstall(); }
    else if (a === 'install-now') installNow();
    else if (a === 'close-install') closeInstall();
    else if (a === 'reload') location.reload();
    else if (a === 'toast-action') { var t = el('toast'); t.hidden = true; t._action && t._action(); }
  });
  el('installSheet').addEventListener('click', function (e) { if (e.target === el('installSheet')) closeInstall(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !el('installSheet').hidden) closeInstall();
    if (el('detail').classList.contains('active') && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
      if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1);
    }
  });
  var deb;
  el('allSearch').addEventListener('input', function () { clearTimeout(deb); deb = setTimeout(renderAll, 90); });
  el('intensityAll').addEventListener('change', renderAll);
  el('search').addEventListener('input', function () { clearTimeout(deb); deb = setTimeout(renderTiles, 90); });
  el('intensityFam').addEventListener('change', renderTiles);
  window.addEventListener('hashchange', route);

  /* ---------- Démarrage ---------- */
  loadCatalogue().then(function (c) {
    setCatalogue(c); applySite(); renderFamilies(); el('favCount').textContent = favs.size;
    if (!standalone()) el('installBtn').hidden = false;
    route();
    if (/[?&]installer\b/.test(location.search)) openInstall();
    document.body.classList.add('ready');
  }).catch(function (err) {
    el('main').innerHTML = '<div class="load-error"><h2>Le catalogue n’a pas pu être chargé.</h2><p class="muted">Vérifiez votre connexion internet puis réessayez.</p><button class="btn dark" data-action="reload">Réessayer</button></div>';
    console.error(err);
  });
  registerSW();
})();
