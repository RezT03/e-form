# EVENT EQUIPMENT E-FORM BOOKING SYSTEM
### Production Manifest & Technical Spec Sheet

Aplikasi web e-form pemesanan perlengkapan event profesional yang dirancang khusus untuk vendor produksi event, *wedding organizer*, dan kru lapangan dengan standar desain antarmuka **Lembar Manifest Produksi / Technical Spec Sheet** (No AI-Slop, utilitarian, presisi, dan fungsional).

---

## 1. TECH STACK & ARSITEKTUR

* **Bahasa:** 100% Pure JavaScript (ES6+ / Node.js).
* **Backend:** Node.js + Express.js.
* **Template Engine & UI:** EJS (Server-Side Rendering) + Vanilla JavaScript + Tailwind CSS (via CDN) + Custom CSS (`@media print` untuk SPK).
* **Database:** MySQL / MariaDB menggunakan `mysql2/promise` (`schema.sql` disertakan).
* **Keamanan:**
  * `crypto` (bawaan Node.js) untuk generator URL hash 8–12 karakter aman (tanpa karakter ambigu `0, O, I, l`).
  * `bcryptjs` untuk enkripsi password per-link.
  * `express-session` untuk isolasi sesi login per hash link (`req.session.unlockedLinks[hash_code]`).
  * `express-rate-limit` proteksi brute-force pada password gate (maks 5 percobaan gagal / 15 menit).
* **Peta & Lokasi Gratis:**
  * OpenStreetMap Nominatim API (`https://nominatim.openstreetmap.org/search?limit=5&countrycodes=id`) untuk pencarian lokasi bebas biaya.
  * Leaflet.js untuk pin point koordinat interaktif.
  * Input tautan manual Google Maps / share location WhatsApp.

---

## 2. FITUR UTAMA

### A. Panel Admin (`/admin`)
1. **Autentikasi Admin:** Proteksi rute admin via session.
2. **Dashboard Overview:** Metrik total link, status (Pending, Submitted, Revised, Locked, Expired), dan ringkasan durasi per-link.
3. **Pembuat Link Baru (`/admin/create-link`):**
   * Generator password acak / manual.
   * Kontrol revisi: `allow_edit` (bisa edit ulang atau hangus jadi Read-Only setelah 1x submit) dan manual `is_locked`.
   * Kontrol kedaluwarsa: `expires_at`, `max_submissions`, dan `lock_before_event_hours` (otomatis lock $X$ jam sebelum acara pertama).
   * Settings JSON: `allow_custom_items`, `require_terms_agreement`, dan `client_note` (banner instruksi khusus untuk klien).
4. **Copy Undangan WhatsApp:** Generator otomatis format teks undangan rapi berisi link dan instruksi siap kirim via WhatsApp Web / API.
5. **Quick Lock / Unlock:** Toggle instan status kunci form langsung dari dashboard tanpa edit form.
6. **Detail Manifest & Cetak SPK (`/admin/detail/:id`):** Rangkuman detail per-hari, total akumulasi durasi (jam), tabel 11 kategori perlengkapan, dan cetak SPK siap tanda tangan fisik kru.

### B. Formulir Klien (`/?user={hash_code}`)
1. **Password-Only Gate:** Klien tidak perlu registrasi/username/email. Cukup masukkan password untuk membuka form sesuai nama pemesan.
2. **Bagian 1: Informasi Acara & Peta:**
   * Dropdown jenis acara + custom text jika memilih "Lainnya".
   * Autocomplete pencarian gedung/alamat via OpenStreetMap Nominatim + Leaflet Map.
   * Input link Google Maps untuk navigasi kru truk loading.
3. **Bagian 2: Single & Multi-Day Schedule:**
   * Pilihan 1 Hari vs Multi-Day dengan tombol `+ Tambah Tanggal Pelaksanaan`.
   * Kalkulasi durasi otomatis per-hari (mendukung acara lintas tengah malam, misal 19:00 s/d 01:00 = 6 jam).
   * Live counter total hari dan total jam akumulasi acara.
4. **Bagian 3: 11 Kategori Perlengkapan Terstruktur:**
   * Setiap item yang dicentang **WAJIB** mengisi kolom **Keterangan**.
   * **Sound System:** Qty/Paket, Include Genset (Ya/Tidak), Keterangan.
   * **LED Screen / Videotron:** Qty/Dimensi, Include Genset (Ya/Tidak), Keterangan.
   * **Tenda (Tratak):** Qty/Ukuran, Keterangan.
   * **Panggung Rigging:** Qty/Ukuran, Keterangan.
   * **Panggung Non-Rigging / Level:** Qty/Ukuran, Keterangan.
   * **Kursi (Multi-Tipe):**
     * Futura: Qty, Include Cover (Ya/Tidak), Cakupan Cover (Semua / Sebagian dengan Qty Cover <= Qty Unit), Keterangan.
     * Plastik: Qty, Include Cover (Ya/Tidak), Cakupan Cover (Semua / Sebagian dengan Qty Cover <= Qty Unit), Keterangan.
     * Sofa VIP: Qty, Keterangan.
   * **Meja (Multi-Bentuk):** Meja Bulat dan/atau Meja Kotak + Keterangan.
   * **Lighting:** Qty/Paket, Include Genset (Ya/Tidak), Keterangan.
   * **Barrikade:** Qty/Panjang, Keterangan.
   * **Genset Terpisah:** Kapasitas (kVA) & Unit, Keterangan.
   * **Lain-lain:** Dynamic repeater `+ Tambah Perlengkapan Lainnya`.
5. **Mode Read-Only / Bukti Pemesanan:**
   * Otomatis berubah menjadi Read-Only jika `allow_edit = false` setelah 1x submit, form dikunci admin, atau waktu lock sebelum acara tercapai.
   * Dilengkapi tombol "Cetak Bukti Pemesanan".

---

## 3. STRUKTUR DIREKTORI

```
e-form/
├── package.json
├── .env.example
├── .env
├── schema.sql
├── server.js                  # Entry point Express, session, global middleware
├── scripts/
│   └── initDb.js              # Script inisialisasi database & tabel MySQL
├── config/
│   └── db.js                  # Pool koneksi mysql2/promise
├── utils/
│   ├── linkSecurity.js        # Generator hash 8-12 char, bcrypt, evaluasi akses & lock
│   └── durationHelper.js      # Kalkulator durasi per hari, lintas malam, & rangkuman jam
├── middleware/
│   ├── formGate.js            # Validasi ?user=hash, rate limiting, cek expired & session
│   └── adminAuth.js           # Proteksi rute admin
├── routes/
│   ├── clientRoutes.js        # GET /?user=..., POST /unlock, POST /submit
│   └── adminRoutes.js         # Dashboard admin, create-link, detail SPK, lock toggle
├── public/
│   ├── css/
│   │   └── custom.css         # Styling technical sheet & @media print
│   └── js/
│       ├── bookingForm.js     # Interaktivitas peta, durasi live, kondisional perlengkapan
│       └── adminDashboard.js  # Generator pesan WhatsApp, quick lock toggle
└── views/
    ├── partials/
    │   ├── header.ejs         # Header utilitarian & asset loader
    │   └── footer.ejs         # Footer teknis & leaflet loader
    ├── client/
    │   ├── password-gate.ejs  # Halaman verifikasi password saja
    │   ├── booking-form.ejs   # Form utama (mode Editable & Read-Only)
    │   └── expired.ejs        # Halaman link kedaluwarsa / akses ditolak
    └── admin/
        ├── login.ejs          # Login admin
        ├── dashboard.ejs      # Daftar semua link & ringkasan status
        ├── create-link.ejs    # Form pembuatan link baru & opsi form
        └── detail.ejs         # Detail pesanan klien & SPK cetak manifest
```

---

## 4. CARA MENJALANKAN APLIKASI

### Langkah 1: Konfigurasi Environment
Pastikan file `.env` sudah sesuai dengan kredensial MySQL lokal Anda:
```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=event-booking-eform-secret-key-production-ready-2026

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=event_booking_db

ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### Langkah 2: Inisialisasi Database
Jalankan script untuk membuat database dan tabel secara otomatis:
```bash
npm run init-db
```
*(Atau Anda dapat mengimpor file `schema.sql` secara manual melalui phpMyAdmin, MySQL Workbench, atau MySQL CLI).*

### Langkah 3: Menjalankan Server
```bash
npm start
```
Atau untuk mode pengembangan:
```bash
npm run dev
```

Buka di browser:
* **Admin Dashboard:** `http://localhost:3000/admin` (Login default: `admin` / `admin123`)
* **Lembar Klien:** `http://localhost:3000/?user={hash_code}` (Dihasilkan saat membuat link baru di Admin).
