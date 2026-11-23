/* L’Art des Associations — espace d’administration
   Les données sont enregistrées dans le dépôt GitHub de la propriétaire (data/catalogue.json, media/).
   Chaque publication = une version datée et restaurable. La clé d’accès reste sur l’appareil. */
(function () {
  'use strict';
  var A = window.ADA, esc = A.esc;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function mkStore(area) {
    return {
      get: function (k, d) { try { var v = area.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
      set: function (k, v) { try { area.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
      del: function (k) { try { area.removeItem(k); } catch (e) { } }
    };
  }
  var LS = mkStore(localStorage), SS = mkStore(sessionStorage);
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var RULE_LABELS = { Roses: 'teintes roses', Rouges: 'teintes rouges', Oranges: 'teintes orangées', Jaunes: 'teintes jaunes', Verts: 'teintes vertes', Bleus: 'teintes bleues', Violets: 'teintes violettes', Neutres: 'teintes neutres' };
  var INT_LABELS = { pastel: 'pastel', nude: 'nude & doux', vif: 'vif', flashy: 'flashy & néon', profond: 'profond' };

  var S = {
    mode: null, cfg: null, token: null, cat: null, base: null, baseStr: '', baseSha: null,
    view: 'dashboard', media: null, mediaPreview: {}, edit: null, editIsNew: false, editDirty: false,
    pq: '', pf: '', plimit: 150, live: null, remoteDraft: null, staleDraft: null
  };

  /* ================= GitHub ================= */
  function repoBase() { return 'https://api.github.com/repos/' + encodeURIComponent(S.cfg.owner) + '/' + encodeURIComponent(S.cfg.repo); }
  function encPath(p) { return p.split('/').map(encodeURIComponent).join('/'); }
  function ghMessage(status, msg) {
    if (status === 401) return 'Clé d’accès refusée ou expirée. Créez une nouvelle clé puis reconnectez-vous.';
    if (status === 403) return /rate limit/i.test(msg || '') ? 'Trop de requêtes vers GitHub : patientez quelques minutes.' : 'Accès refusé : la clé doit avoir l’autorisation « Contents : Read and write » sur ce dépôt.';
    if (status === 404) return 'Introuvable : vérifiez le nom du dépôt (identifiant/nom) et que la clé a bien accès à ce dépôt.';
    if (status === 409) return 'Le catalogue a été modifié depuis un autre appareil. Rechargez la page avant de publier.';
    if (status === 422) return 'GitHub a refusé l’enregistrement (' + (msg || 'données invalides') + ').';
    return 'Erreur GitHub ' + status + (msg ? ' : ' + msg : '') + '.';
  }
  function gh(path, opts) {
    opts = opts || {};
    var headers = { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + S.token, 'X-GitHub-Api-Version': '2022-11-28' };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch(repoBase() + path, { method: opts.method || 'GET', headers: headers, body: opts.body, cache: 'no-store' }).then(function (r) {
      if (r.ok) return r.status === 204 ? null : r.json();
      return r.json().catch(function () { return {}; }).then(function (j) { var e = new Error(ghMessage(r.status, j.message)); e.status = r.status; throw e; });
    }, function () { throw new Error('Connexion impossible. Vérifiez votre accès à internet.'); });
  }
  function b64utf8(str) { return bytesToB64(new TextEncoder().encode(str)); }
  function bytesToB64(bytes) { var bin = ''; for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
  function utf8b64(b64) { var bin = atob(String(b64).replace(/\s/g, '')); var bytes = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); }
  function getFile(path, ref) {
    return gh('/contents/' + encPath(path) + '?ref=' + encodeURIComponent(ref || S.cfg.branch)).then(function (j) {
      if (j.content) return { sha: j.sha, text: utf8b64(j.content) };
      return gh('/git/blobs/' + j.sha).then(function (b) { return { sha: j.sha, text: utf8b64(b.content) }; });
    });
  }
  function putFile(path, b64, message, sha) {
    var body = { message: message, content: b64, branch: S.cfg.branch };
    if (sha) body.sha = sha;
    return gh('/contents/' + encPath(path), { method: 'PUT', body: JSON.stringify(body) });
  }

  /* ================= Données ================= */
  function cleanCatalogue(c) {
    var o = clone(c);
    o.palettes.forEach(function (p) { Object.keys(p).forEach(function (k) { if (k[0] === '_') delete p[k]; }); });
    return o;
  }
  function setBase(cat, sha) { S.base = A.normalize(cat); S.baseStr = JSON.stringify(S.base); S.baseSha = sha || null; }
  var saveTimer;
  function saveDraft(now) {
    clearTimeout(saveTimer);
    var doIt = function () {
      var ok = LS.set('ada:draft', { mode: S.mode, repo: S.mode === 'github' ? S.cfg.owner + '/' + S.cfg.repo : 'demo', baseSha: S.baseSha, savedAt: Date.now(), catalogue: S.cat });
      if (!ok) toast('Le brouillon est trop volumineux pour être conservé sur cet appareil.', true);
    };
    if (now) doIt(); else saveTimer = setTimeout(doIt, 300);
  }
  function change() { saveDraft(); updateStatus(); }

  function diff() {
    var b = S.base, c = S.cat, bm = {}, cm = {}, out = { added: [], removed: [], modified: [], order: false, site: false, families: false, intensities: false };
    b.palettes.forEach(function (p) { bm[p.id] = p; });
    c.palettes.forEach(function (p) { cm[p.id] = p; if (!bm[p.id]) out.added.push(p); else if (JSON.stringify(p) !== JSON.stringify(bm[p.id])) out.modified.push(p); });
    b.palettes.forEach(function (p) { if (!cm[p.id]) out.removed.push(p); });
    var bo = b.palettes.map(function (p) { return p.id; }).filter(function (id) { return cm[id]; }).join();
    var co = c.palettes.map(function (p) { return p.id; }).filter(function (id) { return bm[id]; }).join();
    out.order = bo !== co;
    out.site = JSON.stringify(b.site) !== JSON.stringify(c.site);
    out.families = JSON.stringify(b.families) !== JSON.stringify(c.families);
    out.intensities = JSON.stringify(b.intensities) !== JSON.stringify(c.intensities);
    out.count = out.added.length + out.removed.length + out.modified.length + (out.order ? 1 : 0) + (out.site ? 1 : 0) + (out.families ? 1 : 0) + (out.intensities ? 1 : 0);
    return out;
  }
  function isDirty() { return JSON.stringify(S.cat) !== S.baseStr; }

  function updateStatus() {
    var d = isDirty() ? diff() : { count: 0 };
    var st = $('#status');
    st.className = 'status' + (d.count ? ' dirty' : '');
    st.innerHTML = '<span class="dot"></span><span>' + (d.count ? d.count + ' modification' + (d.count > 1 ? 's' : '') + ' non publiée' + (d.count > 1 ? 's' : '') + ' · brouillon enregistré sur cet appareil' : 'Tout est publié') + '</span>';
    var pill = $('#pendingPill'); pill.hidden = !d.count; pill.textContent = d.count;
  }

  function famOf(p) { return A.paletteFamilyIds(p, S.cat.families); }
  function intOf(p) { return A.paletteIntensityIds(p, S.cat.intensities); }
  function famName(id) { var f = S.cat.families.filter(function (x) { return x.id === id; })[0]; return f ? f.name : id; }
  function nextId() { return S.cat.palettes.reduce(function (m, p) { return Math.max(m, +p.id || 0); }, 0) + 1; }
  function fmtDate(d) { try { return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return d; } }
  function size(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko'; }
  function mediaSrc(path) {
    if (!path) return '';
    if (/^(data:|blob:|https?:)/.test(path)) return path;
    return S.mediaPreview[path] || '../' + path;
  }
  function imgTag(path, alt, cls) { return '<img ' + (cls ? 'class="' + cls + '" ' : '') + 'src="' + esc(mediaSrc(path)) + '" data-media="' + esc(path) + '" alt="' + esc(alt || '') + '" loading="lazy">'; }
  // Image pas encore en ligne : on la récupère directement dans le dépôt
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (img.tagName !== 'IMG' || !img.dataset.media || img.dataset.tried || S.mode !== 'github') return;
    img.dataset.tried = '1';
    var path = img.dataset.media;
    fetch(repoBase() + '/contents/' + encPath(path) + '?ref=' + encodeURIComponent(S.cfg.branch), { headers: { 'Accept': 'application/vnd.github.raw+json', 'Authorization': 'Bearer ' + S.token } })
      .then(function (r) { if (!r.ok) throw 0; return r.blob(); })
      .then(function (b) { S.mediaPreview[path] = URL.createObjectURL(b); $$('img[data-media="' + path.replace(/"/g, '') + '"]').forEach(function (i) { i.src = S.mediaPreview[path]; }); })
      .catch(function () { });
  }, true);

  /* ================= Interface générale ================= */
  var toastT;
  function toast(msg, err) { var t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, err ? 6000 : 3000); }
  function busy(btn, on, label) { if (!btn) return; if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Patientez…'; btn.disabled = true; } else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; } }
  function confirmBox(title, text, okLabel, danger) {
    return new Promise(function (res) {
      var m = layer();
      m.card.innerHTML = '<h2 style="margin:20px 0 6px">' + esc(title) + '</h2><p class="muted">' + text + '</p><div class="modal-foot"><button class="btn" data-x="no">Annuler</button><button class="btn ' + (danger ? 'danger' : 'dark') + '" data-x="ok">' + esc(okLabel || 'Confirmer') + '</button></div>';
      m.card.addEventListener('click', function (e) { var x = e.target.closest('[data-x]'); if (!x) return; m.close(); res(x.dataset.x === 'ok'); });
      $('[data-x=ok]', m.card).focus();
    });
  }
  function promptBox(title, label, value) {
    return new Promise(function (res) {
      var m = layer();
      m.card.innerHTML = '<h2 style="margin:20px 0 6px">' + esc(title) + '</h2><label>' + esc(label) + '<input type="text" value="' + esc(value || '') + '"></label><div class="modal-foot"><button class="btn" data-x="no">Annuler</button><button class="btn dark" data-x="ok">Valider</button></div>';
      var inp = $('input', m.card); inp.focus(); inp.select();
      var done = function (ok) { m.close(); res(ok ? inp.value.trim() : null); };
      m.card.addEventListener('click', function (e) { var x = e.target.closest('[data-x]'); if (x) done(x.dataset.x === 'ok'); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') done(true); });
    });
  }
  // Fenêtres superposées (éditeur + sélecteur d’image, confirmations…)
  var layers = [];
  function layer(side) {
    var wrap = document.createElement('div'); wrap.className = 'modal'; wrap.style.zIndex = 50 + layers.length * 10;
    var card = document.createElement('div'); card.className = 'modal-card' + (side ? '' : ' center'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
    wrap.appendChild(card); document.body.appendChild(wrap);
    var api = { wrap: wrap, card: card, close: function () { wrap.remove(); layers = layers.filter(function (l) { return l !== api; }); } };
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap && !side) api.close(); });
    layers.push(api); return api;
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !layers.length) return;
    var top = layers[layers.length - 1];
    if (top === S.editorLayer) closeEditor(); else top.close();
  });

  function setView(v) {
    S.view = v;
    $$('#tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === v); });
    render();
    window.scrollTo(0, 0);
  }
  function render() {
    var v = S.view, h = '';
    if (v === 'dashboard') h = viewDashboard();
    else if (v === 'palettes') h = viewPalettes();
    else if (v === 'collections') h = viewCollections();
    else if (v === 'media') h = viewMedia();
    else if (v === 'appearance') h = viewAppearance();
    else if (v === 'publish') h = viewPublish();
    else if (v === 'help') h = viewHelp();
    $('#view').innerHTML = banners() + h;
    if (v === 'media' && !S.media) loadMedia().then(function () { if (S.view === 'media') render(); });
    if (v === 'publish' && !S.history) loadHistory().then(function () { if (S.view === 'publish') render(); });
    if (v === 'dashboard' && !S.recent) loadRecent().then(function () { if (S.view === 'dashboard') render(); });
    updateStatus();
  }
  function banners() {
    var h = '';
    if (S.remoteDraft) h += '<div class="banner"><span>Un brouillon enregistré depuis un autre appareil le ' + esc(fmtDate(S.remoteDraft.savedAt)) + ' est disponible.</span><span><button class="btn sm dark" data-act="load-remote-draft">Le reprendre</button> <button class="btn sm" data-act="dismiss-remote-draft">Ignorer</button></span></div>';
    if (S.staleDraft) h += '<div class="banner"><span>Un brouillon local du ' + esc(fmtDate(S.staleDraft.savedAt)) + ' a été préparé sur une version plus ancienne du catalogue (une publication a eu lieu depuis).</span><span><button class="btn sm dark" data-act="load-stale-draft">Reprendre ce brouillon</button> <button class="btn sm" data-act="dismiss-stale-draft">Ignorer</button></span></div>';
    return h;
  }

  /* ================= Tableau de bord ================= */
  function viewDashboard() {
    var c = S.cat, pub = c.palettes.filter(function (p) { return p.published; }).length;
    var d = isDirty() ? diff() : { count: 0 };
    var recent = S.recent || [];
    return '<div class="view-head"><div><div class="eyebrow">Bonjour</div><h1>Tableau de bord</h1></div></div>' +
      '<div class="cards">' +
      stat(pub, 'palettes publiées') + stat(c.palettes.length - pub, 'palettes masquées') +
      stat(c.families.length, 'collections') + stat(c.palettes.reduce(function (n, p) { return n + p.colors.length; }, 0), 'couleurs') +
      stat(S.media ? S.media.length : '—', 'images') + stat(d.count, 'modifications à publier') +
      '</div>' +
      '<div class="card"><h3 style="margin:0 0 12px;font-size:20px">Actions rapides</h3><div class="quick">' +
      '<button class="btn dark" data-act="new-palette">＋ Ajouter une palette</button>' +
      '<button class="btn" data-view-go="palettes">Modifier les palettes</button>' +
      '<button class="btn" data-act="new-family">＋ Nouvelle collection</button>' +
      '<button class="btn" data-view-go="media">Importer des images</button>' +
      '<button class="btn" data-view-go="appearance">Modifier les textes</button>' +
      '<button class="btn" data-act="preview">Aperçu du catalogue ↗</button>' +
      '<button class="btn" data-act="open-site">Voir le site en ligne ↗</button>' +
      '</div></div>' +
      '<h2 class="section-title">Dernières modifications</h2><div class="card"><ul class="list-plain">' +
      (recent.length ? recent.map(function (r) { return '<li><span>' + esc(r.message) + '</span><span class="small">' + esc(fmtDate(r.date)) + '</span></li>'; }).join('') : '<li class="small">' + (S.recent ? 'Aucune publication pour le moment.' : 'Chargement…') + '</li>') +
      '</ul></div>';
  }
  function stat(n, l) { return '<div class="card stat"><b>' + esc(n) + '</b><span>' + esc(l) + '</span></div>'; }
  function loadRecent() {
    if (S.mode === 'demo') { S.recent = LS.get('ada:demo-history', []).slice(0, 8).map(function (h) { return { message: h.note, date: h.date }; }); return Promise.resolve(); }
    return gh('/commits?sha=' + encodeURIComponent(S.cfg.branch) + '&per_page=8').then(function (list) {
      S.recent = list.map(function (c) { return { message: c.commit.message.split('\n')[0].replace(/^\[skip ci\]\s*/i, ''), date: c.commit.author.date }; });
    }).catch(function () { S.recent = []; });
  }

  /* ================= Palettes ================= */
  function viewPalettes() {
    var q = A.plain(S.pq), f = S.pf;
    var arr = S.cat.palettes.filter(function (p) {
      if (f === 'pub' && !p.published) return false;
      if (f === 'hid' && p.published) return false;
      if (f && f.indexOf('fam:') === 0 && famOf(p).indexOf(f.slice(4)) < 0) return false;
      if (!q) return true;
      return A.plain([p.name, p.id, p.description].concat(p.colors).join(' ')).indexOf(q) > -1;
    });
    var shown = arr.slice(0, S.plimit);
    return '<div class="view-head"><div><div class="eyebrow">' + S.cat.palettes.length + ' palettes</div><h1>Palettes</h1></div><button class="btn dark" data-act="new-palette">＋ Ajouter une palette</button></div>' +
      '<div class="tools"><input type="search" id="pq" placeholder="Rechercher un nom, un numéro, un code HEX…" value="' + esc(S.pq) + '" aria-label="Rechercher">' +
      '<select id="pf" aria-label="Filtrer"><option value="">Toutes</option><option value="pub"' + (f === 'pub' ? ' selected' : '') + '>Publiées</option><option value="hid"' + (f === 'hid' ? ' selected' : '') + '>Masquées</option>' +
      S.cat.families.map(function (x) { return '<option value="fam:' + esc(x.id) + '"' + (f === 'fam:' + x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div>' +
      '<p class="small">' + arr.length + ' résultat' + (arr.length > 1 ? 's' : '') + '. L’ordre de cette liste est l’ordre d’affichage dans le catalogue (flèches ↑ ↓ pour déplacer).</p>' +
      '<div id="plist">' + shown.map(prow).join('') + '</div>' +
      (arr.length > shown.length ? '<div class="more-count"><button class="btn" data-act="more">Afficher plus (' + (arr.length - shown.length) + ' restantes)</button></div>' : '');
  }
  function prow(p) {
    var fam = famOf(p);
    return '<div class="prow' + (p.published ? '' : ' hidden-p') + '" data-id="' + p.id + '">' +
      '<div class="sw">' + p.colors.map(function (c) { return '<span style="background:' + c + '"></span>'; }).join('') + '</div>' +
      '<div class="pid">Nº ' + A.pad(p.id) + '</div>' +
      '<div class="pname"><b>' + esc(p.name) + '</b><div class="tags">' + (p.published ? '' : '<span class="tag off">Masquée</span>') + fam.slice(0, 4).map(function (id) { return '<span class="tag">' + esc(famName(id)) + '</span>'; }).join('') + (p.images.length ? '<span class="tag">' + p.images.length + ' image' + (p.images.length > 1 ? 's' : '') + '</span>' : '') + '</div></div>' +
      '<div class="pact"><button class="btn sm dark" data-act="edit" data-id="' + p.id + '">Modifier</button>' +
      '<button class="btn sm" data-act="toggle-pub" data-id="' + p.id + '">' + (p.published ? 'Masquer' : 'Publier') + '</button>' +
      '<button class="btn sm" data-act="dup" data-id="' + p.id + '">Dupliquer</button>' +
      '<button class="btn sm" data-act="up" data-id="' + p.id + '" aria-label="Monter">↑</button><button class="btn sm" data-act="down" data-id="' + p.id + '" aria-label="Descendre">↓</button>' +
      '<button class="btn sm danger" data-act="del" data-id="' + p.id + '">Supprimer</button></div></div>';
  }
  function findP(id) { return S.cat.palettes.filter(function (p) { return String(p.id) === String(id); })[0]; }
  function idx(id) { return S.cat.palettes.indexOf(findP(id)); }
  function refreshRow(id) {
    var row = $('.prow[data-id="' + id + '"]'), p = findP(id);
    if (row && p) { var t = document.createElement('div'); t.innerHTML = prow(p); row.replaceWith(t.firstChild); }
    else if (S.view === 'palettes') render();
  }

  /* ---------- Éditeur de palette ---------- */
  function openEditor(p, isNew) {
    S.edit = clone(p); S.editIsNew = !!isNew; S.editDirty = !!isNew;
    S.editPos = isNew ? S.cat.palettes.length + 1 : idx(p.id) + 1;
    S.editorLayer = layer(true);
    renderEditor();
    var first = $('[data-ed=name]', S.editorLayer.card); if (first && isNew) { first.focus(); first.select(); }
  }
  function closeEditor(force) {
    if (!force && S.editDirty) {
      confirmBox('Abandonner les modifications ?', 'Les changements apportés à cette palette ne seront pas conservés.', 'Abandonner', true).then(function (ok) { if (ok) closeEditor(true); });
      return;
    }
    if (S.editorLayer) S.editorLayer.close();
    S.editorLayer = null; S.edit = null;
  }
  function famChecksHTML(p) {
    var rules = p.autoFamilies ? A.autoRules(p.colors) : [];
    return S.cat.families.map(function (f) {
      var auto = p.autoFamilies && f.rule && rules.indexOf(f.rule) > -1;
      var on = auto || p.families.indexOf(f.id) > -1;
      return '<label class="' + (auto ? 'auto' : '') + '"><input type="checkbox" data-fam="' + esc(f.id) + '"' + (on ? ' checked' : '') + (auto ? ' disabled' : '') + '> ' + esc(f.name) + (f.parent ? ' <span class="small">(' + esc(famName(f.parent)) + ')</span>' : '') + (auto ? ' <span class="small">auto</span>' : '') + '</label>';
    }).join('');
  }
  function intChecksHTML(p) {
    return S.cat.intensities.map(function (it) {
      var auto = p.autoIntensities && it.rule && A.intensityRule(p.colors, it.rule);
      var on = auto || p.intensities.indexOf(it.id) > -1;
      return '<label class="' + (auto ? 'auto' : '') + '"><input type="checkbox" data-int="' + esc(it.id) + '"' + (on ? ' checked' : '') + (auto ? ' disabled' : '') + '> ' + esc(it.name) + (auto ? ' <span class="small">auto</span>' : '') + '</label>';
    }).join('');
  }
  function refreshAuto() {
    if (!S.editorLayer) return;
    var f = $('#edFams', S.editorLayer.card), i = $('#edInts', S.editorLayer.card);
    if (f) f.innerHTML = famChecksHTML(S.edit);
    if (i) i.innerHTML = intChecksHTML(S.edit);
  }
  function renderEditor() {
    var p = S.edit, card = S.editorLayer.card, scroll = card.scrollTop;
    var m = S.cat.site.mockup, v = p.mockup.variant;
    var autoV = p.id % 6;
    card.innerHTML =
      '<div class="modal-head"><h2>' + (S.editIsNew ? 'Nouvelle palette' : 'Palette nº ' + A.pad(p.id)) + '</h2><button class="btn" data-ed-act="cancel">Fermer</button></div>' +
      '<div class="preview-tile" id="edPreview">' + previewTile(p) + '</div>' +
      '<div class="fieldset"><h3>Informations</h3>' +
      '<label>Nom de la palette<input type="text" data-ed="name" value="' + esc(p.name) + '" maxlength="80"></label>' +
      '<label>Description <span class="small">(facultative — affichée sur la fiche)</span><textarea data-ed="description" maxlength="600">' + esc(p.description) + '</textarea></label>' +
      '<div class="two"><label class="check" style="margin-top:16px"><input type="checkbox" data-ed-bool="published"' + (p.published ? ' checked' : '') + '> Visible dans le catalogue</label>' +
      '<label>Position dans le catalogue<input type="number" min="1" max="' + (S.cat.palettes.length + (S.editIsNew ? 1 : 0)) + '" data-ed-pos value="' + S.editPos + '"></label></div></div>' +
      '<div class="fieldset"><h3>Couleurs</h3><p class="small">Les cinq premières couleurs jouent chacune un rôle dans la simulation de site (fond, accent…). Vous pouvez en ajouter jusqu’à 10.</p><div class="colors-edit">' +
      p.colors.map(function (c, i) {
        return '<div class="crow"><input type="color" value="' + c.toLowerCase() + '" data-color="' + i + '" aria-label="Couleur ' + (i + 1) + '"><div><span class="role">' + (A.ROLES[i] || 'Complément') + '</span><input type="text" class="hexin" data-hex="' + i + '" value="' + c + '" maxlength="7" spellcheck="false" autocapitalize="characters"></div>' +
          '<div class="cbtns"><button class="btn sm" data-ed-act="cup" data-i="' + i + '" aria-label="Monter"' + (i ? '' : ' disabled') + '>↑</button><button class="btn sm" data-ed-act="cdown" data-i="' + i + '" aria-label="Descendre"' + (i < p.colors.length - 1 ? '' : ' disabled') + '>↓</button>' +
          '<button class="btn sm danger" data-ed-act="cdel" data-i="' + i + '" aria-label="Retirer"' + (p.colors.length > 5 ? '' : ' disabled') + '>×</button></div></div>';
      }).join('') + '</div>' +
      (p.colors.length < 10 ? '<button class="btn" style="margin-top:10px" data-ed-act="cadd">＋ Ajouter une couleur</button>' : '') + '</div>' +
      '<div class="fieldset"><h3>Familles et collections</h3>' +
      '<label class="check"><input type="checkbox" data-ed-bool="autoFamilies"' + (p.autoFamilies ? ' checked' : '') + '> Classement automatique d’après les couleurs (recommandé)</label>' +
      '<p class="small">Les familles marquées « auto » sont déduites des couleurs. Cochez en plus les collections thématiques de votre choix.</p><div class="checks" id="edFams">' + famChecksHTML(p) + '</div></div>' +
      '<div class="fieldset"><h3>Intensité</h3>' +
      '<label class="check"><input type="checkbox" data-ed-bool="autoIntensities"' + (p.autoIntensities ? ' checked' : '') + '> Intensité automatique d’après les couleurs</label><div class="checks" id="edInts">' + intChecksHTML(p) + '</div></div>' +
      '<div class="fieldset"><h3>Simulation de site vitrine</h3>' +
      '<label>Mise en page<select data-ed-mock="variant"><option value="auto"' + (v === 'auto' ? ' selected' : '') + '>Automatique (mise en page ' + (autoV + 1) + ')</option>' + [0, 1, 2, 3, 4, 5].map(function (i) { return '<option value="' + i + '"' + (String(v) === String(i) ? ' selected' : '') + '>Mise en page ' + (i + 1) + ' — ' + esc(m.titles[i]) + '</option>'; }).join('') + '</select></label>' +
      '<div class="two"><label>Nom de marque affiché<input type="text" data-ed-mock="label" value="' + esc(p.mockup.label) + '" placeholder="' + esc(m.labels[v === 'auto' ? autoV : +v]) + '"></label>' +
      '<label>Grand titre<input type="text" data-ed-mock="title" value="' + esc(p.mockup.title) + '" placeholder="' + esc(m.titles[v === 'auto' ? autoV : +v]) + '"></label></div>' +
      '<p class="small">Laissez vide pour garder les textes par défaut. <button class="btn link" data-ed-act="preview">Voir la simulation complète ↗</button></p></div>' +
      '<div class="fieldset"><h3>Mises en situation (images)</h3><p class="small">Photos ou visuels affichés sous la simulation : vitrine, carte de visite, intérieur…</p><div class="imgs">' +
      p.images.map(function (im, i) {
        return '<div class="irow">' + imgTag(im.src, im.alt) + '<div><input type="text" data-img-cap="' + i + '" value="' + esc(im.caption || '') + '" placeholder="Légende (facultative)"><input type="text" style="margin-top:4px" data-img-alt="' + i + '" value="' + esc(im.alt || '') + '" placeholder="Description pour l’accessibilité"></div>' +
          '<div class="cbtns" style="display:flex;flex-direction:column;gap:3px"><button class="btn sm" data-ed-act="iup" data-i="' + i + '"' + (i ? '' : ' disabled') + '>↑</button><button class="btn sm danger" data-ed-act="idel" data-i="' + i + '">×</button></div></div>';
      }).join('') + '</div><button class="btn" style="margin-top:10px" data-ed-act="iadd">＋ Ajouter une image</button></div>' +
      '<div class="modal-foot"><span>' + (S.editIsNew ? '' : '<button class="btn danger" data-ed-act="delete">Supprimer</button> <button class="btn" data-ed-act="duplicate">Dupliquer</button>') + '</span>' +
      '<span><button class="btn" data-ed-act="cancel">Annuler</button> <button class="btn dark" data-ed-act="save">Enregistrer</button></span></div>';
    card.scrollTop = scroll;
  }
  function previewTile(p) {
    var c = p.colors;
    return '<div class="mini" style="background:' + c[0] + '"><div class="mini-copy" style="color:' + A.contrast(c[0]) + '"><small>CONCEPT ' + A.pad(p.id) + '</small><b>' + esc(p.name || 'Sans nom') + '</b><i style="background:' + c[3] + '"></i></div><div class="mini-art" style="background:' + c[1] + ';color:' + c[4] + '"></div></div><div class="sw" style="height:16px;border-radius:0">' + c.map(function (z) { return '<span style="background:' + z + '"></span>'; }).join('') + '</div>';
  }
  function edPreview() { var e = $('#edPreview'); if (e) e.innerHTML = previewTile(S.edit); }

  function saveEditor() {
    var p = S.edit;
    p.name = (p.name || '').trim();
    if (!p.name) { toast('Donnez un nom à la palette.', true); return false; }
    var bad = $$('.hexin', S.editorLayer.card).filter(function (i) { return !A.normHex(i.value); });
    if (bad.length) { bad[0].focus(); toast('Un code couleur n’est pas valide (format attendu : #A1B2C3).', true); return false; }
    p.colors = p.colors.map(A.normHex);
    var list = S.cat.palettes, pos = Math.max(1, Math.min(+S.editPos || list.length + 1, list.length + (S.editIsNew ? 1 : 0))) - 1;
    if (S.editIsNew) list.splice(pos, 0, p);
    else { var i = idx(p.id); list.splice(i, 1); list.splice(Math.min(pos, list.length), 0, p); }
    change();
    var wasNew = S.editIsNew;
    closeEditor(true);
    toast(wasNew ? 'Palette ajoutée au brouillon ✓' : 'Modifications enregistrées dans le brouillon ✓');
    if (wasNew && S.view !== 'palettes') { S.pq = ''; S.pf = ''; setView('palettes'); }
    else if (S.view === 'palettes' && !wasNew && pos === i) refreshRow(p.id); else render();
    return true;
  }

  function newPalette() {
    var p = { id: nextId(), name: 'Nouvelle palette', colors: ['#F7F2EC', '#E2CBBF', '#C18E85', '#7E5B57', '#3A2C2A'], description: '', published: true, autoFamilies: true, families: [], autoIntensities: true, intensities: [], mockup: { variant: 'auto', label: '', title: '' }, images: [] };
    openEditor(p, true);
  }
  function duplicate(id) {
    var src = findP(id); if (!src) return;
    var p = clone(src); p.id = nextId(); p.name = src.name + ' (copie)'; p.published = false;
    S.cat.palettes.splice(idx(id) + 1, 0, p); change();
    toast('Copie créée (masquée) : modifiez-la puis rendez-la visible.');
    return p;
  }
  function removePalette(id) {
    var p = findP(id); if (!p) return Promise.resolve(false);
    return confirmBox('Supprimer « ' + p.name + ' » ?', 'La palette sera retirée du brouillon. Tant que vous n’avez pas publié, rien ne change en ligne. Après publication, vous pourrez toujours la retrouver grâce à l’historique des versions.', 'Supprimer', true).then(function (ok) {
      if (!ok) return false;
      S.cat.palettes.splice(idx(id), 1); change(); toast('Palette supprimée du brouillon.'); return true;
    });
  }

  /* ================= Collections ================= */
  function viewCollections() {
    var fams = S.cat.families, roots = fams.filter(function (f) { return !f.parent || !fams.some(function (x) { return x.id === f.parent; }); });
    var rows = '';
    roots.forEach(function (f) { rows += frow(f, false); fams.filter(function (x) { return x.parent === f.id; }).forEach(function (s) { rows += frow(s, true); }); });
    return '<div class="view-head"><div><div class="eyebrow">' + fams.length + ' collections</div><h1>Collections</h1></div><button class="btn dark" data-act="new-family">＋ Nouvelle collection</button></div>' +
      '<p class="small">Les familles de couleurs se remplissent automatiquement d’après les codes HEX. Les collections thématiques (ex. « Mariage », « Restaurants ») se composent à la main. Une sous-catégorie apparaît dans sa collection parente.</p>' +
      rows +
      '<h2 class="section-title">Intensités</h2><p class="small">Filtres proposés aux visiteurs. Les intensités automatiques sont calculées d’après les couleurs ; vous pouvez en créer d’autres et les attribuer à la main dans chaque palette.</p>' +
      S.cat.intensities.map(function (it, i) {
        var n = S.cat.palettes.filter(function (p) { return intOf(p).indexOf(it.id) > -1; }).length;
        return '<div class="frow"><div class="small">' + (it.rule ? 'Auto : ' + esc(INT_LABELS[it.rule] || it.rule) : 'Manuelle') + '</div><div><input type="text" data-int-name="' + i + '" value="' + esc(it.name) + '" aria-label="Nom de l’intensité"><span class="small">' + n + ' palettes</span></div>' +
          '<div class="pact"><button class="btn sm" data-act="int-up" data-i="' + i + '"' + (i ? '' : ' disabled') + '>↑</button><button class="btn sm danger" data-act="int-del" data-i="' + i + '">Supprimer</button></div></div>';
      }).join('') + '<button class="btn" data-act="int-add">＋ Nouvelle intensité</button>';
  }
  function frow(f, sub) {
    var n = A.familyMembers(f.id, S.cat).length;
    return '<div class="frow' + (sub ? ' sub' : '') + '"><div class="band">' + f.swatches.map(function (c) { return '<span style="background:' + esc(c) + '"></span>'; }).join('') + '</div>' +
      '<div><b>' + esc(f.name) + '</b>' + (f.visible === false ? ' <span class="tag off">Masquée</span>' : '') + '<div class="small">' + (f.rule ? 'Automatique · ' + esc(RULE_LABELS[f.rule] || f.rule) : 'Thématique · choix manuel') + ' · ' + n + ' palettes' + (sub ? ' · sous-catégorie de ' + esc(famName(f.parent)) : '') + '</div></div>' +
      '<div class="pact"><button class="btn sm dark" data-act="fam-edit" data-id="' + esc(f.id) + '">Modifier</button>' + (f.rule ? '' : '<button class="btn sm" data-act="fam-pick" data-id="' + esc(f.id) + '">Choisir les palettes</button>') +
      '<button class="btn sm" data-act="fam-up" data-id="' + esc(f.id) + '" aria-label="Monter">↑</button><button class="btn sm" data-act="fam-down" data-id="' + esc(f.id) + '" aria-label="Descendre">↓</button>' +
      '<button class="btn sm danger" data-act="fam-del" data-id="' + esc(f.id) + '">Supprimer</button></div></div>';
  }
  function findF(id) { return S.cat.families.filter(function (f) { return f.id === id; })[0]; }
  function editFamily(f, isNew) {
    var e = clone(f), m = layer();
    var draw = function () {
      m.card.innerHTML = '<div class="modal-head"><h2>' + (isNew ? 'Nouvelle collection' : esc(f.name)) + '</h2></div>' +
        '<label>Nom<input type="text" data-f="name" value="' + esc(e.name) + '"></label>' +
        '<label>Description <span class="small">(facultative)</span><textarea data-f="description">' + esc(e.description || '') + '</textarea></label>' +
        '<label>Contenu<select data-f="rule"><option value="">Thématique — je choisis les palettes</option>' + A.RULES.map(function (r) { return '<option value="' + r + '"' + (e.rule === r ? ' selected' : '') + '>Automatique — palettes contenant des ' + RULE_LABELS[r] + '</option>'; }).join('') + '</select></label>' +
        '<label>Sous-catégorie de<select data-f="parent"><option value="">— Aucune (collection principale)</option>' + S.cat.families.filter(function (x) { return x.id !== e.id && !x.parent; }).map(function (x) { return '<option value="' + esc(x.id) + '"' + (e.parent === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label>' +
        '<label>Couleurs de la vignette</label><div style="display:flex;gap:8px;margin-top:6px">' + e.swatches.map(function (c, i) { return '<input type="color" data-sw="' + i + '" value="' + esc(c).toLowerCase() + '" style="width:60px;height:44px;border:1px solid var(--line);border-radius:8px;padding:2px">'; }).join('') + '</div>' +
        '<label class="check" style="margin-top:14px"><input type="checkbox" data-f-bool="visible"' + (e.visible !== false ? ' checked' : '') + '> Visible sur la page d’accueil</label>' +
        '<div class="modal-foot"><button class="btn" data-x="cancel">Annuler</button><button class="btn dark" data-x="save">Enregistrer</button></div>';
    };
    draw();
    m.card.addEventListener('input', function (ev) {
      var t = ev.target;
      if (t.dataset.f) e[t.dataset.f] = t.value;
      if (t.dataset.sw) e.swatches[+t.dataset.sw] = t.value.toUpperCase();
      if (t.dataset.fBool) e[t.dataset.fBool] = t.checked;
    });
    m.card.addEventListener('change', function (ev) { var t = ev.target; if (t.dataset.f) e[t.dataset.f] = t.value; if (t.dataset.fBool) e[t.dataset.fBool] = t.checked; });
    m.card.addEventListener('click', function (ev) {
      var x = ev.target.closest('[data-x]'); if (!x) return;
      if (x.dataset.x === 'cancel') { m.close(); return; }
      e.name = (e.name || '').trim(); if (!e.name) { toast('Donnez un nom à la collection.', true); return; }
      if (isNew) {
        var id = A.slug(e.name), base = id, k = 2; while (findF(id)) id = base + '-' + k++;
        e.id = id; S.cat.families.push(e);
      } else S.cat.families[S.cat.families.indexOf(f)] = e;
      S.cat.families.forEach(function (x) { if (x.parent === e.id && e.parent) x.parent = e.parent; });
      change(); m.close(); render(); toast('Collection enregistrée dans le brouillon ✓');
      if (isNew && !e.rule) pickPalettes(e);
    });
    $('[data-f=name]', m.card).focus();
  }
  function pickPalettes(f) {
    var m = layer(true), q = '';
    var draw = function () {
      var arr = S.cat.palettes.filter(function (p) { return !q || A.plain(p.name + ' ' + p.id).indexOf(q) > -1; });
      $('#pickList', m.card).innerHTML = arr.map(function (p) {
        var on = p.families.indexOf(f.id) > -1;
        return '<label class="check prow" style="grid-template-columns:auto 80px 1fr;margin-bottom:4px"><input type="checkbox" data-pid="' + p.id + '"' + (on ? ' checked' : '') + '><div class="sw" style="height:28px">' + p.colors.map(function (c) { return '<span style="background:' + c + '"></span>'; }).join('') + '</div><span>' + esc(p.name) + ' <span class="small">nº ' + p.id + '</span></span></label>';
      }).join('');
      $('#pickCount', m.card).textContent = S.cat.palettes.filter(function (p) { return p.families.indexOf(f.id) > -1; }).length + ' palettes sélectionnées';
    };
    m.card.innerHTML = '<div class="modal-head"><h2>' + esc(f.name) + '</h2><button class="btn dark" data-x="done">Terminé</button></div><p class="small" id="pickCount"></p><input type="search" placeholder="Rechercher une palette…" id="pickQ"><div id="pickList" style="margin-top:10px"></div>';
    draw();
    $('#pickQ', m.card).addEventListener('input', function (e) { q = A.plain(e.target.value); draw(); });
    m.card.addEventListener('change', function (e) {
      var id = e.target.dataset.pid; if (!id) return;
      var p = findP(id), i = p.families.indexOf(f.id);
      if (e.target.checked && i < 0) p.families.push(f.id); else if (!e.target.checked && i > -1) p.families.splice(i, 1);
      change(); $('#pickCount', m.card).textContent = S.cat.palettes.filter(function (x) { return x.families.indexOf(f.id) > -1; }).length + ' palettes sélectionnées';
    });
    m.card.addEventListener('click', function (e) { if (e.target.closest('[data-x=done]')) { m.close(); render(); } });
  }
  function moveFamily(id, dir) {
    var fams = S.cat.families, f = findF(id), i = fams.indexOf(f), j = i + dir;
    while (j >= 0 && j < fams.length && (fams[j].parent || '') !== (f.parent || '')) j += dir;
    if (j < 0 || j >= fams.length) return;
    fams[i] = fams[j]; fams[j] = f; change(); render();
  }

  /* ================= Médias ================= */
  function loadMedia() {
    if (S.mode === 'demo') { S.media = LS.get('ada:demo-media', []); return Promise.resolve(); }
    return gh('/contents/media?ref=' + encodeURIComponent(S.cfg.branch)).then(function (list) {
      S.media = list.filter(function (f) { return f.type === 'file' && /\.(webp|jpe?g|png|gif|avif)$/i.test(f.name); }).map(function (f) { return { path: f.path, name: f.name, size: f.size, sha: f.sha }; }).reverse();
    }).catch(function (e) { S.media = []; if (e.status !== 404) toast(e.message, true); });
  }
  function usedBy(path) {
    var out = [];
    S.cat.palettes.forEach(function (p) { if (p.images.some(function (i) { return i.src === path; })) out.push('palette « ' + p.name + ' »'); });
    if (S.cat.site.logo === path) out.push('le logo'); if (S.cat.site.heroImage === path) out.push('la bannière d’accueil');
    if (S.baseStr.indexOf(JSON.stringify(path)) > -1 && !out.length) out.push('la version actuellement en ligne');
    return out;
  }
  function viewMedia(picking) {
    var list = S.media;
    return (picking ? '' : '<div class="view-head"><div><div class="eyebrow">' + (list ? list.length : '…') + ' images</div><h1>Médias</h1></div></div>') +
      '<div class="drop" id="drop"><p style="margin:0 0 10px"><b>Glissez vos images ici</b> ou</p><button class="btn dark" data-act="upload">Importer depuis cet appareil</button><p class="small" style="margin:10px 0 0">JPEG, PNG, WebP… Les images sont automatiquement redimensionnées (1800 px max) et compressées en WebP avant l’envoi.</p></div>' +
      (list ? (list.length ? '<div class="mgrid">' + list.map(function (m) {
        var path = m.path || m.src;
        return '<div class="mitem' + (picking ? ' pick' : '') + '" ' + (picking ? 'data-pick="' + esc(path) + '"' : '') + '>' + imgTag(path, m.name) + '<div class="mi"><span title="' + esc(m.name) + '">' + esc(m.name) + '</span><span class="small">' + size(m.size || 0) + '</span>' + (picking ? '' : '<button class="btn sm danger" data-act="media-del" data-path="' + esc(path) + '">Supprimer</button>') + '</div></div>';
      }).join('') + '</div>' : '<p class="muted">Aucune image pour le moment.</p>') : '<p class="muted">Chargement des images…</p>');
  }
  function loadImage(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { res(img); }; img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Format non pris en charge par ce navigateur : ' + file.name)); };
      img.src = url;
    });
  }
  function optimize(file) {
    return loadImage(file).then(function (img) {
      var max = 1800, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
      var cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      var toBlob = function (type, q) { return new Promise(function (r) { cv.toBlob(r, type, q); }); };
      return toBlob('image/webp', .82).then(function (b) {
        if (b && b.type === 'image/webp') return { blob: b, ext: 'webp' };
        return toBlob('image/jpeg', .84).then(function (j) { return { blob: j, ext: 'jpg' }; });
      });
    });
  }
  function uploadFiles(files) {
    files = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type) && !/svg/.test(f.type); });
    if (!files.length) { toast('Choisissez des images (JPEG, PNG, WebP…).', true); return Promise.resolve([]); }
    var done = [], chain = Promise.resolve();
    toast('Optimisation et envoi de ' + files.length + ' image' + (files.length > 1 ? 's' : '') + '…');
    files.forEach(function (file) {
      chain = chain.then(function () { return optimize(file); }).then(function (r) {
        var name = A.slug(file.name.replace(/\.[^.]+$/, '')).slice(0, 40) + '-' + Date.now().toString(36) + '.' + r.ext;
        var path = 'media/' + name;
        if (S.mode === 'demo') {
          return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.readAsDataURL(r.blob); }).then(function (dataUrl) {
            var item = { path: dataUrl, name: name, size: r.blob.size };
            S.media.unshift(item);
            if (!LS.set('ada:demo-media', S.media)) { S.media.shift(); throw new Error('Mémoire locale pleine (mode local).'); }
            done.push(dataUrl);
          });
        }
        return r.blob.arrayBuffer().then(function (buf) {
          return putFile(path, bytesToB64(new Uint8Array(buf)), '[skip ci] Média ajouté : ' + name);
        }).then(function (res) {
          S.mediaPreview[path] = URL.createObjectURL(r.blob);
          (S.media = S.media || []).unshift({ path: path, name: name, size: r.blob.size, sha: res.content.sha });
          done.push(path);
        });
      }).catch(function (e) { toast(e.message, true); });
    });
    return chain.then(function () { if (done.length) toast(done.length + ' image' + (done.length > 1 ? 's importées' : ' importée') + ' ✓'); return done; });
  }
  function deleteMedia(path) {
    var used = usedBy(path);
    if (used.length) { toast('Image utilisée par ' + used.join(', ') + '. Retirez-la (puis publiez) avant de la supprimer.', true); return; }
    confirmBox('Supprimer cette image ?', 'Elle sera définitivement retirée de la médiathèque (elle reste récupérable dans l’historique GitHub).', 'Supprimer', true).then(function (ok) {
      if (!ok) return;
      var item = S.media.filter(function (m) { return (m.path || m.src) === path; })[0];
      var p = S.mode === 'demo' ? Promise.resolve() : gh('/contents/' + encPath(path), { method: 'DELETE', body: JSON.stringify({ message: '[skip ci] Média supprimé : ' + item.name, sha: item.sha, branch: S.cfg.branch }) });
      p.then(function () { S.media.splice(S.media.indexOf(item), 1); if (S.mode === 'demo') LS.set('ada:demo-media', S.media); render(); toast('Image supprimée.'); }).catch(function (e) { toast(e.message, true); });
    });
  }
  // Sélecteur d’image (palettes, logo, bannière)
  function pickMedia(cb) {
    var m = layer(true);
    var draw = function () { m.card.innerHTML = '<div class="modal-head"><h2>Choisir une image</h2><button class="btn" data-x="close">Fermer</button></div>' + viewMedia(true); };
    var ensure = S.media ? Promise.resolve() : loadMedia();
    draw(); ensure.then(draw);
    var handler = function (paths) { draw(); if (paths.length === 1) { m.close(); cb(paths[0]); } };
    S.onUploaded = handler;
    var baseClose = m.close; m.close = function () { if (S.onUploaded === handler) S.onUploaded = null; baseClose(); };
    m.card.addEventListener('click', function (e) {
      if (e.target.closest('[data-x=close]')) { m.close(); return; }
      if (e.target.closest('[data-act=upload]')) { S.onUploaded = handler; }
      var it = e.target.closest('[data-pick]'); if (it) { m.close(); cb(it.dataset.pick); }
    });
  }
  function dropZone(e) { return e.target && e.target.closest ? e.target.closest('#drop') : null; }
  ['dragenter', 'dragover'].forEach(function (t) { document.addEventListener(t, function (e) { var d = dropZone(e); if (d) { e.preventDefault(); d.classList.add('over'); } }); });
  document.addEventListener('dragleave', function (e) { var d = dropZone(e); if (d) d.classList.remove('over'); });
  document.addEventListener('drop', function (e) { var d = dropZone(e); if (!d) return; e.preventDefault(); d.classList.remove('over'); uploadFiles(e.dataTransfer.files).then(afterUpload); });
  function afterUpload(paths) { if (S.onUploaded) { var f = S.onUploaded; S.onUploaded = null; f(paths); } else if (S.view === 'media') render(); }

  /* ================= Apparence ================= */
  var APPEAR = [
    ['Identité', [['brand', 'Nom affiché en haut de page'], ['brandSub', 'Sous-titre du nom'], ['logo', 'Logo (remplace le nom)', 'media']]],
    ['Bannière d’accueil', [['heroEyebrow', 'Surtitre'], ['heroTitle', 'Grand titre', 'area'], ['heroText', 'Texte d’introduction', 'area'], ['heroCta', 'Invitation sous le texte'], ['heroImage', 'Photographie de bannière (remplace la composition graphique)', 'media'], ['heroArtLabel', 'Mention en haut du visuel'], ['heroArtLabelSub', 'Complément de la mention'], ['heroArtText', 'Texte sur le visuel', 'area'], ['heroArtIndex', 'Mention en bas du visuel']]],
    ['Sections de la page d’accueil', [['showFamilies', 'Afficher « Explorer par couleur »', 'bool'], ['familiesTitle', 'Titre des familles'], ['familiesHint', 'Note sous les familles', 'area'], ['showGallery', 'Afficher la galerie complète', 'bool'], ['galleryEyebrow', 'Surtitre de la galerie'], ['galleryTitle', 'Titre de la galerie'], ['galleryText', 'Texte de la galerie', 'area'], ['galleryNote', 'Note sous la galerie', 'area']]],
    ['Fiches palettes et simulations', [['detailDefaultDescription', 'Description par défaut d’une palette', 'area'], ['mockupNote', 'Note sous la simulation', 'area'], ['mockup.titles', 'Grands titres des 6 mises en page', 'list'], ['mockup.labels', 'Noms de marque des 6 mises en page', 'list']]],
    ['Couleurs de l’interface', [['theme.paper', 'Fond', 'color'], ['theme.ink', 'Texte et boutons', 'color'], ['theme.line', 'Filets et bordures', 'color'], ['theme.accent', 'Couleur de mise en avant (focus)', 'color']]],
    ['Contact', [['contact.name', 'Nom (studio, agence…)'], ['contact.message', 'Phrase d’accroche', 'area'], ['contact.email', 'E-mail'], ['contact.phone', 'Téléphone'], ['contact.website', 'Site internet'], ['contact.instagram', 'Instagram (@compte)']]],
    ['Pied de page', [['footer', 'Texte du pied de page', 'area']]]
  ];
  var THEME_DEFAULT = { ink: '#25231f', paper: '#f7f5f0', line: '#e3dfd6', accent: '#25231f' };
  function getPath(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? a : a[k]; }, o); }
  function setPath(o, p, v) { var ks = p.split('.'), last = ks.pop(); ks.forEach(function (k) { o = o[k] = o[k] || {}; }); o[last] = v; }
  function viewAppearance() {
    var s = S.cat.site;
    return '<div class="view-head"><div><div class="eyebrow">Textes, images et couleurs</div><h1>Apparence</h1></div><button class="btn" data-act="preview">Aperçu ↗</button></div>' +
      '<p class="small">Astuces : entourez un mot d’astérisques pour l’écrire en <i>italique</i> (*prend vie.*). Un retour à la ligne crée un saut de ligne. <b>{total}</b> affiche le nombre de palettes publiées, <b>{colors}</b> le nombre de couleurs.</p>' +
      APPEAR.map(function (g) {
        return '<div class="fieldset"><h3>' + esc(g[0]) + '</h3>' + (g[0].indexOf('Couleurs') === 0 ? '<p class="small">Vérifiez la lisibilité dans l’aperçu. <button class="btn link" data-act="theme-reset">Rétablir les couleurs d’origine</button></p>' : '') + '<div class="form-grid">' + g[1].map(function (f) {
          var path = f[0], type = f[2], val = getPath(s, path);
          if (type === 'bool') return '<label class="check" style="margin-top:18px"><input type="checkbox" data-bind="' + path + '" data-type="bool"' + (val !== false ? ' checked' : '') + '> ' + esc(f[1]) + '</label>';
          if (type === 'area') return '<label>' + esc(f[1]) + '<textarea data-bind="' + path + '">' + esc(val || '') + '</textarea></label>';
          if (type === 'color') return '<label>' + esc(f[1]) + '<div class="colorfield"><input type="color" data-bind="' + path + '" data-type="color" value="' + esc(val || '#000000') + '"><input type="text" data-bind="' + path + '" data-type="hex" value="' + esc(val || '') + '" maxlength="7"></div></label>';
          if (type === 'list') return '<div style="grid-column:1/-1"><label>' + esc(f[1]) + '</label><div class="form-grid">' + (val || []).map(function (x, i) { return '<input type="text" style="margin-top:6px" data-bind="' + path + '" data-type="list" data-i="' + i + '" value="' + esc(x) + '" aria-label="Mise en page ' + (i + 1) + '">'; }).join('') + '</div></div>';
          if (type === 'media') return '<div><label>' + esc(f[1]) + '</label><div class="media-field">' + (val ? imgTag(val, '') : '<span class="small">Aucune image</span>') + '<button class="btn sm" data-act="pick-site-media" data-path="' + path + '">Choisir…</button>' + (val ? '<button class="btn sm danger" data-act="clear-site-media" data-path="' + path + '">Retirer</button>' : '') + '</div></div>';
          return '<label>' + esc(f[1]) + '<input type="text" data-bind="' + path + '" value="' + esc(val || '') + '"></label>';
        }).join('') + '</div></div>';
      }).join('');
  }

  /* ================= Publication ================= */
  function viewPublish() {
    var d = diff(), live = S.live;
    var li = function (cls, t) { return '<li class="' + cls + '">' + t + '</li>'; };
    var items = [];
    d.added.forEach(function (p) { items.push(li('add', '＋ Nouvelle palette : ' + esc(p.name))); });
    d.modified.forEach(function (p) { items.push(li('mod', '✎ Palette modifiée : ' + esc(p.name))); });
    d.removed.forEach(function (p) { items.push(li('del', '− Palette supprimée : ' + esc(p.name))); });
    if (d.order) items.push(li('mod', '⇅ Ordre des palettes modifié'));
    if (d.families) items.push(li('mod', '✎ Collections modifiées'));
    if (d.intensities) items.push(li('mod', '✎ Intensités modifiées'));
    if (d.site) items.push(li('mod', '✎ Textes ou apparence modifiés'));
    var hist = S.history;
    return '<div class="view-head"><div><div class="eyebrow">Brouillon · Aperçu · Mise en ligne</div><h1>Publication</h1></div></div>' +
      '<div class="card"><h3 style="margin:0 0 8px;font-size:20px">Modifications en attente</h3>' +
      (items.length ? '<ul class="list-plain diff">' + items.slice(0, 40).join('') + (items.length > 40 ? '<li class="small">… et ' + (items.length - 40) + ' autres</li>' : '') + '</ul>' : '<p class="muted">Aucune modification : le catalogue en ligne est à jour.</p>') +
      '<label>Note de version <span class="small">(facultative, ex. « Ajout de 12 palettes pastel »)</span><input type="text" id="pubNote" maxlength="120"></label>' +
      '<div class="quick" style="margin-top:14px"><button class="btn" data-act="preview">Prévisualiser ↗</button>' +
      '<button class="btn dark" data-act="publish"' + (items.length ? '' : ' disabled') + '>Publier maintenant</button>' +
      (S.mode === 'github' ? '<button class="btn" data-act="save-remote-draft">Enregistrer le brouillon en ligne</button>' : '') +
      '<button class="btn danger" data-act="discard"' + (items.length ? '' : ' disabled') + '>Annuler toutes les modifications</button></div>' +
      '<p class="small">Votre brouillon est enregistré automatiquement sur cet appareil. « Enregistrer le brouillon en ligne » permet de le reprendre depuis un autre appareil (Mac ↔ iPhone) sans rien publier.</p>' +
      (live ? '<div class="live-state' + (live.ok ? '' : ' wait') + '">' + (live.ok ? '✓ Publication en ligne : les visiteurs voient la nouvelle version.' : '⏳ Publication envoyée. Mise en ligne en cours (environ 1 minute)…') + '</div>' : '') +
      '</div>' +
      '<h2 class="section-title">Historique des versions</h2><div class="card"><p class="small" style="margin-top:0">Chaque publication est conservée. « Restaurer » recharge une ancienne version dans le brouillon : vérifiez-la dans l’aperçu, puis publiez.</p><ul class="list-plain">' +
      (hist ? (hist.length ? hist.map(function (h, i) { return '<li><span><b>' + esc(h.message) + '</b><br><span class="small">' + esc(fmtDate(h.date)) + (i === 0 ? ' · version en ligne' : '') + '</span></span><button class="btn sm" data-act="restore" data-ref="' + esc(h.ref) + '">Restaurer</button></li>'; }).join('') : '<li class="small">Aucune version publiée pour le moment.</li>') : '<li class="small">Chargement…</li>') +
      '</ul></div>' +
      '<h2 class="section-title">Sauvegarde</h2><div class="card"><div class="quick">' +
      '<button class="btn" data-act="export">Télécharger une sauvegarde du catalogue (.json)</button>' +
      '<button class="btn" data-act="import">Importer une sauvegarde…</button>' +
      (S.mode === 'github' ? '<button class="btn" data-act="zip">Télécharger tout le projet (.zip)</button>' : '') +
      '</div><p class="small">La sauvegarde contient toutes les palettes, collections et textes. L’archive .zip contient en plus le code source et les images.</p></div>';
  }
  function loadHistory() {
    if (S.mode === 'demo') { S.history = LS.get('ada:demo-history', []).map(function (h, i) { return { message: h.note, date: h.date, ref: 'demo:' + i }; }); return Promise.resolve(); }
    return gh('/commits?path=data/catalogue.json&sha=' + encodeURIComponent(S.cfg.branch) + '&per_page=40').then(function (list) {
      S.history = list.map(function (c) { return { message: c.commit.message.split('\n')[0], date: c.commit.author.date, ref: c.sha }; });
    }).catch(function (e) { S.history = []; toast(e.message, true); });
  }
  function validate(c) {
    var ids = {}, errs = [];
    c.palettes.forEach(function (p) {
      if (ids[p.id]) errs.push('Numéro en double : ' + p.id); ids[p.id] = 1;
      if (!p.name) errs.push('Palette nº ' + p.id + ' sans nom');
      if (p.colors.length < 5 || !p.colors.every(A.validHex)) errs.push('Couleurs invalides : ' + p.name);
    });
    return errs;
  }
  function publish(btn) {
    var errs = validate(S.cat);
    if (errs.length) { toast(errs[0], true); return; }
    var d = diff(), note = ($('#pubNote') || {}).value || '';
    var auto = [d.added.length ? d.added.length + ' ajout(s)' : '', d.modified.length ? d.modified.length + ' modification(s)' : '', d.removed.length ? d.removed.length + ' suppression(s)' : '', d.site ? 'textes' : '', d.families ? 'collections' : ''].filter(Boolean).join(', ');
    var msg = 'Publication : ' + (note.trim() || auto || 'mise à jour');
    var out = cleanCatalogue(S.cat); out.updatedAt = new Date().toISOString();
    busy(btn, true, 'Publication…');
    var p;
    if (S.mode === 'demo') {
      var hist = LS.get('ada:demo-history', []); hist.unshift({ note: msg, date: out.updatedAt, catalogue: out }); hist = hist.slice(0, 12);
      while (hist.length && !LS.set('ada:demo-history', hist)) hist.pop();
      LS.set('ada:demo-published', out);
      p = Promise.resolve({ content: { sha: 'demo-' + out.updatedAt } });
    } else {
      p = putFile('data/catalogue.json', b64utf8(JSON.stringify(out, null, 1)), msg, S.baseSha);
    }
    p.then(function (res) {
      setBase(out, res.content.sha); S.cat = clone(S.base); saveDraft(true);
      S.history = null; S.recent = null;
      S.live = S.mode === 'demo' ? { ok: true } : { ok: false, at: out.updatedAt };
      if (S.mode === 'github') watchLive(out.updatedAt);
      busy(btn, false); render();
      toast(S.mode === 'demo' ? 'Publié en mode local ✓ (téléchargez la sauvegarde pour la mettre en ligne)' : 'Publication envoyée ✓');
    }).catch(function (e) { busy(btn, false); toast(e.message, true); });
  }
  function watchLive(stamp) {
    var tries = 0;
    var tick = function () {
      if (!S.live || S.live.at !== stamp) return;
      tries++;
      fetch('../data/catalogue.json?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
        if (j.updatedAt === stamp) { S.live.ok = true; if (S.view === 'publish') render(); toast('✓ La nouvelle version est en ligne.'); }
        else if (tries < 40) setTimeout(tick, 8000);
      }).catch(function () { if (tries < 40) setTimeout(tick, 8000); });
    };
    setTimeout(tick, 15000);
  }
  function restore(ref) {
    var p = ref.indexOf('demo:') === 0 ? Promise.resolve(LS.get('ada:demo-history', [])[+ref.slice(5)].catalogue) : getFile('data/catalogue.json', ref).then(function (f) { return JSON.parse(f.text); });
    p.then(function (c) {
      return confirmBox('Restaurer cette version ?', 'Elle contient ' + c.palettes.length + ' palettes. Elle remplacera votre brouillon actuel ; rien ne change en ligne tant que vous ne publiez pas.', 'Restaurer dans le brouillon').then(function (ok) {
        if (!ok) return;
        S.cat = A.normalize(c); S.cat.updatedAt = S.base.updatedAt; change(); render();
        toast('Version chargée dans le brouillon. Vérifiez l’aperçu, puis publiez.');
      });
    }).catch(function (e) { toast(e.message, true); });
  }
  function saveRemoteDraft(btn) {
    busy(btn, true, 'Enregistrement…');
    var payload = { savedAt: Date.now(), catalogue: cleanCatalogue(S.cat) };
    getFile('data/brouillon.json').then(function (f) { return f.sha; }, function () { return null; }).then(function (sha) {
      return putFile('data/brouillon.json', b64utf8(JSON.stringify(payload)), '[skip ci] Brouillon enregistré (non publié)', sha);
    }).then(function () { busy(btn, false); toast('Brouillon enregistré en ligne ✓ (non publié)'); }).catch(function (e) { busy(btn, false); toast(e.message, true); });
  }
  function download(name, text) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ================= Aide ================= */
  function viewHelp() {
    return '<div class="help"><div class="view-head"><div><div class="eyebrow">Mode d’emploi</div><h1>Aide</h1></div></div>' +
      '<h2>Le principe</h2><p>Toutes vos modifications vont d’abord dans un <b>brouillon</b>, enregistré automatiquement sur cet appareil. Les visiteurs ne voient rien tant que vous n’avez pas cliqué sur <b>Publier</b>. Après publication, le site se met à jour en une minute environ, et l’application installée chez vos clients récupère les nouveautés à la prochaine ouverture.</p>' +
      '<h2>Ajouter une palette</h2><ol><li>Palettes → <b>＋ Ajouter une palette</b>.</li><li>Donnez un nom, choisissez les couleurs (pipette ou code HEX).</li><li>Les familles et l’intensité se calculent seules ; cochez éventuellement une collection thématique.</li><li><b>Enregistrer</b>, puis <b>Aperçu</b> pour voir le rendu, puis <b>Publier</b>.</li></ol>' +
      '<h2>Masquer plutôt que supprimer</h2><p>« Masquer » retire une palette du catalogue sans la perdre. Une palette supprimée reste récupérable via l’historique des versions.</p>' +
      '<h2>Images</h2><p>Médias → Importer. Depuis l’iPhone, vous pouvez choisir une photo de la photothèque ou en prendre une. Les images sont optimisées automatiquement. Ajoutez-les ensuite à une palette (« Mises en situation ») ou utilisez-les comme logo / bannière dans Apparence.</p>' +
      '<h2>Revenir en arrière</h2><p>Publication → Historique → <b>Restaurer</b>, puis Publier. Avant de publier, « Annuler toutes les modifications » efface le brouillon.</p>' +
      '<h2>Sauvegarde</h2><p>Publication → Sauvegarde. Conservez de temps en temps une sauvegarde .json et l’archive .zip complète.</p>' +
      '<h2>Sécurité</h2><p>Votre clé d’accès n’est jamais publiée. Sur un appareil partagé, décochez « Rester connectée » et utilisez « Se déconnecter ». En cas de perte d’un appareil, supprimez la clé sur github.com → Settings → Developer settings → Personal access tokens.</p></div>';
  }

  /* ================= Événements ================= */
  document.addEventListener('click', function (e) {
    var tab = e.target.closest('#tabs button'); if (tab) { setView(tab.dataset.view); return; }
    var go = e.target.closest('[data-view-go]'); if (go) { setView(go.dataset.viewGo); return; }
    var ed = e.target.closest('[data-ed-act]'); if (ed && S.edit) { editorAction(ed); return; }
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.dataset.act, id = b.dataset.id;
    if (a === 'logout') logout();
    else if (a === 'preview') openPreview();
    else if (a === 'open-site') window.open('../', '_blank', 'noopener');
    else if (a === 'go-publish') setView('publish');
    else if (a === 'new-palette') newPalette();
    else if (a === 'edit') openEditor(findP(id));
    else if (a === 'toggle-pub') { var p = findP(id); p.published = !p.published; change(); refreshRow(id); }
    else if (a === 'dup') { duplicate(id); render(); }
    else if (a === 'del') removePalette(id).then(function (ok) { if (ok) render(); });
    else if (a === 'up' || a === 'down') { var i = idx(id), j = i + (a === 'up' ? -1 : 1), L = S.cat.palettes; if (j >= 0 && j < L.length) { var t = L[i]; L[i] = L[j]; L[j] = t; change(); render(); var row = $('.prow[data-id="' + id + '"]'); row && row.scrollIntoView({ block: 'center' }); } }
    else if (a === 'more') { S.plimit += 300; render(); }
    else if (a === 'new-family') editFamily({ id: '', name: '', rule: '', swatches: ['#F2E6DF', '#C9A9A0', '#6B4A45'], parent: '', visible: true, description: '' }, true);
    else if (a === 'fam-edit') editFamily(findF(id));
    else if (a === 'fam-pick') pickPalettes(findF(id));
    else if (a === 'fam-up') moveFamily(id, -1);
    else if (a === 'fam-down') moveFamily(id, 1);
    else if (a === 'fam-del') {
      var f = findF(id);
      confirmBox('Supprimer la collection « ' + f.name + ' » ?', 'Les palettes ne sont pas supprimées : elles restent visibles dans la galerie et dans leurs autres familles.', 'Supprimer', true).then(function (ok) {
        if (!ok) return;
        S.cat.families.splice(S.cat.families.indexOf(f), 1);
        S.cat.families.forEach(function (x) { if (x.parent === id) x.parent = ''; });
        S.cat.palettes.forEach(function (p) { p.families = p.families.filter(function (x) { return x !== id; }); });
        change(); render();
      });
    }
    else if (a === 'int-add') promptBox('Nouvelle intensité', 'Nom (ex. « Terreux »)').then(function (n) {
      if (!n) return; var iid = A.slug(n), base = iid, k = 2;
      while (S.cat.intensities.some(function (x) { return x.id === iid; })) iid = base + '-' + k++;
      S.cat.intensities.push({ id: iid, name: n, rule: '' }); change(); render();
    });
    else if (a === 'int-up') { var ii = +b.dataset.i, I = S.cat.intensities, tt = I[ii]; I[ii] = I[ii - 1]; I[ii - 1] = tt; change(); render(); }
    else if (a === 'int-del') { var it = S.cat.intensities[+b.dataset.i]; confirmBox('Supprimer l’intensité « ' + it.name + ' » ?', 'Le filtre disparaîtra du catalogue.', 'Supprimer', true).then(function (ok) { if (!ok) return; S.cat.intensities.splice(+b.dataset.i, 1); S.cat.palettes.forEach(function (p) { p.intensities = p.intensities.filter(function (x) { return x !== it.id; }); }); change(); render(); }); }
    else if (a === 'upload') { $('#fileInput').click(); }
    else if (a === 'media-del') deleteMedia(b.dataset.path);
    else if (a === 'pick-site-media') pickMedia(function (path) { setPath(S.cat.site, b.dataset.path, path); change(); render(); });
    else if (a === 'clear-site-media') { setPath(S.cat.site, b.dataset.path, ''); change(); render(); }
    else if (a === 'theme-reset') { S.cat.site.theme = clone(THEME_DEFAULT); change(); render(); }
    else if (a === 'publish') confirmBox('Publier maintenant ?', 'Vos modifications seront visibles par tous les visiteurs d’ici environ une minute.', 'Publier').then(function (ok) { if (ok) publish(b); });
    else if (a === 'discard') confirmBox('Annuler toutes les modifications ?', 'Le brouillon sera remplacé par la version actuellement en ligne.', 'Tout annuler', true).then(function (ok) { if (ok) { S.cat = clone(S.base); change(); render(); } });
    else if (a === 'restore') restore(b.dataset.ref);
    else if (a === 'save-remote-draft') saveRemoteDraft(b);
    else if (a === 'export') download('art-des-associations-sauvegarde-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(cleanCatalogue(S.cat), null, 1));
    else if (a === 'import') $('#importInput').click();
    else if (a === 'zip') window.open('https://github.com/' + encodeURIComponent(S.cfg.owner) + '/' + encodeURIComponent(S.cfg.repo) + '/archive/refs/heads/' + encodeURIComponent(S.cfg.branch) + '.zip', '_blank', 'noopener');
    else if (a === 'load-remote-draft') { S.cat = A.normalize(S.remoteDraft.catalogue); S.remoteDraft = null; change(); render(); toast('Brouillon repris ✓'); }
    else if (a === 'dismiss-remote-draft') { S.remoteDraft = null; render(); }
    else if (a === 'load-stale-draft') { S.cat = A.normalize(S.staleDraft.catalogue); S.staleDraft = null; change(); render(); toast('Brouillon repris : vérifiez-le avant de publier.'); }
    else if (a === 'dismiss-stale-draft') { S.staleDraft = null; render(); }
  });

  function editorAction(b) {
    var a = b.dataset.edAct, p = S.edit, i = +b.dataset.i;
    var mv = function (arr, from, to) { var t = arr[from]; arr[from] = arr[to]; arr[to] = t; };
    if (a === 'cancel') return closeEditor();
    if (a === 'save') return saveEditor();
    S.editDirty = true;
    if (a === 'cadd') p.colors.push(p.colors[p.colors.length - 1]);
    else if (a === 'cdel') p.colors.splice(i, 1);
    else if (a === 'cup') mv(p.colors, i, i - 1);
    else if (a === 'cdown') mv(p.colors, i, i + 1);
    else if (a === 'iup') mv(p.images, i, i - 1);
    else if (a === 'idel') p.images.splice(i, 1);
    else if (a === 'iadd') return pickMedia(function (path) { p.images.push({ src: path, alt: '', caption: '' }); renderEditor(); });
    else if (a === 'preview') { var tmp = clone(S.cat), k = tmp.palettes.map(function (x) { return x.id; }).indexOf(p.id); if (k > -1) tmp.palettes[k] = clone(p); else tmp.palettes.push(clone(p)); openPreview(tmp, '#/palette/' + p.id); return; }
    else if (a === 'delete') return removePalette(p.id).then(function (ok) { if (ok) { closeEditor(true); render(); } });
    else if (a === 'duplicate') { if (S.editDirty && !S.editIsNew && !saveEditor()) return; var np = duplicate(p.id); closeEditor(true); render(); if (np) openEditor(np); return; }
    renderEditor(); edPreview();
  }

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (S.edit && S.editorLayer && S.editorLayer.card.contains(t)) {
      var p = S.edit; S.editDirty = true;
      if (t.dataset.ed) { p[t.dataset.ed] = t.value; edPreview(); }
      else if (t.dataset.color != null) { var c = t.value.toUpperCase(); p.colors[+t.dataset.color] = c; var h = $('[data-hex="' + t.dataset.color + '"]', S.editorLayer.card); if (h) { h.value = c; h.style.borderColor = ''; } edPreview(); }
      else if (t.dataset.hex != null) { var n = A.normHex(t.value); t.style.borderColor = n ? '' : '#a3303a'; if (n) { p.colors[+t.dataset.hex] = n; var ci = $('[data-color="' + t.dataset.hex + '"]', S.editorLayer.card); if (ci) ci.value = n.toLowerCase(); edPreview(); } }
      else if (t.dataset.edMock) { p.mockup[t.dataset.edMock] = t.value; }
      else if (t.dataset.imgCap != null) p.images[+t.dataset.imgCap].caption = t.value;
      else if (t.dataset.imgAlt != null) p.images[+t.dataset.imgAlt].alt = t.value;
      else if (t.hasAttribute('data-ed-pos')) S.editPos = +t.value;
      return;
    }
    if (t.id === 'pq') { S.pq = t.value; S.plimit = 150; clearTimeout(S.qt); S.qt = setTimeout(function () { var pos = t.selectionStart; if (S.view !== 'palettes') return; render(); var n2 = $('#pq'); if (!n2) return; n2.focus(); try { n2.setSelectionRange(pos, pos); } catch (er) { } }, 160); return; }
    if (t.dataset.bind) {
      var path = t.dataset.bind, type = t.dataset.type;
      if (type === 'bool') setPath(S.cat.site, path, t.checked);
      else if (type === 'list') { getPath(S.cat.site, path)[+t.dataset.i] = t.value; }
      else if (type === 'color') { setPath(S.cat.site, path, t.value); var hx = t.parentNode.querySelector('[data-type=hex]'); if (hx) hx.value = t.value; }
      else if (type === 'hex') { var nh = A.normHex(t.value); if (!nh) return; setPath(S.cat.site, path, nh.toLowerCase()); var cc = t.parentNode.querySelector('[data-type=color]'); if (cc) cc.value = nh.toLowerCase(); }
      else setPath(S.cat.site, path, t.value);
      change();
    }
    if (t.dataset.intName != null) { S.cat.intensities[+t.dataset.intName].name = t.value; change(); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (S.edit && S.editorLayer && S.editorLayer.card.contains(t)) {
      var p = S.edit; S.editDirty = true;
      if (t.dataset.edBool) {
        var key = t.dataset.edBool; p[key] = t.checked;
        if (key === 'autoFamilies') p.families = t.checked ? p.families.filter(function (id) { var f = findF(id); return f && !f.rule; }) : A.paletteFamilyIds(Object.assign({}, p, { autoFamilies: true }), S.cat.families);
        if (key === 'autoIntensities') p.intensities = t.checked ? p.intensities.filter(function (id) { var it = S.cat.intensities.filter(function (x) { return x.id === id; })[0]; return it && !it.rule; }) : A.paletteIntensityIds(Object.assign({}, p, { autoIntensities: true }), S.cat.intensities);
        renderEditor();
      } else if (t.dataset.fam) { var arr = p.families, k = arr.indexOf(t.dataset.fam); if (t.checked && k < 0) arr.push(t.dataset.fam); if (!t.checked && k > -1) arr.splice(k, 1); }
      else if (t.dataset.int) { var ar = p.intensities, q = ar.indexOf(t.dataset.int); if (t.checked && q < 0) ar.push(t.dataset.int); if (!t.checked && q > -1) ar.splice(q, 1); }
      else if (t.dataset.color != null || t.dataset.hex != null) { if (t.dataset.hex != null) { var n = A.normHex(t.value); if (n) t.value = n; } refreshAuto(); edPreview(); }
      else if (t.dataset.edMock === 'variant') renderEditor();
      return;
    }
    if (t.id === 'pf') { S.pf = t.value; S.plimit = 150; render(); }
    if (t.dataset.bind && t.dataset.type === 'bool') { setPath(S.cat.site, t.dataset.bind, t.checked); change(); }
  });
  $('#fileInput').addEventListener('change', function (e) { var fl = e.target.files; uploadFiles(fl).then(afterUpload); e.target.value = ''; });
  $('#importInput').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = ''; if (!f) return;
    f.text().then(function (txt) {
      var c = JSON.parse(txt); if (!c || !Array.isArray(c.palettes)) throw new Error();
      return confirmBox('Importer cette sauvegarde ?', 'Elle contient ' + c.palettes.length + ' palettes et remplacera le brouillon actuel (rien n’est publié automatiquement).', 'Importer').then(function (ok) { if (ok) { S.cat = A.normalize(c); change(); render(); toast('Sauvegarde importée dans le brouillon ✓'); } });
    }).catch(function () { toast('Ce fichier n’est pas une sauvegarde valide de L’Art des Associations.', true); });
  });

  function openPreview(catOverride, hash) {
    saveDraft(true);
    if (catOverride) { var d = LS.get('ada:draft', {}); d.catalogue = catOverride; LS.set('ada:draft', d); }
    window.open('../?apercu=1' + (hash || '#/'), 'ada-apercu');
    if (catOverride) setTimeout(function () { saveDraft(true); }, 4000);
  }

  /* ================= Connexion ================= */
  function parseRepo(v) {
    v = String(v || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
    var m = v.split('/'); return m.length === 2 && m[0] && m[1] ? { owner: m[0], repo: m[1] } : null;
  }
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, r = parseRepo(f.repo.value), btn = $('button[type=submit]', f);
    $('#loginError').textContent = '';
    if (!r) { $('#loginError').textContent = 'Indiquez le dépôt sous la forme identifiant/nom-du-dépôt.'; return; }
    S.cfg = { owner: r.owner, repo: r.repo, branch: f.branch.value.trim() || 'main' };
    S.token = f.token.value.trim();
    busy(btn, true, 'Connexion…');
    connect().then(function () {
      LS.set('ada:admin-cfg', S.cfg);
      if (f.remember.checked) LS.set('ada:admin-token', S.token); else { SS.set('ada:admin-token', S.token); LS.del('ada:admin-token'); }
      f.token.value = '';
      busy(btn, false);
    }).catch(function (err) { busy(btn, false); $('#loginError').textContent = err.message; S.token = null; });
  });
  $('#demoBtn').addEventListener('click', function () { S.mode = 'demo'; SS.set('ada:admin-demo', true); start(); });

  function connect() {
    S.mode = 'github';
    return gh('').then(function () { return getFile('data/catalogue.json'); }).then(function (f) {
      setBase(JSON.parse(f.text), f.sha);
      return getFile('data/brouillon.json').then(function (d) { return JSON.parse(d.text); }, function () { return null; });
    }).then(function (remote) {
      prepareDraft(remote);
      showShell();
    });
  }
  function prepareDraft(remote) {
    var full = S.mode === 'github' ? S.cfg.owner + '/' + S.cfg.repo : 'demo';
    var d = LS.get('ada:draft', null);
    S.cat = clone(S.base); S.staleDraft = null; S.remoteDraft = null;
    if (d && d.repo === full && d.catalogue) {
      if (d.baseSha === S.baseSha) S.cat = A.normalize(d.catalogue);
      else if (JSON.stringify(d.catalogue) !== S.baseStr) S.staleDraft = d;
    }
    var localAt = d && d.repo === full ? d.savedAt : 0;
    var pubAt = Date.parse(S.base.updatedAt || 0) || 0;
    if (remote && remote.savedAt > localAt && remote.savedAt > pubAt && JSON.stringify(A.normalize(remote.catalogue)) !== JSON.stringify(S.cat)) S.remoteDraft = remote;
    saveDraft(true);
  }
  function start() {
    var demo = SS.get('ada:admin-demo', false);
    if (demo) {
      S.mode = 'demo';
      var pub = LS.get('ada:demo-published', null);
      (pub ? Promise.resolve(pub) : fetch('../data/catalogue.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })).then(function (c) {
        setBase(c, 'demo-' + (c.updatedAt || '')); prepareDraft(null); showShell();
      }).catch(function () { $('#login').hidden = false; $('#loginError').textContent = 'Impossible de charger le catalogue.'; });
      return;
    }
    S.cfg = LS.get('ada:admin-cfg', null);
    S.token = LS.get('ada:admin-token', null) || SS.get('ada:admin-token', null);
    if (S.cfg && S.token) {
      connect().catch(function (err) { showLogin(err.message); });
    } else showLogin();
  }
  function showLogin(msg) {
    $('#shell').hidden = true; $('#login').hidden = false;
    var f = $('#loginForm');
    if (S.cfg) { f.repo.value = S.cfg.owner + '/' + S.cfg.repo; f.branch.value = S.cfg.branch || 'main'; }
    $('#loginError').textContent = msg || '';
  }
  function showShell() {
    $('#login').hidden = true; $('#shell').hidden = false;
    $('#modeLabel').textContent = S.mode === 'demo' ? 'Mode local (démonstration)' : 'Connectée à ' + S.cfg.owner + '/' + S.cfg.repo;
    setView(S.view);
  }
  function logout() {
    LS.del('ada:admin-token'); SS.del('ada:admin-token'); SS.del('ada:admin-demo');
    S.token = null; S.mode = null; S.media = null; S.history = null; S.recent = null;
    showLogin('Vous êtes déconnectée. Votre brouillon reste enregistré sur cet appareil.');
  }
  window.addEventListener('beforeunload', function () { saveDraft(true); });

  start();
})();
