@echo off
title Form Upload Sekolah
chcp 65001 >nul
cd /d "%~dp0"
cls
echo.
echo ============================================
echo   FORM UPLOAD DOKUMEN SEKOLAH
echo ============================================
echo.

REM Cek apakah Node.js terinstall
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js belum terinstall!
    echo.
    echo Silakan download dan install Node.js dari:
    echo https://nodejs.org
    echo.
    echo Lalu jalankan file ini lagi.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js terdeteksi.
echo.
echo Memulai server di http://localhost:3000
echo Browser akan terbuka otomatis...
echo.
echo Untuk berhenti: tutup jendela ini atau tekan Ctrl+C
echo ============================================
echo.

node server.js

REM Jika error, jangan langsung tutup
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server berhenti dengan error.
    pause
)
