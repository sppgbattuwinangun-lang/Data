# SPPG Batuwinangun — Sistem Pelaporan Distribusi MBG

Web app berbasis browser untuk membuat laporan harian distribusi Makan Bergizi Gratis (MBG) dengan output PDF detail.

## Cara Menjalankan

Cukup buka `index.html` di browser. Tidak perlu server atau instalasi.

### Opsi A — Buka langsung (paling cepat)
Klik dua kali file `index.html`. Aplikasi akan langsung jalan di browser.

> Catatan: beberapa browser memblokir sebagian fitur saat dibuka via `file://`. Jika menemui masalah, gunakan opsi B.

### Opsi B — Lewat server lokal
```bash
cd webapp
python3 -m http.server 8080
# lalu buka http://localhost:8080 di browser
```

### Opsi C — Deploy gratis
Folder `webapp/` ini bisa di-deploy ke:
- **GitHub Pages** — push ke branch, aktifkan Pages, set folder ke `/webapp`
- **Netlify / Vercel** — drag & drop folder ini, langsung jalan
- **Firebase Hosting** — `firebase deploy`

## Kredensial Default

| Username  | Password       | Role          |
|-----------|----------------|---------------|
| admin     | sppg2025       | Administrator |
| operator  | operator2025   | Operator      |

Untuk mengubah, edit `config.js` bagian `users`.

## Fitur

- 🔐 **Login system** dengan multi-user
- 📝 **Form input lengkap** per laporan harian:
  - Tanggal (auto-hari) + Penanggung Jawab + Menu
  - Upload sampai 4 foto makanan (auto-compress)
  - Total porsi terdistribusi
  - Daftar sekolah tidak full (dropdown 32 sekolah/instansi)
  - Tabel kandungan gizi: Porsi Besar vs Porsi Kecil (Energi/Protein/Lemak/Karbohidrat/Serat)
  - Catatan tambahan
- 📊 **Dashboard** dengan ringkasan statistik
- 📚 **Riwayat Laporan** dengan filter tanggal & pencarian, edit, hapus
- 📄 **Export PDF**:
  - PDF detail per laporan harian
  - PDF gabungan berdasarkan rentang tanggal (dengan halaman cover ringkasan)
- 🌙 **Mode Terang & Gelap**
- 📱 **Responsive** — bisa dipakai di HP / tablet
- 💾 **Data tersimpan otomatis** di localStorage browser

## Struktur File

```
webapp/
├── index.html      # Entry point + login screen + app shell
├── styles.css      # Modern UI (glassmorphism, gradient, dark mode)
├── config.js       # Konfigurasi: daftar sekolah, kredensial, field gizi
└── app.js          # Logic: routing, form, PDF generation, storage
```

## Mengubah Konfigurasi

Edit `config.js`:
- **Tambah/edit sekolah:** ubah array `schools`
- **Tambah/ganti user:** ubah array `users`
- **Ubah field gizi:** ubah array `nutritionFields`

## Daftar Sekolah / Instansi (32)

1. Posyandu Batuwinangun
2. Posyandu Batumarta 1
3. MA Madani Global
4. MI Ibnu Umar
5. MTs Ummul Tsanawiyah Quro
6. MTs Madani Global
7. PAUD SPS Lestari Jaya
8. Global Child's School
9. PAUD Nurul Iman
10. Sinar Pelangi
11. PGIT Al-Fath
12. KB Wali Songo
13. Darul Falah
14. RA Raudhatul Nurul Huda
15. SD Negeri 27 OKU
16. SD Negeri 31 OKU
17. SD IT Global YAMTI School
18. SD Negeri 34 OKU
19. SD Negeri 37 OKU
20. SD Negeri 40 OKU
21. SD Negeri 28 OKU
22. SD Negeri 32 OKU
23. SD Negeri 29 OKU
24. SD IT Al-Fath
25. SD Negeri 30 OKU
26. SMA Kurnia Jaya
27. SMK Darul Mubtadiin
28. SMP Negeri 03 OKU
29. SMP Plus Darul Mubtadiin
30. SMP IT Tahfidz Global
31. SMP Negeri 14 OKU
32. TK Negeri Pembina 07 OKU

## Backup & Restore Data

Data tersimpan di **localStorage browser**. Untuk backup:
1. Buka **DevTools** (F12) → tab **Application** → **Local Storage** → key `sppg_reports_v1`
2. Copy isinya, simpan ke file teks

Untuk restore: paste kembali ke key yang sama dan refresh.

> **Tip:** untuk multi-device sync, deploy ke GitHub Pages dan akses dari device manapun. Tapi data tetap per-browser kecuali ditambahkan backend.
