# Sistem Penilaian Mutu Pendidikan

Prototype aplikasi untuk menyusun template kriteria penilaian mutu (per jenjang, fakultas, prodi, tahun ajaran, serta periode mulai/akhir penilaian), pengisian form oleh fakultas/prodi lengkap dengan unggah dokumen pendukung, dan penilaian (skor + komentar) oleh Penjamin Mutu.

## Tindak lanjut RTM/RTL — dari satu periode ke periode berikutnya

Keputusan tindak lanjut **tidak** diubah langsung di template periode yang sedang dinilai, karena itu akan menghapus riwayat capaiannya. Alurnya:

1. **Penilaian selesai** — Penjamin Mutu menekan *Selesaikan penilaian*, capaian tiap indikator diketahui.
2. **Draf RTL otomatis** — menu *Tindak Lanjut & RTM* (Admin Mutu) menyusun satu baris per indikator dengan usulan keputusan:
   - belum tercapai → **Lanjutkan target yang sama**
   - sudah tercapai → **Perketat ambang batas**
   - sudah tercapai tapi target sudah di plafon (100%, IPK 4,00) → **Tambah indikator baru**, karena ambang batasnya tidak bisa dinaikkan lagi
3. **Keputusan RTM** — tiap baris dilengkapi keputusan, target baru, penanggung jawab, dan tenggat. Indikator yang belum tercapai wajib diisi akar masalahnya; tombol penerapan tetap mati sampai semuanya lengkap, dan alasannya ditampilkan.
4. **Diturunkan sekaligus** — sekali disetujui, periode asal dikunci sebagai riwayat baca-saja, dan sistem membuat template periode berikutnya berstatus draf. Setiap indikator membawa catatan asal keputusannya, misalnya *"RTL 2025/2026 Genap: target 90 sudah tercapai (realisasi 93) — ambang batas diperketat menjadi 94,5 (PJ: Ka. LPM, tenggat 2027-06-30)"*.

Untuk keputusan *Tambah indikator baru*, indikator induk dipertahankan pada targetnya dan indikator baru disisipkan di bawahnya dengan target masih kosong untuk diisi Admin Mutu.

## Cakupan template awal

Template contoh disusun dari Lampiran Peraturan Ketua No. 0128/PK/K/STIKOMCKI/VII/2023: **32 Kriteria Standar** (C1–C9, masing-masing dengan kode dokumennya), **55 Pernyataan Standar**, dan **123 indikator** — 97 kuantitatif dan 26 kualitatif. Indikator yang belum tercantum dapat ditambahkan lewat Manajemen Template.

## Data demo yang sudah tersedia

Saat pertama dijalankan (atau setelah menekan **Reset ke data contoh** di bawah sidebar), aplikasi memuat dua skenario sekaligus:

| Template | Kondisi |
|---|---|
| **Sistem Informasi — 2025/2026 Genap** | Siklus penuh. Template ditetapkan, form sudah diisi lengkap 30 indikator oleh Kaprodi dengan 15 dokumen pendukung, dan Penjamin Mutu sudah memberi skor + komentar pada seluruh indikator (skor rata-rata 81,4). Status `reviewed` sehingga terkunci. |
| **Teknik Informatika — 2026/2027 Ganjil** | Baru tahap penetapan template. Belum ada isian sama sekali, jadi form masih bisa diisi dan diubah berulang kali. |

Realisasi pada template pertama sengaja dibuat campuran — 18 indikator melampaui target, 11 di bawah target — supaya penanda capaian dan tombol tindak lanjut PPEPP (*Lanjutkan target periode berikutnya* / *Perketat ambang batas* / *Tambah indikator baru*) terlihat langsung di Manajemen Template.

Tiga akun disiapkan; berpindah peran lewat **Masuk sebagai** di sidebar:

- `Admin Mutu Pusat` — Manajemen Template & Pengguna
- `Kaprodi Sistem Informasi` — Form Penilaian
- `Penjamin Mutu` — Penilaian Mutu

## Fitur

- **Manajemen template** — bagian → sub bagian → kriteria (kualitatif/kuantitatif), dengan identitas jenjang, fakultas, prodi, tahun ajaran, dan periode mulai/akhir penilaian.
- **Struktur mengikuti matriks Standar Mutu Berbasis Risiko** — Kriteria Standar (kode C1–C9 + kode dokumen) → Pernyataan Standar → Indikator. Setiap indikator punya jenis (IKU/IKT, nomor dihitung otomatis per kriteria), objek yang diukur, satuan, arah target (≥ minimal, ≤ maksimal, atau = pemenuhan penuh), target ideal, potensi risiko, dan mitigasi risiko.
- **Target ditulis sesuai jenisnya** — indikator pemenuhan penuh ditulis `100 %` bukan `≥ 100 %`, indikator ketersediaan dokumen dibuat kualitatif dengan target `Tersedia, lengkap, dan disahkan` alih-alih dipaksa jadi persentase.
- **Target tampil di form pengisian** — pengisi melihat target ideal, objek, satuan, serta risiko & mitigasi pada tiap indikator, dan langsung mendapat penanda "memenuhi target" / "di bawah target" beserta selisihnya saat mengisi realisasi. Target yang sama juga tampil di lembar penilaian Penjamin Mutu sebagai acuan skor.
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
