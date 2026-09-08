import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, FileText, Upload, ClipboardCheck, LayoutTemplate, ArrowLeft, Search, Check, X, GraduationCap, Building2, BookOpen, Calendar, Star, Save, Send, Eye, Users, UserPlus, LogOut, Paperclip, Download, TrendingUp, Lock, AlertTriangle, ArrowRight } from "lucide-react";

const uid = () => Math.random().toString(36).slice(2, 10);

const FONT_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600;700&display=swap');
:root{
  --ink:#1B2A4A;
  --ink-soft:#2E3F63;
  --gold:#A8823C;
  --gold-soft:#EFE4CB;
  --bg:#F3F4F1;
  --surface:#FFFFFF;
  --muted:#5B6472;
  --border:#E1E3DE;
  --good:#3A7D5C;
  --good-bg:#E7F1EA;
  --warn:#B5493A;
  --warn-bg:#F7E9E5;
}
.serif{font-family:'Source Serif 4', Georgia, serif;}
.sans{font-family:'Inter', system-ui, sans-serif;}
`;

const EMPTY_TEMPLATE = () => ({
  id: uid(),
  jenjang: "",
  fakultas: "",
  prodi: "",
  tahunAjaran: "",
  periodeMulai: "",
  periodeAkhir: "",
  status: "draft",
  sections: [],
});

const EMPTY_SECTION = () => ({ id: uid(), title: "", subsections: [] });
const EMPTY_SUBSECTION = () => ({ id: uid(), title: "", fields: [] });
const EMPTY_FIELD = () => ({
  id: uid(),
  label: "",
  jenis: "IKU", // IKU = Indikator Kinerja Utama, IKT = Indikator Kinerja Tambahan
  type: "qualitative",
  objek: "", // objek yang diukur (mis. Dosen, Mahasiswa, Dokumen, Kegiatan)
  unit: "",
  maxScore: 100,
  target: "", // ambang batas / target capaian (mis. "100" untuk 100%)
  arah: "min", // "min" = target minimal (semakin tinggi semakin baik), "maks" = target maksimal
  risiko: "", // potensi risiko bila standar tidak terpenuhi
  mitigasi: "", // langkah mitigasi risiko
  tindakLanjutCatatan: "", // catatan tindak lanjut hasil evaluasi periode sebelumnya
});

const JENIS_OPTIONS = ["IKU", "IKT"];
const ARAH_OPTIONS = [
  { id: "min", label: "≥ Minimal" },
  { id: "maks", label: "≤ Maksimal" },
];

/* Ringkasan target untuk ditampilkan di form pengisi & lembar penilaian.
   Kuantitatif -> "≥ 90 %" / "≤ 6 bulan" ; kualitatif -> teks target apa adanya. */
function targetLabel(field) {
  if (field.target === "" || field.target === undefined || field.target === null) return "Belum ditetapkan";
  if (field.type !== "quantitative") return field.target;
  const arrow = field.arah === "maks" ? "≤" : "≥";
  return `${arrow} ${field.target}${field.unit ? " " + field.unit : ""}`;
}

/* Apakah nilai realisasi memenuhi target, dengan memperhatikan arah indikator. */
function meetsTarget(field, valueNum, targetNum) {
  return field.arah === "maks" ? valueNum <= targetNum : valueNum >= targetNum;
}

/* Bandingkan satu isian (realisasi) terhadap target indikator. */
function compareToTarget(field, rawValue) {
  const targetNum = Number(field.target);
  const valueNum = Number(rawValue);
  const hasTarget = field.target !== "" && field.target !== undefined && !isNaN(targetNum);
  const hasValue = rawValue !== "" && rawValue !== undefined && rawValue !== null && !isNaN(valueNum);
  if (!hasTarget || field.type !== "quantitative") return { status: "n/a", gap: null };
  if (!hasValue) return { status: "empty", gap: null };
  // Selisih selalu ditulis relatif terhadap arah: positif = lebih baik dari target.
  const gap = field.arah === "maks" ? targetNum - valueNum : valueNum - targetNum;
  return { status: meetsTarget(field, valueNum, targetNum) ? "tercapai" : "belum", gap };
}

// Opsi role dibatasi hanya 3 ini
const ROLE_OPTIONS = [
  { id: "admin", label: "Admin Mutu", icon: LayoutTemplate, desc: "Kelola template & pengguna" },
  { id: "pengisi", label: "Fakultas / Prodi", icon: BookOpen, desc: "Isi form penilaian" },
  { id: "penjamin", label: "Penjamin Mutu", icon: ClipboardCheck, desc: "Beri skor & komentar" },
];

const EMPTY_USER = () => ({ id: uid(), name: "", email: "", role: "pengisi" });

/* Ketiga role di-seed sekaligus. Sebelumnya hanya Admin Mutu yang dibuat,
   sehingga menu "Form Penilaian" dan "Penilaian Mutu" tidak pernah muncul —
   form terlihat seperti tidak bisa diisi padahal memang belum ada akunnya. */
const SEED_USERS = () => [
  { id: uid(), name: "Admin Mutu Pusat", email: "admin@kampus.ac.id", role: "admin" },
  { id: uid(), name: "Kaprodi Sistem Informasi", email: "kaprodi.si@kampus.ac.id", role: "pengisi" },
  { id: uid(), name: "Penjamin Mutu", email: "penjamin@kampus.ac.id", role: "penjamin" },
];

const STORAGE_KEY = "qa-app-data";
const DATA_VERSION = 2; // dinaikkan saat struktur indikator berubah (jenis/objek/target)

/* ---------------- EVALUASI CAPAIAN & TINDAK LANJUT ----------------
   Sesuai arahan pedoman: kalau indikator belum tercapai, dilanjutkan pada
   periode berikutnya dengan target yang sama. Kalau sudah tercapai, dibuat
   indikator baru atau ambang batasnya dinaikkan. */
function computeAchievement(field, submissions, templateId) {
  const targetNum = Number(field.target);
  if (field.target === "" || field.target === undefined || isNaN(targetNum)) {
    return { status: "no-target", avg: null, targetNum: null };
  }
  const values = submissions
    .filter((s) => s.templateId === templateId && (s.status === "submitted" || s.status === "reviewed"))
    .map((s) => Number(s.answers?.[field.id]?.value))
    .filter((n) => !isNaN(n));
  if (!values.length) return { status: "no-data", avg: null, targetNum };
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return { status: meetsTarget(field, avg, targetNum) ? "tercapai" : "belum", avg, targetNum };
}

function cloneFieldAsNewIndicator(field) {
  return {
    ...EMPTY_FIELD(),
    label: field.label ? `${field.label} (Indikator Baru)` : "",
    jenis: field.jenis,
    type: field.type,
    objek: field.objek,
    unit: field.unit,
    arah: field.arah,
    target: "",
    risiko: field.risiko,
    mitigasi: field.mitigasi,
    tindakLanjutCatatan: "Indikator baru dibuat karena target sebelumnya sudah tercapai.",
  };
}

/* Template awal berbasis Buku Kebijakan Mutu SPMI Berbasis Mitigasi Risiko
   STIKOM Cipta Karya Informatika 2023 (kriteria C1-C9), dilengkapi ambang
   batas (target), potensi risiko, dan mitigasi risiko sesuai dokumen. */
function SEED_QA_TEMPLATE(identity = {}) {
  const mk = (label, opts = {}) => ({
    ...EMPTY_FIELD(),
    label,
    jenis: opts.jenis || "IKU",
    type: opts.type || "quantitative",
    objek: opts.objek || "",
    unit: opts.unit ?? "%",
    arah: opts.arah || "min",
    target: opts.target ?? "100",
    risiko: opts.risiko || "",
    mitigasi: opts.mitigasi || "",
  });

  return {
    id: uid(),
    jenjang: "S1",
    fakultas: "Fakultas Ilmu Komputer",
    prodi: "Semua Program Studi",
    tahunAjaran: "2026/2027 Ganjil",
    periodeMulai: "",
    periodeAkhir: "",
    status: "published",
    ...identity,
    sections: [
      {
        id: uid(), title: "C1. Visi, Misi, Tujuan dan Strategi (VMTS)",
        subsections: [
          {
            id: uid(), title: "Pemahaman dan Keterlibatan Sivitas Akademika",
            fields: [
              mk("Keterjangkauan dan pemahaman dokumen VMTS oleh seluruh sivitas akademika", {
                objek: "Dosen / Tendik / Mahasiswa", 
                target: "90",
                risiko: "Sivitas akademika tidak membaca/memahami dokumen VMTS; distribusi dokumen tidak merata.",
                mitigasi: "Sosialisasi rutin minimal 1x per tahun; menyediakan dokumen di portal internal; membuat ringkasan VMTS.",
              }),
              mk("Keterkaitan VMTS dengan kurikulum dan keilmuan program studi", {
                objek: "Mata kuliah", 
                risiko: "Kurikulum tidak selaras dengan VMTS; revisi kurikulum tidak mempertimbangkan VMTS.",
                mitigasi: "Tim kurikulum memastikan kesesuaian VMTS; review keselarasan setiap 2-3 tahun.",
              }),
              mk("Keterlibatan pemangku kepentingan internal dan eksternal dalam penyusunan VMTS", {
                objek: "Pemangku kepentingan", 
                risiko: "Masukan pemangku kepentingan tidak terakomodasi; keterlibatan hanya formalitas.",
                mitigasi: "Mekanisme pengumpulan masukan tertulis; undangan resmi jauh hari; forum sinkronisasi rutin.",
              }),
            ],
          },
        ],
      },
      {
        id: uid(), title: "C2. Tata Pamong, Tata Kelola, Kerja Sama & SPMI",
        subsections: [
          {
            id: uid(), title: "Tata Pamong dan Tata Kelola",
            fields: [
              mk("Ketersediaan dokumen formal sistem tata pamong dan tata kelola yang akuntabel, transparan, dan mitigatif", {
                objek: "Dokumen", 
                risiko: "Dokumen tidak diperbarui sesuai perubahan kebijakan; penerapan mitigasi risiko tidak konsisten.",
                mitigasi: "Review dan pembaruan dokumen minimal setiap tahun; monitoring penerapan mitigasi risiko secara berkala.",
              }),
              mk("Tingkat kepuasan pemangku kepentingan (mahasiswa, dosen, tendik, lulusan, pengguna, mitra)", {
                jenis: "IKT", objek: "Mahasiswa / dosen / tendik / lulusan / mitra", 
                target: "75",
                risiko: "Tingkat kepuasan rendah; hasil survei tidak ditindaklanjuti.",
                mitigasi: "Survei kepuasan berkala; analisis hasil dan tindak lanjut perbaikan.",
              }),
            ],
          },
          {
            id: uid(), title: "Kerja Sama",
            fields: [
              mk("Ketersediaan dokumen kebijakan/prosedur pengembangan jejaring dan kemitraan serta monev kepuasan mitra", {
                objek: "Dokumen", 
                risiko: "Dokumen kebijakan/prosedur tidak lengkap atau tidak diperbarui; monitoring kepuasan mitra tidak berkala.",
                mitigasi: "Pembaruan dokumen secara rutin; jadwal monitoring dan evaluasi kepuasan mitra secara periodik.",
              }),
            ],
          },
          {
            id: uid(), title: "Sistem Penjaminan Mutu Internal (SPMI)",
            fields: [
              mk("Efektivitas pelaksanaan siklus PPEPP (ditetapkan, dilaksanakan, dievaluasi, dikendalikan, ditindaklanjuti)", {
                objek: "Dokumen", 
                risiko: "Bukti pelaksanaan penjaminan mutu tidak lengkap; tidak ada tindak lanjut hasil evaluasi.",
                mitigasi: "Mengarsipkan bukti pelaksanaan sesuai siklus PPEPP; menyusun rencana perbaikan berkelanjutan.",
              }),
              mk("Ketersediaan bukti Audit Mutu Internal (AMI)", {
                jenis: "IKT", objek: "Dokumen", 
                risiko: "Bukti audit tidak lengkap atau tidak terdokumentasi.",
                mitigasi: "Menyusun dan mengarsipkan laporan audit secara resmi dan tepat waktu; minimal 1x per tahun.",
              }),
            ],
          },
        ],
      },
      {
        id: uid(), title: "C3. Kemahasiswaan (Penerimaan, Layanan & Promosi)",
        subsections: [
          {
            id: uid(), title: "Penerimaan dan Layanan Mahasiswa",
            fields: [
              mk("Persentase calon mahasiswa yang mengikuti seluruh tahapan seleksi", {
                objek: "Mahasiswa", 
                risiko: "Proses seleksi terlalu panjang/rumit sehingga pendaftar tidak menyelesaikan seleksi.",
                mitigasi: "Menyederhanakan tahapan seleksi (mis. integrasi tes daring dengan wawancara daring).",
              }),
              mk("Rasio dosen terhadap mahasiswa", {
                jenis: "IKT", objek: "Mahasiswa / Dosen", 
                type: "quantitative", unit: "mahasiswa per dosen", target: "30", arah: "maks",
                risiko: "Kekurangan jumlah dosen tetap sehingga rasio tidak ideal.",
                mitigasi: "Rekrutmen dosen baru; pemanfaatan dosen tidak tetap dengan seleksi ketat.",
              }),
              mk("Tingkat kepuasan mahasiswa terhadap layanan akademik", {
                objek: "Mahasiswa", 
                risiko: "Layanan akademik tidak memenuhi harapan mahasiswa.",
                mitigasi: "Survei kepuasan berkala dan tindak lanjut; pelatihan layanan akademik bagi staf.",
              }),
            ],
          },
        ],
      },
      {
        id: uid(), title: "C4. Dosen, Tenaga Kependidikan & Sumber Daya Manusia",
        subsections: [
          {
            id: uid(), title: "Kualifikasi dan Kinerja Dosen",
            fields: [
              mk("Dosen Tetap Penghitung Rasio (DTPR) berkualifikasi akademik minimal magister", {
                objek: "Dosen Tetap Penghitung Rasio", 
                risiko: "Dokumen kualifikasi tidak valid.",
                mitigasi: "Verifikasi melalui Verifikasi Ijazah Nasional (VIN) dan cek keabsahan di PD-Dikti.",
              }),
              mk("DTPR yang memiliki jabatan fungsional", {
                objek: "Dosen Tetap Penghitung Rasio", 
                target: "75",
                risiko: "Jumlah DTPR dengan jabatan fungsional rendah sehingga berdampak pada akreditasi.",
                mitigasi: "Pendampingan administrasi dan teknis kenaikan jabatan; insentif bagi dosen yang mencapai jabatan fungsional.",
              }),
              mk("Beban kerja DTPR sesuai EWMP (Ekuivalen Waktu Mengajar Penuh)", {
                objek: "Beban kerja dosen", 
                type: "quantitative", unit: "SKS", target: "12",
                risiko: "Beban kerja tidak sesuai ketentuan (terlalu tinggi/rendah); penelitian dan PkM tidak terpenuhi.",
                mitigasi: "Monitoring beban kerja dosen setiap semester; mendorong keterlibatan dosen dalam penelitian dan PkM.",
              }),
            ],
          },
          {
            id: uid(), title: "Pengembangan SDM",
            fields: [
              mk("DTPR yang melanjutkan pendidikan ke jenjang Doktoral (S3)", {
                objek: "Dosen Tetap Penghitung Rasio", 
                target: "10",
                risiko: "Rendahnya minat/kemampuan DTPR untuk studi lanjut.",
                mitigasi: "Pemberian beasiswa dan dukungan studi lanjut.",
              }),
              mk("Tenaga kependidikan yang memperoleh sertifikasi kompetensi", {
                objek: "Tenaga kependidikan", 
                target: "20",
                risiko: "Tenaga kependidikan tidak memiliki sertifikasi resmi.",
                mitigasi: "Fasilitasi pelatihan sertifikasi dan ujian kompetensi.",
              }),
            ],
          },
        ],
      },
      {
        id: uid(), title: "C5. Keuangan, Sarana dan Prasarana",
        subsections: [
          {
            id: uid(), title: "Pembiayaan",
            fields: [
              mk("Rasio biaya pembelajaran terhadap total dana", {
                objek: "Biaya pembelajaran",  target: "70",
                risiko: "Rasio terlalu tinggi dapat mengorbankan kebutuhan operasional lain.",
                mitigasi: "Monitoring dan evaluasi penggunaan dana secara berkala.",
              }),
              mk("Tingkat kepatuhan terhadap peraturan keuangan (opini audit eksternal)", {
                objek: "Dokumen",  unit: "status", target: "Wajar Tanpa Pengecualian (WTP)",
                type: "qualitative",
                risiko: "Keterlambatan penyampaian dokumen ke auditor.",
                mitigasi: "Menyiapkan dokumen jauh sebelum jadwal audit.",
              }),
            ],
          },
          {
            id: uid(), title: "Sarana dan Prasarana",
            fields: [
              mk("Ketersediaan dan kondisi fasilitas belajar (laboratorium, perpustakaan, ruang kelas)", {
                objek: "Sarana dan prasarana", 
                risiko: "Fasilitas rusak atau tidak memadai; mahasiswa tidak puas dengan fasilitas.",
                mitigasi: "Menyusun jadwal pemeliharaan rutin fasilitas.",
              }),
            ],
          },
        ],
      },
      {
        id: uid(), title: "C6. Kurikulum & Proses Pembelajaran",
        subsections: [
          {
            id: uid(), title: "Kurikulum dan Capaian Pembelajaran",
            fields: [
              mk("Ketersediaan dokumen CPL dan CPMK yang valid dan terintegrasi dengan kurikulum", {
                objek: "Dokumen", 
                risiko: "CPL-CPMK tidak terintegrasi; definisi tidak jelas.",
                mitigasi: "Validasi oleh tim akademik; pelatihan penyusunan CPL/CPMK.",
              }),
              mk("Rata-rata Indeks Prestasi Semester (IPS) mahasiswa", {
                objek: "Mahasiswa", 
                type: "quantitative", unit: "IPS", target: "3.00",
                risiko: "Penurunan IPS signifikan; ketidakseimbangan capaian antar semester.",
                mitigasi: "Sistem early warning akademik; bimbingan belajar tambahan.",
              }),
            ],
          },
          {
            id: uid(), title: "Proses dan Penilaian Pembelajaran",
            fields: [
              mk("Mata kuliah yang memenuhi minimal 7 dari 9 karakteristik proses pembelajaran (SN-Dikti)", {
                objek: "Mata kuliah", 
                risiko: "Desain pembelajaran tidak memenuhi standar karakteristik.",
                mitigasi: "Pelatihan dosen; review RPS sebelum semester dimulai.",
              }),
              mk("Persentase mahasiswa yang lulus tepat waktu", {
                objek: "Lulusan", 
                target: "70",
                risiko: "Banyak mahasiswa terlambat lulus.",
                mitigasi: "Monitoring kemajuan studi; mentoring intensif bagi mahasiswa berisiko terlambat.",
              }),
            ],
          },
        ],
      },
      {
        id: uid(), title: "C7. Penelitian",
        subsections: [
          {
            id: uid(), title: "Pengelolaan dan Hasil Penelitian",
            fields: [
              mk("Penelitian dilakukan sesuai standar metodologi dan etika penelitian", {
                objek: "Dokumen", 
                risiko: "Penelitian melanggar etika; metodologi tidak tepat.",
                mitigasi: "Review proposal oleh komite etik; pelatihan metodologi bagi peneliti.",
              }),
              mk("Jumlah publikasi DTPR dalam jurnal terakreditasi/bereputasi per tahun", {
                objek: "Publikasi", 
                type: "quantitative", unit: "publikasi/dosen/tahun", target: "1",
                risiko: "Publikasi rendah karena biaya atau kualitas riset yang belum memadai.",
                mitigasi: "Hibah publikasi; pendampingan penulisan artikel ilmiah.",
              }),
            ],
          },
        ],
      },
      {
        id: uid(), title: "C8. Pengabdian kepada Masyarakat (PkM)",
        subsections: [
          {
            id: uid(), title: "Pengelolaan dan Hasil PkM",
            fields: [
              mk("Persentase PkM yang sesuai dengan peta jalan (roadmap) PkM", {
                jenis: "IKT", objek: "PkM", 
                risiko: "Banyak PkM di luar fokus peta jalan; dana dan sumber daya terpecah.",
                mitigasi: "Filter proposal berbasis peta jalan; prioritas pendanaan untuk tema prioritas.",
              }),
              mk("Persentase kegiatan PkM yang dilaporkan dan dipublikasikan", {
                objek: "Publikasi", 
                target: "90",
                risiko: "Laporan terlambat atau tidak lengkap; publikasi hasil PkM minim.",
                mitigasi: "Standar format laporan; publikasi wajib di website/jurnal.",
              }),
            ],
          },
        ],
      },
      {
        id: uid(), title: "C9. Capaian Lulusan, Penelitian & PkM",
        subsections: [
          {
            id: uid(), title: "Kompetensi dan Prestasi Lulusan",
            fields: [
              mk("Lulusan yang berhasil mencapai Capaian Pembelajaran Lulusan (CPL)", {
                objek: "Lulusan", 
                risiko: "Sebagian lulusan tidak memenuhi CPL; penurunan kualitas lulusan.",
                mitigasi: "Monitoring capaian CPL tiap semester; perbaikan kurikulum dan pembelajaran.",
              }),
              mk("Rata-rata masa tunggu lulusan mendapatkan pekerjaan", {
                objek: "Lulusan", 
                type: "quantitative", unit: "bulan", target: "6", arah: "maks",
                risiko: "Masa tunggu lama; citra program studi menurun.",
                mitigasi: "Program magang industri; bursa kerja (job fair) rutin.",
              }),
              mk("Persentase lulusan yang bekerja sesuai bidang program studi", {
                objek: "Lulusan", 
                target: "75",
                risiko: "Banyak lulusan bekerja di luar bidang; kurikulum tidak relevan dengan kebutuhan industri.",
                mitigasi: "Sinkronisasi kurikulum dengan kebutuhan industri; tracer study rutin.",
              }),
            ],
          },
        ],
      },
    ],
  };
}

/* ---------------- DATA DEMO ----------------
   Dua skenario disiapkan supaya seluruh alur terlihat tanpa harus mengisi
   apa pun lebih dulu:

   1. "Sistem Informasi — 2025/2026 Genap" : siklus penuh. Template sudah
      ditetapkan, form sudah diisi lengkap oleh Kaprodi beserta dokumen
      pendukung, dan Penjamin Mutu sudah memberi skor + komentar pada semua
      indikator (status "reviewed", terkunci).

   2. "Teknik Informatika — 2026/2027 Ganjil" : baru sampai tahap penetapan
      template. Belum ada isian sama sekali, jadi form masih bisa diisi dan
      diubah berulang kali oleh Fakultas/Prodi. */

// Lampiran contoh: PDF kecil yang benar-benar bisa dibuka/diunduh.
const DEMO_DOC_B64 = "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA1OTUgODQyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCAzNzUgPj4Kc3RyZWFtCkJUIC9GMSAxMSBUZiA2MCA3NjAgVGQgMTYgVEwKKERPS1VNRU4gUEVORFVLVU5HIC0gQ09OVE9IKSBUaiBUKgooKSBUaiBUKgooQmVya2FzIGluaSBhZGFsYWggbGFtcGlyYW4gY29udG9oIHBhZGEgZGF0YSBkZW1vKSBUaiBUKgooU2lzdGVtIFBlbmlsYWlhbiBNdXR1IFBlbmRpZGlrYW4gKFNQTUkpLikgVGogVCoKKCkgVGogVCoKKFBhZGEgcGVuZ2d1bmFhbiBzdW5nZ3VoYW4sIGJlcmthcyBpbmkgZGlnYW50aSBkZW5nYW4pIFRqIFQqCihidWt0aSBkdWt1bmcgYXNsaTogU0ssIGxhcG9yYW4sIHJla2FwIGRhdGEsIGJlcml0YSBhY2FyYSwpIFRqIFQqCihkYWZ0YXIgaGFkaXIsIGF0YXUgZG9rdW1lbiBsYWluIHNlc3VhaSBpbmRpa2F0b3IuKSBUaiBUKgpFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDEgMDAwMDAgbiAKMDAwMDAwMDY2NyAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjczNwolJUVPRgo=";
const DEMO_DOC_DATA_URL = `data:application/pdf;base64,${DEMO_DOC_B64}`;

/* Realisasi, skor, dan komentar untuk template siklus penuh — berurutan
   mengikuti urutan indikator C1-C9 pada SEED_QA_TEMPLATE.
   Sengaja dibuat campuran: sebagian melampaui target, sebagian di bawah
   target, supaya penanda capaian dan tombol tindak lanjut PPEPP terlihat. */
const DEMO_ISIAN = [
  { v: "93", skor: 88, k: "Sosialisasi terdokumentasi baik, capaian di atas ambang batas.", doc: "Laporan_Sosialisasi_VMTS_2025.pdf" },
  { v: "100", skor: 90, k: "Matriks keselarasan VMTS-kurikulum lengkap untuk seluruh mata kuliah.", doc: "Matriks_Keselarasan_VMTS_Kurikulum.pdf" },
  { v: "100", skor: 86, k: "Daftar hadir dan berita acara tersedia, keterlibatan eksternal sudah nyata." , doc: "Berita_Acara_Penyusunan_VMTS.pdf" },
  { v: "100", skor: 89, k: "Dokumen tata pamong lengkap dan sudah memuat matriks mitigasi risiko.", doc: "Dokumen_Tata_Pamong_SOTK_2025.pdf" },
  { v: "79", skor: 83, k: "Kepuasan di atas target, namun tindak lanjut hasil survei perlu didokumentasikan lebih rapi.", doc: "Laporan_Survei_Kepuasan_2025.pdf" },
  { v: "100", skor: 85, k: "Prosedur kerja sama tersedia; monev kepuasan mitra sudah berjalan periodik." },
  { v: "100", skor: 84, k: "Siklus PPEPP berjalan penuh, bukti tiap tahap dapat ditelusuri.", doc: "Laporan_Siklus_PPEPP_2025.pdf" },
  { v: "100", skor: 88, k: "AMI terlaksana 1x setahun sesuai kebijakan, laporan temuan lengkap.", doc: "Laporan_AMI_2025.pdf" },
  { v: "96", skor: 76, k: "Masih ada pendaftar yang tidak menuntaskan seluruh tahapan seleksi. Sederhanakan tahapan sesuai rencana mitigasi." },
  { v: "38", skor: 68, k: "Rasio 1:38 melampaui batas 1:30. Rekrutmen dosen tetap perlu diprioritaskan pada periode berikutnya.", doc: "Rekap_Rasio_Dosen_Mahasiswa.pdf" },
  { v: "84", skor: 74, k: "Kepuasan layanan akademik belum mencapai target. Pelatihan staf layanan belum berjalan rutin." },
  { v: "100", skor: 90, k: "Seluruh DTPR berkualifikasi magister, ijazah terverifikasi.", doc: "Rekap_Kualifikasi_DTPR_2025.pdf" },
  { v: "62", skor: 70, k: "Jabatan fungsional masih di bawah 75%. Pendampingan administrasi kenaikan jabatan perlu diperkuat." },
  { v: "14", skor: 87, k: "Beban kerja berada dalam rentang EWMP 12-16 SKS.", doc: "Rekap_BKD_Genap_2025.pdf" },
  { v: "12", skor: 84, k: "Dua DTPR sedang menempuh S3, sudah melampaui target 10%." },
  { v: "15", skor: 72, k: "Sertifikasi kompetensi tendik masih di bawah target. Fasilitasi biaya ujian kompetensi perlu dianggarkan." },
  { v: "72", skor: 85, k: "Rasio biaya pembelajaran sehat dan terdokumentasi dalam laporan keuangan." },
  { v: "Opini Wajar Tanpa Pengecualian (WTP) dari KAP Iskandar dan Doni untuk tahun buku 2025. Laporan audit diterbitkan 25 Januari 2026 tanpa temuan material.", skor: 92, k: "Opini WTP tercapai sesuai target. Dokumen audit lengkap.", doc: "Laporan_Audit_Eksternal_2025.pdf" },
  { v: "88", skor: 75, k: "Empat laboratorium layak, satu perlu pembaruan. Susun jadwal pemeliharaan dan peremajaan." },
  { v: "100", skor: 88, k: "CPL dan CPMK tersedia untuk seluruh mata kuliah dan tervalidasi.", doc: "Dokumen_CPL_CPMK_2025.pdf" },
  { v: "3.21", skor: 86, k: "IPS rata-rata di atas 3,00. Sistem peringatan dini akademik berjalan." },
  { v: "91", skor: 77, k: "Sebagian RPS belum memuat minimal 7 dari 9 karakteristik. Review RPS sebelum semester berjalan." },
  { v: "74", skor: 82, k: "Kelulusan tepat waktu di atas target, mentoring skripsi efektif.", doc: "Rekap_Kelulusan_Tepat_Waktu.pdf" },
  { v: "100", skor: 85, k: "Seluruh penelitian melalui review etik dan sesuai metodologi." },
  { v: "1.3", skor: 84, k: "Publikasi per dosen melampaui target. Pertahankan skema bantuan publikasi.", doc: "Rekap_Publikasi_Dosen_2025.pdf" },
  { v: "82", skor: 73, k: "Sebagian PkM di luar peta jalan. Perketat seleksi proposal berbasis roadmap." },
  { v: "93", skor: 86, k: "Pelaporan dan publikasi PkM tertib, sebagian terbit di media lokal." },
  { v: "97", skor: 78, k: "Sebagian kecil lulusan belum memenuhi seluruh CPL. Perlu monitoring capaian per semester." },
  { v: "8.5", skor: 66, k: "Masa tunggu 8,5 bulan melebihi batas 6 bulan. Perbanyak job fair dan kerja sama penempatan kerja.", doc: "Laporan_Tracer_Study_2025.pdf" },
  { v: "68", skor: 71, k: "Kesesuaian bidang kerja masih di bawah 75%. Sinkronkan kurikulum dengan kebutuhan industri." },
];

/* Bangun submission lengkap (isian + penilaian) dari sebuah template. */
function buildDemoSubmission(template, pengisi, isian) {
  const fields = template.sections.flatMap((s) => s.subsections.flatMap((ss) => ss.fields));
  const answers = {};
  const reviews = {};

  fields.forEach((f, i) => {
    const d = isian[i];
    // Kalau daftar isian lebih pendek dari jumlah indikator, pakai target sebagai realisasi.
    const value = d ? d.v : f.target || "Terpenuhi sesuai dokumen pendukung.";
    answers[f.id] = {
      value: String(value),
      doc: d && d.doc
        ? { fileName: d.doc, fileSize: 920, fileType: "application/pdf", fileData: DEMO_DOC_DATA_URL }
        : null,
    };
    reviews[f.id] = {
      score: String(d ? d.skor : 80),
      comment: d ? d.k : "Bukti dukung memadai.",
    };
  });

  return {
    id: uid(),
    templateId: template.id,
    filledBy: pengisi.name,
    filledByEmail: pengisi.email,
    status: "reviewed",
    answers,
    reviews,
  };
}

function SEED_DEMO_DATA() {
  const users = SEED_USERS();
  const pengisi = users.find((u) => u.role === "pengisi");

  // Skenario 1 — siklus penuh, sudah dinilai
  const templateSelesai = SEED_QA_TEMPLATE({
    prodi: "Sistem Informasi",
    tahunAjaran: "2025/2026 Genap",
    periodeMulai: "2026-02-01",
    periodeAkhir: "2026-07-31",
    status: "published",
  });

  // Skenario 2 — baru template, form belum diisi & masih bisa diubah
  const templateBaru = SEED_QA_TEMPLATE({
    prodi: "Teknik Informatika",
    tahunAjaran: "2026/2027 Ganjil",
    periodeMulai: "2026-09-01",
    periodeAkhir: "2027-01-31",
    status: "published",
  });

  return {
    users,
    templates: [templateSelesai, templateBaru],
    submissions: [buildDemoSubmission(templateSelesai, pengisi, DEMO_ISIAN)],
  };
}

/* Data lama di localStorage tidak punya field jenis/objek. Tanpa backfill,
   strip target di form menampilkan "undefined". */
function migrateTemplates(list) {
  return list.map((t) => ({
    ...t,
    sections: (t.sections || []).map((s) => ({
      ...s,
      subsections: (s.subsections || []).map((ss) => ({
        ...ss,
        fields: (ss.fields || []).map((f) => ({
          jenis: "IKU",
          objek: "",
          arah: "min",
          target: "",
          risiko: "",
          mitigasi: "",
          tindakLanjutCatatan: "",
          ...f,
        })),
      })),
    })),
  }));
}

/* Pastikan ketiga role selalu punya minimal satu akun, supaya tidak ada menu
   yang tidak bisa dibuka sama sekali. */
function ensureAllRoles(list) {
  const next = [...list];
  SEED_USERS().forEach((seed) => {
    if (!next.some((u) => u.role === seed.role)) next.push(seed);
  });
  return next;
}

function useStore() {
  const [templates, setTemplates] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [rtlStore, setRtlStore] = useState({}); // keputusan RTL per templateId
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.templates || !parsed.templates.length) {
          // Data tersimpan tapi kosong -> muat ulang data demo
          const demo = SEED_DEMO_DATA();
          setTemplates(demo.templates);
          setSubmissions(demo.submissions);
          setUsers(demo.users);
        } else {
          setTemplates(migrateTemplates(parsed.templates));
          setSubmissions(parsed.submissions || []);
          setRtlStore(parsed.rtl || {});
          // Role yang belum ada di data lama ditambahkan supaya semua menu tetap terjangkau
          setUsers(ensureAllRoles(parsed.users && parsed.users.length ? parsed.users : SEED_USERS()));
        }
      } else {
        const demo = SEED_DEMO_DATA();
        setTemplates(demo.templates);
        setSubmissions(demo.submissions);
        setUsers(demo.users);
      }
    } catch (e) {
      const demo = SEED_DEMO_DATA();
      setTemplates(demo.templates);
      setSubmissions(demo.submissions);
      setUsers(demo.users);
    }
    setLoaded(true);
  }, []);

  const persist = (nextTemplates, nextSubmissions, nextUsers, nextRtl = rtlStore) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: DATA_VERSION, templates: nextTemplates, submissions: nextSubmissions, users: nextUsers, rtl: nextRtl })
      );
    } catch (e) {
      console.error("gagal menyimpan", e);
    }
  };

  const saveTemplates = (next) => {
    setTemplates(next);
    persist(next, submissions, users);
  };
  const saveSubmissions = (next) => {
    setSubmissions(next);
    persist(templates, next, users);
  };
  const saveUsers = (next) => {
    setUsers(next);
    persist(templates, submissions, next);
  };
  const saveRtl = (templateId, payload) => {
    const next = { ...rtlStore, [templateId]: payload };
    setRtlStore(next);
    persist(templates, submissions, users, next);
  };
  // Kunci periode asal + tambahkan template periode berikutnya dalam satu transaksi
  const applyRtl = (sourceId, lockedSource, newTemplate, payload) => {
    const nextTemplates = templates.map((t) => (t.id === sourceId ? lockedSource : t)).concat([newTemplate]);
    const nextRtl = { ...rtlStore, [sourceId]: { ...payload, status: "disetujui", disetujuiPada: new Date().toISOString() } };
    setTemplates(nextTemplates);
    setRtlStore(nextRtl);
    persist(nextTemplates, submissions, users, nextRtl);
    return newTemplate;
  };
  // Kembalikan ke data contoh — dipakai kalau data lama di browser sudah tidak
  // cocok dengan struktur indikator yang baru.
  const resetData = () => {
    const demo = SEED_DEMO_DATA();
    setTemplates(demo.templates);
    setSubmissions(demo.submissions);
    setUsers(demo.users);
    setRtlStore({});
    persist(demo.templates, demo.submissions, demo.users, {});
  };

  return { templates, submissions, users, rtlStore, saveTemplates, saveSubmissions, saveUsers, saveRtl, applyRtl, resetData, loaded };
}

function Badge({ children, tone = "default" }) {
  const tones = {
    default: { background: "var(--gold-soft)", color: "var(--ink)" },
    good: { background: "var(--good-bg)", color: "var(--good)" },
    warn: { background: "var(--warn-bg)", color: "var(--warn)" },
    muted: { background: "#EEF0EC", color: "var(--muted)" },
  };
  return (
    <span
      className="sans"
      style={{
        ...tones[tone],
        fontSize: 12,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 20,
        display: "inline-block",
      }}
    >
      {children}
    </span>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="sans" style={{ display: "block", marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{hint}</div>}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 14,
  fontFamily: "Inter, sans-serif",
  color: "var(--ink)",
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
};

function TextInput(props) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}
function TextArea(props) {
  return <textarea {...props} style={{ ...inputStyle, minHeight: 90, resize: "vertical", ...(props.style || {}) }} />;
}
function Select(props) {
  return <select {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}

function Btn({ children, onClick, variant = "primary", icon: Icon, disabled, type = "button", small }) {
  const variants = {
    primary: { background: "var(--ink)", color: "#fff", border: "1px solid var(--ink)" },
    gold: { background: "var(--gold)", color: "#fff", border: "1px solid var(--gold)" },
    outline: { background: "#fff", color: "var(--ink)", border: "1px solid var(--border)" },
    ghost: { background: "transparent", color: "var(--muted)", border: "1px solid transparent" },
    danger: { background: "#fff", color: "var(--warn)", border: "1px solid var(--warn-bg)" },
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="sans"
      style={{
        ...variants[variant],
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: small ? 13 : 14,
        fontWeight: 600,
        padding: small ? "6px 12px" : "9px 16px",
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "opacity .15s",
      }}
    >
      {Icon && <Icon size={small ? 14 : 15} />}
      {children}
    </button>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ---------------- STRIP ACUAN INDIKATOR ----------------
   Dipakai di form pengisi & lembar penilaian: menampilkan target ideal,
   objek, satuan, jenis indikator, serta potensi risiko dan mitigasinya
   supaya pengisi tahu ambang batas yang harus dicapai sebelum mengisi
   realisasi — bukan mengisi angka tanpa acuan. */
function TargetStrip({ field, openRiskByDefault = false }) {
  const [showRisk, setShowRisk] = useState(openRiskByDefault);
  const cells = [
    { label: "Jenis", value: field.jenis || "—" },
    { label: "Objek", value: field.objek || "—" },
    ...(field.type === "quantitative" ? [{ label: "Satuan", value: field.unit || "—" }] : []),
    { label: "Target ideal", value: targetLabel(field), strong: true },
  ];
  const hasRisk = Boolean(field.risiko || field.mitigasi);

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--gold)",
        borderRadius: 8,
        background: "#FCFCFB",
        padding: "9px 12px",
        marginBottom: 10,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 22px", alignItems: "baseline" }}>
        {cells.map((c) => (
          <div key={c.label} className="sans" style={{ fontSize: 12 }}>
            <span style={{ color: "var(--muted)" }}>{c.label}: </span>
            <span style={{ color: c.strong ? "var(--gold)" : "var(--ink)", fontWeight: c.strong ? 700 : 500 }}>
              {c.value}
            </span>
          </div>
        ))}
        {hasRisk && (
          <button
            onClick={() => setShowRisk((v) => !v)}
            className="sans"
            style={{ border: "none", background: "transparent", color: "var(--muted)", fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline" }}
          >
            {showRisk ? "Sembunyikan risiko & mitigasi" : "Lihat risiko & mitigasi"}
          </button>
        )}
      </div>

      {hasRisk && showRisk && (
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="sans" style={{ fontSize: 12, lineHeight: 1.5 }}>
            <div style={{ color: "var(--warn)", fontWeight: 700, marginBottom: 2 }}>Potensi risiko</div>
            <div style={{ color: "var(--muted)" }}>{field.risiko || "—"}</div>
          </div>
          <div className="sans" style={{ fontSize: 12, lineHeight: 1.5 }}>
            <div style={{ color: "var(--good)", fontWeight: 700, marginBottom: 2 }}>Mitigasi risiko</div>
            <div style={{ color: "var(--muted)" }}>{field.mitigasi || "—"}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- MENU PER ROLE (kontrol akses) ---------------- */
const MENUS_BY_ROLE = {
  admin: [
    { id: "templates", label: "Manajemen Template", icon: LayoutTemplate, desc: "Susun kriteria mutu" },
    { id: "rtm", label: "Tindak Lanjut & RTM", icon: TrendingUp, desc: "Turunkan ke periode berikutnya" },
    { id: "users", label: "Manajemen Pengguna", icon: Users, desc: "Kelola akun & role" },
  ],
  pengisi: [
    { id: "form", label: "Form Penilaian", icon: BookOpen, desc: "Isi kriteria mutu" },
  ],
  penjamin: [
    { id: "review", label: "Penilaian Mutu", icon: ClipboardCheck, desc: "Beri skor & komentar" },
  ],
};

const ROLE_LABEL = { admin: "Admin Mutu", pengisi: "Fakultas / Prodi", penjamin: "Penjamin Mutu" };
const ROLE_TONE = { admin: "default", pengisi: "good", penjamin: "warn" };

/* ---------------- SIDEBAR ---------------- */
function Sidebar({ users, currentUser, onSwitchUser, section, setSection, onReset }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const menus = MENUS_BY_ROLE[currentUser?.role] || [];

  return (
    <div
      className="sans"
      style={{
        width: 260,
        flexShrink: 0,
        background: "var(--ink)",
        color: "#fff",
        minHeight: "100vh",
        padding: "28px 18px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ marginBottom: 24, paddingLeft: 6 }}>
        <div className="serif" style={{ fontSize: 19, fontWeight: 700, letterSpacing: 0.2 }}>Mutu Akademik</div>
        <div style={{ fontSize: 12.5, color: "#B7C1D6", marginTop: 3 }}>Sistem penilaian kriteria mutu</div>
      </div>

      {/* Current user / simulasi login */}
      <div style={{ marginBottom: 24, position: "relative" }}>
        <div style={{ fontSize: 11.5, color: "#8492AE", fontWeight: 600, marginBottom: 8, paddingLeft: 6 }}>
          Masuk sebagai
        </div>
        <button
          onClick={() => setPickerOpen((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            cursor: "pointer",
            color: "#fff",
            textAlign: "left",
          }}
        >
          <div
            style={{
              width: 32, height: 32, borderRadius: "50%", background: "var(--gold)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}
          >
            {(currentUser?.name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {currentUser?.name || "Belum ada pengguna"}
            </div>
            <div style={{ fontSize: 11, color: "#B7C1D6" }}>{ROLE_LABEL[currentUser?.role]}</div>
          </div>
          <ChevronDown size={15} style={{ opacity: 0.7, flexShrink: 0 }} />
        </button>

        {pickerOpen && (
          <div
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20,
              background: "#fff", borderRadius: 10, boxShadow: "0 12px 28px rgba(0,0,0,0.25)",
              overflow: "hidden", maxHeight: 260, overflowY: "auto",
            }}
          >
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  onSwitchUser(u.id);
                  setPickerOpen(false);
                }}
                style={{
                  width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start",
                  padding: "9px 12px", border: "none", borderBottom: "1px solid #F0F0EE",
                  background: currentUser?.id === u.id ? "var(--bg)" : "#fff", cursor: "pointer", textAlign: "left",
                }}
              >
                <span className="sans" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{u.name}</span>
                <span className="sans" style={{ fontSize: 11.5, color: "var(--muted)" }}>{u.email} · {ROLE_LABEL[u.role]}</span>
              </button>
            ))}
            {users.length === 0 && (
              <div className="sans" style={{ padding: 12, fontSize: 12.5, color: "var(--muted)" }}>Belum ada pengguna.</div>
            )}
          </div>
        )}
      </div>

      <div style={{ fontSize: 11.5, color: "#8492AE", fontWeight: 600, marginBottom: 10, paddingLeft: 6 }}>
        Menu {ROLE_LABEL[currentUser?.role]}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 30 }}>
        {menus.map((m) => {
          const active = section === m.id;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => setSection(m.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                textAlign: "left",
                padding: "10px 10px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                background: active ? "rgba(255,255,255,0.1)" : "transparent",
                color: active ? "#fff" : "#B7C1D6",
              }}
            >
              <Icon size={17} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.label}</div>
                <div style={{ fontSize: 11.5, opacity: 0.75 }}>{m.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 16, fontSize: 11.5, color: "#7C88A3", lineHeight: 1.6 }}>
        Menu yang tampil menyesuaikan role pengguna yang sedang login. Ganti pengguna di atas untuk mensimulasikan akses role lain.
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="sans"
            style={{ display: "block", marginTop: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.18)", color: "#B7C1D6", fontSize: 11.5, padding: "6px 10px", borderRadius: 7, cursor: "pointer" }}
          >
            Reset ke data contoh
          </button>
        ) : (
          <div style={{ marginTop: 12 }}>
            <div style={{ color: "#E8B4A0", marginBottom: 8 }}>
              Seluruh template, isian, dan penilaian di browser ini akan dihapus dan diganti data contoh. Lanjutkan?
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => { onReset && onReset(); setConfirmReset(false); }}
                className="sans"
                style={{ background: "#fff", border: "none", color: "var(--ink)", fontSize: 11.5, fontWeight: 600, padding: "6px 10px", borderRadius: 7, cursor: "pointer" }}
              >
                Ya, reset
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="sans"
                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.18)", color: "#B7C1D6", fontSize: 11.5, padding: "6px 10px", borderRadius: 7, cursor: "pointer" }}
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- ADMIN: MANAJEMEN PENGGUNA ---------------- */
function UserManagement({ users, onAdd, onDelete, currentUser }) {
  const [form, setForm] = useState(EMPTY_USER());
  const [error, setError] = useState("");

  const submit = () => {
    if (!form.name.trim() || !form.email.trim()) {
      setError("Nama dan email wajib diisi.");
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(form.email.trim())) {
      setError("Format email tidak valid.");
      return;
    }
    if (users.some((u) => u.email.toLowerCase() === form.email.trim().toLowerCase())) {
      setError("Email sudah terdaftar.");
      return;
    }
    onAdd({ ...form, id: uid(), name: form.name.trim(), email: form.email.trim() });
    setForm(EMPTY_USER());
    setError("");
  };

  return (
    <div>
      <h1 className="serif" style={{ fontSize: 26, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
        Manajemen pengguna
      </h1>
      <p className="sans" style={{ color: "var(--muted)", fontSize: 14, marginTop: 6, marginBottom: 22 }}>
        Tambahkan pengguna beserta email dan role-nya. Role menentukan menu dan akses yang tersedia bagi pengguna tersebut.
      </p>

      <Card style={{ padding: 20, marginBottom: 22 }}>
        <div className="serif" style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 14 }}>
          Tambah pengguna baru
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.4fr 1fr auto", gap: 12, alignItems: "start" }}>
          <Field label="Nama lengkap">
            <TextInput placeholder="contoh: Dr. Ayu Lestari" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <TextInput type="email" placeholder="nama@kampus.ac.id" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </Select>
          </Field>
          <div style={{ paddingTop: 24 }}>
            <Btn variant="gold" icon={UserPlus} onClick={submit}>Tambah</Btn>
          </div>
        </div>
        {error && <div className="sans" style={{ color: "var(--warn)", fontSize: 12.5, marginTop: 4 }}>{error}</div>}
      </Card>

      <div className="serif" style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
        Daftar pengguna ({users.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {users.map((u) => (
          <Card key={u.id} style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 34, height: 34, borderRadius: "50%", background: "var(--gold-soft)", color: "var(--gold)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
                }}
              >
                {u.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="sans" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                  {u.name} {currentUser?.id === u.id && <span style={{ color: "var(--gold)", fontWeight: 600 }}>(Anda)</span>}
                </div>
                <div className="sans" style={{ fontSize: 12.5, color: "var(--muted)" }}>{u.email}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
              <button
                onClick={() => onDelete(u.id)}
                disabled={currentUser?.id === u.id}
                style={{ border: "none", background: "transparent", cursor: currentUser?.id === u.id ? "not-allowed" : "pointer", color: "var(--muted)", opacity: currentUser?.id === u.id ? 0.35 : 1 }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------- ADMIN: TEMPLATE LIST ---------------- */
function AdminList({ templates, onNew, onOpen, onDelete }) {
  const [q, setQ] = useState("");
  const filtered = templates.filter((t) =>
    [t.jenjang, t.fakultas, t.prodi, t.tahunAjaran].join(" ").toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 }}>
        <div>
          <h1 className="serif" style={{ fontSize: 26, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
            Template kriteria penilaian
          </h1>
          <p className="sans" style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>
            Susun kriteria mutu per jenjang, fakultas, prodi, dan tahun ajaran.
          </p>
        </div>
        <Btn icon={Plus} variant="gold" onClick={onNew}>Buat template</Btn>
      </div>

      <div style={{ position: "relative", maxWidth: 340, marginBottom: 20 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: 11, color: "var(--muted)" }} />
        <TextInput placeholder="Cari fakultas, prodi, jenjang..." value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 34 }} />
      </div>

      {filtered.length === 0 && (
        <Card style={{ padding: 40, textAlign: "center" }}>
          <div className="sans" style={{ color: "var(--muted)", fontSize: 14 }}>
            Belum ada template. Buat template pertama untuk mulai menyusun kriteria penilaian mutu.
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {filtered.map((t) => {
          const fieldCount = t.sections.reduce((a, s) => a + s.subsections.reduce((b, ss) => b + ss.fields.length, 0), 0);
          return (
            <Card key={t.id} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Badge tone={t.status === "published" ? "good" : "muted"}>
                  {t.status === "published" ? "Aktif" : "Draf"}
                </Badge>
                <button
                  onClick={() => onDelete(t.id)}
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)" }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="serif" style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
                {t.prodi || "Prodi belum diisi"}
              </div>
              <div className="sans" style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>
                {t.fakultas || "—"} · {t.jenjang || "—"}<br />
                Tahun ajaran {t.tahunAjaran || "—"}
                {(t.periodeMulai || t.periodeAkhir) && (
                  <><br />Periode: {t.periodeMulai || "?"} – {t.periodeAkhir || "?"}</>
                )}
              </div>
              <div className="sans" style={{ fontSize: 12.5, color: "var(--gold)", fontWeight: 600 }}>
                {t.sections.length} bagian · {fieldCount} kriteria
              </div>
              <Btn variant="outline" small onClick={() => onOpen(t.id)}>Kelola template</Btn>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- ADMIN: TEMPLATE BUILDER ---------------- */
function TemplateBuilder({ template, onChange, onBack, onSave, submissions = [] }) {
  const ro = !!template.terkunci; // periode sudah dikunci RTM -> hanya bisa dibaca
  const update = (patch) => onChange({ ...template, ...patch });

  const updateSection = (sid, patch) =>
    update({ sections: template.sections.map((s) => (s.id === sid ? { ...s, ...patch } : s)) });
  const removeSection = (sid) => update({ sections: template.sections.filter((s) => s.id !== sid) });
  const addSection = () => update({ sections: [...template.sections, EMPTY_SECTION()] });

  const updateSub = (sid, subid, patch) =>
    updateSection(sid, {
      subsections: template.sections.find((s) => s.id === sid).subsections.map((ss) => (ss.id === subid ? { ...ss, ...patch } : ss)),
    });
  const removeSub = (sid, subid) =>
    updateSection(sid, { subsections: template.sections.find((s) => s.id === sid).subsections.filter((ss) => ss.id !== subid) });
  const addSub = (sid) =>
    updateSection(sid, { subsections: [...template.sections.find((s) => s.id === sid).subsections, EMPTY_SUBSECTION()] });

  const updateField = (sid, subid, fid, patch) => {
    const sub = template.sections.find((s) => s.id === sid).subsections.find((ss) => ss.id === subid);
    updateSub(sid, subid, { fields: sub.fields.map((f) => (f.id === fid ? { ...f, ...patch } : f)) });
  };
  const removeField = (sid, subid, fid) => {
    const sub = template.sections.find((s) => s.id === sid).subsections.find((ss) => ss.id === subid);
    updateSub(sid, subid, { fields: sub.fields.filter((f) => f.id !== fid) });
  };
  const addField = (sid, subid) => {
    const sub = template.sections.find((s) => s.id === sid).subsections.find((ss) => ss.id === subid);
    updateSub(sid, subid, { fields: [...sub.fields, EMPTY_FIELD()] });
  };
  const insertFieldAfter = (sid, subid, fid, newField) => {
    const sub = template.sections.find((s) => s.id === sid).subsections.find((ss) => ss.id === subid);
    const idx = sub.fields.findIndex((f) => f.id === fid);
    const nextFields = [...sub.fields];
    nextFields.splice(idx + 1, 0, newField);
    updateSub(sid, subid, { fields: nextFields });
  };

  return (
    <div>
      <button onClick={onBack} className="sans" style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer", marginBottom: 18 }}>
        <ArrowLeft size={14} /> Kembali ke daftar template
      </button>

      {ro && (
        <Card style={{ padding: 16, marginBottom: 18, borderLeft: "3px solid var(--gold)", background: "#FCFCFB" }}>
          <div className="sans" style={{ fontSize: 13, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8, lineHeight: 1.6 }}>
            <Lock size={15} />
            <span>
              <strong>Periode terkunci.</strong> Keputusan RTM atas periode ini sudah disetujui, jadi seluruh isinya dibaca saja
              sebagai riwayat. Target yang diperbarui berada di template periode berikutnya.
            </span>
          </div>
        </Card>
      )}

      <Card style={{ padding: 22, marginBottom: 20 }}>
        <div className="serif" style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>
          Identitas template
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0 20px" }}>
          <Field label="Jenjang">
            <Select disabled={ro} value={template.jenjang} onChange={(e) => update({ jenjang: e.target.value })}>
              <option value="">Pilih jenjang</option>
              <option>D3</option><option>D4</option><option>S1</option><option>S2</option><option>S3</option><option>Profesi</option>
            </Select>
          </Field>
          <Field label="Tahun ajaran">
            <TextInput disabled={ro} placeholder="contoh: 2026/2027 Ganjil" value={template.tahunAjaran} onChange={(e) => update({ tahunAjaran: e.target.value })} />
          </Field>
          <Field label="Fakultas">
            <TextInput disabled={ro} placeholder="contoh: Fakultas Teknik" value={template.fakultas} onChange={(e) => update({ fakultas: e.target.value })} />
          </Field>
          <Field label="Program studi">
            <TextInput disabled={ro} placeholder="contoh: Teknik Informatika" value={template.prodi} onChange={(e) => update({ prodi: e.target.value })} />
          </Field>
          <Field label="Periode mulai penilaian">
            <TextInput disabled={ro} type="date" value={template.periodeMulai} onChange={(e) => update({ periodeMulai: e.target.value })} />
          </Field>
          <Field label="Periode akhir penilaian">
            <TextInput disabled={ro} type="date" value={template.periodeAkhir} onChange={(e) => update({ periodeAkhir: e.target.value })} />
          </Field>
        </div>
      </Card>

      <div className="serif" style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
        Bagian & kriteria penilaian
      </div>
      {template.asalTahunAjaran && (
        <div className="sans" style={{ fontSize: 12.5, color: "var(--gold)", fontWeight: 600, marginBottom: 6 }}>
          Diturunkan dari keputusan RTM periode {template.asalTahunAjaran}
        </div>
      )}
      <p className="sans" style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 0, marginBottom: 16, maxWidth: 720 }}>
        Setiap indikator dilengkapi jenis (IKU/IKT), objek, satuan, arah dan ambang batas target, potensi risiko, serta mitigasi
        risiko sesuai matriks Standar Mutu Berbasis Risiko. Status capaian dihitung otomatis dari realisasi yang dikirim prodi.
        Keputusan tindak lanjutnya — dilanjutkan, diperketat, atau ditambah indikator baru — <strong>tidak diubah di sini</strong>,
        melainkan dikumpulkan di menu <strong>Tindak Lanjut &amp; RTM</strong> lalu diterapkan sekaligus ke template periode
        berikutnya, supaya data periode ini tetap utuh sebagai riwayat.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
        {template.sections.map((section, si) => (
          <Card key={section.id} style={{ padding: 20 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
              <span className="sans" style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)", width: 22 }}>{si + 1}.</span>
              <TextInput disabled={ro}
                placeholder="Nama bagian, contoh: Kurikulum & Pembelajaran"
                value={section.title}
                onChange={(e) => updateSection(section.id, { title: e.target.value })}
                style={{ fontWeight: 600 }}
              />
              <button disabled={ro} onClick={() => removeSection(section.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)" }}>
                <Trash2 size={15} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingLeft: 32 }}>
              {section.subsections.map((sub, subi) => (
                <div key={sub.id} style={{ borderLeft: "2px solid var(--gold-soft)", paddingLeft: 16, paddingTop: 4, paddingBottom: 4 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                    <TextInput disabled={ro}
                      placeholder="Sub bagian, contoh: Ketersediaan dokumen kurikulum"
                      value={sub.title}
                      onChange={(e) => updateSub(section.id, sub.id, { title: e.target.value })}
                    />
                    <button disabled={ro} onClick={() => removeSub(section.id, sub.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {sub.fields.map((f) => {
                      const achievement = computeAchievement(f, submissions, template.id);
                      return (
                        <div key={f.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, background: "#FCFCFB" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 32px", gap: 8, alignItems: "center" }}>
                            <TextInput disabled={ro}
                              placeholder="Pernyataan indikator, contoh: Rasio dosen tetap terhadap mahasiswa"
                              value={f.label}
                              onChange={(e) => updateField(section.id, sub.id, f.id, { label: e.target.value })}
                            />
                            <button disabled={ro} onClick={() => removeField(section.id, sub.id, f.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)" }}>
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "82px 130px 1fr 100px 96px 100px", gap: 8, marginTop: 8 }}>
                            <Select disabled={ro}
                              value={f.jenis}
                              onChange={(e) => updateField(section.id, sub.id, f.id, { jenis: e.target.value })}
                              title="Jenis indikator: IKU (utama) atau IKT (tambahan)"
                              style={{ fontSize: 12.5, padding: "8px 8px" }}
                            >
                              {JENIS_OPTIONS.map((j) => <option key={j} value={j}>{j}</option>)}
                            </Select>
                            <Select disabled={ro}
                              value={f.type}
                              onChange={(e) => updateField(section.id, sub.id, f.id, { type: e.target.value })}
                              style={{ fontSize: 12.5, padding: "8px 8px" }}
                            >
                              <option value="qualitative">Kualitatif</option>
                              <option value="quantitative">Kuantitatif</option>
                            </Select>
                            <TextInput disabled={ro}
                              placeholder="Objek, mis. Dosen / Mahasiswa / Dokumen"
                              value={f.objek}
                              onChange={(e) => updateField(section.id, sub.id, f.id, { objek: e.target.value })}
                              title="Objek yang diukur"
                              style={{ fontSize: 12.5, padding: "8px 10px" }}
                            />
                            {f.type === "quantitative" ? (
                              <TextInput disabled={ro}
                                placeholder="Satuan"
                                value={f.unit}
                                onChange={(e) => updateField(section.id, sub.id, f.id, { unit: e.target.value })}
                                style={{ fontSize: 12.5, padding: "8px 10px" }}
                              />
                            ) : (
                              <div />
                            )}
                            {f.type === "quantitative" ? (
                              <Select disabled={ro}
                                value={f.arah}
                                onChange={(e) => updateField(section.id, sub.id, f.id, { arah: e.target.value })}
                                title="Arah target: minimal (semakin tinggi semakin baik) atau maksimal (semakin rendah semakin baik)"
                                style={{ fontSize: 12.5, padding: "8px 6px" }}
                              >
                                {ARAH_OPTIONS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                              </Select>
                            ) : (
                              <div />
                            )}
                            <TextInput disabled={ro}
                              placeholder={f.type === "quantitative" ? "Target ideal" : "Target (teks)"}
                              value={f.target}
                              onChange={(e) => updateField(section.id, sub.id, f.id, { target: e.target.value })}
                              title="Ambang batas / target ideal capaian"
                              style={{ fontSize: 12.5, padding: "8px 10px" }}
                            />
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                            <TextArea disabled={ro}
                              placeholder="Potensi risiko bila standar tidak terpenuhi..."
                              value={f.risiko}
                              onChange={(e) => updateField(section.id, sub.id, f.id, { risiko: e.target.value })}
                              style={{ minHeight: 54, fontSize: 12.5 }}
                            />
                            <TextArea disabled={ro}
                              placeholder="Langkah mitigasi risiko..."
                              value={f.mitigasi}
                              onChange={(e) => updateField(section.id, sub.id, f.id, { mitigasi: e.target.value })}
                              style={{ minHeight: 54, fontSize: 12.5 }}
                            />
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                            {achievement.status === "tercapai" && <Badge tone="good">Tercapai ({achievement.avg.toFixed(1)} vs {achievement.targetNum})</Badge>}
                            {achievement.status === "belum" && <Badge tone="warn">Belum tercapai ({achievement.avg.toFixed(1)} vs {achievement.targetNum})</Badge>}
                            {achievement.status === "no-data" && <Badge tone="muted">Belum ada data realisasi</Badge>}
                            {achievement.status === "no-target" && <Badge tone="muted">Target non-angka</Badge>}
                          </div>
                          {f.tindakLanjutCatatan && (
                            <div className="sans" style={{ fontSize: 11.5, color: "var(--gold)", marginTop: 6, fontStyle: "italic", lineHeight: 1.55 }}>
                              Tindak lanjut: {f.tindakLanjutCatatan}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Btn disabled={ro} variant="ghost" small icon={Plus} onClick={() => addField(section.id, sub.id)}>Tambah kriteria</Btn>
                  </div>
                </div>
              ))}
              <div>
                <Btn disabled={ro} variant="outline" small icon={Plus} onClick={() => addSub(section.id)}>Tambah sub bagian</Btn>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 26 }}>
        <Btn disabled={ro} variant="outline" icon={Plus} onClick={addSection}>Tambah bagian</Btn>
      </div>

      {template.terkunci ? (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, marginBottom: 20 }}>
          <div className="sans" style={{ fontSize: 13, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8, lineHeight: 1.6 }}>
            <Lock size={15} />
            Periode ini sudah terkunci lewat RTM, jadi isinya tidak dapat diubah lagi. Perubahan target dilakukan pada template
            periode berikutnya yang dihasilkan dari Rencana Tindak Lanjut.
          </div>
        </div>
      ) : template.status === "published" ? (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Btn variant="gold" icon={Check} onClick={() => onSave(template, "published")}>Simpan perubahan</Btn>
            <Btn variant="outline" onClick={() => onSave(template, "draft")}>Tarik dari peredaran (jadikan draf)</Btn>
          </div>
          <div className="sans" style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10, maxWidth: 640, lineHeight: 1.6 }}>
            Template ini sudah terbit dan bisa diisi Fakultas/Prodi. <strong>Simpan perubahan</strong> mempertahankan statusnya tetap
            terbit. <strong>Tarik dari peredaran</strong> mengembalikannya ke draf sehingga hilang dari daftar form pengisi —
            isian yang sudah masuk tidak terhapus.
          </div>
        </div>
      ) : (
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn variant="outline" icon={Save} onClick={() => onSave(template, "draft")}>Simpan sebagai draf</Btn>
            <Btn variant="gold" icon={Check} onClick={() => onSave(template, "published")}>Terbitkan template</Btn>
          </div>
          <div className="sans" style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10, maxWidth: 640, lineHeight: 1.6 }}>
            Draf belum terlihat oleh Fakultas/Prodi. Terbitkan template supaya muncul di daftar form pengisian.
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- RENCANA TINDAK LANJUT (RTL) & RTM ----------------
   Alur yang dipakai mengikuti tahap Pengendalian & Peningkatan pada siklus
   PPEPP:

   1. Penjamin Mutu menyelesaikan penilaian  ->  capaian tiap indikator
      diketahui (tercapai / belum tercapai).
   2. Sistem menyusun DRAF RTL otomatis: satu baris per indikator, dengan
      usulan keputusan sesuai arahan pedoman —
         belum tercapai  -> "Lanjutkan target yang sama"
         sudah tercapai  -> "Perketat ambang batas" (atau tambah indikator baru)
   3. RTM (Rapat Tinjauan Manajemen) memutuskan tiap baris, melengkapi akar
      masalah, penanggung jawab, dan tenggat.
   4. Sekali disetujui, periode asal DIKUNCI sebagai riwayat, dan sistem
      MENURUNKAN seluruh keputusan itu menjadi template periode berikutnya
      (status draf) — jadi tindak lanjut benar-benar terpakai, bukan hanya
      tercatat di notulen. */

const KEPUTUSAN_OPTIONS = [
  { id: "lanjutkan", label: "Lanjutkan target yang sama", untuk: "belum" },
  { id: "perketat", label: "Perketat ambang batas", untuk: "tercapai" },
  { id: "indikator_baru", label: "Tambah indikator baru", untuk: "tercapai" },
  { id: "terima_risiko", label: "Target dipertahankan (terima risiko)", untuk: "semua" },
];
const KEPUTUSAN_LABEL = Object.fromEntries(KEPUTUSAN_OPTIONS.map((k) => [k.id, k.label]));

/* Indikator yang targetnya sudah menyentuh plafon tidak bisa diperketat lagi —
   mis. 100% atau IPK 4,00. Untuk kasus ini satu-satunya peningkatan yang masuk
   akal adalah menambah indikator baru, bukan menaikkan angka jadi 105%. */
function plafonTarget(field) {
  const u = (field.unit || "").toLowerCase();
  if (u.includes("%") || u.includes("persen")) return 100;
  if (u.includes("ipk") || u.includes("ips")) return 4;
  return null;
}
function sudahDiPlafon(field) {
  const num = Number(field.target);
  const plafon = plafonTarget(field);
  if (isNaN(num) || plafon === null) return false;
  return field.arah === "maks" ? num <= 0 : num >= plafon;
}

/* Angka target yang lebih ketat: naik untuk target minimal, turun untuk maksimal.
   Langkahnya menyesuaikan skala indikator — 5% dari nilai sekarang, dengan
   batas bawah 0,1 untuk skala IPK/IPS dan 1 untuk persen maupun satuan hitungan,
   supaya target 3,00 tidak melompat ke 4,00 dalam satu periode. */
function targetDiperketat(field, langkahPersen = 5) {
  const num = Number(field.target);
  if (isNaN(num)) return field.target;
  const plafon = plafonTarget(field);
  const minLangkah = plafon === 4 ? 0.1 : 1;
  const langkah = Math.max(minLangkah, Math.abs(num) * (langkahPersen / 100));
  let baru = field.arah === "maks" ? Math.max(0, num - langkah) : num + langkah;
  if (plafon !== null && field.arah !== "maks") baru = Math.min(baru, plafon);
  return (Math.round(baru * 100) / 100).toString();
}

/* Draf RTL otomatis dari hasil penilaian satu periode. */
function buildRtlRows(template, submissions) {
  const rows = [];
  template.sections.forEach((s) =>
    s.subsections.forEach((ss) =>
      ss.fields.forEach((f) => {
        const a = computeAchievement(f, submissions, template.id);
        const diPlafon = sudahDiPlafon(f);
        const usulan =
          a.status === "tercapai"
            ? diPlafon ? "indikator_baru" : "perketat"
            : a.status === "belum" ? "lanjutkan" : "terima_risiko";
        rows.push({
          fieldId: f.id,
          bagian: s.title,
          label: f.label,
          jenis: f.jenis,
          unit: f.unit,
          arah: f.arah,
          diPlafon,
          targetLama: f.target,
          realisasi: a.avg === null ? null : Math.round(a.avg * 100) / 100,
          capaian: a.status,
          keputusan: usulan,
          targetBaru: usulan === "perketat" ? targetDiperketat(f) : f.target,
          indikatorBaruLabel: "",
          akarMasalah: "",
          penanggungJawab: "",
          tenggat: "",
        });
      })
    )
  );
  return rows;
}

/* Gabungkan draf otomatis dengan keputusan yang sudah pernah disunting,
   supaya suntingan tidak hilang saat data indikator berubah. */
function mergeRtlRows(draft, saved) {
  if (!saved || !saved.length) return draft;
  const byId = Object.fromEntries(saved.map((r) => [r.fieldId, r]));
  return draft.map((r) => (byId[r.fieldId] ? { ...r, ...byId[r.fieldId], capaian: r.capaian, realisasi: r.realisasi, targetLama: r.targetLama } : r));
}

function rtlRowSiap(row) {
  if (!row.keputusan) return false;
  if (row.keputusan === "perketat" && String(row.targetBaru).trim() === "") return false;
  if (row.keputusan === "indikator_baru" && row.indikatorBaruLabel.trim() === "") return false;
  if (row.capaian === "belum" && row.akarMasalah.trim() === "") return false;
  return true;
}

/* Turunkan seluruh keputusan RTL menjadi template periode berikutnya. */
function turunkanKePeriodeBerikutnya(source, rows, identitasBaru) {
  const byId = Object.fromEntries(rows.map((r) => [r.fieldId, r]));
  const asal = source.tahunAjaran || "periode sebelumnya";

  const olahField = (f) => {
    const r = byId[f.id];
    const base = {
      ...JSON.parse(JSON.stringify(f)),
      id: uid(),
      asalFieldId: f.id,
      tindakLanjutCatatan: "",
    };
    if (!r) return [base];

    const jejak = [];
    if (r.penanggungJawab) jejak.push(`PJ: ${r.penanggungJawab}`);
    if (r.tenggat) jejak.push(`tenggat ${r.tenggat}`);
    const ekor = jejak.length ? ` (${jejak.join(", ")})` : "";
    const realisasiTeks = r.realisasi === null ? "tanpa data angka" : `realisasi ${r.realisasi}`;

    if (r.keputusan === "lanjutkan") {
      base.tindakLanjutCatatan =
        `RTL ${asal}: target ${r.targetLama} belum tercapai (${realisasiTeks}) — dilanjutkan dengan ambang batas yang sama.` +
        (r.akarMasalah ? ` Akar masalah: ${r.akarMasalah}` : "") + ekor;
      return [base];
    }
    if (r.keputusan === "perketat") {
      base.target = String(r.targetBaru);
      base.tindakLanjutCatatan =
        `RTL ${asal}: target ${r.targetLama} sudah tercapai (${realisasiTeks}) — ambang batas diperketat menjadi ${r.targetBaru}.` + ekor;
      return [base];
    }
    if (r.keputusan === "indikator_baru") {
      base.tindakLanjutCatatan =
        `RTL ${asal}: target ${r.targetLama} sudah tercapai (${realisasiTeks}) — target dipertahankan, ditambah indikator baru di bawahnya.` + ekor;
      const baru = {
        ...cloneFieldAsNewIndicator(f),
        label: r.indikatorBaruLabel,
        asalFieldId: f.id,
        tindakLanjutCatatan: `Indikator baru hasil RTL ${asal} karena indikator induknya sudah tercapai.` + ekor,
      };
      return [base, baru];
    }
    // terima_risiko
    base.tindakLanjutCatatan =
      `RTL ${asal}: target dipertahankan atas keputusan RTM (${realisasiTeks}).` +
      (r.akarMasalah ? ` Pertimbangan: ${r.akarMasalah}` : "") + ekor;
    return [base];
  };

  return {
    ...JSON.parse(JSON.stringify(source)),
    id: uid(),
    ...identitasBaru,
    status: "draft",
    terkunci: false,
    asalTemplateId: source.id,
    asalTahunAjaran: asal,
    sections: source.sections.map((s) => ({
      ...s,
      id: uid(),
      subsections: s.subsections.map((ss) => ({
        ...ss,
        id: uid(),
        fields: ss.fields.flatMap(olahField),
      })),
    })),
  };
}

/* ---------------- ADMIN: LAYAR TINDAK LANJUT & RTM ---------------- */
function RtmWorkspace({ templates, submissions, rtlStore, onSaveRtl, onApply }) {
  // Periode yang layak dibawa ke RTM: sudah ada penilaian selesai & belum dikunci
  const siapRtm = templates.filter(
    (t) => !t.terkunci && submissions.some((s) => s.templateId === t.id && s.status === "reviewed")
  );
  const terkunci = templates.filter((t) => t.terkunci);
  const [pilih, setPilih] = useState(siapRtm[0]?.id || "");
  const [tahunBaru, setTahunBaru] = useState("");
  const [konfirmasi, setKonfirmasi] = useState(false);

  const template = templates.find((t) => t.id === pilih);
  const saved = template ? rtlStore[template.id] : null;

  const rows = useMemo(() => {
    if (!template) return [];
    return mergeRtlRows(buildRtlRows(template, submissions), saved?.rows);
  }, [template, submissions, saved]);

  const [localRows, setLocalRows] = useState(rows);
  useEffect(() => setLocalRows(rows), [rows]);
  useEffect(() => setTahunBaru(saved?.tahunAjaranBaru || ""), [saved, pilih]);

  const patchRow = (fieldId, patch) => {
    const next = localRows.map((r) => {
      if (r.fieldId !== fieldId) return r;
      const merged = { ...r, ...patch };
      // Ganti keputusan -> sesuaikan usulan target baru
      if (patch.keputusan) {
        if (patch.keputusan === "perketat") {
          merged.targetBaru = targetDiperketat({ target: r.targetLama, arah: r.arah });
        } else {
          merged.targetBaru = r.targetLama;
        }
      }
      return merged;
    });
    setLocalRows(next);
    onSaveRtl(template.id, { tahunAjaranBaru: tahunBaru, rows: next });
  };

  const setTahun = (v) => {
    setTahunBaru(v);
    if (template) onSaveRtl(template.id, { tahunAjaranBaru: v, rows: localRows });
  };

  const belum = localRows.filter((r) => r.capaian === "belum").length;
  const tercapai = localRows.filter((r) => r.capaian === "tercapai").length;
  const rowBelumSiap = localRows.filter((r) => !rtlRowSiap(r));
  const kurangTahun = tahunBaru.trim() === "";
  const bisaTerapkan = localRows.length > 0 && rowBelumSiap.length === 0 && !kurangTahun;

  const rekap = KEPUTUSAN_OPTIONS.map((k) => ({
    ...k,
    n: localRows.filter((r) => r.keputusan === k.id).length,
  }));

  return (
    <div>
      <h1 className="serif" style={{ fontSize: 26, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
        Tindak Lanjut &amp; Rapat Tinjauan Manajemen
      </h1>
      <p className="sans" style={{ color: "var(--muted)", fontSize: 14, marginTop: 6, maxWidth: 760, lineHeight: 1.7 }}>
        Tahap Pengendalian dan Peningkatan pada siklus PPEPP. Sistem menyusun draf tindak lanjut dari hasil penilaian:
        indikator yang <strong>belum tercapai</strong> diusulkan dilanjutkan dengan target yang sama, yang <strong>sudah
        tercapai</strong> diusulkan diperketat ambang batasnya atau ditambah indikator baru. Setelah keputusan RTM lengkap,
        seluruhnya diturunkan sekaligus menjadi template periode berikutnya.
      </p>

      {siapRtm.length === 0 && (
        <Card style={{ padding: 30, marginTop: 22 }}>
          <div className="sans" style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.7 }}>
            Belum ada periode yang siap dibawa ke RTM. Sebuah periode baru muncul di sini setelah Penjamin Mutu menekan
            <strong> Selesaikan penilaian</strong> pada minimal satu form yang sudah dikirim Fakultas/Prodi.
          </div>
        </Card>
      )}

      {siapRtm.length > 0 && template && (
        <>
          <Card style={{ padding: 20, margin: "22px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 20px" }}>
              <Field label="Periode yang ditinjau">
                <Select value={pilih} onChange={(e) => { setPilih(e.target.value); setKonfirmasi(false); }}>
                  {siapRtm.map((t) => (
                    <option key={t.id} value={t.id}>{t.prodi} — {t.tahunAjaran}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Tahun ajaran periode berikutnya" hint="Identitas template baru yang akan dibuat dari keputusan RTM.">
                <TextInput placeholder="contoh: 2026/2027 Genap" value={tahunBaru} onChange={(e) => setTahun(e.target.value)} />
              </Field>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
              <Badge tone="warn">{belum} belum tercapai</Badge>
              <Badge tone="good">{tercapai} tercapai</Badge>
              {rekap.filter((r) => r.n > 0).map((r) => (
                <Badge key={r.id} tone="muted">{r.n} × {r.label}</Badge>
              ))}
            </div>
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {localRows.map((r, i) => {
              const tone = r.capaian === "tercapai" ? "good" : r.capaian === "belum" ? "warn" : "muted";
              const opsi = KEPUTUSAN_OPTIONS.filter(
                (k) =>
                  (k.untuk === "semua" || k.untuk === r.capaian || k.id === r.keputusan) &&
                  !(k.id === "perketat" && r.diPlafon && r.keputusan !== "perketat")
              );
              const siap = rtlRowSiap(r);
              return (
                <Card key={r.fieldId} style={{ padding: 16, borderLeft: `3px solid ${siap ? "var(--border)" : "var(--warn)"}` }}>
                  <div className="sans" style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 3 }}>
                    {i + 1}. {r.bagian}
                  </div>
                  <div className="sans" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                    {r.label || "Indikator tanpa nama"}
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                    <Badge tone="muted">{r.jenis}</Badge>
                    <span className="sans" style={{ fontSize: 12.5, color: "var(--muted)" }}>
                      Target {r.arah === "maks" ? "≤" : "≥"} <strong style={{ color: "var(--ink)" }}>{r.targetLama || "—"}</strong>
                      {r.unit ? ` ${r.unit}` : ""} · Realisasi <strong style={{ color: "var(--ink)" }}>{r.realisasi === null ? "—" : r.realisasi}</strong>
                    </span>
                    <Badge tone={tone}>
                      {r.capaian === "tercapai" ? "Tercapai" : r.capaian === "belum" ? "Belum tercapai" : "Tanpa data angka"}
                    </Badge>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 10 }}>
                    <Field label="Keputusan RTM">
                      <Select value={r.keputusan} onChange={(e) => patchRow(r.fieldId, { keputusan: e.target.value })} style={{ fontSize: 13 }}>
                        {opsi.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                      </Select>
                    </Field>
                    <Field label={r.keputusan === "perketat" ? "Ambang batas baru" : "Target periode berikutnya"}>
                      <TextInput
                        value={r.targetBaru}
                        disabled={r.keputusan !== "perketat"}
                        onChange={(e) => patchRow(r.fieldId, { targetBaru: e.target.value })}
                        style={{ fontSize: 13 }}
                      />
                    </Field>
                    <Field label="Penanggung jawab">
                      <TextInput placeholder="mis. Ka. LPPM" value={r.penanggungJawab} onChange={(e) => patchRow(r.fieldId, { penanggungJawab: e.target.value })} style={{ fontSize: 13 }} />
                    </Field>
                    <Field label="Tenggat">
                      <TextInput type="date" value={r.tenggat} onChange={(e) => patchRow(r.fieldId, { tenggat: e.target.value })} style={{ fontSize: 13 }} />
                    </Field>
                  </div>

                  {r.diPlafon && r.capaian === "tercapai" && (
                    <div className="sans" style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, lineHeight: 1.6 }}>
                      Target sudah menyentuh plafon ({r.targetLama}{r.unit ? " " + r.unit : ""}), jadi ambang batasnya tidak bisa
                      dinaikkan lagi. Peningkatan dilakukan dengan menambah indikator baru yang lebih menantang.
                    </div>
                  )}
                  {r.keputusan === "indikator_baru" && (
                    <Field label="Nama indikator baru" hint="Indikator ini ditambahkan di bawah indikator induk pada periode berikutnya, dengan target masih kosong.">
                      <TextInput placeholder="mis. Jumlah publikasi terindeks Scopus per dosen" value={r.indikatorBaruLabel} onChange={(e) => patchRow(r.fieldId, { indikatorBaruLabel: e.target.value })} />
                    </Field>
                  )}

                  <Field
                    label={r.capaian === "belum" ? "Akar masalah (wajib untuk indikator belum tercapai)" : "Catatan / pertimbangan RTM"}
                  >
                    <TextArea
                      placeholder={r.capaian === "belum" ? "Mengapa target belum tercapai?" : "Opsional"}
                      value={r.akarMasalah}
                      onChange={(e) => patchRow(r.fieldId, { akarMasalah: e.target.value })}
                      style={{ minHeight: 56, fontSize: 13 }}
                    />
                  </Field>

                  {!siap && (
                    <div className="sans" style={{ fontSize: 12, color: "var(--warn)", display: "flex", alignItems: "center", gap: 6 }}>
                      <AlertTriangle size={13} />
                      {r.keputusan === "indikator_baru" && !r.indikatorBaruLabel.trim()
                        ? "Nama indikator baru belum diisi."
                        : r.keputusan === "perketat" && String(r.targetBaru).trim() === ""
                        ? "Ambang batas baru belum diisi."
                        : "Akar masalah belum diisi."}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <Card style={{ padding: 20, marginTop: 18 }}>
            <div className="serif" style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
              Terapkan ke periode berikutnya
            </div>
            <div className="sans" style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 14, maxWidth: 720 }}>
              Tindakan ini mengunci periode <strong>{template.tahunAjaran}</strong> sebagai riwayat yang tidak dapat diubah, lalu
              membuat template baru berstatus draf berisi seluruh keputusan di atas. Setiap indikator pada template baru membawa
              catatan asal keputusannya, sehingga jejak dari periode ke periode tetap terbaca.
            </div>

            {!bisaTerapkan && (
              <div className="sans" style={{ fontSize: 12.5, color: "var(--warn)", marginBottom: 14, lineHeight: 1.7 }}>
                Belum bisa diterapkan karena:
                <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                  {kurangTahun && <li>Tahun ajaran periode berikutnya belum diisi.</li>}
                  {rowBelumSiap.length > 0 && <li>{rowBelumSiap.length} indikator masih perlu dilengkapi (ditandai garis kuning di atas).</li>}
                </ul>
              </div>
            )}

            {!konfirmasi ? (
              <Btn variant="gold" icon={TrendingUp} disabled={!bisaTerapkan} onClick={() => setKonfirmasi(true)}>
                Setujui RTM &amp; buat template periode berikutnya
              </Btn>
            ) : (
              <div>
                <div className="sans" style={{ fontSize: 13, color: "var(--ink)", marginBottom: 10 }}>
                  Kunci periode {template.tahunAjaran} dan buat template <strong>{template.prodi} — {tahunBaru}</strong>?
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <Btn variant="gold" icon={ArrowRight} onClick={() => { onApply(template, localRows, tahunBaru); setKonfirmasi(false); }}>
                    Ya, terapkan
                  </Btn>
                  <Btn variant="outline" onClick={() => setKonfirmasi(false)}>Batal</Btn>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {terkunci.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <div className="serif" style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>
            Riwayat periode terkunci
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {terkunci.map((t) => (
              <Card key={t.id} style={{ padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <Lock size={15} style={{ color: "var(--muted)" }} />
                <div className="sans" style={{ fontSize: 13.5, color: "var(--ink)" }}>
                  {t.prodi} — {t.tahunAjaran}
                </div>
                <div className="sans" style={{ fontSize: 12.5, color: "var(--muted)", marginLeft: "auto" }}>
                  Sudah ditinjau RTM · isi tidak dapat diubah
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- PENGISI: LIST TEMPLATE AKTIF ---------------- */
function PengisiList({ templates, submissions, onOpen, currentUser }) {
  const published = templates.filter((t) => t.status === "published");
  return (
    <div>
      <h1 className="serif" style={{ fontSize: 26, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
        Form penilaian mutu
      </h1>
      <p className="sans" style={{ color: "var(--muted)", fontSize: 14, marginTop: 6, marginBottom: 22 }}>
        Masuk sebagai <strong>{currentUser?.name}</strong>. Pilih template yang sesuai, lalu lengkapi setiap kriteria beserta dokumen pendukung.
      </p>

      {published.length === 0 && (
        <Card style={{ padding: 40, textAlign: "center" }}>
          <div className="sans" style={{ color: "var(--muted)", fontSize: 14 }}>Belum ada template yang diterbitkan oleh admin mutu.</div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {published.map((t) => {
          const mine = submissions.filter((s) => s.templateId === t.id && s.filledByEmail === currentUser?.email);
          const mineStatus = mine[0]?.status;
          return (
            <Card key={t.id} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="serif" style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>{t.prodi}</div>
              <div className="sans" style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7 }}>
                {t.fakultas} · {t.jenjang}<br />Tahun ajaran {t.tahunAjaran}
                {(t.periodeMulai || t.periodeAkhir) && (
                  <><br />Periode: {t.periodeMulai || "?"} – {t.periodeAkhir || "?"}</>
                )}
              </div>
              {mineStatus && (
                <Badge tone={mineStatus === "submitted" ? "good" : mineStatus === "reviewed" ? "good" : "muted"}>
                  {mineStatus === "draft_fill" ? "Draf tersimpan" : mineStatus === "submitted" ? "Terkirim" : "Sudah dinilai"}
                </Badge>
              )}
              <Btn variant="gold" small icon={FileText} onClick={() => onOpen(t.id)}>
                {mine.length ? "Buka form" : "Isi form"}
              </Btn>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

const MAX_FILE_MB = 5;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FileUploadField({ value, disabled, onUpload, onRemove }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setErr(`Ukuran file maksimal ${MAX_FILE_MB}MB.`);
      return;
    }
    setErr("");
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      onUpload({ fileName: file.name, fileType: file.type, fileSize: file.size, fileData: dataUrl });
    } catch (e) {
      setErr("Gagal mengunggah file.");
    }
    setUploading(false);
  };

  if (value?.fileName) {
    return (
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, background: "var(--bg)", padding: "8px 10px", borderRadius: 7 }}>
        <Paperclip size={13} style={{ color: "var(--gold)", flexShrink: 0 }} />
        <span className="sans" style={{ fontSize: 12.5, color: "var(--ink)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value.fileName}
        </span>
        <a href={value.fileData} download={value.fileName} className="sans" style={{ color: "var(--gold)", display: "flex" }}>
          <Download size={14} />
        </a>
        {!disabled && (
          <button onClick={onRemove} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)", display: "flex" }}>
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <label
        className="sans"
        style={{
          display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600,
          color: disabled ? "var(--muted)" : "var(--ink)", border: "1px dashed var(--border)", borderRadius: 7,
          padding: "8px 12px", cursor: disabled ? "not-allowed" : "pointer", background: "#fff",
        }}
      >
        <Upload size={13} />
        {uploading ? "Mengunggah..." : "Unggah dokumen pendukung"}
        <input type="file" disabled={disabled || uploading} onChange={handleChange} style={{ display: "none" }} />
      </label>
      {err && <div className="sans" style={{ color: "var(--warn)", fontSize: 11.5, marginTop: 4 }}>{err}</div>}
    </div>
  );
}

/* ---------------- PENGISI: FORM FILL ---------------- */
function FormFill({ template, submission, onChangeSubmission, onBack, onSubmit, onReopen, savedAt, currentUser }) {
  const setAnswer = (fid, patch) => {
    const answers = { ...submission.answers, [fid]: { ...(submission.answers[fid] || {}), ...patch } };
    onChangeSubmission({ ...submission, answers });
  };

  const totalFields = template.sections.reduce((a, s) => a + s.subsections.reduce((b, ss) => b + ss.fields.length, 0), 0);
  const filled = Object.values(submission.answers).filter((a) => a && a.value && String(a.value).trim() !== "").length;
  // Terkunci setelah dikirim atau setelah dinilai. Yang "submitted" masih bisa
  // dibuka kembali oleh pengisi untuk diperbaiki; yang "reviewed" tidak.
  const locked = submission.status === "submitted" || submission.status === "reviewed";

  return (
    <div>
      <button onClick={onBack} className="sans" style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer", marginBottom: 18 }}>
        <ArrowLeft size={14} /> Kembali
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div>
          <h1 className="serif" style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{template.prodi}</h1>
          <p className="sans" style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 4 }}>
            {template.fakultas} · {template.jenjang} · Tahun ajaran {template.tahunAjaran}
            {(template.periodeMulai || template.periodeAkhir) && (
              <> · Periode {template.periodeMulai || "?"} – {template.periodeAkhir || "?"}</>
            )}
          </p>
        </div>
        <Badge tone={locked ? "good" : "muted"}>
          {submission.status === "reviewed"
            ? "Sudah dinilai — terkunci"
            : submission.status === "submitted"
            ? "Terkirim — menunggu penilaian"
            : `${filled}/${totalFields} kriteria terisi`}
        </Badge>
      </div>

      <Card style={{ padding: 20, margin: "18px 0" }}>
        <div className="sans" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Diisi oleh</div>
        <div className="sans" style={{ fontSize: 14, color: "var(--ink)" }}>{submission.filledBy}</div>
        <div className="sans" style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{submission.filledByEmail}</div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {template.sections.map((section, si) => (
          <Card key={section.id} style={{ padding: 22 }}>
            <div className="serif" style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>
              {si + 1}. {section.title || "Tanpa judul"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {section.subsections.map((sub) => (
                <div key={sub.id}>
                  <div className="sans" style={{ fontSize: 13.5, fontWeight: 700, color: "var(--gold)", marginBottom: 10 }}>
                    {sub.title}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingLeft: 4 }}>
                    {sub.fields.map((f) => {
                      const ans = submission.answers[f.id] || {};
                      const disabled = locked;
                      const cmp = compareToTarget(f, ans.value);
                      return (
                        <div key={f.id} style={{ borderTop: "1px dashed var(--border)", paddingTop: 12 }}>
                          <div className="sans" style={{ fontSize: 13.5, color: "var(--ink)", marginBottom: 8, fontWeight: 500 }}>
                            {f.label || "Kriteria belum diberi nama"}
                          </div>

                          <TargetStrip field={f} />

                          {f.type === "qualitative" ? (
                            <TextArea disabled={disabled} placeholder="Uraikan realisasi/kondisi saat ini dibanding target di atas..." value={ans.value || ""} onChange={(e) => setAnswer(f.id, { value: e.target.value })} />
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <TextInput disabled={disabled} type="number" placeholder="Realisasi" value={ans.value || ""} onChange={(e) => setAnswer(f.id, { value: e.target.value })} style={{ maxWidth: 180 }} />
                              {f.unit && <span className="sans" style={{ fontSize: 13, color: "var(--muted)" }}>{f.unit}</span>}
                              {cmp.status === "tercapai" && (
                                <Badge tone="good">Memenuhi target (+{cmp.gap.toFixed(2).replace(/\.00$/, "")})</Badge>
                              )}
                              {cmp.status === "belum" && (
                                <Badge tone="warn">Di bawah target ({cmp.gap.toFixed(2).replace(/\.00$/, "")})</Badge>
                              )}
                            </div>
                          )}
                          {cmp.status === "belum" && f.mitigasi && (
                            <div className="sans" style={{ fontSize: 12, color: "var(--warn)", marginTop: 6, lineHeight: 1.5 }}>
                              Realisasi masih di bawah target — lampirkan bukti tindakan mitigasi: {f.mitigasi}
                            </div>
                          )}
                          <FileUploadField
                            value={ans.doc}
                            disabled={disabled}
                            onUpload={(fileInfo) => setAnswer(f.id, { doc: fileInfo })}
                            onRemove={() => setAnswer(f.id, { doc: null })}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {!locked && (
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 20, flexWrap: "wrap" }}>
          <Btn variant="gold" icon={Send} onClick={onSubmit}>Kirim untuk dinilai</Btn>
          <div className="sans" style={{ fontSize: 12.5, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Save size={13} />
            {savedAt
              ? `Draf tersimpan otomatis · ${new Date(savedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
              : "Draf tersimpan otomatis setiap kali Anda mengisi"}
          </div>
        </div>
      )}

      {submission.status === "submitted" && (
        <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <div className="sans" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10, lineHeight: 1.6 }}>
            Form sudah dikirim sehingga isinya dikunci. Buka kembali kalau masih ada realisasi atau dokumen yang perlu diperbaiki
            sebelum dinilai Penjamin Mutu.
          </div>
          <Btn variant="outline" icon={Save} onClick={onReopen}>Buka kembali untuk diperbaiki</Btn>
        </div>
      )}

      {submission.status === "reviewed" && (
        <div style={{ marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <div className="sans" style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
            Form ini sudah dinilai Penjamin Mutu, jadi isinya tidak dapat diubah lagi. Perbaikan dilakukan lewat siklus periode
            berikutnya sesuai tahap Pengendalian dan Peningkatan.
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- PENJAMIN MUTU: LIST SUBMISSIONS ---------------- */
function ReviewList({ templates, submissions, onOpen }) {
  const items = submissions.filter((s) => s.status === "submitted" || s.status === "reviewed");
  return (
    <div>
      <h1 className="serif" style={{ fontSize: 26, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
        Penilaian penjamin mutu
      </h1>
      <p className="sans" style={{ color: "var(--muted)", fontSize: 14, marginTop: 6, marginBottom: 22 }}>
        Tinjau isian dari tiap fakultas / prodi, beri skor dan komentar per kriteria.
      </p>

      {items.length === 0 && (
        <Card style={{ padding: 40, textAlign: "center" }}>
          <div className="sans" style={{ color: "var(--muted)", fontSize: 14 }}>Belum ada isian yang dikirim untuk dinilai.</div>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((s) => {
          const t = templates.find((tt) => tt.id === s.templateId);
          if (!t) return null;
          const totalFields = t.sections.reduce((a, sec) => a + sec.subsections.reduce((b, ss) => b + ss.fields.length, 0), 0);
          const scored = Object.values(s.reviews || {}).filter((r) => r.score !== undefined && r.score !== "").length;
          return (
            <Card key={s.id} style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="serif" style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{t.prodi}</div>
                <div className="sans" style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>
                  {t.fakultas} · {t.jenjang} · {t.tahunAjaran} — diisi oleh {s.filledBy || "tanpa nama"}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Badge tone={s.status === "reviewed" ? "good" : "warn"}>
                  {s.status === "reviewed" ? "Sudah dinilai" : `Menunggu (${scored}/${totalFields})`}
                </Badge>
                <Btn variant="outline" small icon={Eye} onClick={() => onOpen(s.id)}>Buka</Btn>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- PENJAMIN MUTU: REVIEW DETAIL ---------------- */
function ReviewDetail({ template, submission, onChangeSubmission, onBack, onFinish, savedAt }) {
  const setReview = (fid, patch) => {
    const reviews = { ...submission.reviews, [fid]: { ...(submission.reviews[fid] || {}), ...patch } };
    onChangeSubmission({ ...submission, reviews });
  };

  const allFields = template.sections.flatMap((s) => s.subsections.flatMap((ss) => ss.fields));
  const scores = allFields.map((f) => Number(submission.reviews[f.id]?.score)).filter((n) => !isNaN(n) && n !== null);
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";

  return (
    <div>
      <button onClick={onBack} className="sans" style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer", marginBottom: 18 }}>
        <ArrowLeft size={14} /> Kembali ke daftar
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <h1 className="serif" style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{template.prodi}</h1>
          <p className="sans" style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 4 }}>
            {template.fakultas} · {template.jenjang} · {template.tahunAjaran} — diisi oleh {submission.filledBy || "tanpa nama"}
          </p>
        </div>
        <Card style={{ padding: "10px 18px", textAlign: "center" }}>
          <div className="sans" style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>SKOR RATA-RATA</div>
          <div className="serif" style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)" }}>{avg}</div>
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {template.sections.map((section, si) => (
          <Card key={section.id} style={{ padding: 22 }}>
            <div className="serif" style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>
              {si + 1}. {section.title}
            </div>
            {section.subsections.map((sub) => (
              <div key={sub.id} style={{ marginBottom: 18 }}>
                <div className="sans" style={{ fontSize: 13.5, fontWeight: 700, color: "var(--gold)", marginBottom: 10 }}>{sub.title}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {sub.fields.map((f) => {
                    const ans = submission.answers[f.id] || {};
                    const rev = submission.reviews[f.id] || {};
                    return (
                      <div key={f.id} style={{ borderTop: "1px dashed var(--border)", paddingTop: 12, display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }}>
                        <div>
                          <div className="sans" style={{ fontSize: 13.5, fontWeight: 500, color: "var(--ink)", marginBottom: 6 }}>{f.label}</div>
                          <TargetStrip field={f} />
                          <div className="sans" style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginBottom: 3 }}>Realisasi dilaporkan</div>
                          <div className="sans" style={{ fontSize: 13.5, color: "var(--muted)", background: "var(--bg)", padding: "8px 10px", borderRadius: 7, whiteSpace: "pre-wrap" }}>
                            {ans.value || <em>Tidak diisi</em>} {f.type === "quantitative" && f.unit ? f.unit : ""}
                          </div>
                          {(() => {
                            const cmp = compareToTarget(f, ans.value);
                            if (cmp.status === "tercapai") return <div style={{ marginTop: 6 }}><Badge tone="good">Target tercapai</Badge></div>;
                            if (cmp.status === "belum") return <div style={{ marginTop: 6 }}><Badge tone="warn">Target belum tercapai (selisih {cmp.gap.toFixed(2).replace(/\.00$/, "")})</Badge></div>;
                            return null;
                          })()}
                          {ans.doc?.fileName ? (
                            <a
                              href={ans.doc.fileData}
                              download={ans.doc.fileName}
                              className="sans"
                              style={{ fontSize: 12, color: "var(--gold)", marginTop: 6, display: "inline-flex", alignItems: "center", gap: 5, textDecoration: "none" }}
                            >
                              <Paperclip size={12} /> {ans.doc.fileName}
                              <Download size={12} />
                            </a>
                          ) : (
                            <div className="sans" style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, fontStyle: "italic" }}>
                              Tidak ada dokumen pendukung
                            </div>
                          )}
                        </div>
                        <div>
                          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                            <div style={{ position: "relative", width: 100 }}>
                              <Star size={13} style={{ position: "absolute", left: 9, top: 10.5, color: "var(--gold)" }} />
                              <TextInput type="number" min="0" max="100" placeholder="Skor" value={rev.score ?? ""} onChange={(e) => setReview(f.id, { score: e.target.value })} style={{ paddingLeft: 28 }} />
                            </div>
                            <span className="sans" style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>/ 100</span>
                          </div>
                          <TextArea placeholder="Komentar penjamin mutu..." value={rev.comment || ""} onChange={(e) => setReview(f.id, { comment: e.target.value })} style={{ minHeight: 60, fontSize: 13 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 20, flexWrap: "wrap" }}>
        <Btn variant="gold" icon={Check} onClick={onFinish}>Selesaikan penilaian</Btn>
        <div className="sans" style={{ fontSize: 12.5, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Save size={13} />
          {savedAt
            ? `Skor & komentar tersimpan otomatis · ${new Date(savedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
            : "Skor & komentar tersimpan otomatis saat diisi"}
        </div>
      </div>
    </div>
  );
}

/* ---------------- APP ---------------- */
export default function App() {
  const { templates, submissions, users, rtlStore, saveTemplates, saveSubmissions, saveUsers, saveRtl, applyRtl, resetData, loaded } = useStore();
  const [currentUserId, setCurrentUserId] = useState(null);
  const [section, setSection] = useState("templates"); // menu aktif, tergantung role
  const [view, setView] = useState("list"); // list | edit
  const [draftTemplate, setDraftTemplate] = useState(null);
  const [draftSubmission, setDraftSubmission] = useState(null);
  const [savedAt, setSavedAt] = useState(null); // waktu autosave terakhir

  const currentUser = users.find((u) => u.id === currentUserId) || users[0] || null;

  // Set user aktif pertama kali data selesai dimuat
  useEffect(() => {
    if (loaded && !currentUserId && users.length) {
      setCurrentUserId(users[0].id);
    }
  }, [loaded, users, currentUserId]);

  // Saat ganti user, arahkan ke menu pertama yang sesuai role & reset ke tampilan daftar
  const switchUser = (id) => {
    setCurrentUserId(id);
    const u = users.find((x) => x.id === id);
    const menus = MENUS_BY_ROLE[u?.role] || [];
    setSection(menus[0]?.id || "templates");
    setView("list");
  };

  // ---- Template (Admin) ----
  const openTemplate = (id) => {
    const t = templates.find((x) => x.id === id);
    setDraftTemplate(JSON.parse(JSON.stringify(t)));
    setView("edit");
  };
  const newTemplate = () => {
    setDraftTemplate(EMPTY_TEMPLATE());
    setView("edit");
  };
  const saveTemplate = (t, status) => {
    const withStatus = { ...t, status };
    const exists = templates.some((x) => x.id === t.id);
    const next = exists ? templates.map((x) => (x.id === t.id ? withStatus : x)) : [...templates, withStatus];
    saveTemplates(next);
    setView("list");
  };
  const deleteTemplate = (id) => {
    saveTemplates(templates.filter((t) => t.id !== id));
    saveSubmissions(submissions.filter((s) => s.templateId !== id));
  };

  // ---- Pengguna (Admin) ----
  const addUser = (u) => saveUsers([...users, u]);
  const deleteUser = (id) => saveUsers(users.filter((u) => u.id !== id));

  // ---- Form (Pengisi) ----
  const openForm = (templateId) => {
    let sub = submissions.find(
      (s) => s.templateId === templateId && s.filledByEmail === currentUser?.email && s.status !== "reviewed"
    );
    if (!sub) {
      sub = submissions.find((s) => s.templateId === templateId && s.filledByEmail === currentUser?.email);
    }
    if (!sub) {
      sub = {
        id: uid(),
        templateId,
        filledBy: currentUser?.name || "",
        filledByEmail: currentUser?.email || "",
        status: "draft_fill",
        answers: {},
        reviews: {},
      };
    }
    setDraftSubmission(JSON.parse(JSON.stringify(sub)));
    setView("edit");
  };
  const persistSubmission = (sub) => {
    const exists = submissions.some((s) => s.id === sub.id);
    const next = exists ? submissions.map((s) => (s.id === sub.id ? sub : s)) : [...submissions, sub];
    saveSubmissions(next);
    setDraftSubmission(sub);
    setSavedAt(Date.now());
  };
  const submitForm = () => {
    persistSubmission({ ...draftSubmission, status: "submitted" });
    setView("list");
  };
  const reopenForm = () => {
    persistSubmission({ ...draftSubmission, status: "draft_fill" });
  };

  // ---- Tindak lanjut / RTM (Admin) ----
  const terapkanRtl = (source, rows, tahunBaru) => {
    const templateBaru = turunkanKePeriodeBerikutnya(source, rows, { tahunAjaran: tahunBaru });
    const sourceTerkunci = { ...source, terkunci: true };
    applyRtl(source.id, sourceTerkunci, templateBaru, { tahunAjaranBaru: tahunBaru, rows });
    // Langsung buka template baru supaya bisa diperiksa lalu diterbitkan
    setDraftTemplate(JSON.parse(JSON.stringify(templateBaru)));
    setSection("templates");
    setView("edit");
  };

  // ---- Review (Penjamin Mutu) ----
  const openReview = (submissionId) => {
    const sub = submissions.find((s) => s.id === submissionId);
    setDraftSubmission(JSON.parse(JSON.stringify(sub)));
    setView("edit");
  };
  const finishReview = () => {
    persistSubmission({ ...draftSubmission, status: "reviewed" });
    setView("list");
  };

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <style>{FONT_STYLE}</style>
        <div className="sans" style={{ color: "var(--muted)" }}>Memuat data...</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <style>{FONT_STYLE}</style>
        <div className="sans" style={{ color: "var(--muted)" }}>Belum ada pengguna terdaftar.</div>
      </div>
    );
  }

  const role = currentUser.role;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <style>{FONT_STYLE}</style>
      <Sidebar users={users} currentUser={currentUser} onSwitchUser={switchUser} section={section} setSection={(s) => { setSection(s); setView("list"); }} onReset={() => { resetData(); setView("list"); setDraftTemplate(null); setDraftSubmission(null); }} />
      <div style={{ flex: 1, padding: "32px 40px", maxWidth: 1080 }}>
        {role === "admin" && section === "templates" && view === "list" && (
          <AdminList templates={templates} onNew={newTemplate} onOpen={openTemplate} onDelete={deleteTemplate} />
        )}
        {role === "admin" && section === "templates" && view === "edit" && draftTemplate && (
          <TemplateBuilder template={draftTemplate} onChange={setDraftTemplate} onBack={() => setView("list")} onSave={saveTemplate} submissions={submissions} />
        )}
        {role === "admin" && section === "rtm" && (
          <RtmWorkspace
            templates={templates}
            submissions={submissions}
            rtlStore={rtlStore}
            onSaveRtl={saveRtl}
            onApply={terapkanRtl}
          />
        )}
        {role === "admin" && section === "users" && (
          <UserManagement users={users} onAdd={addUser} onDelete={deleteUser} currentUser={currentUser} />
        )}

        {role === "pengisi" && section === "form" && view === "list" && (
          <PengisiList templates={templates} submissions={submissions} onOpen={openForm} currentUser={currentUser} />
        )}
        {role === "pengisi" && section === "form" && view === "edit" && draftSubmission && (
          <FormFill
            template={templates.find((t) => t.id === draftSubmission.templateId)}
            submission={draftSubmission}
            onChangeSubmission={persistSubmission}
            onBack={() => setView("list")}
            onSubmit={submitForm}
            onReopen={reopenForm}
            savedAt={savedAt}
            currentUser={currentUser}
          />
        )}

        {role === "penjamin" && section === "review" && view === "list" && (
          <ReviewList templates={templates} submissions={submissions} onOpen={openReview} />
        )}
        {role === "penjamin" && section === "review" && view === "edit" && draftSubmission && (
          <ReviewDetail
            template={templates.find((t) => t.id === draftSubmission.templateId)}
            submission={draftSubmission}
            onChangeSubmission={persistSubmission}
            onBack={() => setView("list")}
            onFinish={finishReview}
            savedAt={savedAt}
          />
        )}
      </div>
    </div>
  );
}
