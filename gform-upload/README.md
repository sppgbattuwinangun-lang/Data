# Form Upload Dokumen Sekolah (GForm-style)

Form upload super simpel, tampilan mirip **Google Forms**. Pengisi cukup:
1. Tulis nama sekolah
2. Pilih file (PDF/JPG)
3. Klik **Kirim**
4. Muncul halaman "Terima kasih"

Admin bisa lihat & download semua tanggapan di halaman `/admin`.

---

## ⚡ Cara 1: Double-click (Paling Mudah!)

### Windows
1. Pastikan **Node.js** sudah terinstall — download di https://nodejs.org
2. **Double-click `start.bat`**
3. Jendela hitam akan muncul, browser terbuka otomatis ke `http://localhost:3000`
4. Selesai! Form siap dipakai.

### Mac / Linux
1. Pastikan Node.js terinstall (`node --version`)
2. Buka Terminal di folder ini, ketik: `bash start.sh`
3. Atau di Mac: klik kanan `start.sh` → Open With → Terminal
4. Browser akan terbuka otomatis.

> **Untuk berhenti:** tutup jendela hitam atau tekan `Ctrl+C`

---

## 🌐 Cara 2: Deploy Online (Tanpa Komputer Sendiri)

Pakai **Render.com** — gratis, dapat URL permanen seperti `https://form-upload-sekolah.onrender.com`.

### Klik tombol di bawah:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/sppgbattuwinangun-lang/Data)

### Atau manual:
1. Buka https://render.com → daftar gratis
2. Klik **New +** → **Web Service**
3. Connect repository GitHub: `sppgbattuwinangun-lang/Data`
4. **Root Directory:** `gform-upload`
5. **Build Command:** kosongkan
6. **Start Command:** `node server.js`
7. Plan: **Free**
8. Klik **Create Web Service**
9. Tunggu ~2 menit, dapat URL: `https://nama-app-anda.onrender.com`

> Catatan: Render free tier akan "tidur" setelah 15 menit tidak ada traffic, dan butuh ~30 detik untuk bangun lagi saat ada yang akses.

---

## 💻 Cara 3: Manual via Terminal

```bash
cd gform-upload
node server.js
```

---

## 🔗 URL yang Bisa Dibuka

| Halaman | URL | Untuk siapa |
|---------|-----|-------------|
| **📝 Form** | `http://localhost:3000` | Pengisi (sekolah) |
| **🔐 Admin** | `http://localhost:3000/admin` | Anda — lihat & download |

---

## ✨ Fitur

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

## 📁 Format Nama File Saat Download

```
NamaSekolah_namafile_asli.ext
```

Contoh: `SDN_01_Menteng_rapor_siswa.pdf`

## 💾 Penyimpanan Data

- File fisik: `uploads/`
- Metadata: `submissions.json` (persisten, tidak hilang saat restart)

## 📦 Tidak Butuh Dependency

Hanya pakai modul bawaan Node.js — tidak perlu `npm install`.
