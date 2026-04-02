/**
 * Modale photos véhicule / client (OPFS + repli localStorage).
 *
 * Branchement dans js/01-app-core.js :
 *   invooPhotosUi.attach({ photosEnabled, alAlert, alConfirm, addLog, OPFS });
 *
 * Globaux : openPhotosModalFromBtn, openPhotosModal, renderPhotosTabs, handlePhotoUpload,
 * handlePhotoFiles, deletePhoto, getPhotos, savePhotos, countPhotosAsync, countPhotos,
 * openLightbox, closeLightbox, compressImage (si besoin inline HTML).
 */
(function (global) {
  'use strict';

  var ctx = null;

  var PHOTO_TABS = {
    cl: [
      { key: 'cin', label: 'CIN / Passeport' },
      { key: 'permis', label: 'Permis de conduire' },
      { key: 'autre', label: 'Autres docs' }
    ],
    veh: [
      { key: 'avant', label: 'État avant location' },
      { key: 'apres', label: 'État après location' },
      { key: 'docs', label: 'Documents véhicule' }
    ]
  };

  var photosCtx = { type: null, id: null };
  var _photoCache = {};

  function photosEnabled() {
    return ctx && ctx.photosEnabled;
  }

  function getStorageUsagePercent() {
    var total = 0;
    for (var k in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, k)) {
        total += (localStorage[k].length + k.length) * 2;
      }
    }
    return Math.round((total / (5 * 1024 * 1024)) * 100);
  }

  global.openPhotosModalFromBtn = function (btn) {
    if (!photosEnabled()) {
      ctx.alAlert('La fonctionnalité Photos est temporairement désactivée.');
      return;
    }
    if (!btn) return;
    var type = btn.getAttribute('data-type') || '';
    var id = btn.getAttribute('data-id') || '';
    var title = btn.getAttribute('data-title') || '';
    return global.openPhotosModal(type, id, title);
  };

  global.openPhotosModal = function (type, id, title) {
    if (!photosEnabled()) {
      ctx.alAlert('La fonctionnalité Photos est temporairement désactivée.');
      return;
    }
    photosCtx = { type: type, id: id };
    var tit = document.getElementById('photos-modal-title');
    if (tit) tit.textContent = 'Photos — ' + title;
    var warnEl = document.getElementById('photos-storage-warn');
    if (warnEl) {
      if (ctx.OPFS._ready) {
        warnEl.style.background = 'rgba(45,212,191,0.14)';
        warnEl.style.borderColor = 'rgba(45,212,191,0.35)';
        warnEl.style.color = '#ccfbf1';
        warnEl.innerHTML = '✓ Photos stockées dans OPFS — espace illimité';
        warnEl.style.display = 'block';
      } else {
        var usagePct = getStorageUsagePercent();
        if (usagePct > 80) {
          warnEl.innerHTML =
            '⚠️ Stockage navigateur à ' +
            usagePct +
            '% — utilisez Chrome ou Edge pour activer OPFS (illimité)';
          warnEl.style.display = 'block';
        } else {
          warnEl.style.display = 'none';
        }
      }
    }
    global.renderPhotosTabs(0);
    var modal = document.getElementById('photos-modal');
    if (modal) modal.classList.add('open');
  };

  global.renderPhotosTabs = async function (activeIdx) {
    var tabs = PHOTO_TABS[photosCtx.type];
    var tabsEl = document.getElementById('photos-tabs');
    var panelsEl = document.getElementById('photos-panels');
    if (!tabs || !tabsEl || !panelsEl) return;
    var counts = await Promise.all(
      tabs.map(function (t) {
        return global.getPhotos(photosCtx.type, photosCtx.id, t.key).then(function (a) {
          return a.length;
        });
      })
    );
    tabsEl.innerHTML = tabs
      .map(function (t, i) {
        var badge = counts[i] ? '<span class="photo-count-badge">' + counts[i] + '</span>' : '';
        return (
          '<button class="photo-tab ' +
          (i === activeIdx ? 'active' : '') +
          '" onclick="renderPhotosTabs(' +
          i +
          ')">' +
          t.label +
          badge +
          '</button>'
        );
      })
      .join('');
    var tab = tabs[activeIdx];
    var photos = await global.getPhotos(photosCtx.type, photosCtx.id, tab.key);
    panelsEl.innerHTML =
      '<div class="photo-panel active"><div class="photo-drop-zone" onclick="document.getElementById(\'photo-file-input\').click()" id="drop-zone"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><p>Cliquez pour ajouter une photo</p><small>JPG, PNG, WEBP — max 10 Mo par image</small></div><input type="file" id="photo-file-input" accept="image/*" multiple style="display:none" onchange="handlePhotoUpload(event,\'' +
      tab.key +
      "')\">\n " +
      (photos.length
        ? '<div class="photo-preview-grid">\n ' +
          photos
            .map(function (p, i) {
              return (
                '<div class="photo-thumb"><img src="' +
                p.data +
                '" alt="' +
                window.AutoLocUtils.escapeHtml(p.name || tab.label) +
                "\" onclick=\"openLightbox('" +
                photosCtx.type +
                "','" +
                photosCtx.id +
                "','" +
                tab.key +
                "'," +
                i +
                ')\"><button class="photo-thumb-del" onclick="deletePhoto(\'' +
                tab.key +
                "'," +
                i +
                ')\">×</button><div class="photo-thumb-label">' +
                window.AutoLocUtils.escapeHtml(p.name || tab.label) +
                '</div></div>'
              );
            })
            .join('') +
          '</div>'
        : '<p style="text-align:center;color:var(--text3);font-size:0.83rem;margin-top:16px">Aucune photo ajoutée</p>') +
      '</div>';
    var dz = document.getElementById('drop-zone');
    if (dz) {
      dz.addEventListener('dragover', function (e) {
        e.preventDefault();
        dz.style.borderColor = 'var(--accent2)';
      });
      dz.addEventListener('dragleave', function () {
        dz.style.borderColor = '';
      });
      dz.addEventListener('drop', function (e) {
        e.preventDefault();
        dz.style.borderColor = '';
        global.handlePhotoFiles(e.dataTransfer.files, tab.key);
      });
    }
    photosCtx.activeTab = activeIdx;
  };

  global.handlePhotoUpload = function (event, tabKey) {
    global.handlePhotoFiles(event.target.files, tabKey);
    event.target.value = '';
  };

  global.compressImage = function (dataUrl, maxPx, quality) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var w = img.width;
        var h = img.height;
        if (w > maxPx || h > maxPx) {
          if (w >= h) {
            h = Math.round((h * maxPx) / w);
            w = maxPx;
          } else {
            w = Math.round((w * maxPx) / h);
            h = maxPx;
          }
        }
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality || 0.75));
      };
      img.src = dataUrl;
    });
  };

  global.handlePhotoFiles = function (files, tabKey) {
    var arr = Array.from(files);
    if (!arr.length) return;
    if (!ctx.OPFS._ready) {
      var usagePct = getStorageUsagePercent();
      if (usagePct > 85) {
        ctx.alAlert(
          '⚠️ Stockage navigateur utilisé à ' +
            usagePct +
            '%.\n\nUtilisez Chrome ou Edge pour activer OPFS et stocker les photos sans limite.'
        );
        return;
      }
    }
    var done = 0;
    arr.forEach(function (file) {
      if (file.size > 10 * 1024 * 1024) {
        ctx.alAlert(file.name + ' dépasse 10 Mo — image trop volumineuse.');
        done++;
        return;
      }
      try {
        var reader = new FileReader();
        reader.onload = async function (e) {
          try {
            var compressed = await global.compressImage(e.target.result, 900, 0.75);
            var originalKb = Math.round(e.target.result.length * 0.75 / 1024);
            var compressedKb = Math.round(compressed.length * 0.75 / 1024);
            var photos = await global.getPhotos(photosCtx.type, photosCtx.id, tabKey);
            photos.push({
              data: compressed,
              name: file.name,
              date: new Date().toISOString().slice(0, 10),
              sizeKb: compressedKb,
              originalKb: originalKb
            });
            await global.savePhotos(photosCtx.type, photosCtx.id, tabKey, photos);
          } catch (err) {
            console.error('Compression échouée:', err);
            var photos2 = await global.getPhotos(photosCtx.type, photosCtx.id, tabKey);
            photos2.push({
              data: e.target.result,
              name: file.name,
              date: new Date().toISOString().slice(0, 10)
            });
            await global.savePhotos(photosCtx.type, photosCtx.id, tabKey, photos2);
          }
          done++;
          if (done === arr.length) global.renderPhotosTabs(photosCtx.activeTab || 0);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        done++;
      }
    });
    ctx.addLog('Photo ajoutée — ' + arr.length + ' fichier' + (arr.length > 1 ? 's' : ''));
  };

  global.deletePhoto = function (tabKey, idx) {
    ctx.alConfirm({
      icon: '🖼',
      danger: true,
      title: 'Supprimer cette photo ?',
      msg: 'La photo sera définitivement supprimée.',
      okLabel: 'Supprimer',
      onOk: async function () {
        var photos = await global.getPhotos(photosCtx.type, photosCtx.id, tabKey);
        photos.splice(idx, 1);
        await global.savePhotos(photosCtx.type, photosCtx.id, tabKey, photos);
        global.renderPhotosTabs(photosCtx.activeTab || 0);
      }
    });
  };

  global.getPhotos = async function (type, id, tabKey) {
    var cacheKey = type + '_' + id + '_' + tabKey;
    if (_photoCache[cacheKey] !== undefined) return _photoCache[cacheKey];
    var opfsPhotos = await ctx.OPFS.readPhotos(type, id, tabKey);
    if (opfsPhotos !== null) {
      _photoCache[cacheKey] = opfsPhotos;
      return opfsPhotos;
    }
    try {
      var store = JSON.parse(localStorage.getItem('autoloc_photos') || '{}');
      var arr = [];
      if (store[type] && store[type][id] && store[type][id][tabKey]) {
        arr = store[type][id][tabKey];
      }
      if (arr.length) {
        _photoCache[cacheKey] = arr;
        ctx.OPFS.writePhotos(type, id, tabKey, arr).catch(function () {});
      }
      return arr;
    } catch (e) {
      return [];
    }
  };

  global.savePhotos = async function (type, id, tabKey, photos) {
    var cacheKey = type + '_' + id + '_' + tabKey;
    _photoCache[cacheKey] = photos;
    var opfsOk = await ctx.OPFS.writePhotos(type, id, tabKey, photos);
    if (opfsOk) {
      var warn = document.getElementById('storage-topbar-warn');
      if (warn) warn.style.display = 'none';
      return;
    }
    try {
      var store;
      try {
        store = JSON.parse(localStorage.getItem('autoloc_photos') || '{}');
      } catch (e) {
        store = {};
      }
      if (!store[type]) store[type] = {};
      if (!store[type][id]) store[type][id] = {};
      store[type][id][tabKey] = photos;
      localStorage.setItem('autoloc_photos', JSON.stringify(store));
      var usagePct = getStorageUsagePercent();
      var warn2 = document.getElementById('storage-topbar-warn');
      if (warn2) warn2.style.display = usagePct > 80 ? 'block' : 'none';
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        ctx.alAlert(
          '⚠️ Espace de stockage plein!\n\nOPFS non disponible sur ce navigateur. Utilisez Chrome ou Edge pour un stockage illimité.'
        );
      }
    }
  };

  global.countPhotosAsync = async function (type, id) {
    var count = 0;
    var prefix = type + '_' + id + '_';
    for (var k of Object.keys(_photoCache)) {
      if (k.startsWith(prefix)) count += (_photoCache[k] || []).length;
    }
    if (count > 0) return count;
    try {
      var store = JSON.parse(localStorage.getItem('autoloc_photos') || '{}');
      var entity = store[type] && store[type][id];
      if (!entity) return 0;
      return Object.values(entity).reduce(function (s, arr) {
        return s + arr.length;
      }, 0);
    } catch (e) {
      return 0;
    }
  };

  global.countPhotos = function (type, id) {
    var count = 0;
    var prefix = type + '_' + id + '_';
    for (var k of Object.keys(_photoCache)) {
      if (k.startsWith(prefix)) count += (_photoCache[k] || []).length;
    }
    if (count > 0) return count;
    try {
      var store = JSON.parse(localStorage.getItem('autoloc_photos') || '{}');
      var entity = store[type] && store[type][id];
      if (!entity) return 0;
      return Object.values(entity).reduce(function (s, arr) {
        return s + arr.length;
      }, 0);
    } catch (e) {
      return 0;
    }
  };

  global.openLightbox = async function (type, id, tabKey, idx) {
    var photos = await global.getPhotos(type, id, tabKey);
    if (!photos[idx]) return;
    var img = document.getElementById('lightbox-img');
    if (img) img.src = photos[idx].data;
    var lb = document.getElementById('photo-lightbox');
    if (lb) lb.classList.add('open');
  };

  global.closeLightbox = function () {
    var lb = document.getElementById('photo-lightbox');
    if (lb) lb.classList.remove('open');
    var img = document.getElementById('lightbox-img');
    if (img) img.src = '';
  };

  global.invooPhotosUi = {
    attach: function (c) {
      ctx = c;
    }
  };
})(typeof window !== 'undefined' ? window : this);
