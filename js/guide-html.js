(function(global){
'use strict';
/**
 * Contenu HTML du guide (extrait du core). Charge avant 01-app-core.js
 */
global.invooGuideHTML=function invooGuideHTML(){
 const t=(cls,txt)=>`<span class="gtag gtag-${cls}">${txt}</span>`;
 const tip=(type,icon,html)=>`<div class="guide-tip guide-tip-${type}"><span style="font-size:.95rem;flex-shrink:0">${icon}</span><p>${html}</p></div>`;
 const card=(title,items)=>{
 const body=Array.isArray(items)?`<ul>${items.map(x=>`<li>${x}</li>`).join('')}</ul>`:`<p>${items}</p>`;
 return `<div class="guide-card"><div class="guide-card-title">${title}</div>${body}</div>`;
 };
 const cards=(...items)=>`<div class="guide-cards">${items.map(([t,l])=>card(t,l)).join('')}</div>`;
 const step=(n,title,desc)=>`<div class="guide-step"><div class="guide-step-num">${n}</div><div><strong>${title}</strong><span>${desc}</span></div></div>`;
 const steps=(...items)=>`<div class="guide-steps">${items.map(([n,t,d])=>step(n,t,d)).join('')}</div>`;
 const trow=(a,b)=>`<tr><td><strong>${a}</strong></td><td>${b}</td></tr>`;
 const tbl=rows=>`<div class="guide-table-wrap"><table><thead><tr><th>Champ / Indicateur</th><th>Description</th></tr></thead><tbody>${rows.map(([a,b])=>trow(a,b)).join('')}</tbody></table></div>`;
 const sec=(id,iconBg,iconStroke,iconPath,num,title,subtitle,body)=>`
<div class="guide-section" id="${id}"><div class="guide-section-header"><div class="guide-section-icon" style="background:${iconBg}"><svg fill="none" viewBox="0 0 24 24" stroke="${iconStroke}" stroke-width="2">${iconPath}</svg></div><div class="guide-section-title"><h3>${num}. ${title}</h3><p>${subtitle}</p></div></div>
 ${body}
</div><hr class="guide-divider">`;
 const parts=[];
 /* ── 1. TABLEAU DE BORD ─────────────────────────────── */
 parts.push(sec('g-dashboard','rgba(59,130,246,0.16)','#93c5fd',
 '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 1,'Tableau de bord','Vue d\'ensemble de votre agence en temps réel',
 cards(
 ['4 indicateurs clés (KPIs)',['Véhicules total et disponibles','Nombre de clients enregistrés','Locations en cours et total général','Chiffre d\'affaires réalisé (locations terminées)']],
 ['3 graphiques dynamiques',['CA mensuel — barres sur les 12 derniers mois','Taux d\'occupation — courbe % sur 12 mois','Rentabilité par véhicule — comparaison de la flotte']],
 ['Alertes automatiques',[t('red','Rouge')+' Retards : retour dépassé',t('red','Rouge')+' Retours aujourd\'hui à traiter',t('orange','Orange')+' Retours dans les 48h à anticiper',t('red','Rouge')+' Impayés : réservations avec reste dû']],
 ['Activité récente & flotte',['8 dernières actions enregistrées dans le journal','Barres visuelles : disponibles / loués / maintenance','Accès rapide aux alertes de maintenance']]
 )+tip('info','💡','Le <strong>bandeau rouge</strong> en haut apparaît dès qu\'un retard est détecté. Cliquez sur le ✕ pour masquer temporairement.')+
 tip('info','🔄','Le tableau de bord se met à jour <strong>automatiquement</strong> chaque fois que vous revenez dessus ou effectuez une action.')
 ));
 /* ── 2. VÉHICULES ───────────────────────────────────── */
 parts.push(sec('g-vehicules','rgba(59,130,246,0.16)','#93c5fd',
 '<path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h14a2 2 0 012 2v1"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
 2,'Véhicules','Gestion complète de votre flotte automobile',
 cards(
 ['Informations enregistrées',['Immatriculation (format libre, majuscules auto, unique par véhicule)','Marque, modèle, année de mise en circulation','Catégorie : Citadine, Berline, SUV, 4x4, Utilitaire, Luxe','Tarif journalier en MAD (sert au calcul automatique des réservations)','Couleur, carburant (Essence / Diesel / Hybride / Électrique)','Kilométrage actuel (mis à jour manuellement)']],
 ['Statuts du véhicule',[t('green','Disponible')+' — libre pour une nouvelle réservation',t('blue','Loué')+' — actuellement en location (changement automatique)',t('orange','Maintenance')+' — indisponible pour révision ou réparation','Le statut Loué est géré automatiquement par les réservations']],
 ['Actions disponibles',['📷 <strong>Photos</strong> — ajouter l\'état du véhicule avant/après location','📋 <strong>Historique</strong> — voir toutes les locations passées avec stats','🔧 <strong>Maintenance</strong> — planifier ou noter une intervention','✏️ <strong>Modifier</strong> — mettre à jour les informations','🗑️ <strong>Supprimer</strong> — impossible si une location est en cours']]
 )+
 steps(
 ['1','Ajouter un véhicule','Cliquez sur "+ Ajouter" en haut à droite. Remplissez au minimum l\'immatriculation, la marque et le modèle, puis enregistrez.'],
 ['2','Filtrer la flotte','Utilisez les boutons : '+t('gray','Tous')+' '+t('green','Disponibles')+' '+t('blue','Loués')+' '+t('orange','Maintenance')+' pour filtrer rapidement.'],
 ['3','Recherche rapide','Tapez une immatriculation ou une marque dans la barre de recherche en haut pour trouver un véhicule instantanément.'],
 ['4','Mettre à jour le kilométrage','Modifiez le véhicule après chaque retour pour garder un kilométrage précis dans vos contrats.']
 )+
 tip('warn','⚠️','<strong>Immatriculation unique :</strong> le système bloque l\'enregistrement si deux véhicules ont la même plaque.')+
 tip('info','📥','<strong>Import en masse :</strong> vous pouvez importer plusieurs véhicules à la fois via un fichier CSV (voir section Import).')
 ));
 /* ── 3. CLIENTS ─────────────────────────────────────── */
 parts.push(sec('g-clients','rgba(45,212,191,0.15)','#99f6e4',
 '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>',
 3,'Clients','Gestion du portefeuille clients de votre agence',
 cards(
 ['Fiche client complète',['Prénom et nom (obligatoires)','Téléphone : 8 à 15 chiffres, vérifié automatiquement','Email : format validé si renseigné','CIN ou numéro de passeport','Numéro de permis de conduire','Ville, nationalité, adresse complète','Nombre de locations affiché automatiquement']],
 ['Historique client',['Timeline complète de toutes ses locations','Chiffre d\'affaires total généré par ce client','Nombre de locations en cours','Détail par location : véhicule, dates, montant, statut, notes']]
 )+
 steps(
 ['1','Ajouter un client','Bouton "+ Ajouter". Minimum requis : prénom, nom, téléphone. Les autres champs enrichissent le contrat.'],
 ['2','Rechercher un client','Filtrage en temps réel par nom, prénom, téléphone ou numéro CIN depuis la barre de recherche.'],
 ['3','Consulter l\'historique','Cliquez sur "Historique" sur la fiche client pour voir toutes ses locations et son CA total.'],
 ['4','Supprimer un client','Protégé : impossible si une location est en cours. Une confirmation est demandée si un historique existe.']
 )+
 tip('info','🔍','<strong>Recherche rapide :</strong> la barre de recherche filtre en temps réel sur nom, prénom, téléphone et CIN.')+
 tip('info','📥','<strong>Import en masse :</strong> importez votre liste de clients existants via un fichier CSV (voir section Import).')
 ));
 /* ── 4. RÉSERVATIONS ────────────────────────────────── */
 parts.push(sec('g-reservations','rgba(251,191,36,0.12)','#f59e0b',
 '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
 4,'Réservations','Créer et gérer les locations de vos véhicules',
 cards(
 ['Informations d\'une réservation',['Client (sélection depuis votre liste)','Véhicule disponible (seuls les véhicules libres apparaissent)','Date de départ et date de retour prévue','Lieu de prise en charge','Montant total calculé automatiquement : jours × tarif','Notes internes (non imprimées sur le contrat)']],
 ['Statuts d\'une réservation',[t('blue','En cours')+' — location active, véhicule marqué Loué',t('green','Terminée')+' — clôturée, véhicule remis Disponible',t('red','Annulée')+' — annulée, véhicule remis Disponible']],
 ['Actions disponibles',['💳 <strong>Paiements</strong> — gérer les versements et la caution','📄 <strong>Contrat</strong> — générer et imprimer le contrat PDF','✏️ <strong>Modifier</strong> — changer les dates, lieu ou notes','✅ <strong>Clôturer</strong> — terminer la location','❌ <strong>Annuler</strong> — annuler sans supprimer l\'historique']]
 )+
 steps(
 ['1','Créer une réservation','Cliquez sur "+ Nouvelle réservation". Sélectionnez client, véhicule et dates. Le total est calculé automatiquement.'],
 ['2','Gérer les paiements','Bouton "Paiements" sur la carte. Ajoutez des versements (avance, solde), choisissez le mode et la date.'],
['3','Télécharger le contrat PDF','Bouton "Contrat" → "Imprimer / Sauvegarder PDF" pour télécharger le fichier, puis l\'imprimer si besoin.'],
 ['4','Clôturer la location','Bouton "Clôturer" quand le véhicule est rendu. Le statut passe à Terminée, le véhicule redevient Disponible.']
 )+
 tip('info','💡','<strong>Modification sécurisée :</strong> changer les dates ou le véhicule conserve les paiements déjà enregistrés et la caution.')+
 tip('warn','⚠️','<strong>Conflits de dates :</strong> le système vous avertit si un véhicule est déjà réservé sur la période choisie.')
 ));
 /* ── 5. PAIEMENTS & CAUTION ─────────────────────────── */
 parts.push(sec('g-paiements','#F5EEF8','#8E44AD',
 '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>',
 5,'Paiements & Caution','Suivi des encaissements et de la caution par réservation',
 cards(
 ['Types de versement',['<strong>Avance</strong> — acompte versé au départ','<strong>Solde</strong> — paiement du reste à la restitution','<strong>Autre</strong> — complément ou paiement partiel','Chaque versement : montant, mode, date, note optionnelle']],
 ['Modes de paiement acceptés',['Espèces (cash)','Virement bancaire','Chèque']],
 ['Gestion de la caution',['Montant de caution configurable par réservation',t('orange','En attente')+' — caution reçue, non encore traitée',t('green','Encaissée')+' — caution conservée (dommages)',t('blue','Restituée')+' — caution rendue au client']],
 ['Tableau récapitulatif',['Montant total de la location','Total déjà encaissé (somme des versements)','<strong>Reste dû</strong> affiché en rouge si > 0','Indicateur impayé visible sur la carte réservation']]
 )+
 tip('info','💡','Le <strong>reste dû</strong> est calculé automatiquement : total − somme des versements. Il apparaît en rouge sur la carte si non soldé.')+
 tip('info','📊','Les impayés sont <strong>remontés automatiquement</strong> dans le tableau de bord sous forme d\'alertes.')
 ));
 /* ── 6. MAINTENANCE ─────────────────────────────────── */
 parts.push(sec('g-maintenance','#FDEDEC','#C0392B',
 '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>',
 6,'Maintenance','Suivi des entretiens et réparations de votre flotte',
 cards(
 ['Informations d\'une intervention',['Véhicule concerné','Date de l\'intervention','Type : Vidange, Pneus, Freins, Carrosserie, Révision, Autre','Description libre du travail effectué','Coût en MAD','Kilométrage au moment de l\'intervention','Prochain entretien prévu (date ou kilométrage)']],
 ['Alertes de maintenance',['🔴 <strong>En retard</strong> — date dépassée ou kilométrage atteint','🟠 <strong>Bientôt</strong> — échéance dans moins de 15 jours ou 500 km','🟢 <strong>OK</strong> — aucune intervention urgente prévue','Ces alertes remontent automatiquement dans le tableau de bord']]
 )+
 steps(
 ['1','Enregistrer une intervention','Bouton "+ Maintenance" ou depuis la fiche véhicule. Renseignez le type, la date, le coût et la description.'],
 ['2','Planifier le prochain entretien','Ajoutez la date ou le kilométrage du prochain entretien pour recevoir une alerte automatique.'],
 ['3','Suivre les coûts','Le rapport mensuel inclut le total des coûts de maintenance pour calculer la marge nette réelle.'],
 ['4','Filtrer par véhicule','Utilisez les filtres pour voir l\'historique de maintenance d\'un véhicule spécifique.']
 )+
 tip('info','💡','Les coûts de maintenance sont déduits du CA dans le <strong>rapport mensuel</strong> pour afficher la marge nette réelle.')+
 tip('warn','⚠️','Un véhicule en statut <strong>Maintenance</strong> n\'apparaît pas dans la liste de sélection lors d\'une nouvelle réservation.')
 ));
 /* ── 7. CALENDRIER ──────────────────────────────────── */
 parts.push(sec('g-calendrier','#E8F8F5','#1A9974',
 '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
 7,'Calendrier','Vision graphique des disponibilités et réservations',
 cards(
 ['Vue mensuelle',['Navigation mois par mois avec flèches gauche/droite','Chaque jour affiche les réservations actives','Code couleur : '+t('blue','En cours')+' '+t('green','Terminée')+' '+t('red','Annulée'),'Cliquer sur une réservation ouvre sa fiche complète']],
 ['Légende & navigation',['Bouton "Aujourd\'hui" pour revenir au mois courant','Le mois et l\'année sont affichés clairement','Jours passés légèrement grisés pour la lisibilité','Week-ends visuellement distincts des jours ouvrés']]
 )+
 tip('info','💡','Le calendrier est idéal pour vérifier <strong>d\'un coup d\'œil</strong> les disponibilités avant de créer une nouvelle réservation.')+
 tip('info','📱','Sur mobile, le calendrier s\'adapte automatiquement à la taille de l\'écran pour rester lisible.')
 ));
 /* ── 8. CONTRAT PDF ─────────────────────────────────── */
 parts.push(sec('g-contrat','rgba(59,130,246,0.16)','#93c5fd',
 '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
8,'Contrat de location','Génération et téléchargement du contrat officiel',
 cards(
 ['Contenu du contrat généré',['En-tête agence : nom, slogan, ville, téléphone, email, site, RC/Patente','Numéro de contrat unique (CTR-XXXXXX)','Bloc locataire : CIN, permis, téléphone, adresse, nationalité','Bloc véhicule : immatriculation, marque, modèle, année, kilométrage','Détails location : dates, durée, lieu de prise en charge','Récapitulatif paiements : versements, caution, reste dû','Conditions générales personnalisables','Zone signatures : locataire et agence']],
 ['Personnalisation dans Paramètres',['Nom et slogan de votre agence','Coordonnées : téléphone, email, site web','Ville et adresse','RC / Numéro de patente','Conditions générales : texte libre multi-lignes']]
 )+
 steps(
 ['1','Générer le contrat','Depuis une réservation, cliquez sur "Contrat". Un aperçu s\'affiche immédiatement.'],
['2','Télécharger le PDF','Bouton "Imprimer / Sauvegarder PDF" pour télécharger le contrat, puis l\'imprimer ensuite si nécessaire.'],
 ['3','Personnaliser vos informations','Allez dans Paramètres → section "Informations agence". Renseignez nom, coordonnées, conditions. Enregistrez.'],
 ['4','Mettre à jour les conditions','Section "Conditions générales" dans Paramètres. Chaque ligne devient une clause numérotée dans le contrat.']
 )+
 tip('info','💡','Le contrat utilise toujours les <strong>informations les plus récentes</strong> de vos paramètres agence.')+
tip('warn','⚠️','Le PDF est d\'abord téléchargé. L\'impression se fait ensuite depuis votre lecteur PDF (mobile ou PC).')
 ));
 /* ── 9. RAPPORTS ────────────────────────────────────── */
 parts.push(sec('g-rapports','#F4ECF7','#7D3C98',
 '<path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>',
 9,'Rapports & Graphiques','Analyse financière et performance de votre agence',
 cards(
 ['Rapport mensuel',['Sélectionnez le mois et l\'année avec les flèches de navigation','CA réalisé (locations terminées uniquement)','CA encaissé vs reste à encaisser','Coût total de maintenance du mois','Marge nette estimée = CA encaissé − coûts maintenance','Taux d\'occupation de la flotte en pourcentage','Classement des véhicules par rentabilité (avec barre visuelle)','Top 5 clients du mois par CA généré']],
 ['3 graphiques dynamiques',['📊 <strong>CA mensuel</strong> — 12 mois glissants en barres bleues','📈 <strong>Taux d\'occupation</strong> — courbe verte en pourcentage','🚗 <strong>Rentabilité par véhicule</strong> — barres horizontales comparatives']],
 ['Export du rapport',['Bouton "Exporter" → fichier Excel (.xlsx) téléchargeable','Contient toutes les lignes de location du mois','Ouvrable dans Excel, LibreOffice ou Google Sheets']]
 )+
 tip('info','💡','Le <strong>taux d\'occupation</strong> est calculé sur le nombre de jours loués ÷ (nombre de véhicules × jours du mois).')+
 tip('info','📊','Les graphiques se mettent à jour <strong>automatiquement</strong> à chaque modification de vos données.')
 ));
 /* ── 10. RECHERCHE ──────────────────────────────────── */
 parts.push(sec('g-recherche','#FDFEFE','#717D7E',
 '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
 10,'Recherche globale','Retrouvez n\'importe quelle donnée en quelques frappes',
 cards(
 ['Portée de la recherche',['🚗 <strong>Véhicules</strong> — immatriculation, marque, modèle','👤 <strong>Clients</strong> — nom, prénom, téléphone, CIN','📋 <strong>Réservations</strong> — nom du client, immatriculation, statut','Résultats groupés par catégorie avec icône et badge']],
 ['Navigation dans les résultats',['Cliquer sur un résultat ouvre directement la section concernée','Le clic sur un véhicule va dans Véhicules et le met en évidence','Le clic sur un client va dans Clients','Le clic sur une réservation va dans Réservations']]
 )+
 steps(
 ['1','Accès','La barre de recherche est toujours visible dans la barre du haut (topbar).'],
 ['2','Saisir','Commencez à taper (minimum 2 caractères). Les résultats apparaissent instantanément.'],
 ['3','Clavier','Flèches ↑↓ pour naviguer, Entrée pour sélectionner, Échap pour fermer.'],
 ['4','Effacer','Cliquez sur le × à droite du champ pour vider la recherche.']
 )+
 tip('info','⚡','La recherche est optimisée avec un <strong>délai intelligent</strong> : elle attend que vous ayez fini de taper avant de filtrer.')
 ));
 /* ── 11. PHOTOS VÉHICULES ───────────────────────────── */
 parts.push(sec('g-photos','rgba(251,191,36,0.12)','#f59e0b',
 '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>',
11,'Photos véhicules','Fonction temporairement désactivée',
 cards(
['État actuel',['Module photo désactivé pour garantir la stabilité globale de l\'application','Le bouton Photos est masqué dans les listes Véhicules et Clients','Les données principales (véhicules, clients, réservations, maintenance) restent 100% fonctionnelles']],
['Réactivation future',['La fonctionnalité pourra être réactivée ultérieurement','Le code est conservé en mode désactivé, sans impact sur les autres modules','Aucune action requise de votre côté pour continuer à travailler']]
 )+
 steps(
['1','Statut actuel','La fonctionnalité est en pause et n\'est pas affichée dans l\'interface.'],
['2','Pourquoi','Objectif : éviter les problèmes de stockage/compteur et privilégier la stabilité opérationnelle.'],
['3','Impact','Aucun impact sur les réservations, contrats, maintenance, sauvegardes et synchronisation.'],
['4','Suite','Le module peut être réactivé dès que vous le souhaitez.']
 )+
tip('info','🧩','Module conservé mais désactivé : réactivation possible sans refonte complète.')+
tip('warn','⚠️','Cette section est informative tant que la fonctionnalité reste désactivée.')
 ));
 /* ── 12. IMPORT CSV ─────────────────────────────────── */
 parts.push(sec('g-import','#E8F8F5','#1A9974',
 '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
 12,'Import en masse (CSV)','Importer des données depuis Excel ou un fichier CSV',
 cards(
['Données importables',['🚗 <strong>Véhicules</strong> — colonnes : immat*, marque*, modele*, annee, categorie, tarif, couleur, carburant, km, statut, notes','👤 <strong>Clients</strong> — colonnes : prenom*, nom*, tel*, email, cin, permis, ville, nat, adresse','* = colonne obligatoire']],
 ['Format accepté',['Fichier .csv avec séparateur virgule (,) ou point-virgule (;) — détection automatique','Première ligne = en-têtes de colonnes (noms en minuscules)','Encodage UTF-8 recommandé pour les accents','Export depuis Excel : "Enregistrer sous" → CSV UTF-8']]
 )+
 steps(
['1','Ouvrir l\'import','Paramètres → section "Import de données" → choisissez le type (Véhicules ou Clients).'],
 ['2','Préparer votre fichier','Dans Excel : une ligne par enregistrement, première ligne = noms de colonnes en minuscules. Enregistrez en CSV.'],
 ['3','Choisir le fichier','Cliquez sur "Choisir un fichier CSV" et sélectionnez votre fichier. Un aperçu des 8 premières lignes s\'affiche.'],
 ['4','Vérifier et confirmer','Si des erreurs apparaissent (champs manquants), corrigez le CSV et rechargez. Cliquez "Importer" pour valider.']
 )+
 tip('info','💡','L\'import est <strong>additif</strong> : il ajoute les nouvelles données sans écraser les existantes. Idéal pour une migration depuis un ancien logiciel.')+
 tip('warn','⚠️','Vérifiez que les immatriculations (véhicules) et les CIN/tél (clients) sont <strong>uniques</strong> dans votre fichier avant d\'importer.')
 ));
 /* ── 13. PARAMÈTRES ─────────────────────────────────── */
 parts.push(sec('g-parametres','#F2F3F8','#454760',
 '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
 13,'Paramètres','Configurer et personnaliser INVOORENT',
 cards(
 ['Informations agence',['Nom de votre agence (apparaît dans les contrats et rapports)','Slogan affiché sur le contrat','Téléphone, email, site web','Adresse et ville','RC / Numéro de patente (affiché sur le contrat)','IBAN bancaire (pour les virements clients)']],
 ['Conditions générales',['Texte libre multi-lignes','Chaque ligne devient une clause numérotée dans le contrat','Conditions par défaut fournies, modifiables librement']],
 ['Stockage & données',['Jauge d\'utilisation du stockage local','Bouton de sauvegarde manuelle (export JSON)','Restauration depuis une sauvegarde précédente','Section import CSV (véhicules, clients, réservations)']],
 ['Synchronisation Supabase (optionnel)',['Configuration URL et clé API Supabase','Sync bidirectionnelle automatique toutes les 5 minutes','Push immédiat à chaque modification','Fonctionne en complément du stockage local (pas de remplacement)']]
 )+
 steps(
 ['1','Configurer votre agence','Renseignez nom, téléphone, ville et RC. Ces infos apparaissent sur tous vos contrats.'],
 ['2','Personnaliser les conditions','Modifiez les conditions générales selon les règles de votre agence. Enregistrez.'],
 ['3','Sauvegarder vos données','Cliquez "Exporter la sauvegarde" régulièrement. Un rappel automatique apparaît après 7 jours sans backup.'],
 ['4','Activer la sync Supabase','Si vous souhaitez accéder à vos données sur plusieurs appareils, créez un compte Supabase gratuit et entrez l\'URL + clé API.']
 )+
 tip('info','💡','Toutes vos données restent <strong>sur votre appareil</strong>. Supabase est une option de synchronisation, pas une obligation.')+
 tip('info','🔒','La sauvegarde JSON contient <strong>toutes vos données</strong> : véhicules, clients, réservations, paiements, maintenance. Conservez-la dans un endroit sûr.')
 ));
 /* ── 14. SAUVEGARDE & RESTAURATION ─────────────────── */
 parts.push(sec('g-export','rgba(59,130,246,0.16)','#93c5fd',
 '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
 14,'Sauvegarde & Restauration','Protéger et récupérer toutes vos données',
 cards(
['Sauvegarde manuelle',['Paramètres → bouton "Exporter la sauvegarde"','Télécharge un fichier JSON horodaté sur votre ordinateur','Contient 100% de vos données : véhicules, clients, réservations, paiements, maintenance, paramètres agence','Fichier nommé : INVOORENT_backup_AAAA-MM-JJ.json']],
 ['Rappel automatique',['Un bandeau orange apparaît si aucune sauvegarde depuis 7 jours','Bouton "Sauvegarder maintenant" dans le bandeau','Bouton "Plus tard" reporte l\'alerte de 24 heures','Le rappel disparaît automatiquement après une sauvegarde réussie']],
 ['Restauration',['Paramètres → bouton "Restaurer une sauvegarde"','Sélectionnez votre fichier JSON de sauvegarde','Une confirmation est demandée : les données actuelles seront remplacées','L\'application recharge automatiquement après restauration']]
 )+
 steps(
 ['1','Exporter régulièrement','Faites une sauvegarde au minimum chaque semaine, idéalement après chaque grosse journée de travail.'],
 ['2','Stocker en lieu sûr','Copiez le fichier JSON sur une clé USB, Google Drive, WhatsApp ou envoyez-le par email à vous-même.'],
 ['3','Restaurer si besoin','En cas de problème (changement d\'appareil, réinitialisation), ouvrez Paramètres → Restaurer et choisissez votre dernier fichier.'],
 ['4','Vérifier la restauration','Après restauration, vérifiez que vos véhicules, clients et réservations sont bien présents dans chaque section.']
 )+
 tip('warn','⚠️','La restauration <strong>remplace toutes les données actuelles</strong> par celles de la sauvegarde. Assurez-vous de choisir le bon fichier.')+
 tip('info','☁️','Si Supabase est configuré, vos données sont aussi synchronisées en temps réel. La sauvegarde JSON reste recommandée en complément.')
 ));
 /* ── 15. SÉCURITÉ & ACCÈS ───────────────────────────── */
 parts.push(sec('g-securite','#FDEDEC','#922B21',
 '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
 15,'Sécurité & Accès','Protéger l\'accès à votre interface',
 cards(
 ['Système d\'authentification',['Mot de passe protégé par PBKDF2-SHA256 (non récupérable)','Protection brute-force : blocage temporaire après 5 tentatives échouées','Option "Se souvenir de moi" : session valide 30 jours','Déconnexion manuelle disponible en bas de la sidebar']],
 ['Récupération du mot de passe',['En cas d\'oubli : "Mot de passe oublié ?" sur l\'écran de connexion','Saisissez l\'e-mail de licence et la clé hexadécimale (générée pour cet appareil, sans réseau)','Ou utilisez la clé maître si vous l\'avez — puis définissez un nouveau mot de passe (min. 8 caractères)','Ne partagez ni la clé maître ni votre licence']],
 ['Mode démonstration',['Accès 1 heure sans mot de passe pour tester l\'interface','Données de démo isolées, aucun impact sur vos vraies données','Timer visible en bas de l\'écran avec progression','Fin automatique à l\'expiration, retour à l\'écran de connexion']]
 )+
 steps(
 ['1','Définir votre mot de passe','Première ouverture : "Mot de passe oublié ?" → e-mail + clé hex (ou clé maître) → créez votre mot de passe.'],
 ['2','Se connecter','Entrez votre mot de passe sur l\'écran d\'accueil. Cochez "Se souvenir de moi" pour éviter de ressaisir.'],
 ['3','Changer de mot de passe','"Mot de passe oublié ?" puis licence (e-mail + clé hex) ou clé maître pour un nouveau mot de passe.'],
 ['4','Se déconnecter','Cliquez sur "Déconnexion" en bas de la barre latérale gauche.']
 )+
 tip('warn','⚠️','Conservez votre <strong>clé maître</strong> et les informations de licence dans un endroit sûr. Sans elles, la réinitialisation du mot de passe est impossible.')+
 tip('info','🔒','Le mot de passe est protégé par <strong>PBKDF2-SHA256</strong> sur votre appareil. Personne ne peut le lire, même avec un accès au fichier.')
 ));
 /* ── 16. INSTALLER L'APP (PWA) ──────────────────────── */
 parts.push(sec('g-pwa','rgba(59,130,246,0.16)','#93c5fd',
 '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
 16,'Installer INVOORENT','Utiliser l\'app comme une application native',
 cards(
 ['Avantages de l\'installation PWA',['Icône sur le bureau ou l\'écran d\'accueil du téléphone','Lancement en plein écran sans barre de navigation du navigateur','Fonctionne 100% hors ligne une fois installée','Pas de téléchargement sur un store — installation directe depuis le navigateur']],
 ['Compatibilité',['✅ <strong>Chrome (PC/Android)</strong> — installation complète avec icône et mode hors ligne','✅ <strong>Edge (PC)</strong> — identique à Chrome','✅ <strong>Safari (iPhone/iPad)</strong> — installation via bouton Partager','⚠️ <strong>Firefox</strong> — pas de support PWA natif, utilisation dans le navigateur uniquement']]
 )+
 steps(
 ['1','Sur Chrome / Edge (PC)','Une icône d\'installation apparaît dans la barre d\'adresse (⊕). Cliquez dessus → "Installer".'],
 ['2','Sur Android (Chrome)','Menu ⋮ en haut à droite → "Ajouter à l\'écran d\'accueil". L\'app apparaît comme une appli native.'],
 ['3','Sur iPhone / iPad (Safari)','Touchez le bouton Partager (⬆️) en bas → faites défiler → "Sur l\'écran d\'accueil" → "Ajouter".'],
 ['4','Accès hors ligne','Une fois installée, l\'app fonctionne même sans connexion internet. Toutes vos données restent accessibles.']
 )+
 tip('info','💡','L\'app propose automatiquement l\'installation avec une bannière en bas de l\'écran lors de la première utilisation.')+
 tip('info','🔄','Les mises à jour sont automatiques : quand vous accédez à l\'app avec une connexion, le nouveau fichier est mis en cache silencieusement.')
 ));
 /* ── 17. SYNCHRONISATION SUPABASE ───────────────────── */
 parts.push(sec('g-supabase','#E8F8F5','#0E6655',
 '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
 17,'Synchronisation Supabase','Accéder à vos données sur plusieurs appareils (optionnel)',
 cards(
 ['Principe de fonctionnement',['Vos données restent toujours en local (OPFS + localStorage) — la sync est un complément','À chaque modification (ajout, suppression, paiement), les données sont poussées vers Supabase instantanément','Pull automatique toutes les 5 minutes pour récupérer les changements d\'un autre appareil','Stratégie offline-first : l\'app fonctionne normalement même sans connexion']],
 ['Configuration requise (une seule fois)',['Créer un compte gratuit sur supabase.com','Créer un nouveau projet (gratuit jusqu\'à 500 MB)','Copier l\'URL du projet et la clé anon/public','Coller dans Paramètres → Synchronisation Supabase → Enregistrer']],
 ['Tables Supabase à créer',['Exécuter le script SQL fourni dans l\'éditeur SQL Supabase (1 fois)','4 tables : autoloc_vehicules, autoloc_clients, autoloc_reservations, autoloc_maintenances','Schéma simple : id (text), data (jsonb), deleted_at, updated_at']]
 )+
 steps(
 ['1','Créer le projet Supabase','Allez sur supabase.com → New Project. Notez l\'URL (https://xxx.supabase.co) et la clé API (anon/public).'],
 ['2','Créer les tables','Dans Supabase → SQL Editor, collez et exécutez le script SQL de création des 4 tables.'],
 ['3','Configurer dans l\'app','INVOORENT → Paramètres → Synchronisation → collez l\'URL et la clé → "Enregistrer et synchroniser".'],
 ['4','Vérifier la sync','Le badge en haut affiche "Synchronisé à HH:MM". Cliquez dessus pour forcer une sync manuelle.']
 )+
 tip('info','🆓','Supabase est <strong>gratuit</strong> pour un usage individuel (jusqu\'à 500 MB de données, largement suffisant pour une petite agence).')+
 tip('warn','⚠️','La synchronisation nécessite une <strong>connexion internet</strong>. En mode hors ligne, toutes les modifications sont sauvegardées localement et synchronisées automatiquement dès le retour du réseau.')
 ));
 /* ── CONTACT / SUPPORT ──────────────────────────────── */
 parts.push(`<div class="guide-section" id="g-support">
 <div class="guide-section-header">
 <div class="guide-section-icon" style="background:rgba(45,212,191,0.15)">
 <svg fill="none" viewBox="0 0 24 24" stroke="#99f6e4" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
 </div>
 <div class="guide-section-title"><h3>Support & Assistance</h3><p>Besoin d'aide ? Nous sommes là.</p></div>
 </div>
 ${tip('info','✅','<strong>INVOORENT</strong> est fourni avec une licence à vie. En cas de question ou de problème, contactez-nous via WhatsApp pour une assistance rapide.')}
 <div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap">
 <a href="https://wa.me/" target="_blank" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:8px;text-decoration:none">
 <svg viewBox="0 0 24 24" fill="currentColor" style="width:16px;height:16px"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
 Contacter le support
 </a>
 </div>
 </div>`);
 return parts.join('');
};
})(typeof window!=='undefined'?window:globalThis);
