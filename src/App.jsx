import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, FileText, Upload, ClipboardCheck, LayoutTemplate, ArrowLeft, Search, Check, X, GraduationCap, Building2, BookOpen, Calendar, Star, Save, Send, Eye, Users, UserPlus, LogOut, Paperclip, Download } from "lucide-react";

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
const EMPTY_FIELD = () => ({ id: uid(), label: "", type: "qualitative", unit: "", maxScore: 100 });

// Opsi role dibatasi hanya 3 ini
const ROLE_OPTIONS = [
  { id: "admin", label: "Admin Mutu", icon: LayoutTemplate, desc: "Kelola template & pengguna" },
  { id: "pengisi", label: "Fakultas / Prodi", icon: BookOpen, desc: "Isi form penilaian" },
  { id: "penjamin", label: "Penjamin Mutu", icon: ClipboardCheck, desc: "Beri skor & komentar" },
];

const EMPTY_USER = () => ({ id: uid(), name: "", email: "", role: "pengisi" });

const SEED_USERS = () => [
  { id: uid(), name: "Admin Mutu Pusat", email: "admin@kampus.ac.id", role: "admin" },
];

const STORAGE_KEY = "qa-app-data";

function useStore() {
  const [templates, setTemplates] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setTemplates(parsed.templates || []);
        setSubmissions(parsed.submissions || []);
        setUsers(parsed.users && parsed.users.length ? parsed.users : SEED_USERS());
      } else {
        setUsers(SEED_USERS());
      }
    } catch (e) {
      setUsers(SEED_USERS());
    }
    setLoaded(true);
  }, []);

  const persist = (nextTemplates, nextSubmissions, nextUsers) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ templates: nextTemplates, submissions: nextSubmissions, users: nextUsers })
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

  return { templates, submissions, users, saveTemplates, saveSubmissions, saveUsers, loaded };
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

/* ---------------- MENU PER ROLE (kontrol akses) ---------------- */
const MENUS_BY_ROLE = {
  admin: [
    { id: "templates", label: "Manajemen Template", icon: LayoutTemplate, desc: "Susun kriteria mutu" },
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
function Sidebar({ users, currentUser, onSwitchUser, section, setSection }) {
  const [pickerOpen, setPickerOpen] = useState(false);
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
function TemplateBuilder({ template, onChange, onBack, onSave }) {
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

  return (
    <div>
      <button onClick={onBack} className="sans" style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: "var(--muted)", fontSize: 13, cursor: "pointer", marginBottom: 18 }}>
        <ArrowLeft size={14} /> Kembali ke daftar template
      </button>

      <Card style={{ padding: 22, marginBottom: 20 }}>
        <div className="serif" style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 16 }}>
          Identitas template
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0 20px" }}>
          <Field label="Jenjang">
            <Select value={template.jenjang} onChange={(e) => update({ jenjang: e.target.value })}>
              <option value="">Pilih jenjang</option>
              <option>D3</option><option>D4</option><option>S1</option><option>S2</option><option>S3</option><option>Profesi</option>
            </Select>
          </Field>
          <Field label="Tahun ajaran">
            <TextInput placeholder="contoh: 2026/2027 Ganjil" value={template.tahunAjaran} onChange={(e) => update({ tahunAjaran: e.target.value })} />
          </Field>
          <Field label="Fakultas">
            <TextInput placeholder="contoh: Fakultas Teknik" value={template.fakultas} onChange={(e) => update({ fakultas: e.target.value })} />
          </Field>
          <Field label="Program studi">
            <TextInput placeholder="contoh: Teknik Informatika" value={template.prodi} onChange={(e) => update({ prodi: e.target.value })} />
          </Field>
          <Field label="Periode mulai penilaian">
            <TextInput type="date" value={template.periodeMulai} onChange={(e) => update({ periodeMulai: e.target.value })} />
          </Field>
          <Field label="Periode akhir penilaian">
            <TextInput type="date" value={template.periodeAkhir} onChange={(e) => update({ periodeAkhir: e.target.value })} />
          </Field>
        </div>
      </Card>

      <div className="serif" style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
        Bagian & kriteria penilaian
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
        {template.sections.map((section, si) => (
          <Card key={section.id} style={{ padding: 20 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
              <span className="sans" style={{ fontSize: 12, fontWeight: 700, color: "var(--gold)", width: 22 }}>{si + 1}.</span>
              <TextInput
                placeholder="Nama bagian, contoh: Kurikulum & Pembelajaran"
                value={section.title}
                onChange={(e) => updateSection(section.id, { title: e.target.value })}
                style={{ fontWeight: 600 }}
              />
              <button onClick={() => removeSection(section.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)" }}>
                <Trash2 size={15} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingLeft: 32 }}>
              {section.subsections.map((sub, subi) => (
                <div key={sub.id} style={{ borderLeft: "2px solid var(--gold-soft)", paddingLeft: 16, paddingTop: 4, paddingBottom: 4 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                    <TextInput
                      placeholder="Sub bagian, contoh: Ketersediaan dokumen kurikulum"
                      value={sub.title}
                      onChange={(e) => updateSub(section.id, sub.id, { title: e.target.value })}
                    />
                    <button onClick={() => removeSub(section.id, sub.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {sub.fields.map((f) => (
                      <div key={f.id} style={{ display: "grid", gridTemplateColumns: "1fr 150px 100px 32px", gap: 8, alignItems: "center" }}>
                        <TextInput
                          placeholder="Pertanyaan / kriteria, contoh: Rasio dosen terhadap mahasiswa"
                          value={f.label}
                          onChange={(e) => updateField(section.id, sub.id, f.id, { label: e.target.value })}
                        />
                        <Select value={f.type} onChange={(e) => updateField(section.id, sub.id, f.id, { type: e.target.value })}>
                          <option value="qualitative">Kualitatif</option>
                          <option value="quantitative">Kuantitatif</option>
                        </Select>
                        {f.type === "quantitative" ? (
                          <TextInput placeholder="Satuan" value={f.unit} onChange={(e) => updateField(section.id, sub.id, f.id, { unit: e.target.value })} />
                        ) : (
                          <div />
                        )}
                        <button onClick={() => removeField(section.id, sub.id, f.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)" }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Btn variant="ghost" small icon={Plus} onClick={() => addField(section.id, sub.id)}>Tambah kriteria</Btn>
                  </div>
                </div>
              ))}
              <div>
                <Btn variant="outline" small icon={Plus} onClick={() => addSub(section.id)}>Tambah sub bagian</Btn>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 26 }}>
        <Btn variant="outline" icon={Plus} onClick={addSection}>Tambah bagian</Btn>
      </div>

      <div style={{ display: "flex", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
        <Btn variant="outline" onClick={() => onSave(template, "draft")}>Simpan sebagai draf</Btn>
        <Btn variant="gold" icon={Check} onClick={() => onSave(template, "published")}>Terbitkan template</Btn>
      </div>
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
function FormFill({ template, submission, onChangeSubmission, onBack, onSubmit, currentUser }) {
  const setAnswer = (fid, patch) => {
    const answers = { ...submission.answers, [fid]: { ...(submission.answers[fid] || {}), ...patch } };
    onChangeSubmission({ ...submission, answers });
  };

  const totalFields = template.sections.reduce((a, s) => a + s.subsections.reduce((b, ss) => b + ss.fields.length, 0), 0);
  const filled = Object.values(submission.answers).filter((a) => a && a.value && String(a.value).trim() !== "").length;

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
        <Badge tone={submission.status === "submitted" ? "good" : "muted"}>
          {submission.status === "submitted" ? "Terkirim" : `${filled}/${totalFields} kriteria terisi`}
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
                      const disabled = submission.status === "submitted";
                      return (
                        <div key={f.id} style={{ borderTop: "1px dashed var(--border)", paddingTop: 12 }}>
                          <div className="sans" style={{ fontSize: 13.5, color: "var(--ink)", marginBottom: 8, fontWeight: 500 }}>
                            {f.label || "Kriteria belum diberi nama"}
                            {f.type === "quantitative" && f.unit && <span style={{ color: "var(--muted)" }}> ({f.unit})</span>}
                          </div>
                          {f.type === "qualitative" ? (
                            <TextArea disabled={disabled} placeholder="Uraikan jawaban Anda..." value={ans.value || ""} onChange={(e) => setAnswer(f.id, { value: e.target.value })} />
                          ) : (
                            <TextInput disabled={disabled} type="number" placeholder="Masukkan angka" value={ans.value || ""} onChange={(e) => setAnswer(f.id, { value: e.target.value })} style={{ maxWidth: 220 }} />
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

      {submission.status !== "submitted" && (
        <div style={{ display: "flex", gap: 10, marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
          <Btn variant="outline" icon={Save} onClick={() => onChangeSubmission(submission)}>Simpan sebagai draf</Btn>
          <Btn variant="gold" icon={Send} onClick={onSubmit}>Kirim untuk dinilai</Btn>
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
function ReviewDetail({ template, submission, onChangeSubmission, onBack, onFinish }) {
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
                          <div className="sans" style={{ fontSize: 13.5, color: "var(--muted)", background: "var(--bg)", padding: "8px 10px", borderRadius: 7, whiteSpace: "pre-wrap" }}>
                            {ans.value || <em>Tidak diisi</em>} {f.type === "quantitative" && f.unit ? f.unit : ""}
                          </div>
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

      <div style={{ display: "flex", gap: 10, marginTop: 20, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
        <Btn variant="outline" icon={Save} onClick={() => onChangeSubmission(submission)}>Simpan penilaian</Btn>
        <Btn variant="gold" icon={Check} onClick={onFinish}>Selesaikan penilaian</Btn>
      </div>
    </div>
  );
}

/* ---------------- APP ---------------- */
export default function App() {
  const { templates, submissions, users, saveTemplates, saveSubmissions, saveUsers, loaded } = useStore();
  const [currentUserId, setCurrentUserId] = useState(null);
  const [section, setSection] = useState("templates"); // menu aktif, tergantung role
  const [view, setView] = useState("list"); // list | edit
  const [draftTemplate, setDraftTemplate] = useState(null);
  const [draftSubmission, setDraftSubmission] = useState(null);

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
  };
  const submitForm = () => {
    persistSubmission({ ...draftSubmission, status: "submitted" });
    setView("list");
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
      <Sidebar users={users} currentUser={currentUser} onSwitchUser={switchUser} section={section} setSection={(s) => { setSection(s); setView("list"); }} />
      <div style={{ flex: 1, padding: "32px 40px", maxWidth: 1080 }}>
        {role === "admin" && section === "templates" && view === "list" && (
          <AdminList templates={templates} onNew={newTemplate} onOpen={openTemplate} onDelete={deleteTemplate} />
        )}
        {role === "admin" && section === "templates" && view === "edit" && draftTemplate && (
          <TemplateBuilder template={draftTemplate} onChange={setDraftTemplate} onBack={() => setView("list")} onSave={saveTemplate} />
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
          />
        )}
      </div>
    </div>
  );
}
