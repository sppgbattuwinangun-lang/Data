/* ============================================================
   SPPG Batuwinangun - Application Logic
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
  return `${HARI_ID[d.getDay()]}, ${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTanggalShort(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
    try {
      return JSON.parse(localStorage.getItem(APP_CONFIG.STORAGE_REPORTS) || '[]');
    } catch (e) { return []; }
  },
  saveReports(reports) {
    localStorage.setItem(APP_CONFIG.STORAGE_REPORTS, JSON.stringify(reports));
  },
  upsertReport(report) {
    const list = this.getReports();
    const idx = list.findIndex(r => r.id === report.id);
    if (idx >= 0) list[idx] = report;
    else list.push(report);
    list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
    this.saveReports(list);
  },
  deleteReport(id) {
    const list = this.getReports().filter(r => r.id !== id);
    this.saveReports(list);
  },
  getReport(id) {
    return this.getReports().find(r => r.id === id);
  },
  getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(APP_CONFIG.STORAGE_SESSION) || 'null');
    } catch (e) { return null; }
  },
  setSession(s) {
    sessionStorage.setItem(APP_CONFIG.STORAGE_SESSION, JSON.stringify(s));
  },
  clearSession() {
    sessionStorage.removeItem(APP_CONFIG.STORAGE_SESSION);
  }
};

// ============================================================
// UI HELPERS — TOAST & MODAL
// ============================================================
function toast(msg, type = 'info', duration = 3000) {
  const wrap = $('#toastWrap');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'slide-in 0.25s reverse';
    setTimeout(() => t.remove(), 250);
  }, duration);
}

function confirmDialog(opts) {
  return new Promise(resolve => {
    const root = $('#modalRoot');
    root.innerHTML = `
      <div class="modal-bg">
        <div class="modal">
          <h2>${escapeHtml(opts.title || 'Konfirmasi')}</h2>
          <p class="muted text-sm" style="margin: 6px 0 0;">${escapeHtml(opts.message || '')}</p>
          <div class="modal-actions">
            <button class="btn btn-secondary" data-act="cancel">${escapeHtml(opts.cancelText || 'Batal')}</button>
            <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${escapeHtml(opts.okText || 'Ya')}</button>
          </div>
        </div>
      </div>`;
    const close = (val) => { root.innerHTML = ''; resolve(val); };
    root.querySelector('[data-act="cancel"]').onclick = () => close(false);
    root.querySelector('[data-act="ok"]').onclick = () => close(true);
    root.querySelector('.modal-bg').onclick = (e) => {
      if (e.target.classList.contains('modal-bg')) close(false);
    };
  });
}

// ============================================================
// AUTH
// ============================================================
const Auth = {
  login(username, password) {
    const u = APP_CONFIG.users.find(
      x => x.username === username && x.password === password
    );
    if (u) {
      Storage.setSession({ username: u.username, role: u.role, loginAt: Date.now() });
      return u;
    }
    return null;
  },
  logout() {
    Storage.clearSession();
    location.reload();
  },
  current() {
    return Storage.getSession();
  }
};

// ============================================================
// THEME
// ============================================================
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sppg_theme', theme);
  const label = $('#themeLabel');
  if (label) label.textContent = theme === 'dark' ? 'Mode Terang' : 'Mode Gelap';
}
function initTheme() {
  applyTheme(localStorage.getItem('sppg_theme') || 'light');
}

// ============================================================
// ROUTER
// ============================================================
const Pages = {};
let currentPage = 'dashboard';

function navigate(page) {
  currentPage = page;
  $$('.nav-item[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const content = $('#pageContent');
  content.innerHTML = '';
  if (Pages[page]) Pages[page](content);
  // close mobile sidebar
  $('#sidebar')?.classList.remove('open');
  window.scrollTo(0, 0);
}

// ============================================================
// PAGE: DASHBOARD
// ============================================================
Pages.dashboard = function(root) {
  const reports = Storage.getReports();
  const totalReports = reports.length;
  const totalPorsi = reports.reduce((s, r) => s + safeNum(r.totalPorsi), 0);
  const last = reports[0];
  const last7 = reports.filter(r => {
    const d = new Date(r.tanggal);
    const week = new Date();
    week.setDate(week.getDate() - 7);
    return d >= week;
  });
  const totalSchoolsTouched = new Set(
    reports.flatMap(r => (r.sekolahTidakFull || []).map(s => s.sekolah))
  ).size;

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <div class="page-sub">Selamat datang kembali, <strong>${escapeHtml(Auth.current()?.username || '')}</strong>. Berikut ringkasan distribusi MBG.</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" data-go="entry">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Buat Laporan Baru
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat">
        <div class="stat-label">Total Laporan</div>
        <div class="stat-value">${totalReports}</div>
        <div class="stat-trend">${last7.length} laporan dalam 7 hari terakhir</div>
      </div>
      <div class="stat">
        <div class="stat-label">Total Porsi Terdistribusi</div>
        <div class="stat-value">${totalPorsi.toLocaleString('id-ID')}</div>
        <div class="stat-trend">Akumulasi seluruh laporan</div>
      </div>
      <div class="stat">
        <div class="stat-label">Sekolah/Instansi Mitra</div>
        <div class="stat-value">${APP_CONFIG.schools.length}</div>
        <div class="stat-trend">${totalSchoolsTouched} sekolah pernah tercatat tidak full</div>
      </div>
      <div class="stat">
        <div class="stat-label">Laporan Terakhir</div>
        <div class="stat-value" style="font-size:18px; line-height:1.3;">${last ? formatTanggalShort(last.tanggal) : '-'}</div>
        <div class="stat-trend">${last ? escapeHtml(last.menu || 'Tanpa menu') : 'Belum ada data'}</div>
      </div>
    </div>

    <div class="card">
      <h2 class="card-title">Laporan Terbaru</h2>
      ${reports.length === 0 ? `
        <div class="empty">
          <div class="empty-icon">📋</div>
          <div>Belum ada laporan. Klik "Buat Laporan Baru" untuk memulai.</div>
        </div>
      ` : `
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Hari</th>
                <th>Menu</th>
                <th>Total Porsi</th>
                <th>Sekolah Tdk Full</th>
                <th>PJ</th>
                <th class="right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${reports.slice(0, 8).map(r => `
                <tr>
                  <td>${formatTanggalShort(r.tanggal)}</td>
                  <td>${escapeHtml(r.hari || '')}</td>
                  <td>${escapeHtml(r.menu || '-')}</td>
                  <td><strong>${safeNum(r.totalPorsi).toLocaleString('id-ID')}</strong></td>
                  <td>${(r.sekolahTidakFull || []).length === 0
                    ? '<span class="badge badge-success">Semua Full</span>'
                    : `<span class="badge badge-warning">${r.sekolahTidakFull.length} sekolah</span>`}</td>
                  <td>${escapeHtml(r.penanggungJawab || '-')}</td>
                  <td class="right">
                    <div class="row-actions">
                      <button class="btn btn-secondary btn-icon" data-act="view" data-id="${r.id}" title="Lihat">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                      <button class="btn btn-primary btn-icon" data-act="pdf" data-id="${r.id}" title="Download PDF">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;

  root.querySelectorAll('[data-go]').forEach(b => {
    b.onclick = () => navigate(b.dataset.go);
  });
  root.querySelectorAll('[data-act="view"]').forEach(b => {
    b.onclick = () => showReportDetail(b.dataset.id);
  });
  root.querySelectorAll('[data-act="pdf"]').forEach(b => {
    b.onclick = () => generateSinglePDF(b.dataset.id);
  });
};

// ============================================================
// PAGE: ENTRY (FORM INPUT)
// ============================================================
Pages.entry = function(root, editId = null) {
  const editing = editId ? Storage.getReport(editId) : null;
  const data = editing || {
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

  const schoolOptions = APP_CONFIG.schools.map(s =>
    `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`
  ).join('');

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${editing ? 'Edit Laporan' : 'Input Laporan Harian'}</h1>
        <div class="page-sub">Lengkapi data distribusi makan bergizi gratis untuk hari ini.</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" id="btnCancel">Batal</button>
        <button class="btn btn-success" id="btnSave">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Simpan Laporan
        </button>
      </div>
    </div>

    <form id="entryForm" autocomplete="off">
      <!-- Step 1: Informasi Umum -->
      <div class="card">
        <h2 class="card-title"><span class="step-num">1</span> Informasi Umum</h2>
        <div class="grid-2">
          <div class="form-group">
            <label>Tanggal</label>
            <input class="input" type="date" id="f_tanggal" value="${data.tanggal}" required />
          </div>
          <div class="form-group">
            <label>Hari (otomatis)</label>
            <input class="input" type="text" id="f_hari" value="${data.hari}" readonly style="background: var(--surface-2);" />
          </div>
        </div>
        <div class="grid-2" style="margin-top: 12px;">
          <div class="form-group">
            <label>Penanggung Jawab</label>
            <input class="input" type="text" id="f_pj" value="${escapeHtml(data.penanggungJawab)}" placeholder="Nama PJ hari ini" required />
          </div>
          <div class="form-group">
            <label>Menu Makanan</label>
            <input class="input" type="text" id="f_menu" value="${escapeHtml(data.menu)}" placeholder="Contoh: Nasi, Ayam Goreng, Sayur Asem, Buah" required />
          </div>
        </div>
      </div>

      <!-- Step 2: Foto Makanan -->
      <div class="card">
        <h2 class="card-title"><span class="step-num">2</span> Foto Makanan</h2>
        <div class="photo-uploader" id="photoUploader">
          <div class="photo-icon">📸</div>
          <div style="font-weight:600;">Klik atau drag & drop foto di sini</div>
          <div class="text-sm muted" style="margin-top:4px;">Maksimal 4 foto, format JPG/PNG, total maks 5 MB</div>
          <input type="file" id="photoInput" accept="image/*" multiple style="display:none;" />
        </div>
        <div class="photo-grid" id="photoGrid"></div>
      </div>

      <!-- Step 3: Distribusi Porsi -->
      <div class="card">
        <h2 class="card-title"><span class="step-num">3</span> Distribusi Porsi</h2>
        <div class="grid-2">
          <div class="form-group">
            <label>Total Porsi Terdistribusi</label>
            <input class="input" type="number" id="f_totalPorsi" value="${data.totalPorsi}" min="0" placeholder="0" required />
          </div>
        </div>
      </div>

      <!-- Step 4: Sekolah Tidak Full -->
      <div class="card">
        <h2 class="card-title">
          <span class="step-num">4</span> Sekolah Tidak Full Terdistribusi
          <span class="badge badge-info" style="margin-left:auto;" id="schoolCount">0 sekolah</span>
        </h2>
        <p class="text-sm muted" style="margin-top:-8px; margin-bottom:14px;">
          Catat sekolah/instansi yang menerima porsi <strong>kurang dari yang seharusnya</strong>. Kosongkan jika semua sekolah terdistribusi penuh.
        </p>
        <div class="table-wrap">
          <table id="schoolTable">
            <thead>
              <tr>
                <th style="width:55%;">Nama Sekolah / Instansi</th>
                <th>Porsi Terkirim</th>
                <th>Keterangan</th>
                <th class="right">Aksi</th>
              </tr>
            </thead>
            <tbody id="schoolTbody"></tbody>
          </table>
        </div>
        <button type="button" class="btn btn-secondary" id="btnAddSchool" style="margin-top:12px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Tambah Sekolah
        </button>
      </div>

      <!-- Step 5: Kandungan Gizi -->
      <div class="card">
        <h2 class="card-title"><span class="step-num">5</span> Kandungan Gizi per Porsi</h2>
        <p class="text-sm muted" style="margin-top:-8px; margin-bottom:14px;">
          Isi nilai gizi untuk masing-masing kategori. <strong>Porsi Besar</strong> untuk SD kelas atas/SMP/SMA, <strong>Porsi Kecil</strong> untuk PAUD/TK/SD kelas rendah.
        </p>
        <div class="table-wrap">
          <table class="nutri-table">
            <thead>
              <tr>
                <th style="width:30%;">Komponen Gizi</th>
                <th class="nutri-col-besar">Porsi Besar</th>
                <th class="nutri-col-kecil">Porsi Kecil</th>
              </tr>
            </thead>
            <tbody>
              ${APP_CONFIG.nutritionFields.map(f => `
                <tr>
                  <td>${f.label} <span class="muted text-xs">(${f.unit})</span></td>
                  <td class="nutri-col-besar">
                    <input class="input" type="number" step="0.01" min="0"
                      data-gizi="besar" data-key="${f.key}"
                      value="${escapeHtml(data.gizi.besar[f.key] || '')}" placeholder="0" />
                  </td>
                  <td class="nutri-col-kecil">
                    <input class="input" type="number" step="0.01" min="0"
                      data-gizi="kecil" data-key="${f.key}"
                      value="${escapeHtml(data.gizi.kecil[f.key] || '')}" placeholder="0" />
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Step 6: Catatan (Optional) -->
      <div class="card">
        <h2 class="card-title"><span class="step-num">6</span> Catatan Tambahan (Opsional)</h2>
        <textarea class="textarea" id="f_catatan" placeholder="Catatan, kendala, atau hal khusus pada hari ini...">${escapeHtml(data.catatan || '')}</textarea>
      </div>

      <div style="display:flex; gap:8px; justify-content:flex-end; padding-bottom:32px;">
        <button type="button" class="btn btn-secondary" id="btnCancel2">Batal</button>
        <button type="button" class="btn btn-success" id="btnSave2">
          Simpan Laporan
        </button>
      </div>
    </form>
  `;

  // ====== Bind handlers ======
  const tanggalEl = $('#f_tanggal');
  const hariEl = $('#f_hari');
  tanggalEl.addEventListener('change', () => {
    hariEl.value = getHariFromDate(tanggalEl.value);
  });

  // Photo upload
  const photoUploader = $('#photoUploader');
  const photoInput = $('#photoInput');
  const photoGrid = $('#photoGrid');
  let photos = [...(data.foto || [])];

  function renderPhotos() {
    photoGrid.innerHTML = photos.map((src, i) => `
      <div class="photo-thumb">
        <img src="${src}" alt="Foto ${i+1}" />
        <button type="button" class="photo-thumb-remove" data-idx="${i}">×</button>
      </div>
    `).join('');
    photoGrid.querySelectorAll('.photo-thumb-remove').forEach(b => {
      b.onclick = () => { photos.splice(+b.dataset.idx, 1); renderPhotos(); };
    });
  }
  renderPhotos();

  photoUploader.onclick = () => photoInput.click();
  photoUploader.ondragover = (e) => { e.preventDefault(); photoUploader.classList.add('drag'); };
  photoUploader.ondragleave = () => photoUploader.classList.remove('drag');
  photoUploader.ondrop = (e) => {
    e.preventDefault();
    photoUploader.classList.remove('drag');
    handleFiles(e.dataTransfer.files);
  };
  photoInput.onchange = (e) => handleFiles(e.target.files);

  function handleFiles(files) {
    const arr = Array.from(files).slice(0, 4 - photos.length);
    arr.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 2 * 1024 * 1024) {
        toast(`Foto "${file.name}" terlalu besar (>2MB)`, 'warning');
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        // compress via canvas
        const img = new Image();
        img.onload = () => {
          const maxW = 1280;
          const ratio = Math.min(1, maxW / img.width);
          const canvas = document.createElement('canvas');
          canvas.width = img.width * ratio;
          canvas.height = img.height * ratio;
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          photos.push(canvas.toDataURL('image/jpeg', 0.82));
          renderPhotos();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // School not full table
  const schoolTbody = $('#schoolTbody');
  let schoolRows = [...(data.sekolahTidakFull || [])];

  function renderSchools() {
    if (schoolRows.length === 0) {
      schoolTbody.innerHTML = `
        <tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:24px;">
          Belum ada sekolah ditambahkan. Klik "Tambah Sekolah" jika ada yang tidak full.
        </td></tr>`;
    } else {
      schoolTbody.innerHTML = schoolRows.map((row, i) => `
        <tr data-idx="${i}">
          <td>
            <select class="select" data-field="sekolah">
              <option value="">-- Pilih Sekolah --</option>
              ${APP_CONFIG.schools.map(s =>
                `<option value="${escapeHtml(s)}" ${row.sekolah===s?'selected':''}>${escapeHtml(s)}</option>`
              ).join('')}
            </select>
          </td>
          <td><input class="input" type="number" min="0" data-field="porsi" value="${row.porsi || ''}" placeholder="0" /></td>
          <td><input class="input" type="text" data-field="ket" value="${escapeHtml(row.ket || '')}" placeholder="Alasan / kendala" /></td>
          <td class="right">
            <button type="button" class="btn btn-danger btn-icon" data-rm-school="${i}" title="Hapus">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </td>
        </tr>
      `).join('');
      schoolTbody.querySelectorAll('select[data-field], input[data-field]').forEach(el => {
        el.oninput = (e) => {
          const tr = e.target.closest('tr');
          const idx = +tr.dataset.idx;
          schoolRows[idx][e.target.dataset.field] = e.target.value;
        };
      });
      schoolTbody.querySelectorAll('[data-rm-school]').forEach(b => {
        b.onclick = () => {
          schoolRows.splice(+b.dataset.rmSchool, 1);
          renderSchools();
          updateSchoolCount();
        };
      });
    }
    updateSchoolCount();
  }
  function updateSchoolCount() {
    $('#schoolCount').textContent = `${schoolRows.length} sekolah`;
  }
  renderSchools();

  $('#btnAddSchool').onclick = () => {
    schoolRows.push({ sekolah: '', porsi: '', ket: '' });
    renderSchools();
  };

  // Save / Cancel
  function collectData() {
    const gizi = { besar: {}, kecil: {} };
    root.querySelectorAll('input[data-gizi]').forEach(el => {
      gizi[el.dataset.gizi][el.dataset.key] = el.value;
    });

    return {
      ...data,
      tanggal: $('#f_tanggal').value,
      hari: $('#f_hari').value,
      penanggungJawab: $('#f_pj').value.trim(),
      menu: $('#f_menu').value.trim(),
      foto: photos,
      totalPorsi: $('#f_totalPorsi').value,
      sekolahTidakFull: schoolRows.filter(r => r.sekolah && r.porsi !== ''),
      gizi,
      catatan: $('#f_catatan').value.trim(),
      updatedAt: Date.now()
    };
  }

  function save() {
    const d = collectData();
    if (!d.tanggal) return toast('Tanggal wajib diisi', 'error');
    if (!d.penanggungJawab) return toast('Penanggung Jawab wajib diisi', 'error');
    if (!d.menu) return toast('Menu makanan wajib diisi', 'error');
    if (!d.totalPorsi) return toast('Total porsi wajib diisi', 'error');

    Storage.upsertReport(d);
    toast(editing ? 'Laporan berhasil diperbarui' : 'Laporan berhasil disimpan', 'success');
    navigate('history');
  }

  $('#btnSave').onclick = save;
  $('#btnSave2').onclick = save;
  $('#btnCancel').onclick = () => navigate('dashboard');
  $('#btnCancel2').onclick = () => navigate('dashboard');
};

// ============================================================
// PAGE: HISTORY
// ============================================================
Pages.history = function(root) {
  let filterFrom = '';
  let filterTo = '';
  let filterSearch = '';

  function render() {
    const all = Storage.getReports();
    const filtered = all.filter(r => {
      if (filterFrom && r.tanggal < filterFrom) return false;
      if (filterTo && r.tanggal > filterTo) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        const hay = `${r.menu} ${r.penanggungJawab} ${r.hari} ${formatTanggalShort(r.tanggal)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Riwayat Laporan</h1>
          <div class="page-sub">${filtered.length} dari ${all.length} laporan ditampilkan.</div>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" data-go="entry">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Laporan Baru
          </button>
        </div>
      </div>

      <div class="filter-bar">
        <div class="form-group">
          <label>Cari</label>
          <input class="input" id="fSearch" type="text" placeholder="Menu, PJ, hari..." value="${escapeHtml(filterSearch)}" />
        </div>
        <div class="form-group">
          <label>Dari Tanggal</label>
          <input class="input" id="fFrom" type="date" value="${filterFrom}" />
        </div>
        <div class="form-group">
          <label>Sampai Tanggal</label>
          <input class="input" id="fTo" type="date" value="${filterTo}" />
        </div>
        <button class="btn btn-secondary" id="fClear">Reset Filter</button>
      </div>

      ${filtered.length === 0 ? `
        <div class="card">
          <div class="empty">
            <div class="empty-icon">🔍</div>
            <div>Tidak ada laporan yang cocok dengan filter.</div>
          </div>
        </div>
      ` : `
        <div class="card" style="padding:0;">
          <div class="table-wrap" style="border:none;">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Hari</th>
                  <th>Menu</th>
                  <th>Total Porsi</th>
                  <th>Tdk Full</th>
                  <th>PJ</th>
                  <th class="right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(r => `
                  <tr>
                    <td><strong>${formatTanggalShort(r.tanggal)}</strong></td>
                    <td>${escapeHtml(r.hari || '')}</td>
                    <td>${escapeHtml(r.menu || '-')}</td>
                    <td>${safeNum(r.totalPorsi).toLocaleString('id-ID')}</td>
                    <td>${(r.sekolahTidakFull || []).length === 0
                      ? '<span class="badge badge-success">Full</span>'
                      : `<span class="badge badge-warning">${r.sekolahTidakFull.length}</span>`}</td>
                    <td>${escapeHtml(r.penanggungJawab || '-')}</td>
                    <td class="right">
                      <div class="row-actions">
                        <button class="btn btn-secondary btn-icon" data-act="view" data-id="${r.id}" title="Lihat detail">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button class="btn btn-secondary btn-icon" data-act="edit" data-id="${r.id}" title="Edit">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn btn-primary btn-icon" data-act="pdf" data-id="${r.id}" title="Download PDF">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                        <button class="btn btn-danger btn-icon" data-act="delete" data-id="${r.id}" title="Hapus">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `}
    `;

    $('#fSearch').oninput = (e) => { filterSearch = e.target.value; debouncedRender(); };
    $('#fFrom').onchange = (e) => { filterFrom = e.target.value; render(); };
    $('#fTo').onchange = (e) => { filterTo = e.target.value; render(); };
    $('#fClear').onclick = () => {
      filterFrom = filterTo = filterSearch = '';
      render();
    };
    root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => navigate(b.dataset.go));
    root.querySelectorAll('[data-act="view"]').forEach(b =>
      b.onclick = () => showReportDetail(b.dataset.id));
    root.querySelectorAll('[data-act="edit"]').forEach(b =>
      b.onclick = () => Pages.entry($('#pageContent'), b.dataset.id));
    root.querySelectorAll('[data-act="pdf"]').forEach(b =>
      b.onclick = () => generateSinglePDF(b.dataset.id));
    root.querySelectorAll('[data-act="delete"]').forEach(b =>
      b.onclick = async () => {
        const ok = await confirmDialog({
          title: 'Hapus Laporan?',
          message: 'Laporan yang dihapus tidak dapat dikembalikan.',
          danger: true,
          okText: 'Hapus'
        });
        if (ok) {
          Storage.deleteReport(b.dataset.id);
          toast('Laporan dihapus', 'success');
          render();
        }
      });
  }

  let debounceTimer;
  function debouncedRender() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(render, 200);
  }

  render();
};

// ============================================================
// PAGE: EXPORT (Range PDF)
// ============================================================
Pages.export = function(root) {
  const all = Storage.getReports();
  const dates = all.map(r => r.tanggal).filter(Boolean).sort();
  const minD = dates[0] || todayISO();
  const maxD = dates[dates.length - 1] || todayISO();

  root.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Export PDF Range</h1>
        <div class="page-sub">Download laporan dalam satu file PDF berdasarkan rentang tanggal.</div>
      </div>
    </div>

    <div class="card">
      <h2 class="card-title">Pilih Rentang Tanggal</h2>
      <div class="grid-3">
        <div class="form-group">
          <label>Dari Tanggal</label>
          <input class="input" id="rFrom" type="date" value="${minD}" />
        </div>
        <div class="form-group">
          <label>Sampai Tanggal</label>
          <input class="input" id="rTo" type="date" value="${maxD}" />
        </div>
        <div class="form-group" style="align-self:end;">
          <button class="btn btn-secondary btn-block" id="rPreview">Preview Laporan</button>
        </div>
      </div>
      <div id="rResult" style="margin-top: 18px;"></div>
    </div>
  `;

  function preview() {
    const from = $('#rFrom').value;
    const to = $('#rTo').value;
    if (!from || !to) return toast('Tanggal harus diisi', 'error');
    if (from > to) return toast('Tanggal "Dari" harus sebelum "Sampai"', 'error');

    const filtered = all.filter(r => r.tanggal >= from && r.tanggal <= to)
      .sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''));

    const result = $('#rResult');
    if (filtered.length === 0) {
      result.innerHTML = `
        <div class="empty">
          <div class="empty-icon">📭</div>
          <div>Tidak ada laporan dalam rentang tanggal tersebut.</div>
        </div>`;
      return;
    }

    const totalPorsi = filtered.reduce((s,r) => s + safeNum(r.totalPorsi), 0);

    result.innerHTML = `
      <div class="stats-grid" style="margin-bottom:14px;">
        <div class="stat">
          <div class="stat-label">Jumlah Laporan</div>
          <div class="stat-value">${filtered.length}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Total Porsi</div>
          <div class="stat-value">${totalPorsi.toLocaleString('id-ID')}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Periode</div>
          <div class="stat-value" style="font-size:16px;">${formatTanggalShort(from)} - ${formatTanggalShort(to)}</div>
        </div>
      </div>
      <div class="table-wrap" style="margin-bottom:14px;">
        <table>
          <thead>
            <tr><th>Tanggal</th><th>Hari</th><th>Menu</th><th>Total Porsi</th><th>Tdk Full</th></tr>
          </thead>
          <tbody>
            ${filtered.map(r => `
              <tr>
                <td>${formatTanggalShort(r.tanggal)}</td>
                <td>${escapeHtml(r.hari || '')}</td>
                <td>${escapeHtml(r.menu || '-')}</td>
                <td>${safeNum(r.totalPorsi).toLocaleString('id-ID')}</td>
                <td>${(r.sekolahTidakFull||[]).length}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <button class="btn btn-success btn-block" id="rDownload">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download PDF Gabungan (${filtered.length} laporan)
      </button>`;

    $('#rDownload').onclick = () => generateRangePDF(filtered, from, to);
  }

  $('#rPreview').onclick = preview;
  preview(); // initial
};

// ============================================================
// REPORT DETAIL VIEW
// ============================================================
function showReportDetail(id) {
  const r = Storage.getReport(id);
  if (!r) return toast('Laporan tidak ditemukan', 'error');

  const root = $('#modalRoot');
  root.innerHTML = `
    <div class="modal-bg">
      <div class="modal" style="max-width: 720px;">
        <h2>Detail Laporan</h2>
        <p class="muted text-sm" style="margin: 4px 0 16px;">${formatTanggalLengkap(r.tanggal)}</p>
        <div style="max-height: 60vh; overflow-y: auto; padding-right: 6px;">
          ${renderReportHTMLForView(r)}
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-act="close">Tutup</button>
          <button class="btn btn-primary" data-act="pdf">Download PDF</button>
        </div>
      </div>
    </div>`;
  root.querySelector('[data-act="close"]').onclick = () => root.innerHTML = '';
  root.querySelector('[data-act="pdf"]').onclick = () => { root.innerHTML = ''; generateSinglePDF(id); };
  root.querySelector('.modal-bg').onclick = (e) => {
    if (e.target.classList.contains('modal-bg')) root.innerHTML = '';
  };
}

function renderReportHTMLForView(r) {
  return `
    <div class="grid-2" style="margin-bottom:12px;">
      <div><div class="text-xs muted">Penanggung Jawab</div><div><strong>${escapeHtml(r.penanggungJawab || '-')}</strong></div></div>
      <div><div class="text-xs muted">Menu</div><div><strong>${escapeHtml(r.menu || '-')}</strong></div></div>
      <div><div class="text-xs muted">Total Porsi</div><div><strong>${safeNum(r.totalPorsi).toLocaleString('id-ID')}</strong></div></div>
      <div><div class="text-xs muted">Hari</div><div><strong>${escapeHtml(r.hari || '-')}</strong></div></div>
    </div>
    ${(r.foto || []).length > 0 ? `
      <div class="text-xs muted" style="margin:10px 0 6px;">Foto Makanan</div>
      <div class="photo-grid">
        ${r.foto.map(f => `<div class="photo-thumb"><img src="${f}"/></div>`).join('')}
      </div>` : ''}
    <div class="text-xs muted" style="margin:14px 0 6px;">Sekolah Tidak Full Terdistribusi</div>
    ${(r.sekolahTidakFull || []).length === 0
      ? `<div class="badge badge-success">Semua sekolah terdistribusi penuh</div>`
      : `<div class="table-wrap"><table>
          <thead><tr><th>Sekolah</th><th>Porsi</th><th>Keterangan</th></tr></thead>
          <tbody>${r.sekolahTidakFull.map(s => `
            <tr><td>${escapeHtml(s.sekolah)}</td><td>${safeNum(s.porsi)}</td><td>${escapeHtml(s.ket||'-')}</td></tr>
          `).join('')}</tbody>
        </table></div>`}
    <div class="text-xs muted" style="margin:14px 0 6px;">Kandungan Gizi</div>
    <div class="table-wrap"><table class="nutri-table">
      <thead><tr><th>Komponen</th><th>Porsi Besar</th><th>Porsi Kecil</th></tr></thead>
      <tbody>${APP_CONFIG.nutritionFields.map(f => `
        <tr>
          <td>${f.label} (${f.unit})</td>
          <td>${escapeHtml(r.gizi?.besar?.[f.key] || '-')}</td>
          <td>${escapeHtml(r.gizi?.kecil?.[f.key] || '-')}</td>
        </tr>`).join('')}</tbody>
    </table></div>
    ${r.catatan ? `<div class="text-xs muted" style="margin:14px 0 6px;">Catatan</div><div>${escapeHtml(r.catatan)}</div>` : ''}`;
}

// ============================================================
// PDF GENERATION
// ============================================================
function buildReportHTMLForPDF(r) {
  const giziRows = APP_CONFIG.nutritionFields.map(f => `
    <tr>
      <td style="padding:8px 10px; border:1px solid #cbd5e1; font-weight:600;">${f.label} <span style="color:#64748b; font-weight:400;">(${f.unit})</span></td>
      <td style="padding:8px 10px; border:1px solid #cbd5e1; text-align:center; background:#eef2ff;">${escapeHtml(r.gizi?.besar?.[f.key] || '-')}</td>
      <td style="padding:8px 10px; border:1px solid #cbd5e1; text-align:center; background:#ecfdf5;">${escapeHtml(r.gizi?.kecil?.[f.key] || '-')}</td>
    </tr>`).join('');

  const schoolRows = (r.sekolahTidakFull || []).length === 0
    ? `<tr><td colspan="3" style="padding:14px; text-align:center; color:#059669; font-weight:600; border:1px solid #cbd5e1;">✓ Semua sekolah terdistribusi penuh</td></tr>`
    : (r.sekolahTidakFull).map((s, i) => `
        <tr>
          <td style="padding:8px 10px; border:1px solid #cbd5e1; text-align:center;">${i+1}</td>
          <td style="padding:8px 10px; border:1px solid #cbd5e1;">${escapeHtml(s.sekolah)}</td>
          <td style="padding:8px 10px; border:1px solid #cbd5e1; text-align:center; font-weight:600;">${safeNum(s.porsi).toLocaleString('id-ID')}</td>
          <td style="padding:8px 10px; border:1px solid #cbd5e1;">${escapeHtml(s.ket || '-')}</td>
        </tr>`).join('');

  const photos = (r.foto || []).slice(0, 4);
  const photoHtml = photos.length === 0 ? '' : `
    <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:6px;">
      ${photos.map(src => `
        <div style="width:${photos.length === 1 ? '100%' : photos.length === 2 ? '49%' : '24.2%'}; aspect-ratio:4/3; overflow:hidden; border-radius:8px; border:1px solid #cbd5e1;">
          <img src="${src}" style="width:100%; height:100%; object-fit:cover;" />
        </div>`).join('')}
    </div>`;

  return `
    <div style="padding:38px 42px; font-family: 'Inter', Arial, sans-serif; color:#0f172a; background:#fff; width:794px; box-sizing:border-box;">
      <div style="background:linear-gradient(135deg, #4f46e5, #ec4899); margin:-38px -42px 24px; padding:24px 42px; color:#fff;">
        <div style="font-size:11px; letter-spacing:0.15em; text-transform:uppercase; opacity:0.9;">SPPG Batuwinangun</div>
        <div style="font-size:22px; font-weight:800; margin-top:4px;">Laporan Harian Distribusi MBG</div>
        <div style="font-size:13px; margin-top:6px; opacity:0.95;">${formatTanggalLengkap(r.tanggal)}</div>
      </div>

      <table style="width:100%; border-collapse:collapse; font-size:12.5px; margin-bottom:14px;">
        <tr>
          <td style="padding:8px 10px; border:1px solid #cbd5e1; background:#f1f5f9; font-weight:600; width:30%;">Tanggal</td>
          <td style="padding:8px 10px; border:1px solid #cbd5e1;">${formatTanggalShort(r.tanggal)}</td>
          <td style="padding:8px 10px; border:1px solid #cbd5e1; background:#f1f5f9; font-weight:600; width:20%;">Hari</td>
          <td style="padding:8px 10px; border:1px solid #cbd5e1;">${escapeHtml(r.hari || '-')}</td>
        </tr>
        <tr>
          <td style="padding:8px 10px; border:1px solid #cbd5e1; background:#f1f5f9; font-weight:600;">Penanggung Jawab</td>
          <td colspan="3" style="padding:8px 10px; border:1px solid #cbd5e1;">${escapeHtml(r.penanggungJawab || '-')}</td>
        </tr>
        <tr>
          <td style="padding:8px 10px; border:1px solid #cbd5e1; background:#f1f5f9; font-weight:600;">Menu Hari Ini</td>
          <td colspan="3" style="padding:8px 10px; border:1px solid #cbd5e1;">${escapeHtml(r.menu || '-')}</td>
        </tr>
        <tr>
          <td style="padding:8px 10px; border:1px solid #cbd5e1; background:#f1f5f9; font-weight:600;">Total Porsi Terdistribusi</td>
          <td colspan="3" style="padding:10px; border:1px solid #cbd5e1; font-size:16px; font-weight:800; color:#4f46e5;">
            ${safeNum(r.totalPorsi).toLocaleString('id-ID')} porsi
          </td>
        </tr>
      </table>

      ${photos.length > 0 ? `
        <div style="font-size:13px; font-weight:700; margin-bottom:6px; color:#4f46e5;">📸 Foto Makanan</div>
        ${photoHtml}
      ` : ''}

      <div style="font-size:13px; font-weight:700; margin:18px 0 6px; color:#4f46e5;">🏫 Sekolah Tidak Full Terdistribusi</div>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:#1e293b; color:#fff;">
            <th style="padding:8px 10px; border:1px solid #1e293b; width:40px;">No</th>
            <th style="padding:8px 10px; border:1px solid #1e293b; text-align:left;">Nama Sekolah / Instansi</th>
            <th style="padding:8px 10px; border:1px solid #1e293b; width:120px;">Porsi Terkirim</th>
            <th style="padding:8px 10px; border:1px solid #1e293b; text-align:left;">Keterangan</th>
          </tr>
        </thead>
        <tbody>${schoolRows}</tbody>
      </table>

      <div style="font-size:13px; font-weight:700; margin:18px 0 6px; color:#4f46e5;">🥗 Kandungan Gizi per Porsi</div>
      <table style="width:100%; border-collapse:collapse; font-size:12.5px;">
        <thead>
          <tr style="background:#1e293b; color:#fff;">
            <th style="padding:8px 10px; border:1px solid #1e293b; text-align:left; width:40%;">Komponen Gizi</th>
            <th style="padding:8px 10px; border:1px solid #1e293b; background:#4f46e5;">Porsi Besar</th>
            <th style="padding:8px 10px; border:1px solid #1e293b; background:#10b981;">Porsi Kecil</th>
          </tr>
        </thead>
        <tbody>${giziRows}</tbody>
      </table>

      ${r.catatan ? `
        <div style="font-size:13px; font-weight:700; margin:18px 0 6px; color:#4f46e5;">📝 Catatan</div>
        <div style="padding:10px 12px; background:#f1f5f9; border-left:3px solid #4f46e5; font-size:12.5px; border-radius:4px;">
          ${escapeHtml(r.catatan)}
        </div>` : ''}

      <div style="margin-top:24px; padding-top:12px; border-top:1px dashed #cbd5e1; font-size:10px; color:#64748b; display:flex; justify-content:space-between;">
        <div>Dokumen dibuat otomatis oleh Sistem Pelaporan SPPG Batuwinangun</div>
        <div>Dicetak: ${new Date().toLocaleString('id-ID')}</div>
      </div>
    </div>`;
}

async function renderHTMLToCanvas(html) {
  const target = $('#pdfRender');
  target.innerHTML = html;
  // wait images
  const imgs = Array.from(target.querySelectorAll('img'));
  await Promise.all(imgs.map(img => new Promise(res => {
    if (img.complete) res();
    else { img.onload = img.onerror = () => res(); }
  })));
  const canvas = await html2canvas(target.firstElementChild, {
    scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false
  });
  target.innerHTML = '';
  return canvas;
}

async function generateSinglePDF(id) {
  const r = Storage.getReport(id);
  if (!r) return toast('Laporan tidak ditemukan', 'error');
  toast('Memproses PDF...', 'info', 2500);
  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const canvas = await renderHTMLToCanvas(buildReportHTMLForPDF(r));
    addCanvasToPDF(pdf, canvas);
    const filename = `Laporan_SPPG_${r.tanggal}_${(r.hari || '').replace(/\s/g,'')}.pdf`;
    pdf.save(filename);
    toast('PDF berhasil diunduh', 'success');
  } catch (e) {
    console.error(e);
    toast('Gagal membuat PDF: ' + e.message, 'error');
  }
}

async function generateRangePDF(reports, from, to) {
  toast(`Memproses ${reports.length} laporan...`, 'info', 3000);
  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    // Cover page
    const coverHTML = buildCoverHTML(reports, from, to);
    const coverCanvas = await renderHTMLToCanvas(coverHTML);
    addCanvasToPDF(pdf, coverCanvas);

    // Each report
    for (let i = 0; i < reports.length; i++) {
      pdf.addPage();
      const canvas = await renderHTMLToCanvas(buildReportHTMLForPDF(reports[i]));
      addCanvasToPDF(pdf, canvas);
    }

    const filename = `Laporan_SPPG_Range_${from}_sd_${to}.pdf`;
    pdf.save(filename);
    toast('PDF gabungan berhasil diunduh', 'success');
  } catch (e) {
    console.error(e);
    toast('Gagal membuat PDF: ' + e.message, 'error');
  }
}

function addCanvasToPDF(pdf, canvas) {
  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const pageWidth = pdf.internal.pageSize.getWidth();   // 210mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  if (imgHeight <= pageHeight) {
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
  } else {
    // multi-page: slice canvas
    let position = 0;
    let heightLeft = imgHeight;
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
  }
}

function buildCoverHTML(reports, from, to) {
  const totalPorsi = reports.reduce((s,r) => s + safeNum(r.totalPorsi), 0);
  const days = reports.length;
  const totalSchoolIssues = reports.reduce((s,r) => s + (r.sekolahTidakFull||[]).length, 0);

  return `
    <div style="padding:60px 50px; font-family:'Inter',Arial,sans-serif; color:#0f172a; background:#fff; width:794px; box-sizing:border-box; min-height:1000px;">
      <div style="background:linear-gradient(135deg, #4f46e5, #ec4899); margin:-60px -50px 30px; padding:80px 50px; color:#fff; text-align:center;">
        <div style="font-size:14px; letter-spacing:0.2em; text-transform:uppercase; opacity:0.9;">SPPG Batuwinangun</div>
        <div style="font-size:32px; font-weight:800; margin-top:8px;">LAPORAN AKUMULASI</div>
        <div style="font-size:16px; opacity:0.9; margin-top:6px;">Distribusi Makan Bergizi Gratis</div>
      </div>

      <div style="text-align:center; margin:30px 0;">
        <div style="font-size:13px; color:#64748b; text-transform:uppercase; letter-spacing:0.1em;">Periode Pelaporan</div>
        <div style="font-size:22px; font-weight:700; margin-top:6px;">${formatTanggalLengkap(from)}</div>
        <div style="font-size:13px; color:#64748b; margin:4px 0;">s/d</div>
        <div style="font-size:22px; font-weight:700;">${formatTanggalLengkap(to)}</div>
      </div>

      <div style="display:flex; gap:12px; margin:30px 0;">
        <div style="flex:1; background:linear-gradient(135deg,#eef2ff,#fdf4ff); border:1px solid #c7d2fe; border-radius:14px; padding:20px; text-align:center;">
          <div style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:600;">Jumlah Laporan</div>
          <div style="font-size:32px; font-weight:800; color:#4f46e5; margin-top:6px;">${days}</div>
          <div style="font-size:11px; color:#64748b;">hari</div>
        </div>
        <div style="flex:1; background:linear-gradient(135deg,#ecfdf5,#f0fdfa); border:1px solid #a7f3d0; border-radius:14px; padding:20px; text-align:center;">
          <div style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:600;">Total Porsi</div>
          <div style="font-size:32px; font-weight:800; color:#059669; margin-top:6px;">${totalPorsi.toLocaleString('id-ID')}</div>
          <div style="font-size:11px; color:#64748b;">porsi terdistribusi</div>
        </div>
        <div style="flex:1; background:linear-gradient(135deg,#fff7ed,#fef3c7); border:1px solid #fde68a; border-radius:14px; padding:20px; text-align:center;">
          <div style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:600;">Insiden Tdk Full</div>
          <div style="font-size:32px; font-weight:800; color:#d97706; margin-top:6px;">${totalSchoolIssues}</div>
          <div style="font-size:11px; color:#64748b;">total kejadian</div>
        </div>
      </div>

      <div style="font-size:14px; font-weight:700; margin:24px 0 8px; color:#4f46e5;">Daftar Laporan dalam Periode</div>
      <table style="width:100%; border-collapse:collapse; font-size:11.5px;">
        <thead>
          <tr style="background:#1e293b; color:#fff;">
            <th style="padding:8px; border:1px solid #1e293b; width:40px;">No</th>
            <th style="padding:8px; border:1px solid #1e293b; text-align:left;">Tanggal</th>
            <th style="padding:8px; border:1px solid #1e293b; text-align:left;">Menu</th>
            <th style="padding:8px; border:1px solid #1e293b; width:90px;">Total Porsi</th>
            <th style="padding:8px; border:1px solid #1e293b; width:80px;">Tdk Full</th>
          </tr>
        </thead>
        <tbody>
          ${reports.map((r,i) => `
            <tr>
              <td style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">${i+1}</td>
              <td style="padding:6px 8px; border:1px solid #cbd5e1;">${formatTanggalShort(r.tanggal)} (${escapeHtml(r.hari||'')})</td>
              <td style="padding:6px 8px; border:1px solid #cbd5e1;">${escapeHtml(r.menu||'-')}</td>
              <td style="padding:6px 8px; border:1px solid #cbd5e1; text-align:right; font-weight:600;">${safeNum(r.totalPorsi).toLocaleString('id-ID')}</td>
              <td style="padding:6px 8px; border:1px solid #cbd5e1; text-align:center;">${(r.sekolahTidakFull||[]).length}</td>
            </tr>`).join('')}
          <tr style="background:#f1f5f9; font-weight:700;">
            <td colspan="3" style="padding:8px; border:1px solid #cbd5e1; text-align:right;">TOTAL</td>
            <td style="padding:8px; border:1px solid #cbd5e1; text-align:right; color:#4f46e5;">${totalPorsi.toLocaleString('id-ID')}</td>
            <td style="padding:8px; border:1px solid #cbd5e1; text-align:center; color:#d97706;">${totalSchoolIssues}</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top:36px; padding-top:14px; border-top:1px dashed #cbd5e1; font-size:10px; color:#64748b; text-align:center;">
        Dibuat otomatis oleh Sistem Pelaporan SPPG Batuwinangun • Dicetak ${new Date().toLocaleString('id-ID')}<br/>
        Halaman berikut berisi detail laporan harian masing-masing tanggal
      </div>
    </div>`;
}

// ============================================================
// MAIN INIT
// ============================================================
function showApp() {
  $('#loginScreen').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
  const sess = Auth.current();
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
  $('#loginForm').onsubmit = (e) => {
    e.preventDefault();
    const u = $('#loginUsername').value.trim();
    const p = $('#loginPassword').value;
    const errEl = $('#loginError');
    const user = Auth.login(u, p);
    if (user) {
      errEl.style.display = 'none';
      showApp();
      toast(`Selamat datang, ${user.username}!`, 'success');
    } else {
      errEl.textContent = '✗ Username atau password salah';
      errEl.style.display = 'block';
    }
  };

  // Already logged in?
  if (Auth.current()) {
    showApp();
  } else {
    showLogin();
  }

  // Sidebar nav
  $$('.nav-item[data-page]').forEach(b => {
    b.onclick = () => navigate(b.dataset.page);
  });

  // Theme toggle
  $('#themeToggle').onclick = () => {
    const cur = document.documentElement.getAttribute('data-theme');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  };

  // Logout
  $('#logoutBtn').onclick = async () => {
    const ok = await confirmDialog({
      title: 'Logout?',
      message: 'Anda akan keluar dari sistem. Data yang tersimpan tetap aman.',
      okText: 'Ya, Logout'
    });
    if (ok) Auth.logout();
  };

  // Mobile menu
  $('#menuToggle').onclick = () => $('#sidebar').classList.toggle('open');
}

document.addEventListener('DOMContentLoaded', init);

})();
