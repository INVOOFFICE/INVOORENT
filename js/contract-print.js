/**
 * Aperçu contrat (modal) + export PDF (jsPDF / invooEnsureJsPdf).
 * invooContractPrint.attach({ load, KEYS, getSettings, conditionsDefaut, openModal, alAlert })
 */
(function (global) {
 'use strict';

 var ctx = null;

 function idEq(a, b) {
  return global.AutoLocCoreUtils && typeof global.AutoLocCoreUtils.idEq === 'function'
   ? global.AutoLocCoreUtils.idEq(a, b)
   : String(a) === String(b);
 }

 global.printContrat = function (id) {
  if (!ctx) return;
  global._printContratId = id;
  const load = ctx.load;
  const KEYS = ctx.KEYS;
  const sid = String(id);
  const r = load(KEYS.res).find(function (x) {
   return idEq(x.id, sid);
  });
  if (!r) return;
  const c = load(KEYS.cl).find(function (x) {
   return idEq(x.id, r.clientId);
  });
  const v = load(KEYS.veh).find(function (x) {
   return idEq(x.id, r.vehId);
  });
  const d1 = new Date(r.debut);
  const d2 = new Date(r.fin);
  const days = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
  const fmt = function (d) {
   return d ? new Date(d).toLocaleDateString('fr-FR') : '—';
  };
  const s = ctx.getSettings();
  const agenceNom = s.nom || 'INVOORENT';
  const agenceSlogan = s.slogan || 'Gérez, louez, développez';
  const agenceVille = s.ville || 'Tanger,Maroc';
  const agenceTel = s.tel || '+212 5XX XX XX XX';
  const conditions = (s.conditions || ctx.conditionsDefaut).split('\n').filter(function (l) {
   return l.trim();
  });
  const secDrivers =
   c && Array.isArray(c.conducteursSecondaires)
    ? c.conducteursSecondaires.filter(function (x) {
       return x && (x.prenom || x.nom || x.docNum);
      })
    : [];
  var secHtml = '';
  if (secDrivers.length) {
   secHtml =
    '\n<div class="contrat-section"><h4>Conducteur(s) additionnel(s)</h4><div class="contrat-grid">';
   secDrivers.forEach(function (cd, i) {
    const lab =
     cd.docType === 'cin' ? 'CIN' : cd.docType === 'passeport' ? 'Passeport' : 'N° Permis de conduire';
    secHtml +=
     '<div class="contrat-field" style="grid-column:1/-1;padding-top:' +
     (i > 0 ? '0.75rem' : '0') +
     '"><span style="font-size:0.7rem;color:#9A9A9A">Conducteur additionnel ' +
     (i + 1) +
     '</span><strong style="display:block;margin-top:0.2rem">' +
     window.AutoLocUtils.escapeHtml([cd.prenom, cd.nom].filter(Boolean).join(' ') || '—') +
     '</strong></div>';
    secHtml +=
     '<div class="contrat-field"><span>' +
     window.AutoLocUtils.escapeHtml(lab) +
     '</span><strong>' +
     window.AutoLocUtils.escapeHtml(cd.docNum || '—') +
     '</strong></div>';
   });
   secHtml += '</div></div>';
  }
  const contratNum = 'CTR-' + id.slice(-6).toUpperCase();
  const etatHtml =
   global.invooEtatLieux && typeof global.invooEtatLieux.buildContractHtml === 'function'
    ? global.invooEtatLieux.buildContractHtml(r.etatLieux)
    : '';
  document.getElementById('contrat-body').innerHTML =
   '\n<div class="contrat-header"><div class="contrat-logo"><h2>' +
   window.AutoLocUtils.escapeHtml(agenceNom).replace(/(\S+)$/, '<span>$1</span>') +
   '</h2><p>' +
   window.AutoLocUtils.escapeHtml(agenceSlogan) +
   '</p><p style="margin-top:4px;font-size:0.72rem;color:#9A9A9A">' +
   window.AutoLocUtils.escapeHtml(agenceVille) +
   '— Tél: ' +
   window.AutoLocUtils.escapeHtml(agenceTel) +
   (s.email ? ' — ' + window.AutoLocUtils.escapeHtml(s.email) : '') +
   (s.site ? ' — ' + window.AutoLocUtils.escapeHtml(s.site) : '') +
   '</p>\n ' +
   (s.patente
    ? '<p style="font-size:0.7rem;color:#9A9A9A;margin-top:2px">RC / Patente : ' +
      window.AutoLocUtils.escapeHtml(s.patente) +
      '</p>'
    : '') +
   '\n</div><div class="contrat-meta"><span>N° Contrat</span><strong>' +
   window.AutoLocUtils.escapeHtml(contratNum) +
   '</strong><span style="margin-top:6px;display:block">Date : ' +
   new Date().toLocaleDateString('fr-FR') +
   '</span><span class="badge ' +
   (r.statut === 'en cours' ? 'badge-info' : r.statut === 'terminée' ? 'badge-success' : 'badge-danger') +
   '" style="margin-top:6px">' +
   window.AutoLocUtils.escapeHtml(r.statut) +
   '</span></div></div><div class="contrat-title">Contrat de Location de Véhicule</div><div class="contrat-section"><h4>Informations du locataire</h4><div class="contrat-grid"><div class="contrat-field"><span>Nom complet</span><strong>' +
   (c ? window.AutoLocUtils.escapeHtml(c.prenom) + ' ' + window.AutoLocUtils.escapeHtml(c.nom) : '—') +
   '</strong></div><div class="contrat-field"><span>CIN / Passeport</span><strong>' +
   window.AutoLocUtils.escapeHtml(c?.cin || '—') +
   '</strong></div><div class="contrat-field"><span>Téléphone</span><strong>' +
   window.AutoLocUtils.escapeHtml(c?.tel || '—') +
   '</strong></div><div class="contrat-field"><span>N° Permis de conduire</span><strong>' +
   window.AutoLocUtils.escapeHtml(c?.permis || '—') +
   '</strong></div><div class="contrat-field"><span>Email</span><strong>' +
   window.AutoLocUtils.escapeHtml(c?.email || '—') +
   '</strong></div><div class="contrat-field"><span>Adresse</span><strong>' +
   window.AutoLocUtils.escapeHtml(c?.adresse || '—') +
   '</strong></div><div class="contrat-field"><span>Ville</span><strong>' +
   window.AutoLocUtils.escapeHtml(c?.ville || '—') +
   '</strong></div><div class="contrat-field"><span>Nationalité</span><strong>' +
   window.AutoLocUtils.escapeHtml(c?.nat || '—') +
   '</strong></div></div></div>' +
   secHtml +
   '<div class="contrat-section"><h4>Véhicule loué</h4><div class="contrat-grid"><div class="contrat-field"><span>Marque / Modèle</span><strong>' +
   (v ? window.AutoLocUtils.escapeHtml(v.marque) + ' ' + window.AutoLocUtils.escapeHtml(v.modele) : '—') +
   '</strong></div><div class="contrat-field"><span>Immatriculation</span><strong>' +
   window.AutoLocUtils.escapeHtml(v?.immat || '—') +
   '</strong></div><div class="contrat-field"><span>Année</span><strong>' +
   window.AutoLocUtils.escapeHtml(String(v?.annee || '—')) +
   '</strong></div><div class="contrat-field"><span>Catégorie</span><strong>' +
   window.AutoLocUtils.escapeHtml(v?.cat || '—') +
   '</strong></div><div class="contrat-field"><span>Couleur</span><strong>' +
   window.AutoLocUtils.escapeHtml(v?.couleur || '—') +
   '</strong></div><div class="contrat-field"><span>Carburant</span><strong>' +
   window.AutoLocUtils.escapeHtml(v?.carburant || '—') +
   '</strong></div><div class="contrat-field"><span>Kilométrage départ</span><strong>' +
   (v?.km ? v.km.toLocaleString('fr-FR') + ' km' : '—') +
   '</strong></div><div class="contrat-field"><span>Tarif journalier</span><strong>' +
   window.AutoLocUtils.escapeHtml(String(v?.tarif || '—')) +
   'MAD / jour</strong></div></div></div>' +
   etatHtml +
   '<div class="contrat-section"><h4>Détails de la location</h4><div class="contrat-grid"><div class="contrat-field"><span>Date de départ</span><strong>' +
   fmt(r.debut) +
   '</strong></div><div class="contrat-field"><span>Date de retour prévue</span><strong>' +
   fmt(r.fin) +
   '</strong></div><div class="contrat-field"><span>Durée</span><strong>' +
   days +
   'jour' +
   (days > 1 ? 's' : '') +
   '</strong></div><div class="contrat-field"><span>Lieu de prise en charge</span><strong>' +
   window.AutoLocUtils.escapeHtml(r.lieu || '—') +
   '</strong></div>' +
   (r.caution > 0
    ? '<div class="contrat-field"><span>Caution (remboursable)</span><strong>' +
      (r.caution || 0).toLocaleString('fr-FR') +
      ' MAD</strong></div>'
    : '') +
   '\n ' +
   (r.notes
    ? '<div class="contrat-field" style="grid-column:1/-1"><span>Remarques</span><strong>' +
      window.AutoLocUtils.escapeHtml(r.notes) +
      '</strong></div>'
    : '') +
   '\n</div></div><div class="contrat-total-box"><div><p>Montant total de la location</p><p style="font-size:0.75rem;opacity:0.6">' +
   days +
   'jour' +
   (days > 1 ? 's' : '') +
   '× ' +
   (v?.tarif || 0) +
   'MAD</p></div><strong>' +
   (r.total || 0).toLocaleString('fr-FR') +
   'MAD</strong></div>\n ' +
   ((r.paiements || []).length > 0 || r.caution > 0
    ? '\n<div class="contrat-section"><h4>Récapitulatif des paiements</h4><div class="contrat-fields">\n ' +
      (r.paiements || [])
       .map(function (p) {
        const typeLabel = p.type === 'avance' ? 'Avance' : p.type === 'solde' ? 'Solde' : 'Autre';
        return (
         '<div class="contrat-field"><span>' +
         window.AutoLocUtils.escapeHtml(typeLabel) +
         '(' +
         window.AutoLocUtils.escapeHtml(p.mode) +
         '· ' +
         window.AutoLocUtils.escapeHtml(p.date || '') +
         ')</span><strong>' +
         p.montant.toLocaleString('fr-FR') +
         'MAD</strong></div>'
        );
       })
       .join('') +
      '\n ' +
      (r.caution > 0
       ? '<div class="contrat-field"><span>Caution (remboursable)' +
         (r.cautionStatut && r.cautionStatut !== 'non'
          ? ' — ' +
            window.AutoLocUtils.escapeHtml(
             r.cautionStatut === 'encaissee'
              ? 'Encaissée'
              : r.cautionStatut === 'restituee'
               ? 'Restituée'
               : 'En attente'
            )
          : '') +
         '</span><strong>' +
         (r.caution || 0).toLocaleString('fr-FR') +
         ' MAD</strong></div>'
       : '') +
      '\n<div class="contrat-field" style="border-top:1px solid rgba(255,255,255,0.22);margin-top:4px;padding-top:8px"><span><strong>Reste dû</strong></span><strong style="color:' +
      (Math.max(0, (r.total || 0) - (r.paiements || []).reduce(function (s, p) {
        return s + p.montant;
       }, 0)) === 0
       ? '#99f6e4'
       : '#fca5a5') +
      '">' +
      Math.max(
       0,
       (r.total || 0) -
        (r.paiements || []).reduce(function (s, p) {
         return s + p.montant;
        }, 0)
      ).toLocaleString('fr-FR') +
      'MAD</strong></div></div></div>'
    : '') +
   '\n<div class="contrat-section"><h4>Conditions générales</h4><div class="contrat-conditions">\n ' +
   conditions
    .map(function (cl, i) {
     return i + 1 + '. ' + window.AutoLocUtils.escapeHtml(cl);
    })
    .join('<br>') +
   '\n</div></div><div class="contrat-signatures"><div class="contrat-sig-box"><p>Signature du locataire</p><p style="margin-top:4px;font-size:0.7rem">' +
   (c ? window.AutoLocUtils.escapeHtml(c.prenom) + ' ' + window.AutoLocUtils.escapeHtml(c.nom) : '') +
   '</p></div><div class="contrat-sig-box"><p>Cachet et signature de l\'agence</p><p style="margin-top:4px;font-size:0.7rem">' +
   window.AutoLocUtils.escapeHtml(agenceNom) +
   '</p></div></div>\n ';
  ctx.openModal('contrat-modal');
 };

 global.printContratDirect = function () {
  if (!ctx) return;
  const contratEl = document.getElementById('contrat-body');
  if (!contratEl || !contratEl.innerHTML) return;
  function _generatePDF() {
   const { jsPDF } = global.jspdf;
   const pid = global._printContratId != null ? String(global._printContratId) : '';
   const r = pid
    ? ctx.load(ctx.KEYS.res).find(function (x) {
       return idEq(x.id, pid);
      })
    : null;
   const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
   const s = ctx.getSettings();
   const agenceNom = s.nom || 'INVOORENT';
   const agenceSlogan = s.slogan || 'Gérez, louez, développez';
   const agenceVille = s.ville || 'Tanger,Maroc';
   const agenceTel = s.tel || '+212 5XX XX XX XX';
   const res = r || {};
   const clientId = res.clientId;
   const vehId = res.vehId;
   const c = clientId
    ? ctx.load(ctx.KEYS.cl).find(function (x) {
       return idEq(x.id, clientId);
      })
    : null;
   const v = vehId
    ? ctx.load(ctx.KEYS.veh).find(function (x) {
       return idEq(x.id, vehId);
      })
    : null;
   const d1 = res.debut ? new Date(res.debut) : new Date();
   const d2 = res.fin ? new Date(res.fin) : new Date();
   const days = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
   const fmt = function (d) {
    return d ? new Date(d).toLocaleDateString('fr-FR') : '—';
   };
   const contratNum = res.id ? 'CTR-' + res.id.slice(-6).toUpperCase() : 'CTR-000000';
   const fmtNum = function (n) {
    return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
   };
   const conditions = (s.conditions || ctx.conditionsDefaut).split('\n').filter(function (l) {
    return l.trim();
   });
   const W = 210;
   const ml = 15;
   const mr = 15;
   const cw = W - ml - mr;
   const PAGE_MAX_Y = 283;
   function ensurePage(doc, y, needMm) {
    if (y + needMm <= PAGE_MAX_Y) return y;
    doc.addPage();
    return 15;
   }
   var y = 15;
   const txt = function (t, x, yy, opts) {
    doc.text(String(t || ''), x, yy, opts);
   };
   const line = function (x1, y1, x2, y2, color) {
    doc.setDrawColor(color || '#0C0E14');
    doc.line(x1, y1, x2, y2);
   };
   const rect = function (x, yy, w, h, fillColor, strokeColor) {
    if (fillColor) doc.setFillColor(fillColor);
    if (strokeColor) doc.setDrawColor(strokeColor);
    else doc.setDrawColor(255, 255, 255, 0);
    doc.roundedRect(x, yy, w, h, 2, 2, fillColor ? (strokeColor ? 'FD' : 'F') : 'S');
   };
   const setFont = function (size, style, color) {
    doc.setFontSize(size);
    doc.setFont('helvetica', style || 'normal');
    if (color) doc.setTextColor(color);
    else doc.setTextColor('#0C0E14');
   };
   setFont(16, 'bold', '#0C0E14');
   txt(agenceNom, ml, y);
   setFont(8, 'normal', '#777777');
   txt(agenceSlogan, ml, y + 5);
   txt(agenceVille + ' — Tél: ' + agenceTel + (s.email ? ' — ' + s.email : ''), ml, y + 10);
   if (s.patente) {
    setFont(7, 'normal', '#AAAAAA');
    txt('RC / Patente : ' + s.patente, ml, y + 14);
   }
   setFont(7, 'normal', '#777777');
   txt('N° Contrat', W - mr, y, { align: 'right' });
   setFont(11, 'bold', '#0C0E14');
   txt(contratNum, W - mr, y + 5, { align: 'right' });
   setFont(7, 'normal', '#777777');
   txt('Date : ' + new Date().toLocaleDateString('fr-FR'), W - mr, y + 10, { align: 'right' });
   y += 18;
   line(ml, y, W - mr, y, '#0C0E14');
   y += 6;
   rect(ml, y - 4, cw, 10, '#E6FFFA', '#99F6E4');
   setFont(8, 'bold', '#312E81');
   txt('CONTRAT DE LOCATION DE VÉHICULE', W / 2, y + 2, { align: 'center' });
   y += 12;
   const section = function (title) {
    y = ensurePage(doc, y, 14);
    setFont(7, 'bold', '#0C0E14');
    txt(title, ml, y);
    doc.setDrawColor('#E4E0D8');
    line(ml, y + 1.5, W - mr, y + 1.5, '#E4E0D8');
    y += 6;
   };
   const grid2 = function (pairs) {
    var rows = Math.ceil(pairs.length / 2);
    var gh = rows * 9 + 4;
    y = ensurePage(doc, y, gh);
    const colW = cw / 2 - 4;
    pairs.forEach(function (pair, i) {
     const col = i % 2;
     const row = Math.floor(i / 2);
     const x = ml + col * (colW + 8);
     const yy = y + row * 9;
     setFont(6.5, 'normal', '#777777');
     txt(pair[0], x, yy);
     setFont(8, 'bold', '#0C0E14');
     txt(String(pair[1] || '—'), x, yy + 4);
    });
    y += rows * 9 + 2;
   };
   section('INFORMATIONS DU LOCATAIRE');
   grid2([
    ['Nom complet', c ? c.prenom + ' ' + c.nom : '—'],
    ['CIN / Passeport', c?.cin || '—'],
    ['Téléphone', c?.tel || '—'],
    ['N° Permis', c?.permis || '—'],
    ['Email', c?.email || '—'],
    ['Adresse', c?.adresse || '—'],
    ['Ville', c?.ville || '—'],
    ['Nationalité', c?.nat || '—'],
   ]);
   const secDriversPdf =
    c && Array.isArray(c.conducteursSecondaires)
     ? c.conducteursSecondaires.filter(function (x) {
        return x && (x.prenom || x.nom || x.docNum);
       })
     : [];
   if (secDriversPdf.length) {
    section('CONDUCTEUR(S) ADDITIONNEL(S)');
    secDriversPdf.forEach(function (cd) {
     const lab =
      cd.docType === 'cin' ? 'CIN' : cd.docType === 'passeport' ? 'Passeport' : 'N° Permis';
     grid2([
      ['Nom complet', [cd.prenom, cd.nom].filter(Boolean).join(' ') || '—'],
      [lab, cd.docNum || '—'],
     ]);
    });
   }
   section('VÉHICULE LOUÉ');
   grid2([
    ['Marque / Modèle', v ? v.marque + ' ' + v.modele : '—'],
    ['Immatriculation', v?.immat || '—'],
    ['Année', v?.annee || '—'],
    ['Catégorie', v?.cat || '—'],
    ['Couleur', v?.couleur || '—'],
    ['Carburant', v?.carburant || '—'],
    ['Kilométrage départ', v?.km ? fmtNum(v.km) + ' km' : '—'],
    ['Tarif journalier', (v?.tarif || '—') + ' MAD/j'],
   ]);
   if (global.invooEtatLieux && typeof global.invooEtatLieux.drawPdf === 'function') {
    y = ensurePage(doc, y, 95);
    y = global.invooEtatLieux.drawPdf(doc, ml, y, cw, res.etatLieux);
   }
   section('DÉTAILS DE LA LOCATION');
   grid2(
    [
     ['Date de départ', fmt(res.debut)],
     ['Date de retour', fmt(res.fin)],
     ['Durée', days + ' jour' + (days > 1 ? 's' : '')],
     ['Lieu de prise', res.lieu || '—'],
    ]
     .concat(res.caution > 0 ? [['Caution (remboursable)', fmtNum(res.caution) + ' MAD']] : [])
     .concat(res.notes ? [['Remarques', res.notes]] : [])
   );
   y += 2;
   y = ensurePage(doc, y, 22);
   rect(ml, y, cw, 14, '#0C0E14');
   setFont(8, 'normal', '#CCCCCC');
   txt('Montant total de la location', ml + 4, y + 5);
   setFont(7, 'normal', '#999999');
   txt(days + ' jour' + (days > 1 ? 's' : '') + ' × ' + (v?.tarif || 0) + ' MAD', ml + 4, y + 10);
   setFont(14, 'bold', '#FFFFFF');
   txt(fmtNum(res.total || 0) + ' MAD', W - mr - 4, y + 9, { align: 'right' });
   y += 20;
   if ((res.paiements || []).length > 0 || res.caution > 0) {
    section('RÉCAPITULATIF DES PAIEMENTS');
    (res.paiements || []).forEach(function (p) {
     y = ensurePage(doc, y, 10);
     const typeLabel = p.type === 'avance' ? 'Avance' : p.type === 'solde' ? 'Solde' : 'Autre';
     setFont(7, 'normal', '#555555');
     txt(typeLabel + '(' + p.mode + ' · ' + (p.date || '') + ')', ml, y);
     setFont(7, 'bold', '#0C0E14');
     txt(fmtNum(p.montant) + ' MAD', W - mr, y, { align: 'right' });
     y += 6;
    });
    if (res.caution > 0) {
     y = ensurePage(doc, y, 10);
     const cautionLbl =
      res.cautionStatut === 'encaissee'
       ? 'Encaissée'
       : res.cautionStatut === 'restituee'
        ? 'Restituée'
        : res.cautionStatut === 'non'
         ? ''
         : 'En attente';
     setFont(7, 'normal', '#555555');
     txt(
      'Caution (remboursable)' + (cautionLbl ? ' — ' + cautionLbl : ''),
      ml,
      y
     );
     setFont(7, 'bold', '#0C0E14');
     txt(fmtNum(res.caution || 0) + ' MAD', W - mr, y, { align: 'right' });
     y += 6;
    }
    const restedu = Math.max(
     0,
     (res.total || 0) -
      (res.paiements || []).reduce(function (s, p) {
       return s + p.montant;
      }, 0)
    );
    doc.setDrawColor('#EEEEEE');
    line(ml, y, W - mr, y, '#EEEEEE');
    y += 4;
    setFont(7, 'bold', '#0C0E14');
    txt('Reste dû', ml, y);
    setFont(8, 'bold', restedu === 0 ? '#047857' : '#B91C1C');
    txt(fmtNum(restedu) + ' MAD', W - mr, y, { align: 'right' });
    y += 8;
   }
   section('CONDITIONS GÉNÉRALES');
   setFont(6.5, 'normal', '#333333');
   doc.setTextColor(51, 51, 51);
   var lineH = 3.5;
   conditions.forEach(function (cl, i) {
    var block = i + 1 + '. ' + cl;
    var lines = doc.splitTextToSize(block, cw - 8);
    var j = 0;
    for (j = 0; j < lines.length; j++) {
     y = ensurePage(doc, y, lineH + 2);
     doc.text(lines[j], ml + 4, y);
     y += lineH;
    }
    y += 1.5;
   });
   y += 4;
   doc.setTextColor(12, 14, 20);
   y = ensurePage(doc, y, 28);
   const sigW = (cw - 10) / 2;
   doc.setDrawColor('#1A1A1A');
   doc.setLineWidth(0.4);
   line(ml, y, ml + sigW, y, '#1A1A1A');
   line(ml + sigW + 10, y, ml + sigW + 10 + sigW, y, '#1A1A1A');
   doc.setLineWidth(0.2);
   setFont(7, 'normal', '#555555');
   txt('Signature du locataire', ml + sigW / 2, y + 4, { align: 'center' });
   txt(c ? c.prenom + ' ' + c.nom : '', ml + sigW / 2, y + 8, { align: 'center' });
   txt("Cachet et signature de l'agence", ml + sigW + 10 + sigW / 2, y + 4, { align: 'center' });
   txt(agenceNom, ml + sigW + 10 + sigW / 2, y + 8, { align: 'center' });
   doc.save('Contrat_' + contratNum + '_' + (c ? c.nom : 'client') + '.pdf');
  }
  function runPdf() {
   if (global.jspdf) {
    _generatePDF();
    return;
   }
   if (typeof global.invooEnsureJsPdf === 'function') {
    global
     .invooEnsureJsPdf()
     .then(function () {
      if (global.jspdf) _generatePDF();
      else ctx.alAlert('Module PDF indisponible. Rechargez la page (Ctrl+F5) puis réessayez.');
     })
     .catch(function () {
      ctx.alAlert('Impossible de charger le module PDF local.\nRechargez la page (Ctrl+F5) puis réessayez.');
     });
    return;
   }
   ctx.alAlert('Module PDF indisponible. Rechargez la page (Ctrl+F5) puis réessayez.');
  }
  runPdf();
 };

 global.invooContractPrint = {
  attach: function (c) {
   ctx = c;
  },
 };
})(typeof window !== 'undefined' ? window : globalThis);
