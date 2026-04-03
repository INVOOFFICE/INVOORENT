/**
 * Export CSV par entité + export Excel multi-feuilles (tableau de bord).
 *
 * Branchement dans js/01-app-core.js — en fin de fichier, même IIFE que les autres attach :
 *   invooDataExport.attach({ load, KEYS, alAlert, addLog });
 *
 * Offline / PWA : CSV = Blob local uniquement. Excel = `invooEnsureXlsx()` (js/vendor-loader.js)
 * charge xlsx depuis `assets/vendor/xlsx.full.min.js` (présent dans sw.js ASSETS).
 *
 * Handlers HTML inchangés : onclick="exportCSV('veh'|'cl'|'res'|'maint')", exportExcel().
 */
(function (global) {
 'use strict';

 var ctx = null;

 function idEq(a, b) {
  return global.AutoLocCoreUtils && typeof global.AutoLocCoreUtils.idEq === 'function'
   ? global.AutoLocCoreUtils.idEq(a, b)
   : String(a) === String(b);
 }

 function csvEscape(v) {
  if (v === null || v === undefined) return '';
  var s = String(v).replace(/"/g, '""');
  return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s;
 }

 function downloadCSV(filename, rows) {
  var bom = '\uFEFF';
  var csv = bom + rows.map(function (r) {
   return r.map(csvEscape).join(',');
  }).join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
 }

 /** Suffixe fichier export (YYYY-MM-DD) — indépendant de today() du core (sauvegardes). */
 function stamp() {
  return new Date().toISOString().slice(0, 10);
 }

 global.exportCSV = function (type) {
  if (!ctx) return;
  var load = ctx.load;
  var KEYS = ctx.KEYS;
  var vehs = load(KEYS.veh).filter(function (v) {
   return !v._deleted;
  });
  var cls = load(KEYS.cl).filter(function (c) {
   return !c._deleted;
  });
  var res = load(KEYS.res).filter(function (r) {
   return !r._deleted;
  });
  var fmt = function (d) {
   return d ? new Date(d).toLocaleDateString('fr-FR') : '';
  };
  if (type === 'veh') {
   var rows = [
    [
     'Immatriculation',
     'Marque',
     'Modèle',
     'Année',
     'Catégorie',
     'Carburant',
     'Couleur',
     'Kilométrage',
     'Tarif / Jour (MAD)',
     'Statut',
     'Assurance expire le',
     'Vignette expire le',
     'Visite technique le',
     'Assistance (échéance le)',
    ],
   ];
   vehs.forEach(function (v) {
    rows.push([
     v.immat,
     v.marque,
     v.modele,
     v.annee,
     v.categorie || v.cat,
     v.carburant,
     v.couleur,
     v.km,
     v.tarif,
     v.statut,
     v.assurance || '',
     v.vignette || '',
     v.visite || '',
     v.assistance || '',
    ]);
   });
   downloadCSV('vehicules_' + stamp() + '.csv', rows);
  } else if (type === 'cl') {
   var rowsC = [['prenom', 'nom', 'tel', 'email', 'cin', 'permis', 'ville', 'nat', 'adresse']];
   cls.forEach(function (c) {
    rowsC.push([
     c.prenom,
     c.nom,
     c.tel,
     c.email || '',
     c.cin || '',
     c.permis || '',
     c.ville || '',
     c.nat || '',
     c.adresse || '',
    ]);
   });
   downloadCSV('clients_' + stamp() + '.csv', rowsC);
  } else if (type === 'res') {
   var rowsR = [
    [
     'N° Contrat',
     'Client',
     'Véhicule',
     'Immat',
     'Départ',
     'Retour',
     'Jours',
     'Total(MAD)',
     'Payé(MAD)',
     'Reste(MAD)',
     'Caution(MAD)',
     'Statut caution',
     'Statut',
     'Lieu',
     'Notes',
    ],
   ];
   res.forEach(function (r) {
    var c = cls.find(function (x) {
     return idEq(x.id, r.clientId);
    });
    var v = vehs.find(function (x) {
     return idEq(x.id, r.vehId);
    });
    var days =
     r.debut && r.fin
      ? Math.max(1, Math.round((new Date(r.fin) - new Date(r.debut)) / (1000 * 60 * 60 * 24)))
      : 0;
    var paid = (r.paiements || []).reduce(function (s, p) {
     return s + p.montant;
    }, 0);
    var reste = Math.max(0, (r.total || 0) - paid);
    rowsR.push([
     'CTR-' + (r.id || '').slice(-6).toUpperCase(),
     c ? c.prenom + ' ' + c.nom : '',
     v ? v.marque + ' ' + v.modele : '',
     v ? v.immat : '',
     fmt(r.debut),
     fmt(r.fin),
     days,
     r.total || 0,
     paid,
     reste,
     r.caution || 0,
     r.cautionStatut === 'encaissee' ? 'Encaissée' : r.cautionStatut === 'restituee' ? 'Restituée' : 'En attente',
     r.statut,
     r.lieu || '',
     r.notes || '',
    ]);
   });
   downloadCSV('reservations_' + stamp() + '.csv', rowsR);
  } else if (type === 'maint') {
   var maints = load(KEYS.maint);
   var rowsM = [['Véhicule', 'Immat', 'Type', 'Date prévue', 'Km', 'Km seuil', 'Coût(MAD)', 'Statut', 'Notes']];
   maints.forEach(function (m) {
    var v = vehs.find(function (x) {
     return idEq(x.id, m.vehId);
    });
    rowsM.push([
     v ? v.marque + ' ' + v.modele : '',
     v ? v.immat : '',
     m.type,
     fmt(m.date),
     m.km || '',
     m.kmSeuil || '',
     m.cout || 0,
     m.statut,
     m.notes || '',
    ]);
   });
   downloadCSV('maintenance_' + stamp() + '.csv', rowsM);
  }
 };

 global.exportExcel = async function () {
  if (!ctx) return;
  var load = ctx.load;
  var KEYS = ctx.KEYS;
  var alAlert = ctx.alAlert;
  var addLog = ctx.addLog;
  try {
   if (typeof global.invooEnsureXlsx === 'function') await global.invooEnsureXlsx();
  } catch (e) {
   alAlert('Impossible de charger l’export Excel. Vérifiez la connexion ou rechargez la page.');
   return;
  }
  if (typeof XLSX === 'undefined') {
   alAlert('Chargement en cours,réessayez dans 2 secondes…');
   return;
  }
  var vehs = load(KEYS.veh).filter(function (v) {
   return !v._deleted;
  });
  var cls = load(KEYS.cl).filter(function (c) {
   return !c._deleted;
  });
  var res = load(KEYS.res).filter(function (r) {
   return !r._deleted;
  });
  var maints = load(KEYS.maint);
  var fmt = function (d) {
   return d ? new Date(d).toLocaleDateString('fr-FR') : '';
  };
  var wb = XLSX.utils.book_new();
  var vehRows = [
   [
    'Immatriculation',
    'Marque',
    'Modèle',
    'Année',
    'Catégorie',
    'Carburant',
    'Couleur',
    'Kilométrage',
    'Tarif / Jour (MAD)',
    'Statut',
    'Assurance expire le',
    'Vignette expire le',
    'Visite technique le',
    'Assistance (échéance le)',
   ],
  ];
  vehs.forEach(function (v) {
   vehRows.push([
    v.immat,
    v.marque,
    v.modele,
    v.annee,
    v.categorie || v.cat,
    v.carburant,
    v.couleur,
    v.km,
    v.tarif,
    v.statut,
    fmt(v.assurance),
    fmt(v.vignette),
    fmt(v.visite),
    fmt(v.assistance),
   ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vehRows), 'Véhicules');
  var clRows = [['Prénom', 'Nom', 'Téléphone', 'Email', 'CIN/Passeport', 'Permis', 'Ville', 'Nationalité', 'Nb locations']];
  cls.forEach(function (c) {
   var nb = res.filter(function (r) {
    return idEq(r.clientId, c.id);
   }).length;
   clRows.push([c.prenom, c.nom, c.tel, c.email || '', c.cin || '', c.permis || '', c.ville || '', c.nat || '', nb]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(clRows), 'Clients');
  var resRows = [
   [
    'N° Contrat',
    'Client',
    'Véhicule',
    'Immat',
    'Départ',
    'Retour',
    'Jours',
    'Total(MAD)',
    'Payé(MAD)',
    'Reste(MAD)',
    'Caution(MAD)',
    'Statut caution',
    'Statut',
    'Lieu',
    'Notes',
   ],
  ];
  res.forEach(function (r) {
   var c = cls.find(function (x) {
    return idEq(x.id, r.clientId);
   });
   var v = vehs.find(function (x) {
    return idEq(x.id, r.vehId);
   });
   var days =
    r.debut && r.fin
     ? Math.max(1, Math.round((new Date(r.fin) - new Date(r.debut)) / (1000 * 60 * 60 * 24)))
     : 0;
   var paid = (r.paiements || []).reduce(function (s, p) {
    return s + p.montant;
   }, 0);
   var reste = Math.max(0, (r.total || 0) - paid);
   resRows.push([
    'CTR-' + (r.id || '').slice(-6).toUpperCase(),
    c ? c.prenom + ' ' + c.nom : '',
    v ? v.marque + ' ' + v.modele : '',
    v ? v.immat : '',
    fmt(r.debut),
    fmt(r.fin),
    days,
    r.total || 0,
    paid,
    reste,
    r.caution || 0,
    r.cautionStatut === 'encaissee' ? 'Encaissée' : r.cautionStatut === 'restituee' ? 'Restituée' : 'En attente',
    r.statut,
    r.lieu || '',
    r.notes || '',
   ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resRows), 'Réservations');
  var maintRows = [['Véhicule', 'Immat', 'Type', 'Date prévue', 'Km', 'Km seuil', 'Coût(MAD)', 'Statut', 'Notes']];
  maints.forEach(function (m) {
   var v = vehs.find(function (x) {
    return idEq(x.id, m.vehId);
   });
   maintRows.push([
    v ? v.marque + ' ' + v.modele : '',
    v ? v.immat : '',
    m.type,
    fmt(m.date),
    m.km || '',
    m.kmSeuil || '',
    m.cout || 0,
    m.statut,
    m.notes || '',
   ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(maintRows), 'Maintenance');
  XLSX.writeFile(wb, 'INVOORENT_' + stamp() + '.xlsx');
  addLog('Export Excel complet généré');
 };

 global.invooDataExport = {
  attach: function (c) {
   ctx = c;
  },
 };
})(typeof window !== 'undefined' ? window : globalThis);
