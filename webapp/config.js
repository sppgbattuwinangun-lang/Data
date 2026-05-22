// ============================================
// SPPG Batuwinangun - Konfigurasi Aplikasi
// ============================================
// Edit file ini untuk mengubah daftar sekolah, kredensial, dll.

const APP_CONFIG = {
  // Nama Aplikasi
  appName: "SPPG Batuwinangun",
  appSubtitle: "Sistem Pelaporan Distribusi Makan Bergizi Gratis",

  // ====== KREDENSIAL LOGIN ======
  // Multiple users didukung. Tambahkan/edit sesuai kebutuhan.
  users: [
    { username: "admin", password: "sppg2025", role: "Administrator" },
    { username: "operator", password: "operator2025", role: "Operator" }
  ],

  // ====== DAFTAR SEKOLAH/INSTANSI PENERIMA ======
  schools: [
    "Posyandu Batuwinangun",
    "Posyandu Batumarta 1",
    "MA Madani Global",
    "MI Ibnu Umar",
    "MTs Ummul Tsanawiyah Quro",
    "MTs Madani Global",
    "PAUD SPS Lestari Jaya",
    "Global Child's School",
    "PAUD Nurul Iman",
    "Sinar Pelangi",
    "PGIT Al-Fath",
    "KB Wali Songo",
    "Darul Falah",
    "RA Raudhatul Nurul Huda",
    "SD Negeri 27 OKU",
    "SD Negeri 31 OKU",
    "SD IT Global YAMTI School",
    "SD Negeri 34 OKU",
    "SD Negeri 37 OKU",
    "SD Negeri 40 OKU",
    "SD Negeri 28 OKU",
    "SD Negeri 32 OKU",
    "SD Negeri 29 OKU",
    "SD IT Al-Fath",
    "SD Negeri 30 OKU",
    "SMA Kurnia Jaya",
    "SMK Darul Mubtadiin",
    "SMP Negeri 03 OKU",
    "SMP Plus Darul Mubtadiin",
    "SMP IT Tahfidz Global",
    "SMP Negeri 14 OKU",
    "TK Negeri Pembina 07 OKU"
  ],

  // ====== FIELD NILAI GIZI ======
  nutritionFields: [
    { key: "energi", label: "Energi", unit: "kkal" },
    { key: "protein", label: "Protein", unit: "g" },
    { key: "lemak", label: "Lemak", unit: "g" },
    { key: "karbohidrat", label: "Karbohidrat", unit: "g" },
    { key: "serat", label: "Serat", unit: "g" }
  ],

  // Storage key
  STORAGE_REPORTS: "sppg_reports_v1",
  STORAGE_SESSION: "sppg_session_v1"
};
