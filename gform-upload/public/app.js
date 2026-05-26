const form = document.getElementById('uploadForm');
const namaSekolah = document.getElementById('namaSekolah');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const fileIcon = document.getElementById('fileIcon');
const removeFile = document.getElementById('removeFile');
const submitBtn = document.getElementById('submitBtn');
const alertError = document.getElementById('alertError');
const formScreen = document.getElementById('formScreen');
const thankScreen = document.getElementById('thankScreen');
const thankSchool = document.getElementById('thankSchool');
const newResponse = document.getElementById('newResponse');

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// Pilih file
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'jpg', 'jpeg'].includes(ext)) {
        showError('Hanya file PDF, JPG, atau JPEG yang diperbolehkan.');
        fileInput.value = '';
        return;
    }
    if (file.size > MAX_SIZE) {
        showError('Ukuran file maksimal 10 MB.');
        fileInput.value = '';
        return;
    }

    fileIcon.textContent = ext === 'pdf' ? '📄' : '🖼️';
    fileName.textContent = file.name;
    fileSize.textContent = formatSize(file.size);
    filePreview.style.display = 'inline-flex';
    hideError();
});

// Hapus file
removeFile.addEventListener('click', () => {
    fileInput.value = '';
    filePreview.style.display = 'none';
});

// Submit form
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const sekolah = namaSekolah.value.trim();
    const file = fileInput.files[0];

    if (!sekolah) {
        showError('Mohon isi nama sekolah.');
        namaSekolah.focus();
        return;
    }
    if (!file) {
        showError('Mohon pilih file untuk diupload.');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loading').style.display = 'inline';

    try {
        const formData = new FormData();
        formData.append('nama_sekolah', sekolah);
        formData.append('file', file);

        const res = await fetch('/api/submit', {
            method: 'POST',
            body: formData
        });
        const result = await res.json();

        if (res.ok && result.success) {
            thankSchool.textContent = sekolah;
            formScreen.style.display = 'none';
            thankScreen.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            showError(result.error || 'Gagal mengirim. Silakan coba lagi.');
        }
    } catch (err) {
        showError('Terjadi kesalahan jaringan. Silakan coba lagi.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').style.display = 'inline';
        submitBtn.querySelector('.btn-loading').style.display = 'none';
    }
});

// Kirim tanggapan lain
newResponse.addEventListener('click', () => {
    form.reset();
    filePreview.style.display = 'none';
    thankScreen.style.display = 'none';
    formScreen.style.display = 'block';
    namaSekolah.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

function showError(msg) {
    alertError.textContent = msg;
    alertError.style.display = 'block';
}

function hideError() {
    alertError.style.display = 'none';
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
