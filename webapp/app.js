/* ============================================================
   SPPG Batuwinangun - Application Logic v2.0
   Complete rewrite with fixes:
   - Proper multi-page PDF rendering
   - Photos included in PDF output
   - Loading overlay with progress
   - Settings page with backup/restore
   - Proper image wait before canvas render
   ============================================================ */

(function() {
'use strict';

// ============================================================
// UTILITIES
// ============================================================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function getHariFromDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return HARI_ID[d.getDay()];
}

function formatTanggalLengkap(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return HARI_ID[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN_ID[d.getMonth()] + ' ' + d.getFullYear();
}

function formatTanggalShort(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
}


function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function safeNum(v) {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

// ============================================================
// STORAGE
// ============================================================
const Storage = {
  getReports() {
    try { return JSON.parse(localStorage.getItem(APP_CONFIG.STORAGE_REPORTS) || '[]'); }
    catch(e) { return []; }
  },
  saveReports(reports) {
    localStorage.setItem(APP_CONFIG.STORAGE_REPORTS, JSON.stringify(reports));
  },
  upsertReport(report) {
    const list = this.getReports();
    const idx = list.findIndex(r => r.id === report.id);
    if (idx >= 0) list[idx] = report; else list.push(report);
    list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
    this.saveReports(list);
  },
  deleteReport(id) {
    this.saveReports(this.getReports().filter(r => r.id !== id));
  },
  getReport(id) {
    return this.getReports().find(r => r.id === id);
  },
  getSession() {
    try { return JSON.parse(sessionStorage.getItem(APP_CONFIG.STORAGE_SESSION) || 'null'); }
    catch(e) { return null; }
  },
  setSession(s) { sessionStorage.setItem(APP_CONFIG.STORAGE_SESSION, JSON.stringify(s)); },
  clearSession() { sessionStorage.removeItem(APP_CONFIG.STORAGE_SESSION); }
};


// ============================================================
// UI HELPERS
// ============================================================
function toast(msg, type, duration) {
  type = type || 'info';
  duration = duration || 3000;
  var wrap = $('#toastWrap');
  var t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(function() {
    t.style.opacity = '0';
    t.style.transform = 'translateX(100%)';
    t.style.transition = 'all 0.25s';
    setTimeout(function() { t.remove(); }, 250);
  }, duration);
}

function showLoading(text, sub) {
  var overlay = $('#loadingOverlay');
  $('#loadingText').textContent = text || 'Memproses...';
  $('#loadingSub').textContent = sub || '';
  $('#loadingProgress').classList.add('hidden');
  overlay.classList.remove('hidden');
}

function updateLoadingProgress(pct, sub) {
  var prog = $('#loadingProgress');
  prog.classList.remove('hidden');
  $('#loadingProgressBar').style.width = pct + '%';
  if (sub) $('#loadingSub').textContent = sub;
}

function hideLoading() {
  $('#loadingOverlay').classList.add('hidden');
}

function confirmDialog(opts) {
  return new Promise(function(resolve) {
    var root = $('#modalRoot');
    root.innerHTML =
      '<div class="modal-bg"><div class="modal">' +
      '<h2>' + escapeHtml(opts.title || 'Konfirmasi') + '</h2>' +
      '<p class="muted text-sm" style="margin:6px 0 0;">' + escapeHtml(opts.message || '') + '</p>' +
      '<div class="modal-actions">' +
      '<button class="btn btn-secondary" data-act="cancel">' + escapeHtml(opts.cancelText || 'Batal') + '</button>' +
      '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-act="ok">' + escapeHtml(opts.okText || 'Ya') + '</button>' +
      '</div></div></div>';
    function close(val) { root.innerHTML = ''; resolve(val); }
    root.querySelector('[data-act="cancel"]').onclick = function() { close(false); };
    root.querySelector('[data-act="ok"]').onclick = function() { close(true); };
    root.querySelector('.modal-bg').onclick = function(e) {
      if (e.target.classList.contains('modal-bg')) close(false);
    };
  });
}


// ============================================================
// AUTH
// ============================================================
var Auth = {
  login: function(username, password) {
    var u = APP_CONFIG.users.find(function(x) {
      return x.username === username && x.password === password;
    });
    if (u) {
      Storage.setSession({ username: u.username, role: u.role, loginAt: Date.now() });
      return u;
    }
    return null;
  },
  logout: function() { Storage.clearSession(); location.reload(); },
  current: function() { return Storage.getSession(); }
};

// ============================================================
// THEME
// ============================================================
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sppg_theme', theme);
  var label = $('#themeLabel');
  if (label) label.textContent = theme === 'dark' ? 'Mode Terang' : 'Mode Gelap';
}
function initTheme() {
  applyTheme(localStorage.getItem('sppg_theme') || 'light');
}

// ============================================================
// ROUTER
// ============================================================
var Pages = {};
var currentPage = 'dashboard';

function navigate(page) {
  currentPage = page;
  $$('.nav-item[data-page]').forEach(function(el) {
    el.classList.toggle('active', el.dataset.page === page);
  });
  var content = $('#pageContent');
  content.innerHTML = '';
  if (Pages[page]) Pages[page](content);
  var sb = $('#sidebar');
  if (sb) sb.classList.remove('open');
  window.scrollTo(0, 0);
}


// ============================================================
// PAGE: DASHBOARD
// ============================================================
Pages.dashboard = function(root) {
  var reports = Storage.getReports();
  var totalReports = reports.length;
  var totalPorsi = reports.reduce(function(s,r){ return s + safeNum(r.totalPorsi); }, 0);
  var last = reports[0];
  var now = new Date();
  var weekAgo = new Date(now.getTime() - 7*24*60*60*1000);
  var last7 = reports.filter(function(r){ return new Date(r.tanggal) >= weekAgo; });
  var schoolSet = new Set();
  reports.forEach(function(r){ (r.sekolahTidakFull||[]).forEach(function(s){ schoolSet.add(s.sekolah); }); });

  root.innerHTML =
    '<div class="page-header"><div>' +
    '<h1 class="page-title">Dashboard</h1>' +
    '<div class="page-sub">Selamat datang, <strong>' + escapeHtml((Auth.current()||{}).username||'') + '</strong>. Ringkasan distribusi MBG.</div>' +
    '</div><div class="page-actions">' +
    '<button class="btn btn-primary" data-go="entry"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Buat Laporan</button>' +
    '</div></div>' +
    '<div class="stats-grid">' +
    '<div class="stat"><div class="stat-label">Total Laporan</div><div class="stat-value">' + totalReports + '</div><div class="stat-trend">' + last7.length + ' dalam 7 hari terakhir</div></div>' +
    '<div class="stat"><div class="stat-label">Total Porsi</div><div class="stat-value">' + totalPorsi.toLocaleString('id-ID') + '</div><div class="stat-trend">Akumulasi seluruh laporan</div></div>' +
    '<div class="stat"><div class="stat-label">Sekolah Mitra</div><div class="stat-value">' + APP_CONFIG.schools.length + '</div><div class="stat-trend">' + schoolSet.size + ' pernah tidak full</div></div>' +
    '<div class="stat"><div class="stat-label">Laporan Terakhir</div><div class="stat-value" style="font-size:18px">' + (last ? formatTanggalShort(last.tanggal) : '-') + '</div><div class="stat-trend">' + (last ? escapeHtml(last.menu||'-') : 'Belum ada') + '</div></div>' +
    '</div>';

  if (reports.length === 0) {
    root.innerHTML += '<div class="card"><div class="empty"><div class="empty-icon">📋</div><div>Belum ada laporan. Klik "Buat Laporan" untuk memulai.</div></div></div>';
  } else {
    var tbl = '<div class="card"><h2 class="card-title">Laporan Terbaru</h2><div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Hari</th><th>Menu</th><th>Total Porsi</th><th>Tdk Full</th><th>PJ</th><th class="right">Aksi</th></tr></thead><tbody>';
    reports.slice(0,8).forEach(function(r) {
      var sf = (r.sekolahTidakFull||[]).length;
      tbl += '<tr><td>' + formatTanggalShort(r.tanggal) + '</td><td>' + escapeHtml(r.hari||'') + '</td><td>' + escapeHtml(r.menu||'-') + '</td><td><strong>' + safeNum(r.totalPorsi).toLocaleString('id-ID') + '</strong></td><td>' + (sf===0 ? '<span class="badge badge-success">Full</span>' : '<span class="badge badge-warning">' + sf + ' sekolah</span>') + '</td><td>' + escapeHtml(r.penanggungJawab||'-') + '</td><td class="right"><div class="row-actions"><button class="btn btn-secondary btn-icon" data-act="view" data-id="' + r.id + '" title="Lihat"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button><button class="btn btn-primary btn-icon" data-act="pdf" data-id="' + r.id + '" title="PDF"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button></div></td></tr>';
    });
    tbl += '</tbody></table></div></div>';
    root.innerHTML += tbl;
  }

  root.querySelectorAll('[data-go]').forEach(function(b){ b.onclick = function(){ navigate(b.dataset.go); }; });
  root.querySelectorAll('[data-act="view"]').forEach(function(b){ b.onclick = function(){ showReportDetail(b.dataset.id); }; });
  root.querySelectorAll('[data-act="pdf"]').forEach(function(b){ b.onclick = function(){ generateSinglePDF(b.dataset.id); }; });
};


// ============================================================
// PAGE: ENTRY (FORM INPUT)
// ============================================================
Pages.entry = function(root, editId) {
  var editing = editId ? Storage.getReport(editId) : null;
  var data = editing || {
    id: uid(),
    tanggal: todayISO(),
    hari: getHariFromDate(todayISO()),
    penanggungJawab: '',
    menu: '',
    foto: [],
    totalPorsi: '',
    sekolahTidakFull: [],
    gizi: {
      besar: { energi:'', protein:'', lemak:'', karbohidrat:'', serat:'' },
      kecil: { energi:'', protein:'', lemak:'', karbohidrat:'', serat:'' }
    },
    catatan: '',
    createdAt: Date.now()
  };

  var giziHTML = APP_CONFIG.nutritionFields.map(function(f) {
    return '<tr><td>' + f.label + ' <span class="muted text-xs">(' + f.unit + ')</span></td>' +
      '<td class="nutri-col-besar"><input class="input" type="number" step="0.01" min="0" data-gizi="besar" data-key="' + f.key + '" value="' + escapeHtml((data.gizi.besar||{})[f.key]||'') + '" placeholder="0"/></td>' +
      '<td class="nutri-col-kecil"><input class="input" type="number" step="0.01" min="0" data-gizi="kecil" data-key="' + f.key + '" value="' + escapeHtml((data.gizi.kecil||{})[f.key]||'') + '" placeholder="0"/></td></tr>';
  }).join('');

  root.innerHTML =
    '<div class="page-header"><div><h1 class="page-title">' + (editing ? 'Edit Laporan' : 'Input Laporan Harian') + '</h1><div class="page-sub">Lengkapi data distribusi makan bergizi gratis.</div></div><div class="page-actions"><button class="btn btn-secondary" id="btnCancel">Batal</button><button class="btn btn-success" id="btnSave"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Simpan</button></div></div>' +
    '<form id="entryForm" autocomplete="off">' +
    // Step 1
    '<div class="card"><h2 class="card-title"><span class="step-num">1</span> Informasi Umum</h2>' +
    '<div class="grid-2"><div class="form-group"><label>Tanggal</label><input class="input" type="date" id="f_tanggal" value="' + data.tanggal + '" required/></div><div class="form-group"><label>Hari (otomatis)</label><input class="input" type="text" id="f_hari" value="' + data.hari + '" readonly style="background:var(--surface-2)"/></div></div>' +
    '<div class="grid-2" style="margin-top:12px"><div class="form-group"><label>Penanggung Jawab</label><input class="input" type="text" id="f_pj" value="' + escapeHtml(data.penanggungJawab) + '" placeholder="Nama PJ hari ini" required/></div><div class="form-group"><label>Menu Makanan</label><input class="input" type="text" id="f_menu" value="' + escapeHtml(data.menu) + '" placeholder="Nasi, Ayam Goreng, Sayur..." required/></div></div></div>' +
    // Step 2
    '<div class="card"><h2 class="card-title"><span class="step-num">2</span> Foto Makanan</h2>' +
    '<div class="photo-uploader" id="photoUploader"><div class="photo-icon">📸</div><div style="font-weight:600">Klik atau drag & drop foto di sini</div><div class="text-sm muted" style="margin-top:4px">Maks 4 foto, JPG/PNG</div><input type="file" id="photoInput" accept="image/*" multiple style="display:none"/></div>' +
    '<div class="photo-grid" id="photoGrid"></div></div>' +
    // Step 3
    '<div class="card"><h2 class="card-title"><span class="step-num">3</span> Distribusi Porsi</h2>' +
    '<div class="grid-2"><div class="form-group"><label>Total Porsi Terdistribusi</label><input class="input" type="number" id="f_totalPorsi" value="' + data.totalPorsi + '" min="0" placeholder="0" required/></div></div></div>' +
    // Step 4
    '<div class="card"><h2 class="card-title"><span class="step-num">4</span> Sekolah Tidak Full Terdistribusi <span class="badge badge-info" style="margin-left:auto" id="schoolCount">0</span></h2>' +
    '<p class="text-sm muted" style="margin-top:-8px;margin-bottom:14px">Catat sekolah yang porsinya kurang. Kosongkan jika semua full.</p>' +
    '<div class="table-wrap"><table><thead><tr><th style="width:50%">Sekolah</th><th>Porsi Terkirim</th><th>Keterangan</th><th class="right">Aksi</th></tr></thead><tbody id="schoolTbody"></tbody></table></div>' +
    '<button type="button" class="btn btn-secondary" id="btnAddSchool" style="margin-top:12px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Tambah Sekolah</button></div>' +
    // Step 5
    '<div class="card"><h2 class="card-title"><span class="step-num">5</span> Kandungan Gizi per Porsi</h2>' +
    '<p class="text-sm muted" style="margin-top:-8px;margin-bottom:14px"><strong>Porsi Besar</strong> = SD kelas atas/SMP/SMA. <strong>Porsi Kecil</strong> = PAUD/TK/SD kelas rendah.</p>' +
    '<div class="table-wrap"><table class="nutri-table"><thead><tr><th style="width:35%">Komponen Gizi</th><th class="nutri-col-besar">Porsi Besar</th><th class="nutri-col-kecil">Porsi Kecil</th></tr></thead><tbody>' + giziHTML + '</tbody></table></div></div>' +
    // Step 6
    '<div class="card"><h2 class="card-title"><span class="step-num">6</span> Catatan (Opsional)</h2><textarea class="textarea" id="f_catatan" placeholder="Catatan, kendala, hal khusus...">' + escapeHtml(data.catatan||'') + '</textarea></div>' +
    '<div class="flex-end" style="padding-bottom:32px"><button type="button" class="btn btn-secondary" id="btnCancel2">Batal</button><button type="button" class="btn btn-success" id="btnSave2">Simpan Laporan</button></div></form>';

  // Bind date->hari
  $('#f_tanggal').addEventListener('change', function() { $('#f_hari').value = getHariFromDate(this.value); });

  // Photos
  var photos = (data.foto || []).slice();
  var photoUploader = $('#photoUploader');
  var photoInput = $('#photoInput');
  var photoGrid = $('#photoGrid');

  function renderPhotos() {
    photoGrid.innerHTML = photos.map(function(src, i) {
      return '<div class="photo-thumb"><img src="' + src + '" alt="Foto ' + (i+1) + '"/><button type="button" class="photo-thumb-remove" data-idx="' + i + '">×</button></div>';
    }).join('');
    photoGrid.querySelectorAll('.photo-thumb-remove').forEach(function(b) {
      b.onclick = function() { photos.splice(+b.dataset.idx, 1); renderPhotos(); };
    });
  }
  renderPhotos();

  photoUploader.onclick = function() { photoInput.click(); };
  photoUploader.ondragover = function(e) { e.preventDefault(); photoUploader.classList.add('drag'); };
  photoUploader.ondragleave = function() { photoUploader.classList.remove('drag'); };
  photoUploader.ondrop = function(e) { e.preventDefault(); photoUploader.classList.remove('drag'); handleFiles(e.dataTransfer.files); };
  photoInput.onchange = function() { handleFiles(photoInput.files); };

  function handleFiles(files) {
    Array.from(files).slice(0, 4 - photos.length).forEach(function(file) {
      if (!file.type.startsWith('image/')) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        var img = new Image();
        img.onload = function() {
          var maxW = 1200, ratio = Math.min(1, maxW / img.width);
          var c = document.createElement('canvas');
          c.width = img.width * ratio; c.height = img.height * ratio;
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          photos.push(c.toDataURL('image/jpeg', 0.8));
          renderPhotos();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }


  // School rows
  var schoolRows = (data.sekolahTidakFull || []).slice();
  var schoolTbody = $('#schoolTbody');

  function renderSchools() {
    if (schoolRows.length === 0) {
      schoolTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px">Semua sekolah terdistribusi penuh.</td></tr>';
    } else {
      schoolTbody.innerHTML = schoolRows.map(function(row, i) {
        var opts = APP_CONFIG.schools.map(function(s) {
          return '<option value="' + escapeHtml(s) + '"' + (row.sekolah===s?' selected':'') + '>' + escapeHtml(s) + '</option>';
        }).join('');
        return '<tr data-idx="' + i + '"><td><select class="select" data-field="sekolah"><option value="">-- Pilih --</option>' + opts + '</select></td><td><input class="input" type="number" min="0" data-field="porsi" value="' + (row.porsi||'') + '" placeholder="0"/></td><td><input class="input" type="text" data-field="ket" value="' + escapeHtml(row.ket||'') + '" placeholder="Keterangan"/></td><td class="right"><button type="button" class="btn btn-danger btn-icon" data-rm="' + i + '" title="Hapus"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg></button></td></tr>';
      }).join('');
      schoolTbody.querySelectorAll('select[data-field],input[data-field]').forEach(function(el) {
        el.oninput = function() {
          var idx = +el.closest('tr').dataset.idx;
          schoolRows[idx][el.dataset.field] = el.value;
        };
      });
      schoolTbody.querySelectorAll('[data-rm]').forEach(function(b) {
        b.onclick = function() { schoolRows.splice(+b.dataset.rm, 1); renderSchools(); };
      });
    }
    $('#schoolCount').textContent = schoolRows.length + ' sekolah';
  }
  renderSchools();
  $('#btnAddSchool').onclick = function() { schoolRows.push({sekolah:'',porsi:'',ket:''}); renderSchools(); };

  // Save
  function collectData() {
    var gizi = { besar: {}, kecil: {} };
    root.querySelectorAll('input[data-gizi]').forEach(function(el) {
      gizi[el.dataset.gizi][el.dataset.key] = el.value;
    });
    return {
      id: data.id, createdAt: data.createdAt,
      tanggal: $('#f_tanggal').value,
      hari: $('#f_hari').value,
      penanggungJawab: $('#f_pj').value.trim(),
      menu: $('#f_menu').value.trim(),
      foto: photos,
      totalPorsi: $('#f_totalPorsi').value,
      sekolahTidakFull: schoolRows.filter(function(r){ return r.sekolah && r.porsi !== ''; }),
      gizi: gizi,
      catatan: $('#f_catatan').value.trim(),
      updatedAt: Date.now()
    };
  }

  function save() {
    var d = collectData();
    if (!d.tanggal) return toast('Tanggal wajib diisi', 'error');
    if (!d.penanggungJawab) return toast('PJ wajib diisi', 'error');
    if (!d.menu) return toast('Menu wajib diisi', 'error');
    if (!d.totalPorsi) return toast('Total porsi wajib diisi', 'error');
    Storage.upsertReport(d);
    toast(editing ? 'Laporan diperbarui' : 'Laporan disimpan', 'success');
    navigate('history');
  }

  $('#btnSave').onclick = save;
  $('#btnSave2').onclick = save;
  $('#btnCancel').onclick = function() { navigate('dashboard'); };
  $('#btnCancel2').onclick = function() { navigate('dashboard'); };
};


// ============================================================
// PAGE: HISTORY
// ============================================================
Pages.history = function(root) {
  var filterFrom = '', filterTo = '', filterSearch = '';

  function render() {
    var all = Storage.getReports();
    var filtered = all.filter(function(r) {
      if (filterFrom && r.tanggal < filterFrom) return false;
      if (filterTo && r.tanggal > filterTo) return false;
      if (filterSearch) {
        var q = filterSearch.toLowerCase();
        var hay = (r.menu||'') + ' ' + (r.penanggungJawab||'') + ' ' + (r.hari||'');
        if (hay.toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });

    var rows = filtered.map(function(r) {
      var sf = (r.sekolahTidakFull||[]).length;
      return '<tr><td><strong>' + formatTanggalShort(r.tanggal) + '</strong></td><td>' + escapeHtml(r.hari||'') + '</td><td>' + escapeHtml(r.menu||'-') + '</td><td>' + safeNum(r.totalPorsi).toLocaleString('id-ID') + '</td><td>' + (sf===0 ? '<span class="badge badge-success">Full</span>' : '<span class="badge badge-warning">' + sf + '</span>') + '</td><td>' + escapeHtml(r.penanggungJawab||'-') + '</td><td class="right"><div class="row-actions"><button class="btn btn-secondary btn-icon" data-act="view" data-id="' + r.id + '" title="Lihat"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button><button class="btn btn-secondary btn-icon" data-act="edit" data-id="' + r.id + '" title="Edit"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn btn-primary btn-icon" data-act="pdf" data-id="' + r.id + '" title="PDF"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button><button class="btn btn-danger btn-icon" data-act="delete" data-id="' + r.id + '" title="Hapus"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg></button></div></td></tr>';
    }).join('');

    root.innerHTML =
      '<div class="page-header"><div><h1 class="page-title">Riwayat Laporan</h1><div class="page-sub">' + filtered.length + ' dari ' + all.length + ' laporan.</div></div><div class="page-actions"><button class="btn btn-primary" data-go="entry"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Laporan Baru</button></div></div>' +
      '<div class="filter-bar"><div class="form-group"><label>Cari</label><input class="input" id="fSearch" type="text" placeholder="Menu, PJ, hari..." value="' + escapeHtml(filterSearch) + '"/></div><div class="form-group"><label>Dari</label><input class="input" id="fFrom" type="date" value="' + filterFrom + '"/></div><div class="form-group"><label>Sampai</label><input class="input" id="fTo" type="date" value="' + filterTo + '"/></div><button class="btn btn-secondary" id="fClear">Reset</button></div>' +
      (filtered.length === 0 ? '<div class="card"><div class="empty"><div class="empty-icon">🔍</div><div>Tidak ada laporan cocok.</div></div></div>' :
      '<div class="card" style="padding:0"><div class="table-wrap" style="border:none"><table><thead><tr><th>Tanggal</th><th>Hari</th><th>Menu</th><th>Porsi</th><th>Tdk Full</th><th>PJ</th><th class="right">Aksi</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>');

    $('#fSearch').oninput = function(e) { filterSearch = e.target.value; debouncedRender(); };
    $('#fFrom').onchange = function(e) { filterFrom = e.target.value; render(); };
    $('#fTo').onchange = function(e) { filterTo = e.target.value; render(); };
    $('#fClear').onclick = function() { filterFrom = filterTo = filterSearch = ''; render(); };
    root.querySelectorAll('[data-go]').forEach(function(b){ b.onclick = function(){ navigate(b.dataset.go); }; });
    root.querySelectorAll('[data-act="view"]').forEach(function(b){ b.onclick = function(){ showReportDetail(b.dataset.id); }; });
    root.querySelectorAll('[data-act="edit"]').forEach(function(b){ b.onclick = function(){ Pages.entry($('#pageContent'), b.dataset.id); }; });
    root.querySelectorAll('[data-act="pdf"]').forEach(function(b){ b.onclick = function(){ generateSinglePDF(b.dataset.id); }; });
    root.querySelectorAll('[data-act="delete"]').forEach(function(b){
      b.onclick = function() {
        confirmDialog({ title:'Hapus Laporan?', message:'Data tidak bisa dikembalikan.', danger:true, okText:'Hapus' }).then(function(ok){ if(ok){ Storage.deleteReport(b.dataset.id); toast('Dihapus','success'); render(); } });
      };
    });
  }

  var debounceTimer;
  function debouncedRender() { clearTimeout(debounceTimer); debounceTimer = setTimeout(render, 200); }
  render();
};


// ============================================================
// PAGE: EXPORT (Range PDF)
// ============================================================
Pages.export = function(root) {
  var all = Storage.getReports();
  var dates = all.map(function(r){return r.tanggal;}).filter(Boolean).sort();
  var minD = dates[0] || todayISO();
  var maxD = dates[dates.length-1] || todayISO();

  root.innerHTML =
    '<div class="page-header"><div><h1 class="page-title">Export PDF Range</h1><div class="page-sub">Download laporan gabungan berdasarkan rentang tanggal.</div></div></div>' +
    '<div class="card"><h2 class="card-title">Pilih Rentang Tanggal</h2><div class="grid-3"><div class="form-group"><label>Dari</label><input class="input" id="rFrom" type="date" value="' + minD + '"/></div><div class="form-group"><label>Sampai</label><input class="input" id="rTo" type="date" value="' + maxD + '"/></div><div class="form-group" style="align-self:end"><button class="btn btn-secondary btn-block" id="rPreview">Preview</button></div></div><div id="rResult" style="margin-top:18px"></div></div>';

  function preview() {
    var from = $('#rFrom').value, to = $('#rTo').value;
    if (!from || !to) return toast('Tanggal harus diisi','error');
    if (from > to) return toast('Tanggal "Dari" harus sebelum "Sampai"','error');
    var filtered = all.filter(function(r){ return r.tanggal >= from && r.tanggal <= to; }).sort(function(a,b){ return (a.tanggal||'').localeCompare(b.tanggal||''); });
    var result = $('#rResult');
    if (filtered.length === 0) { result.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><div>Tidak ada laporan.</div></div>'; return; }
    var tp = filtered.reduce(function(s,r){ return s + safeNum(r.totalPorsi); }, 0);
    var trows = filtered.map(function(r){ return '<tr><td>' + formatTanggalShort(r.tanggal) + '</td><td>' + escapeHtml(r.hari||'') + '</td><td>' + escapeHtml(r.menu||'-') + '</td><td>' + safeNum(r.totalPorsi).toLocaleString('id-ID') + '</td><td>' + (r.sekolahTidakFull||[]).length + '</td></tr>'; }).join('');
    result.innerHTML =
      '<div class="stats-grid" style="margin-bottom:14px"><div class="stat"><div class="stat-label">Laporan</div><div class="stat-value">' + filtered.length + '</div></div><div class="stat"><div class="stat-label">Total Porsi</div><div class="stat-value">' + tp.toLocaleString('id-ID') + '</div></div><div class="stat"><div class="stat-label">Periode</div><div class="stat-value" style="font-size:16px">' + formatTanggalShort(from) + ' - ' + formatTanggalShort(to) + '</div></div></div>' +
      '<div class="table-wrap" style="margin-bottom:14px"><table><thead><tr><th>Tanggal</th><th>Hari</th><th>Menu</th><th>Porsi</th><th>Tdk Full</th></tr></thead><tbody>' + trows + '</tbody></table></div>' +
      '<button class="btn btn-success btn-block" id="rDownload"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download PDF (' + filtered.length + ' laporan)</button>';
    $('#rDownload').onclick = function() { generateRangePDF(filtered, from, to); };
  }
  $('#rPreview').onclick = preview;
  preview();
};


// ============================================================
// PAGE: SETTINGS
// ============================================================
Pages.settings = function(root) {
  var reports = Storage.getReports();
  var storageSize = new Blob([JSON.stringify(reports)]).size;
  var sizeStr = storageSize > 1024*1024 ? (storageSize/1024/1024).toFixed(2) + ' MB' : (storageSize/1024).toFixed(1) + ' KB';

  root.innerHTML =
    '<div class="page-header"><div><h1 class="page-title">Pengaturan</h1><div class="page-sub">Kelola data dan backup laporan.</div></div></div>' +
    '<div class="card"><h2 class="card-title">Backup & Restore Data</h2>' +
    '<p class="text-sm muted" style="margin-top:-8px;margin-bottom:14px">Data tersimpan di browser (localStorage). Total: <strong>' + sizeStr + '</strong> (' + reports.length + ' laporan).</p>' +
    '<div class="flex" style="gap:12px;flex-wrap:wrap">' +
    '<button class="btn btn-primary" id="btnBackup"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download Backup (JSON)</button>' +
    '<button class="btn btn-warning" id="btnRestore"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Restore dari File</button>' +
    '<input type="file" id="restoreInput" accept=".json" style="display:none"/>' +
    '</div></div>' +
    '<div class="card"><h2 class="card-title">Hapus Semua Data</h2>' +
    '<p class="text-sm muted" style="margin-top:-8px;margin-bottom:14px">Menghapus semua laporan dari browser ini. Pastikan sudah backup terlebih dahulu.</p>' +
    '<button class="btn btn-danger" id="btnClearAll"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg> Hapus Semua Laporan</button></div>' +
    '<div class="card"><h2 class="card-title">Informasi Aplikasi</h2>' +
    '<div class="grid-2">' +
    '<div><div class="text-xs muted">Versi</div><div><strong>2.0</strong></div></div>' +
    '<div><div class="text-xs muted">Storage</div><div><strong>localStorage (browser)</strong></div></div>' +
    '<div><div class="text-xs muted">Jumlah Sekolah</div><div><strong>' + APP_CONFIG.schools.length + '</strong></div></div>' +
    '<div><div class="text-xs muted">User Aktif</div><div><strong>' + escapeHtml((Auth.current()||{}).username||'-') + '</strong></div></div>' +
    '</div></div>';

  // Backup
  $('#btnBackup').onclick = function() {
    var data = { version: '2.0', exportedAt: new Date().toISOString(), reports: Storage.getReports() };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'backup_sppg_' + todayISO() + '.json'; a.click();
    URL.revokeObjectURL(url);
    toast('Backup berhasil diunduh', 'success');
  };

  // Restore
  var restoreInput = $('#restoreInput');
  $('#btnRestore').onclick = function() { restoreInput.click(); };
  restoreInput.onchange = function() {
    var file = restoreInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var json = JSON.parse(ev.target.result);
        var arr = json.reports || json;
        if (!Array.isArray(arr)) throw new Error('Format tidak valid');
        confirmDialog({ title: 'Restore Data?', message: 'Akan menambahkan ' + arr.length + ' laporan. Data lama tetap ada (merge).', okText: 'Restore' }).then(function(ok) {
          if (!ok) return;
          var existing = Storage.getReports();
          var existIds = new Set(existing.map(function(r){return r.id;}));
          var added = 0;
          arr.forEach(function(r) {
            if (!existIds.has(r.id)) { existing.push(r); added++; }
          });
          existing.sort(function(a,b){ return (b.tanggal||'').localeCompare(a.tanggal||''); });
          Storage.saveReports(existing);
          toast('Restore selesai: ' + added + ' laporan baru ditambahkan', 'success');
          Pages.settings(root);
        });
      } catch(e) { toast('File tidak valid: ' + e.message, 'error'); }
    };
    reader.readAsText(file);
  };

  // Clear all
  $('#btnClearAll').onclick = function() {
    confirmDialog({ title: 'Hapus Semua?', message: 'SEMUA laporan akan dihapus permanen. Pastikan sudah backup!', danger: true, okText: 'Hapus Semua' }).then(function(ok) {
      if (!ok) return;
      Storage.saveReports([]);
      toast('Semua data dihapus', 'success');
      Pages.settings(root);
    });
  };
};


// ============================================================
// REPORT DETAIL VIEW (Modal)
// ============================================================
function showReportDetail(id) {
  var r = Storage.getReport(id);
  if (!r) return toast('Tidak ditemukan', 'error');
  var root = $('#modalRoot');
  var photoHTML = (r.foto||[]).length > 0 ? '<div class="text-xs muted" style="margin:10px 0 6px">Foto Makanan</div><div class="photo-grid">' + r.foto.map(function(f){ return '<div class="photo-thumb"><img src="' + f + '"/></div>'; }).join('') + '</div>' : '';
  var schoolHTML = (r.sekolahTidakFull||[]).length === 0 ? '<div class="badge badge-success">Semua sekolah full</div>' : '<div class="table-wrap"><table><thead><tr><th>Sekolah</th><th>Porsi</th><th>Ket</th></tr></thead><tbody>' + r.sekolahTidakFull.map(function(s){ return '<tr><td>' + escapeHtml(s.sekolah) + '</td><td>' + safeNum(s.porsi) + '</td><td>' + escapeHtml(s.ket||'-') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  var giziHTML = '<div class="table-wrap"><table class="nutri-table"><thead><tr><th>Komponen</th><th>Porsi Besar</th><th>Porsi Kecil</th></tr></thead><tbody>' + APP_CONFIG.nutritionFields.map(function(f){ return '<tr><td>' + f.label + ' (' + f.unit + ')</td><td>' + escapeHtml((r.gizi&&r.gizi.besar?r.gizi.besar[f.key]:'')||'-') + '</td><td>' + escapeHtml((r.gizi&&r.gizi.kecil?r.gizi.kecil[f.key]:'')||'-') + '</td></tr>'; }).join('') + '</tbody></table></div>';

  root.innerHTML =
    '<div class="modal-bg"><div class="modal modal-wide"><h2>Detail Laporan</h2><p class="muted text-sm" style="margin:4px 0 16px">' + formatTanggalLengkap(r.tanggal) + '</p>' +
    '<div style="max-height:60vh;overflow-y:auto;padding-right:6px">' +
    '<div class="grid-2" style="margin-bottom:12px"><div><div class="text-xs muted">Penanggung Jawab</div><div><strong>' + escapeHtml(r.penanggungJawab||'-') + '</strong></div></div><div><div class="text-xs muted">Menu</div><div><strong>' + escapeHtml(r.menu||'-') + '</strong></div></div><div><div class="text-xs muted">Total Porsi</div><div><strong>' + safeNum(r.totalPorsi).toLocaleString('id-ID') + '</strong></div></div><div><div class="text-xs muted">Hari</div><div><strong>' + escapeHtml(r.hari||'-') + '</strong></div></div></div>' +
    photoHTML +
    '<div class="text-xs muted" style="margin:14px 0 6px">Sekolah Tidak Full</div>' + schoolHTML +
    '<div class="text-xs muted" style="margin:14px 0 6px">Kandungan Gizi</div>' + giziHTML +
    (r.catatan ? '<div class="text-xs muted" style="margin:14px 0 6px">Catatan</div><div>' + escapeHtml(r.catatan) + '</div>' : '') +
    '</div><div class="modal-actions"><button class="btn btn-secondary" data-act="close">Tutup</button><button class="btn btn-primary" data-act="pdf">Download PDF</button></div></div></div>';

  root.querySelector('[data-act="close"]').onclick = function() { root.innerHTML = ''; };
  root.querySelector('[data-act="pdf"]').onclick = function() { root.innerHTML = ''; generateSinglePDF(id); };
  root.querySelector('.modal-bg').onclick = function(e) { if (e.target.classList.contains('modal-bg')) root.innerHTML = ''; };
}


// ============================================================
// PDF GENERATION — FIXED multi-page + photos
// ============================================================
function buildReportHTMLForPDF(r) {
  var giziRows = APP_CONFIG.nutritionFields.map(function(f) {
    return '<tr><td style="padding:8px 10px;border:1px solid #cbd5e1;font-weight:600">' + f.label + ' <span style="color:#64748b;font-weight:400">(' + f.unit + ')</span></td><td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;background:#eef2ff">' + escapeHtml((r.gizi&&r.gizi.besar?r.gizi.besar[f.key]:'')||'-') + '</td><td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;background:#ecfdf5">' + escapeHtml((r.gizi&&r.gizi.kecil?r.gizi.kecil[f.key]:'')||'-') + '</td></tr>';
  }).join('');

  var schoolRows;
  if ((r.sekolahTidakFull||[]).length === 0) {
    schoolRows = '<tr><td colspan="4" style="padding:14px;text-align:center;color:#059669;font-weight:600;border:1px solid #cbd5e1">&#10003; Semua sekolah terdistribusi penuh</td></tr>';
  } else {
    schoolRows = r.sekolahTidakFull.map(function(s, i) {
      return '<tr><td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center">' + (i+1) + '</td><td style="padding:8px 10px;border:1px solid #cbd5e1">' + escapeHtml(s.sekolah) + '</td><td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;font-weight:600">' + safeNum(s.porsi).toLocaleString('id-ID') + '</td><td style="padding:8px 10px;border:1px solid #cbd5e1">' + escapeHtml(s.ket||'-') + '</td></tr>';
    }).join('');
  }

  // Photo section - IMPORTANT: use full base64 src for html2canvas
  var photos = (r.foto || []).slice(0, 4);
  var photoHtml = '';
  if (photos.length > 0) {
    var w = photos.length === 1 ? '100%' : photos.length === 2 ? '48%' : '31%';
    photoHtml = '<div style="font-size:13px;font-weight:700;margin:16px 0 8px;color:#4f46e5">Foto Makanan</div><div style="display:flex;flex-wrap:wrap;gap:8px">';
    photos.forEach(function(src) {
      photoHtml += '<div style="width:' + w + ';border-radius:8px;overflow:hidden;border:1px solid #cbd5e1"><img src="' + src + '" style="width:100%;height:auto;display:block" crossorigin="anonymous"/></div>';
    });
    photoHtml += '</div>';
  }

  return '<div style="padding:32px 38px;font-family:Inter,Arial,sans-serif;color:#0f172a;background:#fff;width:794px;box-sizing:border-box">' +
    '<div style="background:linear-gradient(135deg,#4f46e5,#7c3aed,#ec4899);margin:-32px -38px 20px;padding:22px 38px;color:#fff">' +
    '<div style="font-size:10px;letter-spacing:0.15em;text-transform:uppercase;opacity:0.9">SPPG Batuwinangun</div>' +
    '<div style="font-size:20px;font-weight:800;margin-top:3px">Laporan Harian Distribusi MBG</div>' +
    '<div style="font-size:12px;margin-top:4px;opacity:0.95">' + formatTanggalLengkap(r.tanggal) + '</div></div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px">' +
    '<tr><td style="padding:7px 10px;border:1px solid #cbd5e1;background:#f1f5f9;font-weight:600;width:28%">Tanggal</td><td style="padding:7px 10px;border:1px solid #cbd5e1">' + formatTanggalShort(r.tanggal) + '</td><td style="padding:7px 10px;border:1px solid #cbd5e1;background:#f1f5f9;font-weight:600;width:18%">Hari</td><td style="padding:7px 10px;border:1px solid #cbd5e1">' + escapeHtml(r.hari||'-') + '</td></tr>' +
    '<tr><td style="padding:7px 10px;border:1px solid #cbd5e1;background:#f1f5f9;font-weight:600">Penanggung Jawab</td><td colspan="3" style="padding:7px 10px;border:1px solid #cbd5e1">' + escapeHtml(r.penanggungJawab||'-') + '</td></tr>' +
    '<tr><td style="padding:7px 10px;border:1px solid #cbd5e1;background:#f1f5f9;font-weight:600">Menu Hari Ini</td><td colspan="3" style="padding:7px 10px;border:1px solid #cbd5e1">' + escapeHtml(r.menu||'-') + '</td></tr>' +
    '<tr><td style="padding:7px 10px;border:1px solid #cbd5e1;background:#f1f5f9;font-weight:600">Total Porsi</td><td colspan="3" style="padding:8px 10px;border:1px solid #cbd5e1;font-size:15px;font-weight:800;color:#4f46e5">' + safeNum(r.totalPorsi).toLocaleString('id-ID') + ' porsi</td></tr></table>' +
    photoHtml +
    '<div style="font-size:13px;font-weight:700;margin:16px 0 6px;color:#4f46e5">Sekolah Tidak Full Terdistribusi</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:11.5px"><thead><tr style="background:#1e293b;color:#fff"><th style="padding:7px 10px;border:1px solid #1e293b;width:35px">No</th><th style="padding:7px 10px;border:1px solid #1e293b;text-align:left">Sekolah</th><th style="padding:7px 10px;border:1px solid #1e293b;width:100px">Porsi</th><th style="padding:7px 10px;border:1px solid #1e293b;text-align:left">Keterangan</th></tr></thead><tbody>' + schoolRows + '</tbody></table>' +
    '<div style="font-size:13px;font-weight:700;margin:16px 0 6px;color:#4f46e5">Kandungan Gizi per Porsi</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#1e293b;color:#fff"><th style="padding:7px 10px;border:1px solid #1e293b;text-align:left;width:38%">Komponen</th><th style="padding:7px 10px;border:1px solid #1e293b;background:#4f46e5">Porsi Besar</th><th style="padding:7px 10px;border:1px solid #1e293b;background:#10b981">Porsi Kecil</th></tr></thead><tbody>' + giziRows + '</tbody></table>' +
    (r.catatan ? '<div style="font-size:13px;font-weight:700;margin:16px 0 6px;color:#4f46e5">Catatan</div><div style="padding:8px 12px;background:#f1f5f9;border-left:3px solid #4f46e5;font-size:12px;border-radius:4px">' + escapeHtml(r.catatan) + '</div>' : '') +
    '<div style="margin-top:20px;padding-top:10px;border-top:1px dashed #cbd5e1;font-size:9px;color:#64748b;display:flex;justify-content:space-between"><div>SPPG Batuwinangun - Sistem Pelaporan Distribusi MBG</div><div>Dicetak: ' + new Date().toLocaleString('id-ID') + '</div></div></div>';
}


function buildCoverHTML(reports, from, to) {
  var totalPorsi = reports.reduce(function(s,r){ return s + safeNum(r.totalPorsi); }, 0);
  var totalIssues = reports.reduce(function(s,r){ return s + (r.sekolahTidakFull||[]).length; }, 0);
  var trows = reports.map(function(r, i) {
    return '<tr><td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:center">' + (i+1) + '</td><td style="padding:5px 8px;border:1px solid #cbd5e1">' + formatTanggalShort(r.tanggal) + ' (' + escapeHtml(r.hari||'') + ')</td><td style="padding:5px 8px;border:1px solid #cbd5e1">' + escapeHtml(r.menu||'-') + '</td><td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:right;font-weight:600">' + safeNum(r.totalPorsi).toLocaleString('id-ID') + '</td><td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:center">' + (r.sekolahTidakFull||[]).length + '</td></tr>';
  }).join('');

  return '<div style="padding:50px;font-family:Inter,Arial,sans-serif;color:#0f172a;background:#fff;width:794px;box-sizing:border-box;min-height:1000px">' +
    '<div style="background:linear-gradient(135deg,#4f46e5,#7c3aed,#ec4899);margin:-50px -50px 28px;padding:70px 50px;color:#fff;text-align:center">' +
    '<div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;opacity:0.9">SPPG Batuwinangun</div>' +
    '<div style="font-size:28px;font-weight:800;margin-top:6px">LAPORAN AKUMULASI</div>' +
    '<div style="font-size:14px;opacity:0.9;margin-top:4px">Distribusi Makan Bergizi Gratis</div></div>' +
    '<div style="text-align:center;margin:24px 0"><div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.1em">Periode</div><div style="font-size:20px;font-weight:700;margin-top:4px">' + formatTanggalLengkap(from) + '</div><div style="font-size:12px;color:#64748b;margin:3px 0">s/d</div><div style="font-size:20px;font-weight:700">' + formatTanggalLengkap(to) + '</div></div>' +
    '<div style="display:flex;gap:10px;margin:24px 0">' +
    '<div style="flex:1;background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:16px;text-align:center"><div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600">Jumlah Laporan</div><div style="font-size:28px;font-weight:800;color:#4f46e5;margin-top:4px">' + reports.length + '</div></div>' +
    '<div style="flex:1;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:16px;text-align:center"><div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600">Total Porsi</div><div style="font-size:28px;font-weight:800;color:#059669;margin-top:4px">' + totalPorsi.toLocaleString('id-ID') + '</div></div>' +
    '<div style="flex:1;background:#fff7ed;border:1px solid #fde68a;border-radius:12px;padding:16px;text-align:center"><div style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600">Tdk Full</div><div style="font-size:28px;font-weight:800;color:#d97706;margin-top:4px">' + totalIssues + '</div></div></div>' +
    '<div style="font-size:13px;font-weight:700;margin:20px 0 6px;color:#4f46e5">Daftar Laporan</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#1e293b;color:#fff"><th style="padding:6px;border:1px solid #1e293b;width:35px">No</th><th style="padding:6px;border:1px solid #1e293b;text-align:left">Tanggal</th><th style="padding:6px;border:1px solid #1e293b;text-align:left">Menu</th><th style="padding:6px;border:1px solid #1e293b;width:80px">Porsi</th><th style="padding:6px;border:1px solid #1e293b;width:60px">Tdk Full</th></tr></thead><tbody>' + trows +
    '<tr style="background:#f1f5f9;font-weight:700"><td colspan="3" style="padding:6px;border:1px solid #cbd5e1;text-align:right">TOTAL</td><td style="padding:6px;border:1px solid #cbd5e1;text-align:right;color:#4f46e5">' + totalPorsi.toLocaleString('id-ID') + '</td><td style="padding:6px;border:1px solid #cbd5e1;text-align:center;color:#d97706">' + totalIssues + '</td></tr></tbody></table>' +
    '<div style="margin-top:30px;padding-top:12px;border-top:1px dashed #cbd5e1;font-size:9px;color:#64748b;text-align:center">SPPG Batuwinangun - Dicetak ' + new Date().toLocaleString('id-ID') + ' | Halaman berikut: detail per tanggal</div></div>';
}


// ============================================================
// RENDER HTML TO CANVAS (with proper image wait)
// ============================================================
function renderHTMLToCanvas(html) {
  return new Promise(function(resolve, reject) {
    var target = $('#pdfRender');
    target.innerHTML = html;
    // Wait for ALL images to load (critical for photos in PDF)
    var imgs = Array.from(target.querySelectorAll('img'));
    var promises = imgs.map(function(img) {
      return new Promise(function(res) {
        if (img.complete && img.naturalWidth > 0) { res(); return; }
        img.onload = function() { res(); };
        img.onerror = function() { res(); }; // don't block on error
      });
    });
    Promise.all(promises).then(function() {
      // Small delay to ensure rendering is complete
      setTimeout(function() {
        html2canvas(target.firstElementChild, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          imageTimeout: 15000
        }).then(function(canvas) {
          target.innerHTML = '';
          resolve(canvas);
        }).catch(function(err) {
          target.innerHTML = '';
          reject(err);
        });
      }, 100);
    });
  });
}

// ============================================================
// ADD CANVAS TO PDF — FIXED multi-page slicing
// ============================================================
function addCanvasToPDF(pdf, canvas, isFirstPage) {
  var pageWidth = 210; // A4 mm
  var pageHeight = 297;
  var imgWidth = pageWidth;
  var imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight <= pageHeight) {
    // Fits on one page
    if (!isFirstPage) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, imgWidth, imgHeight);
  } else {
    // Need to slice canvas into multiple pages
    var pxPerPage = Math.floor(canvas.width * (pageHeight / imgWidth));
    var totalPages = Math.ceil(canvas.height / pxPerPage);

    for (var p = 0; p < totalPages; p++) {
      if (p > 0 || !isFirstPage) pdf.addPage();

      var sliceHeight = Math.min(pxPerPage, canvas.height - p * pxPerPage);
      var sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeight;
      var ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, p * pxPerPage, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

      var sliceImgHeight = (sliceHeight * imgWidth) / canvas.width;
      pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, imgWidth, sliceImgHeight);
    }
  }
}


// ============================================================
// GENERATE SINGLE PDF
// ============================================================
function generateSinglePDF(id) {
  var r = Storage.getReport(id);
  if (!r) return toast('Tidak ditemukan', 'error');

  showLoading('Membuat PDF...', 'Memproses laporan ' + formatTanggalShort(r.tanggal));

  setTimeout(function() {
    renderHTMLToCanvas(buildReportHTMLForPDF(r)).then(function(canvas) {
      var jsPDF = window.jspdf.jsPDF;
      var pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      addCanvasToPDF(pdf, canvas, true);
      var filename = 'Laporan_SPPG_' + r.tanggal + '_' + (r.hari||'').replace(/\s/g,'') + '.pdf';
      pdf.save(filename);
      hideLoading();
      toast('PDF berhasil diunduh!', 'success');
    }).catch(function(err) {
      hideLoading();
      console.error(err);
      toast('Gagal: ' + err.message, 'error');
    });
  }, 200);
}

// ============================================================
// GENERATE RANGE PDF (multiple reports)
// ============================================================
function generateRangePDF(reports, from, to) {
  showLoading('Membuat PDF Gabungan...', '0 / ' + (reports.length + 1) + ' halaman');

  setTimeout(function() {
    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    var total = reports.length + 1; // cover + reports

    // Build cover first
    renderHTMLToCanvas(buildCoverHTML(reports, from, to)).then(function(coverCanvas) {
      addCanvasToPDF(pdf, coverCanvas, true);
      updateLoadingProgress(Math.round(1/total*100), '1 / ' + total + ' halaman');

      // Process reports sequentially
      var idx = 0;
      function processNext() {
        if (idx >= reports.length) {
          // Done
          var filename = 'Laporan_SPPG_' + from + '_sd_' + to + '.pdf';
          pdf.save(filename);
          hideLoading();
          toast('PDF gabungan berhasil!', 'success');
          return;
        }
        var r = reports[idx];
        renderHTMLToCanvas(buildReportHTMLForPDF(r)).then(function(canvas) {
          addCanvasToPDF(pdf, canvas, false);
          idx++;
          updateLoadingProgress(Math.round((idx+1)/total*100), (idx+1) + ' / ' + total + ' halaman');
          // Use setTimeout to prevent blocking
          setTimeout(processNext, 50);
        }).catch(function(err) {
          console.error('Error on report ' + idx, err);
          idx++;
          setTimeout(processNext, 50);
        });
      }
      processNext();
    }).catch(function(err) {
      hideLoading();
      console.error(err);
      toast('Gagal: ' + err.message, 'error');
    });
  }, 200);
}


// ============================================================
// MAIN INIT
// ============================================================
function showApp() {
  $('#loginScreen').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
  var sess = Auth.current();
  if (sess) {
    $('#userName').textContent = sess.username;
    $('#userRole').textContent = sess.role;
    $('#userAvatar').textContent = (sess.username || 'U')[0].toUpperCase();
  }
  navigate('dashboard');
}

function showLogin() {
  $('#loginScreen').classList.remove('hidden');
  $('#appShell').classList.add('hidden');
}

function init() {
  initTheme();

  // Login form
  $('#loginForm').onsubmit = function(e) {
    e.preventDefault();
    var u = $('#loginUsername').value.trim();
    var p = $('#loginPassword').value;
    var errEl = $('#loginError');
    var user = Auth.login(u, p);
    if (user) {
      errEl.style.display = 'none';
      showApp();
      toast('Selamat datang, ' + user.username + '!', 'success');
    } else {
      errEl.textContent = 'Username atau password salah';
      errEl.style.display = 'block';
    }
  };

  // Check session
  if (Auth.current()) { showApp(); } else { showLogin(); }

  // Sidebar nav
  $$('.nav-item[data-page]').forEach(function(b) {
    b.onclick = function() { navigate(b.dataset.page); };
  });

  // Theme toggle
  $('#themeToggle').onclick = function() {
    var cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  };

  // Logout
  $('#logoutBtn').onclick = function() {
    confirmDialog({ title: 'Logout?', message: 'Data tetap tersimpan.', okText: 'Ya, Logout' }).then(function(ok) {
      if (ok) Auth.logout();
    });
  };

  // Mobile menu
  $('#menuToggle').onclick = function() { $('#sidebar').classList.toggle('open'); };
}

document.addEventListener('DOMContentLoaded', init);

})();
