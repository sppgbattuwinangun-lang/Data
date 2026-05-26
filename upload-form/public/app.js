// DOM Elements
const uploadForm = document.getElementById('uploadForm');
const namaSekolahInput = document.getElementById('namaSekolah');
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

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadFileList();
});

// Drag & Drop
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

// Handle file selection
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

    // Update file input
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    // Show preview
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatFileSize(file.size);
    filePreview.style.display = 'flex';
    dropZone.style.display = 'none';
    hideAlerts();
}

// Form submission
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

    // Disable button
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

// Load file list
async function loadFileList() {
    fileListLoading.style.display = 'block';
    fileTable.style.display = 'none';
    emptyState.style.display = 'none';

    try {
        const response = await fetch('/api/files');
        const files = await response.json();

        fileListLoading.style.display = 'none';

        if (files.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        fileTable.style.display = 'table';
        fileTableBody.innerHTML = '';

        files.forEach((file, index) => {
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
                <td>${formatFileSize(file.size)}</td>
                <td>${uploadDate}</td>
                <td>
                    <button class="btn-download" onclick="downloadFile('${file.id}')">⬇ Download</button>
                    <button class="btn-delete" onclick="deleteFile('${file.id}')">🗑 Hapus</button>
                </td>
            `;
            fileTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Load files error:', error);
        fileListLoading.textContent = 'Gagal memuat data file.';
    }
}

// Download file
function downloadFile(fileId) {
    window.location.href = `/api/download/${fileId}`;
}

// Delete file
async function deleteFile(fileId) {
    if (!confirm('Apakah Anda yakin ingin menghapus file ini?')) return;

    try {
        const response = await fetch(`/api/delete/${fileId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (response.ok && result.success) {
            loadFileList();
        } else {
            alert(result.error || 'Gagal menghapus file');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Terjadi kesalahan saat menghapus file');
    }
}

// Helper functions
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
