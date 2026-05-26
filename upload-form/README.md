# Form Upload Dokumen Sekolah

Aplikasi web sederhana untuk mengupload file PDF/JPG dengan nama sekolah. File yang didownload akan memiliki nama sekolah di dalamnya sehingga mudah diidentifikasi.

## Fitur

- Upload file PDF dan JPG/JPEG
- Input nama sekolah untuk identifikasi file
- Drag & drop file support
- Download file dengan format nama: `NamaSekolah_namafile.ext`
- Daftar file yang sudah diupload
- Hapus file yang tidak diperlukan
- Validasi tipe file (hanya PDF & JPG/JPEG)
- Maksimal ukuran file 10MB
- Responsive design

## Cara Menjalankan

```bash
cd upload-form
node server.js
```

Buka browser dan akses: **http://localhost:3000**

## Cara Penggunaan

1. Isi **Nama Sekolah** di form
2. Pilih file PDF atau JPG/JPEG (drag & drop atau klik untuk memilih)
3. Klik **Upload File**
4. File akan muncul di daftar bawah
5. Klik **Download** untuk mengunduh file (nama file akan mengandung nama sekolah)
6. Klik **Hapus** untuk menghapus file

## Format Nama File Download

Ketika download, file akan bernama:
```
NamaSekolah_namafileasli.pdf
NamaSekolah_namafileasli.jpg
```

Contoh: `SDN_01_Menteng_rapor_siswa.pdf`

## Teknologi

- Node.js (tanpa library eksternal)
- HTML5, CSS3, JavaScript (Vanilla)
- No database (file-based storage)

## Struktur Folder

```
upload-form/
├── server.js          # Backend server
├── package.json       # Project config
├── README.md          # Dokumentasi
├── public/
│   ├── index.html     # Halaman utama
│   ├── styles.css     # Styling
│   └── app.js         # Frontend logic
└── uploads/           # Folder penyimpanan file (auto-created)
```
