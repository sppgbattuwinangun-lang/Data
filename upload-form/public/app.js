// ====== DOM Elements ======
const uploadForm = document.getElementById('uploadForm');
const namaSekolahInput = document.getElementById('namaSekolah');
const schoolListDatalist = document.getElementById('schoolList');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const filePreview = document.getElementById('filePreview');
const fileNameEl = document.getElementById('fileName');
const fileSizeEl = document.getElementById('fileSize');
const removeFileBtn = document.getElementById('removeFile');
const submitBtn = document.getElementById('submitBtn');
const alertSuccess = document.getElementById('alertSuccess');
const alertError = document.getElementById('alertError');
const alertSuccessMsg = document.getElementById('alertSuccessMsg');
const alertErrorMsg = document.getElementById('alertErrorMsg');
const fileTableBody = document.getElementById('fileTableBody');
const fileTable = document.getElementById('fileTable');
const fileListLoading = document.getElementById('fileListLoading');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');

// Stats
const statTotal = document.getElementById('statTotal');
const statPdf = document.getElementById('statPdf');
const statJpg = document.getElementById('statJpg');
const statSchools = document.getElementById('statSchools');
const statSize = document.getElementById('statSize');

// Summary
const schoolSummaryCard = document.getElementById('schoolSummaryCard');
const summaryTableBody = document.getElementById('summaryTableBody');

// Modal
const detailModal = document.getElementById('detailModal');
const detailTitle = document.getElementById('detailTitle');
const detailBody = document.getElementById('detailBody');
const closeDetail = document.getElementById('closeDetail');
const closeDetailBtn = document.getElementById('closeDetailBtn');
const downloadDetailBtn = document.getElementById('downloadDetailBtn');

// State
const MAX_FILE_SIZE = 10 * 1024 * 1024;
let allFiles = [];
let currentDetailId = null;

// ====== Init ======
document.addEventListener('DOMContentLoaded', () => {
    loadFileList();
});

// ====== Drag & Drop ======
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

removeFileBtn.addEventListener('click', () => {
    fileInput.value = '';
    filePreview.style.display = 'none';
    dropZone.style.display = 'block';
});

function handleFileSelect(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    if (!['pdf', 'jpg', 'jpeg'].includes(ext)) {
        showError('Hanya file PDF dan JPG/JPEG yang diperbolehkan!');
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        showError('Ukuran file maksimal 10MB!');
        return;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatFileSize(file.size);
    filePreview.style.display = 'flex';
    dropZone.style.display = 'none';
    hideAlerts();
}

// ====== Form Submit ======
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlerts();

    const namaSekolah = namaSekolahInput.value.trim();
    const file = fileInput.files[0];

    if (!namaSekolah) {
        showError('Nama sekolah wajib diisi!');
        return;
    }
    if (!file) {
        showError('Pilih file untuk diupload!');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loading').style.display = 'inline';

    try {
        const formData = new FormData();
        formData.append('nama_sekolah', namaSekolah);
        formData.append('file', file);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok && result.success) {
            showSuccess(`File "${file.name}" dari ${namaSekolah} berhasil diupload!`);
            resetForm();
            loadFileList();
        } else {
            showError(result.error || 'Gagal mengupload file');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showError('Terjadi kesalahan jaringan. Silakan coba lagi.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').style.display = 'inline';
        submitBtn.querySelector('.btn-loading').style.display = 'none';
    }
});

// ====== Search ======
searchInput.addEventListener('input', () => {
    renderFileList();
});

// ====== Load Files ======
async function loadFileList() {
    fileListLoading.style.display = 'block';
    fileTable.style.display = 'none';
    emptyState.style.display = 'none';

    try {
        const response = await fetch('/api/files');
        allFiles = await response.json();

        // Sort by upload date desc
        allFiles.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

        fileListLoading.style.display = 'none';

        updateStats();
        updateSchoolDatalist();
        renderSummary();
        renderFileList();
    } catch (error) {
        console.error('Load files error:', error);
        fileListLoading.textContent = 'Gagal memuat data file.';
    }
}

// ====== Update Statistics ======
function updateStats() {
    const total = allFiles.length;
    const pdfCount = allFiles.filter(f => f.fileType === 'PDF').length;
    const jpgCount = allFiles.filter(f => f.fileType === 'JPG' || f.fileType === 'JPEG').length;
    const schools = new Set(allFiles.map(f => f.namaSekolah));
    const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);

    statTotal.textContent = total;
    statPdf.textContent = pdfCount;
    statJpg.textContent = jpgCount;
    statSchools.textContent = schools.size;
    statSize.textContent = formatFileSize(totalSize);
}

// ====== Update School Autocomplete ======
function updateSchoolDatalist() {
    const schools = [...new Set(allFiles.map(f => f.namaSekolah))].sort();
    schoolListDatalist.innerHTML = schools.map(s =>
        `<option value="${escapeHtml(s)}"></option>`
    ).join('');
}

// ====== Render Summary per School ======
function renderSummary() {
    if (allFiles.length === 0) {
        schoolSummaryCard.style.display = 'none';
        return;
    }

    schoolSummaryCard.style.display = 'block';

    // Group by school
    const grouped = {};
    allFiles.forEach(f => {
        if (!grouped[f.namaSekolah]) {
            grouped[f.namaSekolah] = { pdf: 0, jpg: 0, total: 0, size: 0 };
        }
        grouped[f.namaSekolah].total += 1;
        grouped[f.namaSekolah].size += f.size;
        if (f.fileType === 'PDF') grouped[f.namaSekolah].pdf += 1;
        else grouped[f.namaSekolah].jpg += 1;
    });

    const sorted = Object.entries(grouped).sort((a, b) => b[1].total - a[1].total);

    let totalPdf = 0, totalJpg = 0, totalAll = 0, totalSize = 0;
    const rows = sorted.map(([school, stats]) => {
        totalPdf += stats.pdf;
        totalJpg += stats.jpg;
        totalAll += stats.total;
        totalSize += stats.size;
        return `
            <tr>
                <td><strong>${escapeHtml(school)}</strong></td>
                <td class="center">${stats.pdf}</td>
                <td class="center">${stats.jpg}</td>
                <td class="center"><strong>${stats.total}</strong></td>
                <td class="right">${formatFileSize(stats.size)}</td>
            </tr>
        `;
    }).join('');

    summaryTableBody.innerHTML = rows + `
        <tr class="total-row">
            <td><strong>TOTAL (${sorted.length} sekolah)</strong></td>
            <td class="center"><strong>${totalPdf}</strong></td>
            <td class="center"><strong>${totalJpg}</strong></td>
            <td class="center"><strong>${totalAll}</strong></td>
            <td class="right"><strong>${formatFileSize(totalSize)}</strong></td>
        </tr>
    `;
}

// ====== Render File List (with search) ======
function renderFileList() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = query
        ? allFiles.filter(f =>
            f.namaSekolah.toLowerCase().includes(query) ||
            f.originalFilename.toLowerCase().includes(query)
        )
        : allFiles;

    if (allFiles.length === 0) {
        emptyState.style.display = 'block';
        fileTable.style.display = 'none';
        return;
    }

    fileTable.style.display = 'table';
    emptyState.style.display = 'none';

    if (filtered.length === 0) {
        fileTableBody.innerHTML = `
            <tr><td colspan="7" style="text-align:center; padding:30px; color:#999;">
                Tidak ada file yang cocok dengan pencarian "<strong>${escapeHtml(query)}</strong>"
            </td></tr>
        `;
        return;
    }

    fileTableBody.innerHTML = '';
    filtered.forEach((file, index) => {
        const row = document.createElement('tr');
        const badgeClass = file.fileType === 'PDF' ? 'badge-pdf' : 'badge-jpg';
        const uploadDate = new Date(file.uploadDate).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(file.namaSekolah)}</strong></td>
            <td>${escapeHtml(file.originalFilename)}</td>
            <td><span class="badge ${badgeClass}">${file.fileType}</span></td>
            <td class="right">${formatFileSize(file.size)}</td>
            <td>${uploadDate}</td>
            <td class="center">
                <button class="btn-action btn-view" data-id="${file.id}" title="Lihat detail">Detail</button>
                <button class="btn-action btn-download" data-download="${file.id}" title="Download">Download</button>
                <button class="btn-action btn-delete" data-delete="${file.id}" title="Hapus">Hapus</button>
            </td>
        `;
        fileTableBody.appendChild(row);
    });

    // Bind events
    fileTableBody.querySelectorAll('[data-id]').forEach(b => {
        b.onclick = () => showDetail(b.dataset.id);
    });
    fileTableBody.querySelectorAll('[data-download]').forEach(b => {
        b.onclick = () => downloadFile(b.dataset.download);
    });
    fileTableBody.querySelectorAll('[data-delete]').forEach(b => {
        b.onclick = () => deleteFile(b.dataset.delete);
    });
}

// ====== Detail Modal ======
function showDetail(fileId) {
    const file = allFiles.find(f => f.id === fileId);
    if (!file) return;

    currentDetailId = fileId;
    detailTitle.textContent = `Detail File - ${file.namaSekolah}`;

    const uploadDate = new Date(file.uploadDate).toLocaleString('id-ID', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const downloadName = `${file.namaSekolah.replace(/[^a-zA-Z0-9_\-\s]/g, '').replace(/\s+/g, '_')}_${file.originalFilename}`;

    let previewHtml = '';
    if (file.fileType === 'JPG' || file.fileType === 'JPEG') {
        previewHtml = `
            <div class="preview-box">
                <img src="/api/preview/${file.id}" alt="Preview" />
            </div>
        `;
    } else if (file.fileType === 'PDF') {
        previewHtml = `
            <div class="preview-box">
                <iframe src="/api/preview/${file.id}" title="Preview PDF"></iframe>
            </div>
        `;
    }

    detailBody.innerHTML = `
        <div class="detail-grid">
            <div class="label">Nama Sekolah</div>
            <div class="value"><strong>${escapeHtml(file.namaSekolah)}</strong></div>

            <div class="label">Nama File Asli</div>
            <div class="value">${escapeHtml(file.originalFilename)}</div>

            <div class="label">Nama Saat Download</div>
            <div class="value" style="color:#27ae60;"><strong>${escapeHtml(downloadName)}</strong></div>

            <div class="label">Tipe File</div>
            <div class="value"><span class="badge ${file.fileType === 'PDF' ? 'badge-pdf' : 'badge-jpg'}">${file.fileType}</span></div>

            <div class="label">Ukuran</div>
            <div class="value">${formatFileSize(file.size)}</div>

            <div class="label">Tanggal Upload</div>
            <div class="value">${uploadDate}</div>

            <div class="label">ID File</div>
            <div class="value" style="font-family:monospace; font-size:0.85rem; color:#888;">${file.id}</div>
        </div>
        <h3 style="margin-top:20px; margin-bottom:10px; font-size:1rem; color:#555;">Preview File</h3>
        ${previewHtml}
    `;

    detailModal.style.display = 'flex';
}

closeDetail.addEventListener('click', closeModal);
closeDetailBtn.addEventListener('click', closeModal);
detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeModal();
});
downloadDetailBtn.addEventListener('click', () => {
    if (currentDetailId) downloadFile(currentDetailId);
});

function closeModal() {
    detailModal.style.display = 'none';
    currentDetailId = null;
}

// Close modal with ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && detailModal.style.display === 'flex') {
        closeModal();
    }
});

// ====== Actions ======
function downloadFile(fileId) {
    window.location.href = `/api/download/${fileId}`;
}

async function deleteFile(fileId) {
    const file = allFiles.find(f => f.id === fileId);
    if (!file) return;
    if (!confirm(`Hapus file "${file.originalFilename}" dari ${file.namaSekolah}?`)) return;

    try {
        const response = await fetch(`/api/delete/${fileId}`, { method: 'DELETE' });
        const result = await response.json();

        if (response.ok && result.success) {
            loadFileList();
            showSuccess('File berhasil dihapus.');
        } else {
            alert(result.error || 'Gagal menghapus file');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Terjadi kesalahan saat menghapus file');
    }
}

// ====== Helpers ======
function resetForm() {
    uploadForm.reset();
    filePreview.style.display = 'none';
    dropZone.style.display = 'block';
}

function showSuccess(msg) {
    alertSuccessMsg.textContent = msg;
    alertSuccess.style.display = 'flex';
    alertError.style.display = 'none';
    setTimeout(() => { alertSuccess.style.display = 'none'; }, 5000);
}

function showError(msg) {
    alertErrorMsg.textContent = msg;
    alertError.style.display = 'flex';
    alertSuccess.style.display = 'none';
    setTimeout(() => { alertError.style.display = 'none'; }, 5000);
}

function hideAlerts() {
    alertSuccess.style.display = 'none';
    alertError.style.display = 'none';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
