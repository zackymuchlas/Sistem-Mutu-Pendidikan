# Sistem Penilaian Mutu Pendidikan

Prototype aplikasi untuk menyusun template kriteria penilaian mutu (per jenjang, fakultas, prodi, tahun ajaran, serta periode mulai/akhir penilaian), pengisian form oleh fakultas/prodi lengkap dengan unggah dokumen pendukung, dan penilaian (skor + komentar) oleh Penjamin Mutu.

## Fitur

- **Manajemen template** — bagian → sub bagian → kriteria (kualitatif/kuantitatif), dengan identitas jenjang, fakultas, prodi, tahun ajaran, dan periode mulai/akhir penilaian.
- **Manajemen pengguna** — tambah pengguna dengan nama, email, dan role (dibatasi 3 opsi: Admin Mutu, Fakultas/Prodi, Penjamin Mutu).
- **Simulasi login & akses per role** — pilih "Masuk sebagai" di sidebar untuk berpindah antar pengguna; menu yang tampil otomatis menyesuaikan role pengguna tersebut (Admin → Template & Pengguna; Fakultas/Prodi → Form Penilaian; Penjamin Mutu → Penilaian Mutu).
- **Form pengisian** — field kualitatif (uraian) & kuantitatif (angka + satuan), dengan **unggah file** sungguhan (bukan sekadar teks nama file) sebagai dokumen pendukung per kriteria, maksimal 5MB per file.
- **Penilaian oleh Penjamin Mutu** — skor + komentar per kriteria, skor rata-rata otomatis, dan bisa mengunduh dokumen pendukung yang diunggah pengisi.

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`.

## Build production

```bash
npm run build
npm run preview
```

## Deploy ke Vercel

**Cara termudah — lewat dashboard:**
1. Push folder ini ke repo GitHub/GitLab/Bitbucket.
2. Buka [vercel.com](https://vercel.com) → **Add New Project** → import repo tersebut.
3. Vercel otomatis mendeteksi framework **Vite** — biarkan default:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Klik **Deploy**. Selesai dalam ~1 menit.

**Cara lewat CLI (tanpa GitHub):**
```bash
npm install -g vercel
cd sistem-mutu
vercel
```
Ikuti instruksi di terminal (login, pilih scope, konfirmasi setting default). Untuk deploy production: `vercel --prod`.

## ⚠️ Catatan penting soal penyimpanan data (untuk prototype ini)

Aplikasi ini menyimpan data (pengguna, template, isian form beserta file yang diunggah, hasil penilaian) di **localStorage browser** — artinya:
- Data hanya tersimpan di browser/perangkat yang sama.
- Kalau Anda buka di laptop lalu rekan Anda buka di laptop lain, mereka **tidak** akan melihat data yang sama — "simulasi login" di sidebar hanyalah cara berpindah peran dalam satu browser yang sama untuk keperluan demo.
- File yang diunggah disimpan sebagai base64 di localStorage (batas 5MB/file) — cukup untuk demo, tapi localStorage browser umumnya terbatas ~5-10MB total, jadi jangan unggah terlalu banyak file besar saat mencoba prototype ini.
- Cocok untuk demo alur kerja (Admin → Pengisi → Penjamin Mutu) di satu perangkat, tapi **belum siap** dipakai banyak orang berbeda secara bersamaan, dan belum ada autentikasi/password sungguhan — "login" hanya memilih dari daftar pengguna yang sudah didaftarkan.

### Untuk penggunaan sungguhan (multi-user, data tersimpan permanen)
Ganti isi `useStore()` di `src/App.jsx` agar menyimpan ke backend/database, misalnya:
- **Vercel Postgres / Supabase / Firebase** — paling cepat diintegrasikan dengan Vercel.
- Buat API routes sederhana (`/api/templates`, `/api/users`, `/api/submissions`) yang membaca/menulis ke database tersebut, lalu panggil lewat `fetch()` menggantikan `localStorage.getItem/setItem`.
- File yang diunggah sebaiknya disimpan di object storage (Vercel Blob / S3 / Supabase Storage), bukan base64 di database.
- Tambahkan **autentikasi sungguhan** (mis. NextAuth, Clerk, atau Supabase Auth) menggantikan "simulasi login" saat ini, agar akses data benar-benar terverifikasi per akun, bukan sekadar dipilih dari daftar.

## Struktur proyek

```
src/
  App.jsx      # seluruh logika & tampilan aplikasi (single file)
  main.jsx     # entry point React
  index.css    # Tailwind + reset dasar
index.html
tailwind.config.js
vite.config.js
vercel.json    # rewrite rule agar routing SPA berjalan di Vercel
```
