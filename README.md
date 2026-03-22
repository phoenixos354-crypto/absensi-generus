# 🕌 Absensi Generus

Sistem absensi digital untuk pengajian Generasi Penerus (Generus).  
Dibangun dengan **Next.js 14**, **Google Sheets** sebagai database, **Google OAuth** untuk login.  
**100% gratis** — deploy di Vercel, data di Google Sheets.

---

## ✨ Fitur

- 🔐 Login dengan akun Google
- 🕌 Buat & kelola beberapa kelompok pengajian (Caberawit, Pra Remaja, Remaja, Usia Nikah, Kelompok)
- 👥 Tambah murid (satu per satu atau massal)
- 📅 Set jadwal ngaji mingguan
- ✅ Absensi harian: **Hadir / Izin / Sakit / Alfa**
- 📊 Rekap kehadiran per **Hari / Minggu / Bulan**
- 📈 Persentase kehadiran global dan per murid
- 💾 Semua data tersimpan otomatis di Google Sheets

---

## 🛠 Cara Setup (Langkah demi Langkah)

### LANGKAH 1 — Buat Google Spreadsheet

1. Buka [Google Sheets](https://sheets.google.com) → **Buat spreadsheet baru**
2. Beri nama: `Absensi Generus`
3. Catat **ID spreadsheet** dari URL:
   ```
   https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   ```

---

### LANGKAH 2 — Buat Google Cloud Project & Service Account

1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Klik **"New Project"** → beri nama → **Create**
3. Di sidebar, klik **APIs & Services → Library**
4. Cari **"Google Sheets API"** → klik → **Enable**
5. Kembali ke **APIs & Services → Credentials**
6. Klik **"+ Create Credentials" → Service Account**
   - Isi nama: `absensi-generus-sa`
   - Klik **Create and Continue** → **Done**
7. Klik service account yang baru dibuat
8. Buka tab **Keys** → **Add Key → Create new key → JSON** → **Create**
9. File JSON akan terdownload otomatis. **Simpan baik-baik!**

**Dari file JSON tersebut, catat:**
- `client_email` → ini adalah `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` → ini adalah `GOOGLE_PRIVATE_KEY`

---

### LANGKAH 3 — Beri Akses Service Account ke Spreadsheet

1. Buka spreadsheet yang tadi dibuat
2. Klik tombol **Share** (Bagikan)
3. Masukkan email service account (dari `client_email` di file JSON)
4. Pilih role **Editor**
5. Klik **Send / Kirim**

---

### LANGKAH 4 — Setup Google OAuth

1. Di Google Cloud Console → **APIs & Services → Credentials**
2. Klik **"+ Create Credentials" → OAuth client ID**
3. **Application type:** Web application
4. Beri nama: `Absensi Generus`
5. **Authorized redirect URIs:**
   - Untuk development: `http://localhost:3000/api/auth/callback/google`
   - Untuk production (Vercel): `https://NAMA-DOMAIN-KAMU.vercel.app/api/auth/callback/google`
6. Klik **Create**
7. Catat **Client ID** dan **Client Secret**

> ⚠️ Jika muncul "OAuth consent screen" → pilih **External** → isi nama app → Save

---

### LANGKAH 5 — Setup Environment Variables

Salin file `.env.example` menjadi `.env.local`:

```bash
cp .env.example .env.local
```

Isi semua nilai:

```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx

NEXTAUTH_SECRET=isi-dengan-random-string-panjang
NEXTAUTH_URL=http://localhost:3000

SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms

GOOGLE_SERVICE_ACCOUNT_EMAIL=absensi-generus-sa@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"
```

> 💡 Untuk generate `NEXTAUTH_SECRET`: jalankan `openssl rand -base64 32`

---

### LANGKAH 6 — Install & Jalankan Lokal

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

### LANGKAH 7 — Deploy ke Vercel (Gratis)

1. Push project ke **GitHub**:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/USERNAME/absensi-generus.git
   git push -u origin main
   ```

2. Buka [vercel.com](https://vercel.com) → **New Project** → Import dari GitHub

3. Di halaman konfigurasi Vercel, tambahkan semua **Environment Variables** yang sama seperti `.env.local`
   
   > ⚠️ Untuk `NEXTAUTH_URL`, ganti dengan URL Vercel kamu:  
   > `https://absensi-generus.vercel.app`
   
   > ⚠️ Untuk `GOOGLE_PRIVATE_KEY`, pastikan isi value-nya persis seperti di file JSON (dengan `\n` untuk newline)

4. Klik **Deploy** 🚀

5. **Update Google OAuth** dengan URL Vercel:
   - Kembali ke Google Cloud Console → Credentials → OAuth Client
   - Tambah URI baru di **Authorized redirect URIs**:
     ```
     https://NAMA-KAMU.vercel.app/api/auth/callback/google
     ```

---

## 📊 Struktur Google Sheets

Setelah pertama kali login, sheet-sheet ini akan otomatis dibuat:

| Sheet | Kolom | Keterangan |
|-------|-------|------------|
| `users` | id, email, name, image, created_at | Data akun guru |
| `kelompok` | id, user_id, nama_kelompok, tingkatan, desa, daerah, created_at | Data kelompok ngaji |
| `murid` | id, kelompok_id, nama_murid, created_at | Daftar murid |
| `jadwal` | id, kelompok_id, hari, created_at | Jadwal ngaji mingguan |
| `absensi` | id, kelompok_id, murid_id, tanggal, status, dicatat_oleh, created_at | Record absensi |

---

## 🗂 Struktur Folder

```
src/
├── app/
│   ├── page.js              # Root → redirect
│   ├── login/page.js        # Halaman login
│   ├── dashboard/page.js    # List kelompok
│   ├── setup/[id]/page.js   # Setup murid & jadwal
│   ├── kelompok/[id]/page.js # Detail kelompok
│   ├── absensi/[id]/page.js  # Form absensi
│   ├── rekap/[id]/page.js    # Rekap & statistik
│   └── api/
│       ├── auth/[...nextauth]/route.js
│       ├── kelompok/route.js
│       ├── kelompok/[id]/route.js
│       ├── murid/route.js
│       ├── jadwal/route.js
│       ├── absensi/route.js
│       ├── rekap/route.js
│       └── init/route.js
├── components/
│   ├── Navbar.js
│   └── Providers.js
└── lib/
    ├── sheets.js    # Google Sheets client
    └── auth.js      # NextAuth config
```

---

## ❓ FAQ & Troubleshooting

**Q: Sheet tidak terbuat otomatis?**  
A: Pastikan service account sudah diberi akses Editor ke spreadsheet.

**Q: Error "PRIVATE_KEY is not defined"?**  
A: Pastikan `GOOGLE_PRIVATE_KEY` di `.env.local` ditulis dalam tanda kutip dan `\n` tidak diganti newline asli.

**Q: Google OAuth error redirect_uri_mismatch?**  
A: Tambahkan URL callback yang benar di Google Cloud Console OAuth settings.

**Q: Deploy Vercel tapi login tidak bisa?**  
A: Pastikan `NEXTAUTH_URL` sudah diupdate ke URL Vercel, dan redirect URI OAuth sudah ditambah.

---

## 🤝 Kontribusi

Pull request dan issue sangat disambut. Semoga bermanfaat untuk kemajuan generasi penerus! 🌱
