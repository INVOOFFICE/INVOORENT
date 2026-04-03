/**
 * Grille des réservations + filtres par statut (page Réservations).
 *
 * Branchement dans js/01-app-core.js — en fin de fichier, dans le même IIFE que les
 * autres attach (après load, KEYS, save, etc.) :
 *   invooReservationsRender.attach({ load, KEYS });
 *
 * Dépendances : `load` / `KEYS` lus comme aujourd’hui (données OPFS / localStorage via le
 * core) — aucun changement de stockage. Les boutons des cartes appellent toujours les
 * fonctions globales : js/reservations-modal.js (closeRental, editRes, deleteRes, sendWhatsApp),
 * core / autres modules (openPayModal, printContrat).
 *
 * Appels indirects : navigation `page === 'reservations'`, saveReservation / closeRental /
 * deleteRes (reservations-modal), invooPaymentModals (via window.renderReservations), sync Supabase.
 */
(function (global) {
 'use strict';

 function idEq(a, b) {
  return global.AutoLocCoreUtils && typeof global.AutoLocCoreUtils.idEq === 'function'
   ? global.AutoLocCoreUtils.idEq(a, b)
   : String(a) === String(b);
 }

 var ctx = null;
 /** Filtre actif des boutons #res-filters (état module, comme l’ancien resFilter global). */
 var resFilter = 'all';

 global.filterRes = function (el, f) {
  if (!ctx) return;
  document.querySelectorAll('#res-filters .filter-btn').forEach(function (b) {
   b.classList.remove('active');
  });
  el.classList.add('active');
  resFilter = f;
  global.renderReservations();
 };

 global.renderReservations = function () {
  if (!ctx) return;
  var load = ctx.load;
  var KEYS = ctx.KEYS;
  var data = load(KEYS.res).filter(function (r) {
   return !r._deleted;
  });
  if (resFilter !== 'all') {
   data = data.filter(function (r) {
    return r.statut === resFilter;
   });
  }
  var clients = load(KEYS.cl).filter(function (c) {
   return !c._deleted;
  });
  var vehs = load(KEYS.veh).filter(function (v) {
   return !v._deleted;
  });
  var grid = document.getElementById('res-grid');
  if (!grid) return;
  if (!data.length) {
   grid.innerHTML = `<div class="empty-state"><svg viewBox="0 0 48 48" fill="none"><rect x="6" y="10" width="36" height="32" rx="4" fill="#F5F5F7" stroke="#D0D0D8" stroke-width="1.5"/><path d="M16 6v8M32 6v8M6 22h36" stroke="#D0D0D8" stroke-width="1.5" stroke-linecap="round"/><path d="M14 30h8M14 36h14" stroke="#C8C9D3" stroke-width="1.5" stroke-linecap="round"/><circle cx="38" cy="38" r="8" fill="#2dd4bf"/><path d="M35 38h6M38 35v6" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg><h4>Aucune réservation</h4><p>Créez votre première réservation</p></div>`;
   return;
  }
  grid.innerHTML = `<div class="grid-2">${data
   .map(function (r) {
    var c = clients.find(function (x) {
     return idEq(x.id, r.clientId);
    });
    var v = vehs.find(function (x) {
     return idEq(x.id, r.vehId);
    });
    var badgeCls =
     r.statut === 'en cours' ? 'badge-info' : r.statut === 'terminée' ? 'badge-success' : 'badge-danger';
    var paid = (r.paiements || []).reduce(function (s, p) {
     return s + p.montant;
    }, 0);
    var total = r.total || 0;
    var caution = r.caution || 0;
    var payPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
    var payBadge =
     paid === 0
      ? `<span class="pay-badge-none">Non payé</span>`
      : paid >= total
       ? `<span class="pay-badge-full">Soldé ✓</span>`
       : `<span class="pay-badge-partial">${payPct}% payé</span>`;
    return `<div class="rental-card" data-res-id="${window.AutoLocUtils.escapeHtml(String(r.id))}"><div class="rental-card-header"><div><h4>${c ? window.AutoLocUtils.escapeHtml(c.prenom) + ' ' + window.AutoLocUtils.escapeHtml(c.nom) : 'Client inconnu'}</h4><div style="margin-top:4px;display:flex;gap:5px;align-items:center;flex-wrap:wrap;"><span class="badge ${badgeCls}">${window.AutoLocUtils.escapeHtml(r.statut)}</span>
 ${payBadge}
 ${caution > 0 ? `<span style="background:rgba(45,212,191,0.14);color:#99f6e4;padding:2px 8px;border-radius:12px;font-size:0.68rem;font-weight:700;border:1px solid rgba(45,212,191,0.3);">Caution : ${caution} MAD</span>` : ''}
</div></div><span class="total-badge">${total || '—'} MAD</span></div><div class="rental-info"><strong>Véhicule :</strong>${v ? window.AutoLocUtils.escapeHtml(v.marque) + ' ' + window.AutoLocUtils.escapeHtml(v.modele) + ' (' + window.AutoLocUtils.escapeHtml(v.immat) + ')' : '—'}<br><strong>Période :</strong>${window.AutoLocUtils.escapeHtml(r.debut)} → ${window.AutoLocUtils.escapeHtml(r.fin)}<br><strong>Lieu :</strong>${window.AutoLocUtils.escapeHtml(r.lieu || '—')}<br>
 ${r.notes ? `<strong>Notes :</strong>${window.AutoLocUtils.escapeHtml(r.notes)}` : ''}
</div><div class="rental-actions">
 ${r.statut === 'en cours' ? `<button class="btn btn-sm btn-outline" onclick="closeRental('${window.AutoLocUtils.escapeHtml(r.id)}')">Clôturer</button>` : ''}
<button class="btn btn-sm btn-outline" onclick="openPayModal('${window.AutoLocUtils.escapeHtml(r.id)}')" style="color:var(--success);border-color:var(--success);"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
 Paiement
</button><button class="btn btn-sm btn-primary" onclick="printContrat('${window.AutoLocUtils.escapeHtml(r.id)}')"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>
 Contrat
</button><button class="btn btn-sm btn-outline" onclick="editRes('${window.AutoLocUtils.escapeHtml(r.id)}')">Modifier</button><button class="btn btn-sm btn-danger" onclick="deleteRes('${window.AutoLocUtils.escapeHtml(r.id)}')">Supprimer</button><button class="btn btn-sm btn-whatsapp" onclick="sendWhatsApp('${window.AutoLocUtils.escapeHtml(r.id)}')" title="Envoyer via WhatsApp" style="background:#25D366;color:#fff;border:none;display:flex;align-items:center;gap:5px;"><svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
 WhatsApp
</button></div></div>`;
   })
   .join('')}</div>`;
 };

 global.invooReservationsRender = {
  attach: function (c) {
   ctx = c;
  },
 };
})(typeof window !== 'undefined' ? window : globalThis);
