# Form Upload Dokumen Sekolah (GForm-style)

Form upload super simpel, tampilan mirip **Google Forms**. Pengisi cukup:
1. Tulis nama sekolah
2. Pilih file (PDF/JPG)
3. Klik **Kirim**
4. Muncul halaman "Terima kasih"

Admin bisa lihat & download semua tanggapan di halaman `/admin`.

## Cara Pakai

```bash
cd gform-upload
node server.js
```

Lalu buka:

| Halaman | URL | Keterangan |
|---------|-----|-----------|
| **Form** | http://localhost:3000 | Untuk pengisi (sekolah) |
| **Admin** | http://localhost:3000/admin | Untuk pengumpul (lihat & download) |

## Fitur

### Halaman Form (untuk pengisi)
- Tampilan ala Google Forms (clean, ungu, card)
- Validasi: PDF/JPG/JPEG, max 10 MB
- Halaman "Terima kasih" setelah submit
- Tombol "Kirim tanggapan lain"

### Halaman Admin (`/admin`)
- Statistik: Total / PDF / JPG / Jumlah Sekolah
- Daftar lengkap semua tanggapan
- Search / filter
- Download per file (nama file otomatis berisi nama sekolah)
- **Download Semua** (sekaligus dalam 1 file `.tar`)

## Format Nama File Saat Download

```
NamaSekolah_namafile_asli.ext
```

Contoh:  
`SDN_01_Menteng_rapor_siswa.pdf`

## Penyimpanan

- File fisik: `uploads/`
- Metadata: `submissions.json` (persisten, tidak hilang saat restart)

## Tidak butuh dependency

Hanya pakai modul bawaan Node.js — tidak perlu `npm install`.
