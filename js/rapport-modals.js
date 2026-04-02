/**
 * Rapport mensuel (modal tableau de bord).
 * invooRapportModals.attach({ load, KEYS, getSettings, addLog })
 */
(function (global) {
 'use strict';

 var ctx = null;

 const MOIS_RAPPORT = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
 ];

 global.openRapportModal = function () {
  if (!ctx) return;
  const load = ctx.load;
  const KEYS = ctx.KEYS;
  const moisSel = document.getElementById('rapport-mois');
  const annSel = document.getElementById('rapport-annee');
  const now = new Date();
  moisSel.innerHTML = MOIS_RAPPORT.map(
   (m, i) => `<option value="${i}" ${i === now.getMonth() ? 'selected' : ''}>${m}</option>`
  ).join('');
  const years = new Set();
  load(KEYS.res).forEach((r) => {
   if (r.debut) years.add(new Date(r.debut).getFullYear());
  });
  years.add(now.getFullYear());
  annSel.innerHTML = [...years]
   .sort((a, b) => b - a)
   .map((y) => `<option value="${y}" ${y === now.getFullYear() ? 'selected' : ''}>${y}</option>`)
   .join('');
  document.getElementById('rapport-body').innerHTML = '';
  document.getElementById('rapport-modal').classList.add('open');
  global.genererRapport();
 };

 global.genererRapport = function () {
  if (!ctx) return;
  const load = ctx.load;
  const KEYS = ctx.KEYS;
  const getSettings = ctx.getSettings;
  const addLog = ctx.addLog;
  const mois = parseInt(document.getElementById('rapport-mois').value, 10);
  const an = parseInt(document.getElementById('rapport-annee').value, 10);
  const res = load(KEYS.res);
  const vehs = load(KEYS.veh);
  const cls = load(KEYS.cl);
  const maints = load(KEYS.maint);
  const resMois = res.filter((r) => {
   if (!r.debut) return false;
   const d = new Date(r.debut);
   return d.getFullYear() === an && d.getMonth() === mois;
  });
  const terminees = resMois.filter((r) => r.statut === 'terminée');
  const enCours = resMois.filter((r) => r.statut === 'en cours');
  const annulees = resMois.filter((r) => r.statut === 'annulée');
  const ca = terminees.reduce((s, r) => s + (r.total || 0), 0);
  const caEncaisse = terminees.reduce(
   (s, r) => s + (r.paiements || []).reduce((ss, p) => ss + p.montant, 0),
   0
  );
  const caImpaye = ca - caEncaisse;
  const nbJours = resMois.reduce((s, r) => {
   if (!r.debut || !r.fin) return s;
   return s + Math.max(1, Math.round((new Date(r.fin) - new Date(r.debut)) / (1000 * 60 * 60 * 24)));
  }, 0);
  const clientsUniques = new Set(resMois.map((r) => r.clientId)).size;
  const daysInMonth = new Date(an, mois + 1, 0).getDate();
  const tauxOcc = vehs.length ? Math.min(100, Math.round((nbJours / (vehs.length * daysInMonth)) * 100)) : 0;
  const vehStats = vehs
   .map((v) => {
    const rV = resMois.filter((r) => r.vehId === v.id && r.statut === 'terminée');
    return { v, ca: rV.reduce((s, r) => s + (r.total || 0), 0), nb: rV.length };
   })
   .filter((x) => x.ca > 0)
   .sort((a, b) => b.ca - a.ca);
  const maxCaVeh = vehStats[0]?.ca || 1;
  const maintMois = maints.filter((m) => {
   if (!m.date) return false;
   const d = new Date(m.date);
   return d.getFullYear() === an && d.getMonth() === mois;
  });
  const coutMaint = maintMois.reduce((s, m) => s + (m.cout || 0), 0);
  const clientStats = cls
   .map((c) => {
    const rC = resMois.filter((r) => r.clientId === c.id && r.statut === 'terminée');
    return { c, ca: rC.reduce((s, r) => s + (r.total || 0), 0), nb: rC.length };
   })
   .filter((x) => x.nb > 0)
   .sort((a, b) => b.ca - a.ca)
   .slice(0, 5);
  const fmt = (n) => n.toLocaleString('fr-FR');
  document.getElementById('rapport-body').innerHTML = `
<div style="text-align:center;margin-bottom:18px;"><p style="font-size:1rem;font-weight:700;color:var(--accent)">${window.AutoLocUtils.escapeHtml(getSettings().nom || 'INVOORENT')}— Rapport ${MOIS_RAPPORT[mois]}${an}</p><p style="font-size:0.75rem;color:var(--text3)">Généré le ${new Date().toLocaleDateString('fr-FR')}</p></div><div class="rapport-kpis"><div class="rapport-kpi"><strong>${fmt(ca)}MAD</strong><span>CA réalisé</span></div><div class="rapport-kpi"><strong>${resMois.length}</strong><span>Locations</span></div><div class="rapport-kpi"><strong>${tauxOcc}%</strong><span>Taux occupation</span></div><div class="rapport-kpi"><strong>${clientsUniques}</strong><span>Clients actifs</span></div></div><div class="rapport-section"><h4>Synthèse financière</h4><div class="rapport-row"><span>CA total(locations terminées)</span><strong>${fmt(ca)}MAD</strong></div><div class="rapport-row"><span>Montant encaissé</span><strong style="color:var(--success)">${fmt(caEncaisse)}MAD</strong></div><div class="rapport-row"><span>Reste à encaisser</span><strong style="color:${caImpaye > 0 ? 'var(--danger)' : 'var(--success)'}">${fmt(caImpaye)}MAD</strong></div><div class="rapport-row"><span>Coût maintenance</span><strong style="color:var(--warning)">${fmt(coutMaint)}MAD</strong></div><div class="rapport-row" style="border-top:2px solid var(--border);margin-top:4px;padding-top:8px"><span><strong>Marge nette estimée</strong></span><strong style="color:var(--accent);font-size:1rem">${fmt(caEncaisse - coutMaint)}MAD</strong></div></div><div class="rapport-section"><h4>Activité locations</h4><div class="rapport-row"><span>Locations en cours</span><strong>${enCours.length}</strong></div><div class="rapport-row"><span>Locations terminées</span><strong>${terminees.length}</strong></div><div class="rapport-row"><span>Locations annulées</span><strong>${annulees.length}</strong></div><div class="rapport-row"><span>Total jours loués</span><strong>${nbJours}jours</strong></div><div class="rapport-row"><span>Taux d'occupation flotte</span><strong>${tauxOcc}%(${vehs.length}véh. × ${daysInMonth}j)</strong></div><div class="rapport-row"><span>Interventions maintenance</span><strong>${maintMois.length}</strong></div></div>
 ${vehStats.length ? `
<div class="rapport-section"><h4>Rentabilité véhicules</h4>
 ${vehStats
  .map(
   (x, i) => `
<div class="rapport-top-veh"><div class="rapport-rank" style="background:${i === 0 ? 'rgba(251,191,36,0.16)' : i === 1 ? 'rgba(45,212,191,0.15)' : 'rgba(59,130,246,0.16)'};color:${i === 0 ? '#fde68a' : i === 1 ? '#99f6e4' : '#93c5fd'}">${i + 1}</div><div style="min-width:140px;font-size:0.82rem"><strong>${window.AutoLocUtils.escapeHtml(x.v?.marque)}${window.AutoLocUtils.escapeHtml(x.v?.modele)}</strong><br><span style="color:var(--text3);font-size:0.7rem">${window.AutoLocUtils.escapeHtml(x.v?.immat)}· ${x.nb}loc.</span></div><div class="rapport-bar-wrap"><div class="rapport-bar-track"><div class="rapport-bar-fill" style="width:${Math.round((x.ca / maxCaVeh) * 100)}%;background:${i === 0 ? '#f59e0b' : '#2dd4bf'}"></div></div></div><strong style="font-size:0.85rem;white-space:nowrap">${fmt(x.ca)}MAD</strong></div>`
  )
  .join('')}
</div>` : ''}
 ${clientStats.length ? `
<div class="rapport-section"><h4>Top clients</h4>
 ${clientStats
  .map(
   (x, i) => `
<div class="rapport-row"><span>${i + 1}. ${window.AutoLocUtils.escapeHtml(x.c?.prenom)}${window.AutoLocUtils.escapeHtml(x.c?.nom)}<span style="color:var(--text3);font-size:0.72rem">(${x.nb}location${x.nb > 1 ? 's' : ''})</span></span><strong>${fmt(x.ca)}MAD</strong></div>`
  )
  .join('')}
</div>` : ''}
 ${resMois.length === 0 ? `<div class="empty-state" style="padding:32px"><p>Aucune location ce mois-ci</p></div>` : ''}
 `;
  addLog(`Rapport ${MOIS_RAPPORT[mois]}${an}généré`);
 };

 global.invooRapportModals = {
  attach: function (c) {
   ctx = c;
  },
 };
})(typeof window !== 'undefined' ? window : globalThis);
