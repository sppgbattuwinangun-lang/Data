#!/bin/bash
# Form Upload Sekolah - Auto-runner untuk Mac & Linux

cd "$(dirname "$0")"

clear
echo ""
echo "============================================"
echo "  FORM UPLOAD DOKUMEN SEKOLAH"
echo "============================================"
echo ""

# Cek Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js belum terinstall!"
    echo ""
    echo "Silakan install Node.js dari:"
    echo "https://nodejs.org"
    echo ""
    echo "Atau via Homebrew (Mac): brew install node"
    echo "Atau via apt (Ubuntu):  sudo apt install nodejs"
    echo ""
    read -p "Tekan Enter untuk keluar..."
    exit 1
fi

echo "[OK] Node.js $(node --version) terdeteksi."
echo ""
echo "Memulai server di http://localhost:3000"
echo "Browser akan terbuka otomatis..."
echo ""
echo "Untuk berhenti: tekan Ctrl+C"
echo "============================================"
echo ""

node server.js
