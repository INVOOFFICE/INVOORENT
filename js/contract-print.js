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

 /** px CSS → mm jsPDF (96 dpi) */
 function pxToMm(px) {
  return (Number(px) || 0) * 0.264583;
 }

 /** Évite RC: RC: … si le champ patente contient déjà RC ou Patente. */
 function formatPatenteContrat(pat) {
  var t = String(pat == null ? '' : pat).trim();
  if (!t) return '';
  if (/^RC\b/i.test(t) || /^Patente\b/i.test(t)) return t;
  return 'RC / Patente : ' + t;
 }

 function buildContractHeaderLeftHtml(s) {
  var agenceNom = s.nom || 'INVOORENT';
  var agenceSlogan = s.slogan || 'Gérez, louez, développez';
  var agenceVille = s.ville || 'Tanger,Maroc';
  var agenceTel = s.tel || '+212 5XX XX XX XX';
  var esc = window.AutoLocUtils.escapeHtml;
  var textBlock =
   '<h2>' +
   esc(agenceNom).replace(/(\S+)$/, '<span>$1</span>') +
   '</h2><p>' +
   esc(agenceSlogan) +
   '</p><p style="margin-top:4px;font-size:0.72rem;color:#9A9A9A">' +
   esc(agenceVille) +
   '— Tél: ' +
   esc(agenceTel) +
   (s.email ? ' — ' + esc(s.email) : '') +
   (s.site ? ' — ' + esc(s.site) : '') +
   '</p>\n ' +
   (s.patente
    ? '<p style="font-size:0.7rem;color:#9A9A9A;margin-top:2px">' +
      esc(formatPatenteContrat(s.patente)) +
      '</p>'
    : '');
  var logoUrl = s.logoDataUrl || '';
  var hasLogo = logoUrl.indexOf('data:image') === 0;
  var logoH = Math.min(400, Math.max(16, parseInt(s.logoHeightPx, 10) || 48));
  var showInfos = s.logoAfficherInfosAgence !== false;
  if (!hasLogo) {
   return '<div class="contrat-logo">' + textBlock + '</div>';
  }
  var safeSrc = String(logoUrl).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  var logoImg =
   '<img class="contrat-header-logo-img" src="' +
   safeSrc +
   '" alt="" style="height:' +
   logoH +
   'px;width:auto;max-width:100%;object-fit:contain;display:block" />';
  if (!showInfos) {
   return '<div class="contrat-header-logo-only">' + logoImg + '</div>';
  }
  return (
   '<div class="contrat-header-brand-split">' +
   '<div class="contrat-header-logo-wrap">' +
   logoImg +
   '</div><div class="contrat-logo">' +
   textBlock +
   '</div></div>'
  );
 }

 function buildDocumentFooterHtml(s) {
  var t = s.documentFooter;
  if (!t || !String(t).trim()) return '';
  var esc =
   window.AutoLocUtils && typeof window.AutoLocUtils.escapeHtml === 'function'
    ? window.AutoLocUtils.escapeHtml
    : function (x) {
       return String(x)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
      };
  return (
   '<div class="contrat-doc-footer">' + esc(t).replace(/\n/g, '<br>') + '</div>'
  );
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
  const useEtatLieuxContrat = s.etatLieuxContrat === true;
  const etatHtml =
   useEtatLieuxContrat &&
   global.invooEtatLieux &&
   typeof global.invooEtatLieux.buildContractHtml === 'function'
    ? global.invooEtatLieux.buildContractHtml(r.etatLieux)
    : '';
  document.getElementById('contrat-body').innerHTML =
   '\n<div class="contrat-header"><div class="contrat-header-left">' +
   buildContractHeaderLeftHtml(s) +
   '</div><div class="contrat-meta"><span>N° Contrat</span><strong>' +
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
   '</p></div></div>' +
   buildDocumentFooterHtml(s) +
   '\n ';
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
   const agenceVille = s.ville || 'Tanger, Maroc';
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
   const conditionsRaw = (s.conditions || ctx.conditionsDefaut).split('\n').filter(function (l) {
    return l.trim();
   });
   var conditions = conditionsRaw.slice(0, 14);
   const useEtatLieuxContrat = s.etatLieuxContrat === true;
   const W = 210;
   const ml = 10;
   const mr = 10;
   const cw = W - ml - mr;
   const PAGE_MAX_Y = 287;
   function ensurePage(yy, needMm) {
    if (yy + needMm <= PAGE_MAX_Y) return yy;
    doc.addPage();
    return 10;
   }
   var y = 10;

   const BLUE = [26, 60, 110];
   const BLUE_LIGHT = [46, 92, 154];
   const BLUE_MUTED = [160, 184, 216];
   const BLUE_LINE = [58, 106, 170];
   const ORANGE_RESTE = [255, 153, 102];
   const TEXT_DARK = [26, 26, 26];
   const TEXT_MED = [85, 85, 85];
   const TEXT_DIM = [136, 136, 136];
   const TEXT_LIGHT = [153, 153, 153];
   const WHITE = [255, 255, 255];

   function txt(t, x, yy, opts) {
    doc.text(String(t || ''), x, yy, opts);
   }
   function setTextRgb(arr) {
    doc.setTextColor(arr[0], arr[1], arr[2]);
   }
   function setFillRgb(arr) {
    doc.setFillColor(arr[0], arr[1], arr[2]);
   }
   function setDrawRgb(arr) {
    doc.setDrawColor(arr[0], arr[1], arr[2]);
   }

   var logoUrlPdf = s.logoDataUrl || '';
   var hasLogoPdf = logoUrlPdf.indexOf('data:image') === 0;
   var showInfosPdf = s.logoAfficherInfosAgence !== false;
   var logoHpxPdf = Math.min(400, Math.max(16, parseInt(s.logoHeightPx, 10) || 48));
   var imgWp = s.logoImgWidth || 0;
   var imgHp = s.logoImgHeight || 0;
   var hMmLogo = pxToMm(logoHpxPdf);
   var wMmLogo =
    imgWp > 0 && imgHp > 0 ? hMmLogo * (imgWp / imgHp) : Math.min(34, hMmLogo * 2.4);
   var headerH = 11;
   var logoGapMm = 4;
   var maxLogoH = 16;
   var maxLogoW = 36;
   var lw = 0;
   var lh = 0;
   var logoBlockW = headerH;

   if (hasLogoPdf) {
    lw = wMmLogo;
    lh = hMmLogo;
    if (lh > maxLogoH) {
     var scH = maxLogoH / lh;
     lh = maxLogoH;
     lw = lw * scH;
    }
    if (lw > maxLogoW) {
     var scW = maxLogoW / lw;
     lw = maxLogoW;
     lh = lh * scW;
    }
    var imgFmt = logoUrlPdf.indexOf('image/png') >= 0 ? 'PNG' : 'JPEG';
    try {
     doc.addImage(logoUrlPdf, imgFmt, ml, y, lw, lh);
     logoBlockW = lw;
    } catch (e1) {
     try {
      doc.addImage(logoUrlPdf, 'PNG', ml, y, lw, lh);
      logoBlockW = lw;
     } catch (e2) {
      try {
       doc.addImage(logoUrlPdf, 'JPEG', ml, y, lw, lh);
       logoBlockW = lw;
      } catch (e3) {
       hasLogoPdf = false;
       lw = 0;
       lh = 0;
      }
     }
    }
   }
   if (!hasLogoPdf) {
    setFillRgb(BLUE);
    doc.roundedRect(ml, y, headerH, headerH, 1.5, 1.5, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    setTextRgb(WHITE);
    txt('CAR', ml + 2.8, y + 7);
    logoBlockW = headerH;
   }

   var textLeftX = ml + logoBlockW + logoGapMm;
   var textMaxW = W - mr - textLeftX - 2;
   var patenteLine = s.patente ? formatPatenteContrat(s.patente) : '';

   if (!hasLogoPdf || showInfosPdf) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    setTextRgb(BLUE);
    var nomLines = doc.splitTextToSize(agenceNom, textMaxW);
    txt(nomLines[0] || agenceNom, textLeftX, y + 5);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    setTextRgb(TEXT_MED);
    var slogLines = doc.splitTextToSize(agenceSlogan, textMaxW);
    txt(slogLines[0] || agenceSlogan, textLeftX, y + 8.5);
    doc.setFont('helvetica', 'normal');
    var contactLn =
     agenceVille + ' — Tél: ' + agenceTel + (s.email ? ' — ' + s.email : '');
    doc.setFontSize(7.5);
    setTextRgb(TEXT_DIM);
    var contactLines = doc.splitTextToSize(contactLn, textMaxW);
    txt(contactLines[0] || contactLn, textLeftX, y + 11.5);
    var yPat = y + 14.5;
    if (patenteLine) {
     doc.setFontSize(7);
     setTextRgb(TEXT_LIGHT);
     var patLines = doc.splitTextToSize(patenteLine, textMaxW);
     for (var pi = 0; pi < patLines.length; pi++) {
      txt(patLines[pi], textLeftX, yPat + pi * 3.2);
     }
    }
   }

   doc.setFont('helvetica', 'normal');
   doc.setFontSize(8);
   setTextRgb(TEXT_DIM);
   txt('N° Contrat', W - mr, y + 3, { align: 'right' });
   doc.setFont('helvetica', 'bold');
   doc.setFontSize(16);
   setTextRgb(BLUE);
   txt(contratNum, W - mr, y + 8, { align: 'right' });
   doc.setFont('helvetica', 'normal');
   doc.setFontSize(8);
   setTextRgb(TEXT_MED);
   txt('Date : ' + new Date().toLocaleDateString('fr-FR'), W - mr, y + 11.5, { align: 'right' });
   var yRightMetaBottom = y + 12.5;
   if (res && res.statut) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setTextRgb(TEXT_MED);
    txt('Statut : ' + String(res.statut), W - mr, y + 15.2, { align: 'right' });
    yRightMetaBottom = y + 18;
   }

   var yAfterLogo = y + (hasLogoPdf ? lh : headerH);
   var yAfterText = y;
   if (!hasLogoPdf || showInfosPdf) {
    var patExtra = patenteLine ? (doc.splitTextToSize(patenteLine, textMaxW).length - 1) * 3.2 : 0;
    yAfterText = y + 14.5 + patExtra + (patenteLine ? 2.5 : 0);
   } else {
    yAfterText = yAfterLogo;
   }
   var yHeaderBottom = Math.max(yAfterLogo, yAfterText, yRightMetaBottom) + 2;
   y = yHeaderBottom + 3;
   setDrawRgb(BLUE);
   doc.setLineWidth(0.6);
   doc.line(ml, y, W - mr, y);
   y += 3;

   setFillRgb(BLUE);
   doc.roundedRect(ml, y, cw, 6, 1, 1, 'F');
   doc.setFont('helvetica', 'bold');
   doc.setFontSize(11);
   setTextRgb(WHITE);
   txt('CONTRAT DE LOCATION DE VÉHICULE', ml + cw / 2, y + 4.2, { align: 'center' });
   y += 8;

   function sectionBar(label, fillRgb) {
    y = ensurePage(y, 12);
    setFillRgb(fillRgb || BLUE);
    doc.roundedRect(ml, y, cw, 5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setTextRgb(WHITE);
    txt(label, ml + 2, y + 3.4);
    y += 6.5;
   }

   /** Ligne type tableau : label (colonne fixe) + valeur, retours à la ligne si besoin. */
   function drawLabelValueRow(xBase, width, pair, opts) {
    opts = opts || {};
    var labelColW = opts.labelColW != null ? opts.labelColW : 40;
    var valueX = xBase + labelColW;
    var valueW = Math.max(14, width - labelColW - 2.5);
    var lab = pair[0];
    var val = String(pair[1] != null ? pair[1] : '—');
    var lineStep = 2.75;
    var firstBaseline = 2.15;
    var tailBelowLastLine = 1.35;
    var valueBold =
     opts.valueBold != null
      ? opts.valueBold
      : lab === 'Nom complet' ||
        lab === 'Téléphone' ||
        lab === 'Ville' ||
        lab.indexOf('Date') === 0 ||
        lab === 'N° Permis de conduire';
    var valueBlue =
     opts.valueBlue != null
      ? opts.valueBlue
      : lab === 'Email' ||
        lab.indexOf('Tarif') >= 0 ||
        lab.indexOf('Caution') >= 0 ||
        lab === 'Caution (remboursable)';

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setTextRgb(TEXT_DIM);
    var labelLines = doc.splitTextToSize(lab, labelColW - 0.5);

    doc.setFont('helvetica', valueBold ? 'bold' : 'normal');
    doc.setFontSize(8);
    setTextRgb(valueBlue ? BLUE : TEXT_DARK);
    var valueLines = doc.splitTextToSize(val, valueW);

    var n = Math.max(labelLines.length, valueLines.length, 1);
    var rowH =
     firstBaseline + (n > 1 ? (n - 1) * lineStep : 0) + tailBelowLastLine;
    var minH = rowH;
    return { lines: n, minH: minH, draw: function (curTop) {
     var i = 0;
     for (i = 0; i < n; i++) {
      var yy = curTop + firstBaseline + i * lineStep;
      if (labelLines[i]) {
       doc.setFont('helvetica', 'normal');
       doc.setFontSize(7.5);
       setTextRgb(TEXT_DIM);
       txt(labelLines[i], xBase + 0.5, yy);
      }
      if (valueLines[i]) {
       doc.setFont('helvetica', valueBold ? 'bold' : 'normal');
       doc.setFontSize(8);
       setTextRgb(valueBlue ? BLUE : TEXT_DARK);
       txt(valueLines[i], valueX, yy);
      }
     }
     var rowHDraw =
      firstBaseline + (n > 1 ? (n - 1) * lineStep : 0) + tailBelowLastLine;
     setDrawRgb([238, 238, 238]);
     doc.setLineWidth(0.15);
     doc.line(xBase, curTop + rowHDraw, xBase + width, curTop + rowHDraw);
     return curTop + rowHDraw;
    }};
   }

   function rowPair2Col(pairs) {
    var gutter = 5;
    var colW = (cw - gutter) / 2;
    var midX = ml + colW + gutter;
    var half = Math.ceil(pairs.length / 2);
    var left = pairs.slice(0, half);
    var right = pairs.slice(half);
    var labelColHalf = 40;
    var yL = y;
    var yR = y;
    function drawSide(list, xBase, width, yyStart) {
     var cur = yyStart;
     list.forEach(function (pair) {
      var lay = drawLabelValueRow(xBase, width, pair, { labelColW: labelColHalf });
      cur = ensurePage(cur, lay.minH + 0.2);
      cur = lay.draw(cur);
     });
     return cur;
    }
    yL = drawSide(left, ml, colW, yL);
    yR = drawSide(right, midX, colW, yR);
    y = Math.max(yL, yR) + 0.5;
   }

   sectionBar('INFORMATIONS DU LOCATAIRE');
   rowPair2Col([
    ['Nom complet', c ? c.prenom + ' ' + c.nom : '—'],
    ['CIN / Passeport', c?.cin || '—'],
    ['Téléphone', c?.tel || '—'],
    ['N° Permis de conduire', c?.permis || '—'],
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
    sectionBar('CONDUCTEUR(S) ADDITIONNEL(S)', BLUE_LIGHT);
    secDriversPdf.forEach(function (cd) {
     const lab =
      cd.docType === 'cin'
       ? 'CIN'
       : cd.docType === 'passeport'
        ? 'Passeport'
        : 'N° Permis de conduire';
     rowPair2Col([
      ['Nom complet', [cd.prenom, cd.nom].filter(Boolean).join(' ') || '—'],
      [lab, cd.docNum || '—'],
     ]);
    });
   }

   var colGutter = 5;
   var col_w = (cw - colGutter) / 2;
   var mid = ml + col_w + colGutter;
   var vehLabelW = 42;
   y = ensurePage(y, 8);
   setFillRgb(BLUE);
   doc.roundedRect(ml, y, col_w, 5, 1, 1, 'F');
   doc.roundedRect(mid, y, col_w, 5, 1, 1, 'F');
   doc.setFont('helvetica', 'bold');
   doc.setFontSize(9);
   setTextRgb(WHITE);
   txt('VÉHICULE LOUÉ', ml + 2, y + 3.4);
   txt('DÉTAILS DE LA LOCATION', mid + 2, y + 3.4);
   y += 6.5;

   var leftRows = [
    ['Marque / Modèle', v ? v.marque + ' ' + v.modele : '—'],
    ['Immatriculation', v?.immat || '—'],
    ['Année', String(v?.annee || '—')],
    ['Catégorie', v?.cat || '—'],
    ['Couleur', v?.couleur || '—'],
    ['Carburant', v?.carburant || '—'],
    ['Kilométrage départ', v?.km ? fmtNum(v.km) + ' km' : '—'],
    ['Tarif journalier', (v?.tarif != null ? v.tarif : '—') + ' MAD/j'],
   ];
   var rightRows = [
    ['Date de départ', fmt(res.debut)],
    ['Date de retour prévue', fmt(res.fin)],
    ['Durée', days + ' jour' + (days > 1 ? 's' : '')],
    ['Lieu de prise en charge', res.lieu && String(res.lieu).trim() ? res.lieu : '—'],
   ];
   if (res.caution > 0) {
    rightRows.push(['Caution (remboursable)', fmtNum(res.caution) + ' MAD']);
   }
   if (res.notes) {
    rightRows.push(['Remarques', res.notes]);
   }

   var y_l = y;
   var y_r = y;
   leftRows.forEach(function (pair) {
    var blueV =
     pair[0].indexOf('Tarif') >= 0 ||
     pair[0].indexOf('Marque') >= 0 ||
     pair[0].indexOf('Immat') >= 0 ||
     pair[0].indexOf('Kilométrage') >= 0;
    var lay = drawLabelValueRow(ml, col_w, pair, {
     labelColW: vehLabelW,
     valueBold: true,
     valueBlue: blueV,
    });
    y_l = ensurePage(y_l, lay.minH + 0.2);
    y_l = lay.draw(y_l);
   });
   rightRows.forEach(function (pair) {
    var blueV = pair[0].indexOf('Caution') >= 0;
    var lay = drawLabelValueRow(mid, col_w, pair, {
     labelColW: vehLabelW,
     valueBold: true,
     valueBlue: blueV,
    });
    y_r = ensurePage(y_r, lay.minH + 0.2);
    y_r = lay.draw(y_r);
   });
   var yAfterCols = Math.max(y_l, y_r) + 0.5;

   var paid = (res.paiements || []).reduce(function (s, p) {
    return s + (Number(p && p.montant) || 0);
   }, 0);
   var restedu = Math.max(0, (res.total || 0) - paid);
   var box_x = mid;
   var box_w = col_w;
   var box_h = 28;
   y = ensurePage(yAfterCols, box_h + 4);
   var yBox = yAfterCols;
   setFillRgb(BLUE);
   doc.roundedRect(box_x, yBox, box_w, box_h, 1.2, 1.2, 'F');
   doc.setFont('helvetica', 'normal');
   doc.setFontSize(8);
   setTextRgb(BLUE_MUTED);
   txt('Montant total de la location', box_x + 3, yBox + 5);
   doc.setFontSize(8);
   txt(
    days + ' jour' + (days > 1 ? 's' : '') + ' × ' + (v?.tarif || 0) + ' MAD',
    box_x + 3,
    yBox + 8.5
   );
   doc.setFont('helvetica', 'bold');
   doc.setFontSize(16);
   setTextRgb(WHITE);
   txt(fmtNum(res.total || 0) + ' MAD', box_x + box_w - 3, yBox + 13, { align: 'right' });
   setDrawRgb(BLUE_LINE);
   doc.setLineWidth(0.2);
   doc.line(box_x + 3, yBox + 15, box_x + box_w - 3, yBox + 15);
   doc.setFont('helvetica', 'normal');
   doc.setFontSize(9);
   setTextRgb(BLUE_MUTED);
   txt('Caution (remboursable)', box_x + 3, yBox + 18);
   doc.setFont('helvetica', 'bold');
   setTextRgb(WHITE);
   txt(fmtNum(res.caution || 0) + ' MAD', box_x + box_w - 3, yBox + 18, { align: 'right' });
   doc.setFont('helvetica', 'normal');
   setTextRgb(BLUE_MUTED);
   txt('Reste dû', box_x + 3, yBox + 22.5);
   doc.setFont('helvetica', 'bold');
   doc.setFontSize(11);
   setTextRgb(ORANGE_RESTE);
   txt(fmtNum(restedu) + ' MAD', box_x + box_w - 3, yBox + 22.5, { align: 'right' });
   y = yBox + box_h + 3;

   if (
    useEtatLieuxContrat &&
    global.invooEtatLieux &&
    typeof global.invooEtatLieux.drawPdf === 'function'
   ) {
    y = ensurePage(y, 40);
    y = global.invooEtatLieux.drawPdf(doc, ml, y, cw, res.etatLieux);
   }

   sectionBar('CONDITIONS GÉNÉRALES');
   var nC = conditions.length;
   var halfC = Math.ceil(nC / 2);
   var col1 = conditions.slice(0, halfC);
   var col2 = conditions.slice(halfC);
   var midC = ml + cw / 2;
   var maxRows = Math.max(col1.length, col2.length);
   var condLineStep = 2.65;
   var condTopPad = 1.9;
   for (var ri = 0; ri < maxRows; ri++) {
    var line1 = ri < col1.length ? doc.splitTextToSize(col1[ri], midC - ml - 9) : [];
    var line2 = ri < col2.length ? doc.splitTextToSize(col2[ri], ml + cw - midC - 9) : [];
    var condLines = Math.max(line1.length, line2.length, 1);
    var condRowH =
     condTopPad +
     (condLines > 1 ? (condLines - 1) * condLineStep : 0) +
     2 +
     0.35;
    y = ensurePage(y, condRowH + 0.2);
    var baseY = y;
    if (ri < col1.length) {
     var idx1 = ri + 1;
     doc.setFont('helvetica', 'bold');
     doc.setFontSize(8);
     setTextRgb(BLUE);
     txt(String(idx1) + '.', ml + 1, baseY + condTopPad);
     doc.setFont('helvetica', 'normal');
     setTextRgb(TEXT_DARK);
     line1.forEach(function (ln, li) {
      txt(ln, ml + 5.5, baseY + condTopPad + li * condLineStep);
     });
    }
    if (ri < col2.length) {
     var idx2 = halfC + ri + 1;
     doc.setFont('helvetica', 'bold');
     setTextRgb(BLUE);
     txt(String(idx2) + '.', midC + 1, baseY + condTopPad);
     doc.setFont('helvetica', 'normal');
     setTextRgb(TEXT_DARK);
     line2.forEach(function (ln, li) {
      txt(ln, midC + 5.5, baseY + condTopPad + li * condLineStep);
     });
    }
    setDrawRgb([240, 240, 240]);
    doc.line(ml, baseY + condRowH, ml + cw, baseY + condRowH);
    y = baseY + condRowH;
   }
   y += 2;

   var sigW = (cw - 4) / 2;
   var sigH = 22;
   y = ensurePage(y, sigH + 6);
   setDrawRgb([221, 221, 221]);
   doc.setLineWidth(0.5);
   doc.roundedRect(ml, y, sigW, sigH, 1, 1, 'S');
   doc.roundedRect(ml + sigW + 4, y, sigW, sigH, 1, 1, 'S');
   doc.setFont('helvetica', 'normal');
   doc.setFontSize(8);
   setTextRgb(TEXT_DIM);
   txt('Signature du locataire', ml + 3, y + 4);
   txt('Cachet et signature de l\'agence', ml + sigW + 7, y + 4);
   setDrawRgb([170, 170, 170]);
   doc.setLineWidth(0.2);
   doc.line(ml + 3, y + 14, ml + sigW - 3, y + 14);
   doc.line(ml + sigW + 7, y + 14, ml + cw - 3, y + 14);
   doc.setFont('helvetica', 'italic');
   doc.setFontSize(11);
   setTextRgb(BLUE);
   var locName = c ? c.prenom + ' ' + c.nom : '';
   txt(locName, ml + 3, y + 12);
   doc.setFont('helvetica', 'normal');
   doc.setFontSize(8);
   setTextRgb(TEXT_MED);
   txt(locName, ml + 3, y + 18);
   var stampCx = ml + sigW + 4 + sigW / 2;
   doc.setFont('helvetica', 'bold');
   doc.setFontSize(8);
   setTextRgb(BLUE);
   txt('AGENCE', stampCx, y + 11, { align: 'center' });
   doc.setFont('helvetica', 'normal');
   doc.setFontSize(8);
   setTextRgb(TEXT_MED);
   txt(agenceNom, stampCx, y + 18, { align: 'center' });
   y += sigH + 4;

   setDrawRgb(BLUE);
   doc.setLineWidth(0.35);
   doc.line(ml, y, ml + cw, y);
   y += 4;
   doc.setFont('helvetica', 'normal');
   doc.setFontSize(7.5);
   setTextRgb(TEXT_LIGHT);
   var foot =
    s.documentFooter && String(s.documentFooter).trim()
     ? String(s.documentFooter).trim()
     : agenceNom +
       '  |  ' +
       agenceVille +
       ' — Tél: ' +
       agenceTel +
       (s.email ? ' — ' + s.email : '') +
       (patenteLine ? '  |  ' + patenteLine : '');
   var footLines = doc.splitTextToSize(foot, cw - 4).slice(0, 3);
   footLines.forEach(function (ln) {
    txt(ln, ml + cw / 2, y, { align: 'center' });
    y += 3.2;
   });

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
