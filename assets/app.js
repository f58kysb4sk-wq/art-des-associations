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
      return '<button class="family" data-action="fam" data-id="' + esc(f.id) + '"><div class="band">' + f.swatches.map(function (z) { return '<span style="background:' + esc(z) + '"></span>'; }).join('') + '</div><div class="info"><div><strong>' + esc(f.name) + '</strong><br><em>' + n + ' associations</em></div><span aria-hidden="true">↗︎</span></div></button>';
    }).join('');
  }

  function tile(x) {
    var c = x.colors;
    return '<button class="tile" data-action="open" data-id="' + x.id + '"><div class="mini" style="background:' + c[0] + '"><div class="mini-copy" style="color:' + contrast(c[0]) + '"><small>CONCEPT ' + pad(x.id) + '</small><b>' + esc(x.name) + '</b><i style="background:' + c[3] + '"></i></div><div class="mini-art" style="background:' + c[1] + ';color:' + c[4] + '"></div></div><div class="swatches">' + c.map(function (z) { return '<span style="background:' + z + '"></span>'; }).join('') + '</div><div class="tile-meta"><div><small>PALETTE ' + pad(x.id) + ' / ' + total + '</small><h3>' + esc(x.name) + '</h3></div><span aria-hidden="true">↗︎</span></div></button>';
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
    el('allTiles').innerHTML = arr.map(tile).join('') || '<div class="empty"><p>Aucune palette ne correspond à cette recherche.</p><button class="btn dark" data-action="clear-all">Effacer la recherche</button></div>';
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
    el('tiles').innerHTML = arr.map(tile).join('') || (activeFam === 'favoris' && !panelPool().length ? '<div class="empty"><p>Aucune palette enregistrée pour le moment. Ouvrez une palette puis touchez « ♡ Enregistrer » : elle sera conservée sur cet appareil.</p><button class="btn dark" data-action="to-gallery">Explorer les palettes</button></div>' : '<div class="empty"><p>Aucune palette ne correspond à cette recherche.</p><button class="btn dark" data-action="clear-fam">Effacer la recherche</button></div>');
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
      var same = current && current.id === +parts[1] && el('detail').classList.contains('active');
      if (!same) openDetail(+parts[1]);
      if (parts[2]) openPanel(parts[2]); else hidePanel();
      return;
    }
    hidePanel();
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

  /* La maquette est un vrai mini-site : chaque bouton mène à une section ou ouvre une page de détail. */
  function mk(action, label) { return ' data-mk="' + action + '" role="button" tabindex="0"' + (label ? ' aria-label="' + esc(label) + '"' : ''); }
  function mockTexts(x) {
    var v = variantOf(x), m = cat.site.mockup;
    return { v: v, title: esc((x.mockup && x.mockup.title) || m.titles[v]), label: esc((x.mockup && x.mockup.label) || m.labels[v]) };
  }
  function mockupHTML(x) {
    var c = x.colors, T = mockTexts(x), v = T.v, title = T.title, label = T.label, ct = contrast;
    var dark = ct(c[4]);
    var insta = ((cat.site.contact || {}).instagram || '').replace(/^@/, '');
    var h = '';
    h += '<div class="site-announcement" data-sec="top" style="background:' + c[4] + ';color:' + ct(c[4]) + '">COLLECTION SIGNATURE <span>—</span> <b class="mk-link"' + mk('panel:art-du-detail') + '>DÉCOUVREZ NOTRE UNIVERS <span>↗︎</span></b></div>';
    h += '<nav style="border-bottom:1px solid ' + c[4] + '22"><strong' + mk('top', 'Haut de la maquette') + '>' + label + '</strong><div style="background:' + c[0] + '">' +
      [['Accueil', 'top'], ['Univers', 'collection'], ['Projets', 'projets'], ['À propos', 'vision'], ['Contact', 'contact']].map(function (n) { return '<span' + mk(n[1]) + '>' + n[0] + '</span>'; }).join('') +
      '</div><span class="site-nav-pill" style="border:1px solid ' + c[4] + ';color:' + c[4] + '"' + mk('contact') + '>Prendre contact ↗︎</span><span class="site-burger"' + mk('menu', 'Menu') + ' aria-expanded="false">☰</span></nav>';
    h += '<div class="site-hero"><div class="site-copy"><small style="font-size:10px;letter-spacing:.16em">COLLECTION 0' + (v + 1) + ' / ÉDITION PRIVÉE</small><h3>' + title + '</h3><p>Un univers pensé pour celles et ceux qui cherchent l’élégance, le caractère et la singularité.</p><span class="site-cta" style="background:' + c[4] + ';color:' + dark + '"' + mk('collection') + '>Découvrir la collection ↗︎</span><span class="site-link" style="border-bottom:1px solid ' + c[4] + '"' + mk('panel:histoire') + '>Notre histoire ↗︎</span><div class="site-hero-caption">01 — L’EXPRESSION D’UN SAVOIR-FAIRE</div></div>' +
      '<div class="site-art" style="background:' + c[1] + ';color:' + c[3] + '"><div class="site-art-corner" style="background:' + c[2] + '">STUDIO<br>ÉDITION<br>2026</div><div class="editorial-stage" style="--a:' + c[0] + ';--b:' + c[1] + ';--c:' + c[2] + ';--d:' + c[3] + ';--e:' + c[4] + '"><div class="stage-orb"></div><div class="stage-plinth"></div><div class="stage-vase"></div><div class="stage-line"></div><div class="stage-stamp">ÉDITION<br>LIMITÉE<br>✳︎</div><div class="stage-number">0' + (v + 1) + '</div></div><span class="site-art-caption" style="background:' + c[4] + ';color:' + ct(c[4]) + '"' + mk('panel:art-du-detail') + '>L\'ART DU DÉTAIL &nbsp; ↗︎</span></div></div>';
    h += '<div class="site-ticker" style="background:' + c[3] + ';color:' + ct(c[3]) + '">CRÉATIVITÉ &nbsp; ✳︎ &nbsp; SINGULARITÉ &nbsp; ✳︎ &nbsp; ÉLÉGANCE &nbsp; ✳︎ &nbsp; SAVOIR-FAIRE &nbsp; ✳︎ &nbsp; CRÉATIVITÉ</div>';
    h += '<div class="site-intro" data-sec="vision" style="background:' + c[2] + ';color:' + ct(c[2]) + '"><div><small>01 / NOTRE VISION</small><h4>Chaque détail<br><em>compte.</em></h4></div><div><p>Une identité singulière, une expérience raffinée. Découvrez un savoir-faire où les nuances dialoguent et les contrastes trouvent leur équilibre.</p><span class="site-outline" style="border-color:currentColor"' + mk('approche') + '>Explorer notre approche ↗︎</span></div></div>';
    h += '<div class="site-section-head" data-sec="collection"><div><small>02 / LA SÉLECTION</small><h4>Nos univers</h4></div><span' + mk('projets') + '>TOUT DÉCOUVRIR ↗︎</span></div><div class="site-bottom">' +
      [['Notre histoire', 'panel:histoire'], ['Nos créations', 'projets'], ['Notre univers', 'panel:art-du-detail']].map(function (z, i) { var bg = c[[1, 3, 4][i]]; return '<div style="background:' + bg + ';color:' + ct(bg) + '"' + mk(z[1], z[0]) + '><span class="site-card-no">0' + (i + 1) + ' / SIGNATURE</span><div class="site-card-deco" style="border-color:' + c[[0, 2, 1][i]] + '"></div><strong>' + z[0] + '</strong><span class="site-card-arrow">↗︎</span></div>'; }).join('') + '</div>';
    h += '<div class="site-visual-intro" style="--a:' + c[0] + ';--b:' + c[1] + ';--c:' + c[2] + ';--d:' + c[3] + ';--e:' + c[4] + '"><div class="site-visual-scene"><div class="window"></div><div class="disc"></div><div class="block"></div></div><div class="site-visual-copy" style="background:' + c[3] + ';color:' + ct(c[3]) + '"><small>ÉDITORIAL / L’INSPIRATION</small><h4>La beauté des contrastes.</h4><p>Une direction artistique où la couleur devient matière, volume et émotion. Chaque nuance joue son rôle.</p><span class="micro"' + mk('panel:art-du-detail') + '>DÉCOUVRIR L’UNIVERS &nbsp; ↗︎</span></div></div>';
    h += '<div class="site-section-head" data-sec="projets"><div><small>03 / OBJETS DE DÉSIR</small><h4>La sélection du studio</h4></div><span' + mk('panel:objet-1') + '>VOIR LA COLLECTION ↗︎</span></div><div class="site-product-grid">' +
      PRODUCTS.map(function (lab, i) { var P = productColors(c, i); return '<div class="site-product"' + mk('panel:objet-' + (i + 1), lab) + '><div class="site-product-visual" style="background:' + P.bg + ';color:' + ct(P.bg) + ';--item:' + P.item + ';--trim:' + P.trim + ';--angle:' + P.angle + 'deg"><span class="product-index">Nº 0' + (i + 1) + '</span><span class="product-tag" style="background:' + P.tag + ';color:' + ct(P.tag) + '">DÉCOUVRIR ↗︎</span></div><div class="site-product-meta"><strong>' + lab + '</strong><span>EXPLORER ↗︎</span></div></div>'; }).join('') + '</div>';
    h += '<div class="site-mosaic" style="--c:' + c[2] + ';--e:' + c[4] + '"><div class="site-mosaic-copy" style="background:' + c[1] + ';color:' + ct(c[1]) + '"><small>04 / L’ART DE COMPOSER</small><h4>Oser la couleur.<br>Créer l’émotion.</h4><p>Une identité mémorable se construit avec des aplats, des contrastes, de la typographie et des détails soigneusement orchestrés.</p><span class="site-cta" style="background:' + c[4] + ';color:' + ct(c[4]) + ';align-self:start"' + mk('approche') + '>DÉCOUVRIR NOTRE VISION ↗︎</span></div><div class="site-mosaic-art" style="background:' + c[3] + '"></div></div>';
    h += '<div class="site-strip" style="grid-template-columns:repeat(' + c.length + ',1fr)">' + c.map(function (z) { return '<span style="background:' + z + '"' + mk('copy:' + z, 'Copier ' + z) + ' title="Copier ' + z + '"></span>'; }).join('') + '</div>';
    h += '<div class="site-approach" data-sec="approche" style="background:' + c[0] + ';color:' + c[4] + '"><div class="site-approach-head"><div><small>05 / VISION &amp; APPROCHE</small><h4>Une méthode<br><em>en trois temps.</em></h4></div><p>Notre conviction : une belle identité naît d’un dialogue juste entre les couleurs, les matières et les mots. Chaque projet suit le même chemin, exigeant et sensible.</p></div><ol class="site-steps">' +
      [['Écouter', 'Comprendre votre histoire, vos clients et l’émotion que vous souhaitez transmettre dès le premier regard.'], ['Composer', 'Associer couleurs, typographies et matières pour créer une harmonie qui ne ressemble qu’à vous.'], ['Révéler', 'Donner vie à l’identité sur chaque page, du grand titre au plus petit détail, sur tous les écrans.']].map(function (s, i) { return '<li style="border-color:' + c[4] + '40"><span class="step-no" style="color:' + c[3] + '">0' + (i + 1) + '</span><strong>' + s[0] + '</strong><p>' + s[1] + '</p></li>'; }).join('') +
      '</ol><div class="site-approach-cta"><span class="site-outline" style="border-color:currentColor"' + mk('panel:art-du-detail') + '>Voir la palette en détail ↗︎</span><span class="site-outline" style="border-color:currentColor"' + mk('contact') + '>Démarrer un projet ↗︎</span></div></div>';
    h += '<div class="site-feature" style="background:' + c[4] + ';color:' + ct(c[4]) + '"><div><small>06 / LA DIFFÉRENCE</small><h4>Des idées qui<br><em>prennent forme.</em></h4><p>Du premier regard à la dernière impression, chaque élément raconte une histoire.</p><span class="site-cta" style="background:' + c[3] + ';color:' + ct(c[3]) + '"' + mk('contact') + '>Parler de votre projet ↗︎</span></div><div class="site-feature-art" style="background:' + c[3] + '"><div style="background:' + c[1] + '"></div><span style="background:' + c[2] + '"></span><i style="border-color:' + c[0] + '"></i></div></div>';
    h += '<div class="site-testimonial" style="background:' + c[0] + ';color:' + c[4] + '"><small>07 / TÉMOIGNAGE</small><div class="site-stars" style="color:' + c[3] + '">✦ ✦ ✦ ✦ ✦</div><blockquote>« Une expérience pensée avec soin, jusque dans les moindres détails. »</blockquote><span>— TÉMOIGNAGE FICTIF · APERÇU DE MISE EN PAGE</span></div>';
    h += '<div class="site-contact" data-sec="contact" style="background:' + c[1] + ';color:' + ct(c[1]) + '"><div><small>08 / CONTACT</small><h4>Imaginons<br>la suite.</h4></div><span class="site-contact-button" style="background:' + c[4] + ';color:' + ct(c[4]) + '"' + mk('panel:contact') + '>Échangeons ensemble ↗︎</span></div>';
    h += '<div class="site-footer" style="background:' + c[4] + ';color:' + ct(c[4]) + '"><strong' + mk('top', 'Haut de la maquette') + '>' + label + '</strong><div class="site-footer-links" role="navigation" aria-label="Liens du pied de page">' +
      (insta ? '<a href="https://instagram.com/' + esc(insta) + '" target="_blank" rel="noopener">INSTAGRAM</a>' : '') +
      '<b' + mk('contact') + '>CONTACT</b><b' + mk('panel:mentions') + '>MENTIONS LÉGALES</b><b' + mk('top') + '>HAUT DE PAGE ↑</b></div><small>© 2026 · MAQUETTE CONCEPTUELLE</small></div>';
    return h;
  }
  var PRODUCTS = ['Édition Lumière', 'Forme Libre', 'Objet Signature'];
  function productColors(c, i) {
    return { bg: c[[2, 3, 1][i]], tag: c[[0, 2, 4][i]], item: c[[4, 0, 3][i]], trim: c[[1, 4, 2][i]], angle: [-12, 9, -20][i], roles: [[2, 3, 1][i], [4, 0, 3][i], [1, 4, 2][i]] };
  }

  /* ---------- Actions de la maquette ---------- */
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SEC_LABEL = { top: 'accueil', collection: 'univers', projets: 'projets', vision: 'a-propos', approche: 'approche', contact: 'contact' };
  function setAddr(sec) { var s = document.querySelector('#browserFrame .chrome span:last-child'); if (s) s.textContent = 'concept-site.fr/' + (sec && sec !== 'top' ? SEC_LABEL[sec] || sec : '') + ' · aperçu fictif'; }
  function mockDoc() { var f = el('siteMobile'); return device === 'mobile' && f.contentDocument ? f.contentDocument : document; }
  function mockAction(a, doc, node) {
    doc = doc || document;
    if (a.indexOf('panel:') === 0) { if (current) go('#/palette/' + current.id + '/' + a.slice(6)); return; }
    if (a.indexOf('copy:') === 0) { var hx = a.slice(5); copyText(hx, function () { toast('Code ' + hx + ' copié ✓'); }); return; }
    if (a === 'menu') { var nv = node.closest('nav'); var open = nv.classList.toggle('menu-open'); node.setAttribute('aria-expanded', open); return; }
    var openNav = doc.querySelector('.site nav.menu-open'); if (openNav) { openNav.classList.remove('menu-open'); var bu = openNav.querySelector('.site-burger'); if (bu) bu.setAttribute('aria-expanded', 'false'); }
    mkScroll(doc, a);
  }
  function mkScroll(doc, sec) {
    var root = doc.querySelector('.site'); if (!root) return;
    var t = sec === 'top' ? root : root.querySelector('[data-sec="' + sec + '"]'); if (!t) return;
    var win = doc.defaultView, off = doc === document ? el('siteHeader').offsetHeight + 12 : 0;
    win.scrollTo({ top: Math.max(0, t.getBoundingClientRect().top + win.scrollY - off), behavior: reduceMotion ? 'auto' : 'smooth' });
    t.classList.remove('mk-arrive'); void t.offsetWidth; t.classList.add('mk-arrive');
    setAddr(sec);
  }
  function bindMock(doc) {
    if (!doc || doc._mkBound) return; doc._mkBound = true;
    doc.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-mk]'); if (!t) return;
      e.preventDefault(); mockAction(t.dataset.mk, doc, t);
    });
    doc.addEventListener('keydown', function (e) {
      var t = e.target.closest && e.target.closest('[data-mk]');
      if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); mockAction(t.dataset.mk, doc, t); }
      if (e.key === 'Escape' && doc !== document && !el('mkOverlay').hidden) closePanel();
    });
  }

  /* ---------- Pages de détail (panneaux) ---------- */
  var USES = ['Grandes surfaces, fonds de page et respiration.', 'Visuels, accents et appels à l’action.', 'Sections secondaires, encarts et cartes.', 'Bandeaux, illustrations et rythmes.', 'Titres, textes et boutons principaux.'];
  function lum(hex) { var v = [1, 3, 5].map(function (i) { var x = parseInt(hex.slice(i, i + 2), 16) / 255; return x <= .04045 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return v[0] * .2126 + v[1] * .7152 + v[2] * .0722; }
  function ratio(a, b) { var A1 = lum(a), B1 = lum(b); return (Math.max(A1, B1) + .05) / (Math.min(A1, B1) + .05); }
  function level(r) { return r >= 7 ? 'Excellent (AAA)' : r >= 4.5 ? 'Très bon (AA)' : r >= 3 ? 'Titres uniquement' : 'Décoratif uniquement'; }
  function chip(z, i) { return '<button class="mk-chip" data-action="copy-hex" data-hex="' + z + '"><span style="background:' + z + '"></span><b>' + (A.ROLES[i] || 'Complément') + '</b><small>' + z + '</small></button>'; }
  function favLabel() { return current && favs.has(current.id) ? '♥︎ Palette enregistrée' : '♡ Enregistrer la palette'; }
  function panelHTML(name, x) {
    var c = x.colors, ct = contrast, T = mockTexts(x), m;
    var close = '<button class="mk-btn" data-action="close-panel">Fermer</button>';
    var head = function (eyebrow, title, text, bg) { bg = bg || c[1]; return '<div class="mk-hero" style="background:' + bg + ';color:' + ct(bg) + '"><small>' + eyebrow + '</small><h2 id="mkTitle">' + title + '</h2>' + (text ? '<p>' + text + '</p>' : '') + '</div>'; };
    if (name === 'art-du-detail') {
      var rows = [['Texte sur le fond', c[4], c[0]], ['Boutons principaux', ct(c[4]), c[4]], ['Sections nuancées', ct(c[2]), c[2]], ['Bandeaux secondaires', ct(c[3]), c[3]]];
      return { title: 'L’art du détail', html: head('L’ART DU DÉTAIL · PALETTE ' + pad(x.id), esc(x.name), 'Chaque nuance joue un rôle précis. Voici comment cette harmonie habille un site, de la plus grande surface au plus petit détail. Touchez une couleur pour copier son code.') +
        '<div class="mk-bands" style="--n:' + c.length + '">' + c.map(function (z, i) { return '<button class="mk-band" data-action="copy-hex" data-hex="' + z + '" style="background:' + z + ';color:' + ct(z) + '"><small>0' + (i + 1) + '</small><b>' + (A.ROLES[i] || 'Complément') + '</b><span>' + z + '</span><em>' + (USES[i] || 'Touche complémentaire, à doser avec parcimonie.') + '</em></button>'; }).join('') + '</div>' +
        '<section class="mk-type" style="background:' + c[0] + ';color:' + c[4] + '"><div><small>TYPOGRAPHIE &amp; LISIBILITÉ</small><h3>' + T.title + '</h3><p>Un texte courant composé dans la couleur de contraste, posé sur le fond : c’est ainsi que vos visiteurs liront vos pages. Les contrastes ci-contre sont calculés selon les règles d’accessibilité du web (WCAG).</p></div><ul class="mk-ratios">' +
        rows.map(function (r) { var q = ratio(r[1], r[2]); return '<li><span class="mk-sample" style="background:' + r[2] + ';color:' + r[1] + '">Aa</span><span><b>' + r[0] + '</b><small>' + q.toFixed(1) + ' : 1 · ' + level(q) + '</small></span></li>'; }).join('') + '</ul></section>' +
        '<div class="mk-actions"><button class="mk-btn primary" data-action="copy-all">Copier les codes</button><button class="mk-btn" data-action="fav">' + favLabel() + '</button><button class="mk-btn" data-action="mk-go" data-target="approche">Notre approche ↗︎</button>' + close + '</div>' };
    }
    if (name === 'histoire') {
      return { title: 'Notre histoire', html: head('NOTRE HISTOIRE · ' + T.label, 'Une maison, <em>une signature.</em>', '', c[3]) +
        '<section class="mk-text" style="background:' + c[0] + ';color:' + c[4] + '"><div class="mk-cols"><p class="mk-lead">Tout commence par une émotion : celle d’une couleur qui raconte déjà qui vous êtes.</p><div><p>Depuis ses débuts, la maison cultive l’exigence du détail et le goût des belles matières. Chaque création naît d’un dialogue entre savoir-faire et sensibilité, entre l’héritage et l’audace.</p><p>Cette palette prolonge cette histoire : <b>' + esc(x.name) + '</b> associe ' + c.length + ' nuances pensées pour se répondre, du fond le plus discret au contraste le plus affirmé.</p><p class="mk-note">Texte d’exemple : sur votre futur site, cette page accueillera votre propre histoire.</p></div></div></section>' +
        '<div class="mk-actions"><button class="mk-btn primary" data-action="mk-go" data-target="collection">Découvrir la collection ↗︎</button><button class="mk-btn" data-action="mk-go" data-target="approche">Notre approche ↗︎</button>' + close + '</div>' };
    }
    if ((m = /^objet-([1-3])$/.exec(name))) {
      var i = +m[1] - 1, P = productColors(c, i);
      var nav = '<button class="mk-btn" data-action="swap-panel" data-panel="objet-' + ((i + 2) % 3 + 1) + '" aria-label="Objet précédent">← Précédent</button><button class="mk-btn" data-action="swap-panel" data-panel="objet-' + ((i + 1) % 3 + 1) + '" aria-label="Objet suivant">Suivant →</button>';
      return { title: PRODUCTS[i], html: '<div class="mk-product-wrap" style="background:' + c[0] + ';color:' + c[4] + '"><div class="site-product-visual mk-product" style="background:' + P.bg + ';color:' + ct(P.bg) + ';--item:' + P.item + ';--trim:' + P.trim + ';--angle:' + P.angle + 'deg"><span class="product-index">Nº 0' + (i + 1) + ' / 03</span></div>' +
        '<div class="mk-product-copy"><small>OBJETS DE DÉSIR · ' + T.label + '</small><h2 id="mkTitle">' + PRODUCTS[i] + '</h2><p>Une fiche produit où trois nuances de la palette se partagent les rôles : le fond met l’objet en valeur, la matière l’incarne, le liseré le signe.</p><div class="mk-chips">' +
        [['Fond', P.roles[0]], ['Matière', P.roles[1]], ['Liseré', P.roles[2]]].map(function (r) { var z = c[r[1]]; return '<button class="mk-chip" data-action="copy-hex" data-hex="' + z + '"><span style="background:' + z + '"></span><b>' + r[0] + '</b><small>' + z + '</small></button>'; }).join('') +
        '</div><p class="mk-note">Objet fictif, présenté pour illustrer l’association des couleurs.</p></div></div>' +
        '<div class="mk-actions">' + nav + '<button class="mk-btn primary" data-action="mk-go" data-target="projets">Voir toute la sélection</button>' + close + '</div>' };
    }
    if (name === 'contact') {
      var k = cat.site.contact || {}, subject = 'Palette nº ' + pad(x.id) + ' — ' + x.name, body = 'Bonjour,\n\nJ’ai eu un coup de cœur pour la palette « ' + x.name + ' » (nº ' + pad(x.id) + ') : ' + c.join(' · ') + '\n\nLien : ' + paletteURL(x.id) + '\n';
      var direct = (k.email ? '<a class="mk-btn primary" href="mailto:' + esc(k.email) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body) + '">Écrire à ' + esc(k.name || k.email) + '</a>' : '') + (k.phone ? '<a class="mk-btn" href="tel:' + esc(k.phone.replace(/\s/g, '')) + '">Appeler ' + esc(k.phone) + '</a>' : '');
      return { title: 'Échangeons ensemble', html: head('08 / CONTACT · PALETTE ' + pad(x.id), 'Ce concept <em>vous plaît ?</em>', 'Gardez cette palette, envoyez-la à votre designer ou partagez-la : elle contient tout ce qu’il faut pour démarrer votre identité.', c[4]) +
        '<section class="mk-text" style="background:' + c[0] + ';color:' + c[4] + '"><div class="mk-chips">' + c.map(chip).join('') + '</div>' + (direct ? '<p class="mk-note">' + (k.email ? 'Votre e-mail sera prérempli avec le nom, les codes et le lien de la palette.' : '') + '</p>' : '<p class="mk-note">Transmettez les codes ou le lien de la palette à votre designer : il pourra reproduire exactement cette harmonie.</p>') + '</section>' +
        '<div class="mk-actions">' + direct + '<button class="mk-btn' + (direct ? '' : ' primary') + '" data-action="fav">' + favLabel() + '</button><button class="mk-btn" data-action="copy-all">Copier les codes</button><button class="mk-btn" data-action="share">Partager la palette ↗︎</button>' + close + '</div>' };
    }
    if (name === 'mentions') {
      return { title: 'Mentions légales', html: head('MENTIONS LÉGALES', 'Une maquette <em>conceptuelle.</em>', '', c[2]) +
        '<section class="mk-text" style="background:' + c[0] + ';color:' + c[4] + '"><p>Ce site vitrine est une simulation réalisée par <b>' + esc(cat.site.brand || 'L’Art des Associations') + '</b> pour illustrer l’association de couleurs « ' + esc(x.name) + ' ».</p><p>La marque « ' + T.label + ' », les textes, les objets et le témoignage présentés sont fictifs. Aucune donnée n’est collectée et aucune commande n’est possible.</p><p class="mk-note">© 2026 · L’Art des Associations · Maquette conceptuelle.</p></section><div class="mk-actions">' + close + '</div>' };
    }
    if ((m = /^image-(\d+)$/.exec(name))) {
      var imgs = (x.images || []).filter(function (im) { return im && im.src; }), j = +m[1] - 1, im = imgs[j];
      if (!im) return null;
      var n = imgs.length, nav2 = n > 1 ? '<button class="mk-btn" data-action="swap-panel" data-panel="image-' + ((j - 1 + n) % n + 1) + '">← Précédente</button><button class="mk-btn" data-action="swap-panel" data-panel="image-' + ((j + 1) % n + 1) + '">Suivante →</button>' : '';
      return { title: im.caption || 'Mise en situation', html: '<figure class="mk-figure"><img src="' + esc(im.src) + '" alt="' + esc(im.alt || x.name) + '"><figcaption><small>MISE EN SITUATION ' + (j + 1) + ' / ' + n + '</small><span id="mkTitle">' + esc(im.caption || x.name) + '</span></figcaption></figure><div class="mk-actions">' + nav2 + close + '</div>' };
    }
    return null;
  }
  var panelName = '';
  function openPanel(name) {
    var x = current, p = x && panelHTML(name, x);
    if (!p) { if (x) { stack.pop(); location.replace('#/palette/' + x.id); } return; }
    var c = x.colors, sheet = el('mkSheet');
    sheet.style.background = c[0]; sheet.style.color = c[4];
    sheet.style.setProperty('--p4', c[4]); sheet.style.setProperty('--pc4', contrast(c[4]));
    el('mkContent').innerHTML = p.html;
    var wasOpen = !el('mkOverlay').hidden;
    panelName = name;
    el('mkOverlay').hidden = false; document.body.classList.add('sheet-open');
    if (!wasOpen) { sheet.scrollTop = 0; setTimeout(function () { el('mkClose').focus({ preventScroll: true }); }, 30); }
    else sheet.scrollTop = 0;
    document.title = p.title + ' — ' + x.name;
  }
  function refreshPanel() { if (panelName && !el('mkOverlay').hidden) { var s = el('mkSheet').scrollTop; openPanel(panelName); el('mkSheet').scrollTop = s; } }
  function hidePanel() {
    if (el('mkOverlay').hidden) return;
    el('mkOverlay').hidden = true; panelName = '';
    if (el('installSheet').hidden) document.body.classList.remove('sheet-open');
    if (current) document.title = current.name + ' — L’Art des Associations';
  }
  function closePanel(after) {
    if (!current) { hidePanel(); return; }
    if (stack.length > 1 && stack[stack.length - 2] === '#/palette/' + current.id) history.back();
    else { stack.pop(); location.replace('#/palette/' + current.id); }
    if (after) setTimeout(after, 380);
  }
  function paletteURL(id) { return location.href.replace(/[?#].*$/, '') + '#/palette/' + id; }

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
    el('situationsGrid').innerHTML = imgs.map(function (m, i) { return '<figure><button class="situation" data-action="open-panel" data-panel="image-' + (i + 1) + '" aria-label="Agrandir l’image ' + (i + 1) + '"><img src="' + esc(m.src) + '" alt="' + esc(m.alt || x.name) + '" loading="lazy" decoding="async"></button>' + (m.caption ? '<figcaption>' + esc(m.caption) + '</figcaption>' : '') + '</figure>'; }).join('');
    setAddr('top');
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
      frame.onload = function () { bindMock(frame.contentDocument); };
    }
  }

  function updateFavBtn() { if (!current) return; el('favBtn').textContent = favs.has(current.id) ? '♥︎ Enregistrée' : '♡ Enregistrer'; el('favCount').textContent = favs.size; }
  function toggleFav() {
    if (!current) return;
    favs.has(current.id) ? favs.delete(current.id) : favs.add(current.id);
    store.set('ada:favoris', Array.from(favs));
    updateFavBtn(); refreshPanel();
    if (activeFam === 'favoris' && el('panel').classList.contains('active')) renderTiles();
    toast(favs.has(current.id) ? 'Ajoutée à vos inspirations ♥︎' : 'Retirée de vos inspirations');
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
    t.hidden = false; t._action = action; document.body.classList.add('has-toast');
    clearTimeout(toastTimer);
    if (!actionLabel) toastTimer = setTimeout(function () { t.hidden = true; document.body.classList.remove('has-toast'); }, 2600);
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
      var url = paletteURL(current.id);
      if (navigator.share) navigator.share({ title: current.name + ' — L’Art des Associations', text: current.colors.join(' · '), url: url }).catch(function () { });
      else copyText(url, function () { toast('Lien de la palette copié ✓'); });
    }
    else if (a === 'device') { device = b.dataset.device; renderDevice(); }
    else if (a === 'clear-all') { el('allSearch').value = ''; el('intensityAll').value = ''; renderAll(); }
    else if (a === 'install') { if (deferredPrompt) installNow(); else openInstall(); }
    else if (a === 'install-now') installNow();
    else if (a === 'close-install') closeInstall();
    else if (a === 'reload') location.reload();
    else if (a === 'copy-hex') copyText(b.dataset.hex, function () { toast('Code ' + b.dataset.hex + ' copié ✓'); });
    else if (a === 'open-panel' && current) go('#/palette/' + current.id + '/' + b.dataset.panel);
    else if (a === 'swap-panel' && current) { stack.pop(); location.replace('#/palette/' + current.id + '/' + b.dataset.panel); }
    else if (a === 'close-panel') closePanel();
    else if (a === 'mk-go') { var tg = b.dataset.target; closePanel(function () { mockAction(tg, mockDoc()); }); }
    else if (a === 'to-families') { var tgt = el(cat.site.showFamilies === false ? 'allGallery' : 'familiesBlock'); window.scrollTo({ top: tgt.getBoundingClientRect().top + window.scrollY - el('siteHeader').offsetHeight - 10, behavior: reduceMotion ? 'auto' : 'smooth' }); }
    else if (a === 'to-gallery') { homeScroll = 0; go('#/'); setTimeout(function () { var g = el('allGallery'); window.scrollTo({ top: g.getBoundingClientRect().top + window.scrollY - el('siteHeader').offsetHeight - 10, behavior: reduceMotion ? 'auto' : 'smooth' }); }, 80); }
    else if (a === 'clear-fam') { el('search').value = ''; el('intensityFam').value = ''; renderTiles(); }
    else if (a === 'top') window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    else if (a === 'toast-action') { var t = el('toast'); t.hidden = true; t._action && t._action(); }
  });
  el('installSheet').addEventListener('click', function (e) { if (e.target === el('installSheet')) closeInstall(); });
  el('mkOverlay').addEventListener('click', function (e) { if (e.target === el('mkOverlay')) closePanel(); });
  bindMock(document);
  // Bouton « haut de page »
  var topBtn = el('toTop'), ticking = false;
  window.addEventListener('scroll', function () { if (ticking) return; ticking = true; requestAnimationFrame(function () { topBtn.hidden = window.scrollY < 900; ticking = false; }); }, { passive: true });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !el('installSheet').hidden) { closeInstall(); return; }
    if (e.key === 'Escape' && !el('mkOverlay').hidden) { closePanel(); return; }
    if (!el('mkOverlay').hidden) return;
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
