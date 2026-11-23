/* L’Art des Associations — logique partagée (catalogue public + administration)
   Toutes les règles de classement sont reprises à l’identique de la version d’origine. */
(function (root) {
  'use strict';

  function hsl(hex) {
    var r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
    var sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    var h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    return { h: h, s: sat, l: l };
  }

  // Classement d’une nuance (règle d’origine : une teinte beige ou taupe n’est pas classée « orange »).
  function colorFamilies(hex) {
    var c = hsl(hex), h = c.h, s = c.s, l = c.l, out = [];
    if (s < .27 || (l > .91 && s < .55)) { out.push('Neutres'); return out; }
    if ((h >= 345 || h < 14) && s >= .28) { out.push(l > .72 ? 'Roses' : 'Rouges'); if (l > .72 && s > .60) out.push('Rouges'); }
    else if (h >= 14 && h < 45 && s >= .39) out.push('Oranges');
    else if (h >= 45 && h < 73 && s >= .34) out.push('Jaunes');
    else if (h >= 73 && h < 175 && s >= .28) out.push('Verts');
    else if (h >= 175 && h < 257 && s >= .28) out.push('Bleus');
    else if (h >= 257 && h < 322 && s >= .28) out.push('Violets');
    else if (h >= 322 && h < 345 && s >= .28) out.push('Roses');
    else out.push('Neutres');
    return out;
  }

  var RULES = ['Roses', 'Rouges', 'Oranges', 'Jaunes', 'Verts', 'Bleus', 'Violets', 'Neutres'];
  var INTENSITY_RULES = ['pastel', 'nude', 'vif', 'flashy', 'profond'];

  function autoRules(colors) {
    var set = {};
    (colors || []).forEach(function (c) { if (validHex(c)) colorFamilies(c).forEach(function (f) { set[f] = 1; }); });
    return Object.keys(set);
  }

  function intensityRule(colors, mode) {
    var cs = (colors || []).filter(validHex).map(hsl);
    var colorful = cs.filter(function (c) { return c.s > .36 && c.l > .17 && c.l < .88; });
    if (mode === 'pastel') return cs.some(function (c) { return c.s > .22 && c.l > .70 && c.l < .93; });
    if (mode === 'nude') return cs.filter(function (c) { return c.s < .34; }).length >= 3;
    if (mode === 'vif') return colorful.some(function (c) { return c.s > .65 && c.l > .36; });
    if (mode === 'flashy') return colorful.some(function (c) { return c.s > .88 && c.l > .43 && c.l < .72; });
    if (mode === 'profond') return cs.some(function (c) { return c.l < .31 && c.s > .30; });
    return false;
  }

  /* Familles d’une palette : automatiques (d’après les couleurs) + collections choisies à la main. */
  function paletteFamilyIds(p, families) {
    var manual = p.families || [], out = [];
    var rules = p.autoFamilies !== false ? autoRules(p.colors) : [];
    families.forEach(function (f) {
      if (manual.indexOf(f.id) > -1) out.push(f.id);
      else if (f.rule && rules.indexOf(f.rule) > -1) out.push(f.id);
    });
    return out;
  }

  function paletteIntensityIds(p, intensities) {
    var manual = p.intensities || [], out = [];
    intensities.forEach(function (it) {
      if (manual.indexOf(it.id) > -1) out.push(it.id);
      else if (p.autoIntensities !== false && it.rule && intensityRule(p.colors, it.rule)) out.push(it.id);
    });
    return out;
  }

  /* Une famille « parente » contient aussi les palettes de ses sous-catégories. */
  function familyMembers(famId, catalogue, pool) {
    var ids = [famId];
    catalogue.families.forEach(function (f) { if (f.parent === famId) ids.push(f.id); });
    return (pool || catalogue.palettes).filter(function (p) {
      var fam = p._fam || paletteFamilyIds(p, catalogue.families);
      return fam.some(function (x) { return ids.indexOf(x) > -1; });
    });
  }

  function contrast(hex) {
    if (!validHex(hex)) return '#26211e';
    var rgb = [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16) / 255; });
    var v = rgb.map(function (x) { return x <= .04045 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); });
    return v[0] * .2126 + v[1] * .7152 + v[2] * .0722 > .35 ? '#26211e' : '#fffaf2';
  }

  function validHex(h) { return typeof h === 'string' && /^#[0-9a-fA-F]{6}$/.test(h); }
  function normHex(h) {
    h = String(h || '').trim().replace(/^#?/, '#');
    if (/^#[0-9a-fA-F]{3}$/.test(h)) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    return validHex(h) ? h.toUpperCase() : null;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* Mise en forme simple et sûre : *italique*, retour à la ligne, {total}, {colors}. */
  function fmt(s, vars) {
    var out = esc(s || '');
    if (vars) Object.keys(vars).forEach(function (k) { out = out.split('{' + k + '}').join(esc(vars[k])); });
    return out.replace(/\*([^*]+)\*/g, '<i>$1</i>').replace(/\n/g, '<br>');
  }
  function plain(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function slug(s) { return plain(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'collection'; }

  /* Garantit une structure complète, même pour un fichier ancien ou importé. */
  function normalize(cat) {
    cat = cat || {};
    cat.site = cat.site || {};
    cat.site.theme = cat.site.theme || {};
    cat.site.contact = cat.site.contact || {};
    cat.site.mockup = cat.site.mockup || {};
    if (!Array.isArray(cat.site.mockup.titles) || cat.site.mockup.titles.length < 6) cat.site.mockup.titles = ['Un regard singulier.', 'Le détail fait tout.', 'Créer l’exception.', 'L’art de recevoir.', 'Une autre idée du beau.', 'L’essentiel, autrement.'];
    if (!Array.isArray(cat.site.mockup.labels) || cat.site.mockup.labels.length < 6) cat.site.mockup.labels = ['MAISON / ÉDITION', 'ATELIER / CRÉATION', 'STUDIO / DESIGN', 'COLLECTION / SIGNATURE', 'MAISON / ATELIER', 'ARCHITECTURE / ESPACE'];
    cat.families = Array.isArray(cat.families) ? cat.families : [];
    cat.intensities = Array.isArray(cat.intensities) ? cat.intensities : [];
    cat.palettes = Array.isArray(cat.palettes) ? cat.palettes : [];
    cat.families.forEach(function (f) { if (f.visible === undefined) f.visible = true; f.swatches = f.swatches || ['#eeeeee', '#bbbbbb', '#777777']; f.parent = f.parent || ''; });
    cat.palettes.forEach(function (p) {
      p.colors = (p.colors || []).map(normHex).filter(Boolean);
      while (p.colors.length < 5) p.colors.push('#CCCCCC');
      if (p.published === undefined) p.published = true;
      if (p.autoFamilies === undefined) p.autoFamilies = true;
      if (p.autoIntensities === undefined) p.autoIntensities = true;
      p.families = p.families || []; p.intensities = p.intensities || [];
      p.mockup = p.mockup || { variant: 'auto', label: '', title: '' };
      p.images = p.images || []; p.description = p.description || '';
    });
    return cat;
  }

  root.ADA = {
    hsl: hsl, colorFamilies: colorFamilies, autoRules: autoRules, intensityRule: intensityRule,
    paletteFamilyIds: paletteFamilyIds, paletteIntensityIds: paletteIntensityIds, familyMembers: familyMembers,
    contrast: contrast, validHex: validHex, normHex: normHex, esc: esc, fmt: fmt, plain: plain, pad: pad, slug: slug,
    normalize: normalize, RULES: RULES, INTENSITY_RULES: INTENSITY_RULES,
    ROLES: ['Fond', 'Accent', 'Nuance', 'Secondaire', 'Contraste']
  };
})(window);
