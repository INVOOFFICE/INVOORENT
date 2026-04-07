/**
 * État des lieux — schéma SVG (vue dessus) + données pour contrat / PDF.
 * global.invooEtatLieux
 */
(function (global) {
 'use strict';

 var ZONES = [
  { id: 'pare-choc-av', label: 'Pare-choc avant', abbr: 'P-choc av' },
  { id: 'capot', label: 'Capot', abbr: 'Capot' },
  { id: 'pare-brise-av', label: 'Pare-brise avant', abbr: 'P-bris av' },
  { id: 'toit', label: 'Toit', abbr: 'Toit' },
  { id: 'pare-brise-ar', label: 'Pare-brise arrière', abbr: 'P-bris ar' },
  { id: 'coffre', label: 'Coffre', abbr: 'Coffre' },
  { id: 'pare-choc-ar', label: 'Pare-choc arrière', abbr: 'P-choc ar' },
  { id: 'porte-av-g', label: 'Porte avant gauche', abbr: 'Pte av G' },
  { id: 'porte-av-d', label: 'Porte avant droite', abbr: 'Pte av D' },
  { id: 'porte-ar-g', label: 'Porte arrière gauche', abbr: 'Pte ar G' },
  { id: 'porte-ar-d', label: 'Porte arrière droite', abbr: 'Pte ar D' },
  { id: 'aile-av-g', label: 'Aile avant gauche', abbr: 'Aile av G' },
  { id: 'aile-av-d', label: 'Aile avant droite', abbr: 'Aile av D' },
  { id: 'aile-ar-g', label: 'Aile arrière gauche', abbr: 'Aile ar G' },
  { id: 'aile-ar-d', label: 'Aile arrière droite', abbr: 'Aile ar D' },
 ];

 /** Coordonnées viewBox 0 0 360 280 — alignées SVG / PDF */
 var LAYOUT = [
  { id: 'pare-choc-av', x: 78, y: 6, w: 204, h: 24, rx: 6 },
  { id: 'capot', x: 88, y: 34, w: 184, h: 30, rx: 4 },
  { id: 'pare-brise-av', x: 108, y: 68, w: 144, h: 16, rx: 2 },
  { id: 'toit', x: 100, y: 88, w: 160, h: 52, rx: 6 },
  { id: 'pare-brise-ar', x: 108, y: 144, w: 144, h: 16, rx: 2 },
  { id: 'coffre', x: 88, y: 164, w: 184, h: 30, rx: 4 },
  { id: 'pare-choc-ar', x: 78, y: 198, w: 204, h: 24, rx: 6 },
  { id: 'porte-av-g', x: 42, y: 72, w: 56, h: 52, rx: 3 },
  { id: 'porte-av-d', x: 262, y: 72, w: 56, h: 52, rx: 3 },
  { id: 'porte-ar-g', x: 42, y: 132, w: 56, h: 52, rx: 3 },
  { id: 'porte-ar-d', x: 262, y: 132, w: 56, h: 52, rx: 3 },
  { id: 'aile-av-g', x: 14, y: 76, w: 44, h: 32, rx: 4 },
  { id: 'aile-av-d', x: 302, y: 76, w: 44, h: 32, rx: 4 },
  { id: 'aile-ar-g', x: 14, y: 148, w: 44, h: 32, rx: 4 },
  { id: 'aile-ar-d', x: 302, y: 148, w: 44, h: 32, rx: 4 },
 ];

 var FILL_OK = '#34d399';
 var FILL_BAD = '#ef4444';
 var STROKE = '#0f172a';

 function labelFor(id) {
  var z = ZONES.find(function (o) {
   return o.id === id;
  });
  return z ? z.label : id;
 }

 function abbrFor(id) {
  var z = ZONES.find(function (o) {
   return o.id === id;
  });
  return z && z.abbr ? z.abbr : labelFor(id);
 }

 function defaultZonesState() {
  var o = {};
  ZONES.forEach(function (z) {
   o[z.id] = { damaged: false, note: '' };
  });
  return o;
 }

 function mergeEtatLieux(raw) {
  var base = defaultZonesState();
  if (!raw || !raw.zones) return base;
  Object.keys(raw.zones).forEach(function (id) {
   if (base[id]) {
    base[id] = {
     damaged: !!raw.zones[id].damaged,
     note: String(raw.zones[id].note || ''),
    };
   }
  });
  return base;
 }

 function buildSvgInner(zonesState) {
  var parts = [];
  parts.push(
   '<ellipse cx="180" cy="140" rx="118" ry="108" fill="none" stroke="' +
    STROKE +
    '" stroke-width="1.5" stroke-opacity="0.25"/>'
  );
  LAYOUT.forEach(function (z) {
   var st = zonesState[z.id] || { damaged: false };
   var fill = st.damaged ? FILL_BAD : FILL_OK;
   parts.push(
    '<rect class="el-zone" data-zone-id="' +
     z.id +
     '" x="' +
     z.x +
     '" y="' +
     z.y +
     '" width="' +
     z.w +
     '" height="' +
     z.h +
     '" rx="' +
     z.rx +
     '" fill="' +
     fill +
     '" stroke="' +
     STROKE +
     '" stroke-width="1.2" style="cursor:pointer" tabindex="0"><title>' +
     escapeAttr(labelFor(z.id)) +
     '</title></rect>'
   );
  });
  LAYOUT.forEach(function (z) {
   var fs = z.w < 50 ? 6 : z.h < 22 ? 6.5 : 7.5;
   var cx = z.x + z.w / 2;
   var cy = z.y + z.h / 2 + fs / 3;
   parts.push(
    '<text x="' +
     cx +
     '" y="' +
     cy +
     '" text-anchor="middle" font-size="' +
     fs +
     '" font-family="system-ui,-apple-system,sans-serif" fill="#0f172a" pointer-events="none" style="user-select:none">' +
     escapeAttr(abbrFor(z.id)) +
     '</text>'
   );
  });
  return parts.join('');
 }

 function escapeAttr(s) {
  return String(s)
   .replace(/&/g, '&amp;')
   .replace(/"/g, '&quot;')
   .replace(/</g, '&lt;');
 }

 function escapeHtml(s) {
  return window.AutoLocUtils && typeof window.AutoLocUtils.escapeHtml === 'function'
   ? window.AutoLocUtils.escapeHtml(s)
   : String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
 }

 function wireSvg(root) {
  var svg = root.querySelector('.el-veh-svg');
  if (!svg) return;
  svg.querySelectorAll('.el-zone').forEach(function (el) {
   el.addEventListener('click', function () {
    toggleZone(root, el.getAttribute('data-zone-id'));
   });
   el.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
     e.preventDefault();
     toggleZone(root, el.getAttribute('data-zone-id'));
    }
   });
  });
 }

 function toggleZone(root, id) {
  var st = root._elZones;
  if (!st[id]) return;
  st[id].damaged = !st[id].damaged;
  applyZoneVisual(root, id);
  refreshRecap(root);
 }

 function applyZoneVisual(root, id) {
  var svg = root.querySelector('.el-veh-svg');
  if (!svg) return;
  var el = svg.querySelector('[data-zone-id="' + id + '"]');
  if (!el) return;
  var st = root._elZones[id];
  el.setAttribute('fill', st.damaged ? FILL_BAD : FILL_OK);
 }

 function refreshRecap(root) {
  var box = root.querySelector('.el-recap-list');
  if (!box) return;
  box.innerHTML = '';
  var st = root._elZones;
  var hasDamaged = false;
  ZONES.forEach(function (z) {
   if (!st[z.id].damaged) return;
   hasDamaged = true;
   var row = document.createElement('div');
   row.className = 'el-recap-row';
   row.innerHTML =
    '<label class="el-recap-label">' +
    escapeHtml(z.label) +
    '</label>' +
    '<input type="text" class="el-recap-input" data-zone-note="' +
    escapeHtml(z.id) +
    '" placeholder="Description du dommage" value="' +
    escapeHtml(st[z.id].note || '') +
    '"/>';
   box.appendChild(row);
  });
  var empty = root.querySelector('.el-recap-empty');
  if (empty) empty.style.display = hasDamaged ? 'none' : 'block';
  box.querySelectorAll('.el-recap-input').forEach(function (inp) {
   inp.addEventListener('input', function () {
    var zid = inp.getAttribute('data-zone-note');
    if (zid && root._elZones[zid]) root._elZones[zid].note = inp.value;
   });
  });
 }

 function mount(rootId) {
  var root = typeof rootId === 'string' ? document.getElementById(rootId) : rootId;
  if (!root) return;
  if (root.dataset.elMounted === '1') {
   reset(root);
   return;
  }
  root.dataset.elMounted = '1';
  root.classList.add('el-veh-wrap');
  root.innerHTML =
   '<p class="el-veh-intro">Chaque partie est nommée sur le schéma. Cliquez pour signaler un dommage (rouge) — vous pouvez en choisir plusieurs. Re-cliquez pour annuler.</p>' +
   '<div class="el-svg-outer">' +
   '<svg class="el-veh-svg" viewBox="0 0 360 280" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Schéma véhicule vue dessus">' +
   '</svg>' +
   '</div>' +
   '<div class="el-recap-block">' +
   '<div class="el-recap-title">Zones endommagées</div>' +
   '<p class="el-recap-empty" style="font-size:0.82rem;color:var(--text3);margin:0">Aucun dommage signalé à la prise du véhicule.</p>' +
   '<div class="el-recap-list"></div>' +
   '</div>';
  root._elZones = defaultZonesState();
  var svg = root.querySelector('.el-veh-svg');
  svg.innerHTML = buildSvgInner(root._elZones);
  wireSvg(root);
  refreshRecap(root);
 }

 function reset(rootOrId) {
  var root = typeof rootOrId === 'string' ? document.getElementById(rootOrId) : rootOrId;
  if (!root || root.dataset.elMounted !== '1') return;
  root._elZones = defaultZonesState();
  var svg = root.querySelector('.el-veh-svg');
  if (svg) {
   svg.innerHTML = buildSvgInner(root._elZones);
   wireSvg(root);
  }
  refreshRecap(root);
 }

 function setData(rootOrId, data) {
  var root = typeof rootOrId === 'string' ? document.getElementById(rootOrId) : rootOrId;
  if (!root) return;
  if (root.dataset.elMounted !== '1') mount(root);
  root._elZones = mergeEtatLieux(data);
  var svg = root.querySelector('.el-veh-svg');
  if (svg) {
   svg.innerHTML = buildSvgInner(root._elZones);
   wireSvg(root);
  }
  refreshRecap(root);
  root.querySelectorAll('.el-recap-input').forEach(function (inp) {
   var zid = inp.getAttribute('data-zone-note');
   if (zid && root._elZones[zid]) inp.value = root._elZones[zid].note || '';
  });
 }

 function getData(rootOrId) {
  var root = typeof rootOrId === 'string' ? document.getElementById(rootOrId) : rootOrId;
  if (!root || !root._elZones) return { zones: defaultZonesState() };
  var zones = {};
  ZONES.forEach(function (z) {
   zones[z.id] = {
    damaged: !!root._elZones[z.id].damaged,
    note: String(root._elZones[z.id].note || ''),
   };
  });
  root.querySelectorAll('.el-recap-input').forEach(function (inp) {
   var zid = inp.getAttribute('data-zone-note');
   if (zid && zones[zid]) zones[zid].note = inp.value.trim();
  });
  return { zones: zones };
 }

 /** HTML pour aperçu contrat (SVG + bloc liste au même emplacement que « aucun dommage ») */
 function buildContractHtml(etatLieux) {
  var zs = mergeEtatLieux(etatLieux);
  var svgInner = buildSvgInner(zs);
  var damaged = [];
  ZONES.forEach(function (z) {
   if (!zs[z.id].damaged) return;
   damaged.push(z);
  });
  var reportHtml;
  if (damaged.length === 0) {
   reportHtml =
    '<div class="el-contrat-damage-report">' +
    '<p class="el-contrat-ok">Aucun dommage signalé à la prise du véhicule.</p>' +
    '</div>';
  } else {
   var lis = damaged
    .map(function (z) {
     return (
      '<li><strong>' +
      escapeHtml(z.label) +
      '</strong><span class="el-contrat-damage-sep"> — </span><span>' +
      escapeHtml(zs[z.id].note || '—') +
      '</span></li>'
     );
    })
    .join('');
   reportHtml =
    '<div class="el-contrat-damage-report">' +
    '<p class="el-contrat-damage-lead">Dommages signalés à la prise du véhicule :</p>' +
    '<ul class="el-contrat-damage-ul">' +
    lis +
    '</ul>' +
    '</div>';
  }
  return (
   '<div class="contrat-section el-contrat-etat">' +
   '<h4>État des lieux du véhicule</h4>' +
   '<p style="font-size:0.78rem;color:var(--text3);margin:0 0 10px">Vue dessus — chaque zone est nommée sur le schéma. Vert : sans dommage, rouge : dommage signalé. Les parties endommagées apparaissent dans la liste ci-dessous et figurent dans le PDF.</p>' +
   '<div class="el-contrat-svg-wrap">' +
   '<svg viewBox="0 0 360 280" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;display:block">' +
   svgInner +
   '</svg></div>' +
   reportHtml +
   '</div>'
  );
 }

 /** Dessin PDF (mm) — même logique que le SVG */
 function drawPdf(doc, ml, yStart, cw, etatLieux) {
  var PAGE_MAX = 278;
  function ensureY(y, needMm) {
   if (y + needMm <= PAGE_MAX) return y;
   doc.addPage();
   return 15;
  }
  var zs = mergeEtatLieux(etatLieux);
  var vbW = 360;
  var vbH = 280;
  var drawW = Math.min(cw, 100);
  var scale = drawW / vbW;
  var drawH = vbH * scale;
  var blockH = 8 + 6 + 5 + drawH + 10;
  yStart = ensureY(yStart, blockH);
  var y = yStart;
  setFontPdf(doc, 7, 'bold', '#0C0E14');
  doc.text('ÉTAT DES LIEUX DU VÉHICULE', ml, y);
  doc.setDrawColor(228, 224, 216);
  doc.line(ml, y + 1.5, ml + cw, y + 1.5);
  y += 6;
  setFontPdf(doc, 6, 'normal', '#555555');
  var sub =
   'Vue dessus — libellés sur le schéma. Vert : OK, rouge : dommage (plusieurs zones possibles).';
  var subLines = doc.splitTextToSize(sub, cw);
  doc.text(subLines, ml, y);
  y += subLines.length * 3.2 + 3;
  var diagramTop = y;
  function sx(x) {
   return ml + x * scale;
  }
  function sy(yy) {
   return diagramTop + yy * scale;
  }
  function sw(w) {
   return w * scale;
  }
  LAYOUT.forEach(function (z) {
   var st = zs[z.id] || { damaged: false };
   var r = st.damaged ? 239 : 52;
   var g = st.damaged ? 68 : 211;
   var b = st.damaged ? 68 : 153;
   doc.setFillColor(r, g, b);
   doc.setDrawColor(15, 23, 42);
   doc.setLineWidth(0.15);
   var rx = Math.max(0.3, z.rx * scale * 0.45);
   if (typeof doc.roundedRect === 'function') {
    doc.roundedRect(sx(z.x), sy(z.y), sw(z.w), sw(z.h), rx, rx, 'FD');
   } else {
    doc.rect(sx(z.x), sy(z.y), sw(z.w), sw(z.h), 'FD');
   }
  });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  LAYOUT.forEach(function (z) {
   doc.setFontSize(sw(z.w) < 14 ? 3.8 : sw(z.h) < 8 ? 4 : 4.6);
   var ab = abbrFor(z.id);
   var cx = sx(z.x) + sw(z.w) / 2;
   var cyy = sy(z.y) + sw(z.h) / 2 + 1.2;
   doc.text(ab, cx, cyy, { align: 'center' });
  });
  y = diagramTop + drawH + 6;
  y = ensureY(y, 20);
  setFontPdf(doc, 7, 'bold', '#0C0E14');
  doc.text('Dommages signalés', ml, y);
  y += 4;
  var damagedList = [];
  ZONES.forEach(function (z) {
   if (zs[z.id].damaged) damagedList.push({ label: z.label, note: zs[z.id].note || '—' });
  });
  if (damagedList.length === 0) {
   setFontPdf(doc, 6.5, 'normal', '#555555');
   doc.text('Aucun dommage signalé.', ml, y);
   y += 5;
   return y + 2;
  }
  damagedList.forEach(function (d) {
   setFontPdf(doc, 6.5, 'normal', '#333333');
   var line = d.label + ' : ' + d.note;
   var split = doc.splitTextToSize(line, cw - 4);
   y = ensureY(y, split.length * 3.2 + 2);
   doc.text(split, ml, y);
   y += split.length * 3.2 + 1;
  });
  return y + 2;
 }

 function setFontPdf(doc, size, style, color) {
  doc.setFontSize(size);
  doc.setFont('helvetica', style || 'normal');
  if (color && typeof color === 'string' && color.charAt(0) === '#') {
   var n = parseInt(color.slice(1), 16);
   doc.setTextColor((n >> 16) & 255, (n >> 8) & 255, n & 255);
  } else if (color) {
   doc.setTextColor(color);
  } else {
   doc.setTextColor(12, 14, 20);
  }
 }

 global.invooEtatLieux = {
  ZONES: ZONES,
  LAYOUT: LAYOUT,
  mount: mount,
  reset: reset,
  setData: setData,
  getData: getData,
  mergeEtatLieux: mergeEtatLieux,
  buildContractHtml: buildContractHtml,
  drawPdf: drawPdf,
 };
})(typeof window !== 'undefined' ? window : globalThis);
