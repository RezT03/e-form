# PRODUCT & TECHNICAL SPECIFICATION: EVENT EQUIPMENT E-FORM BOOKING SYSTEM

> **INSTRUKSI UNTUK GITHUB COPILOT:**
> Gunakan dokumen ini sebagai *Single Source of Truth* untuk membangun aplikasi web e-form pemesanan perlengkapan event. Patuhi seluruh batasan teknologi, skema database, logika bisnis, dan standar desain antarmuka di bawah ini tanpa menyimpang.

## 1. TECH STACK & STRICT CONSTRAINTS

* **Bahasa Pemrograman:** 100% Pure JavaScript (ES6+ / Node.js). **DILARANG keras menggunakan TypeScript (`.ts`/`.tsx`)**, proses *build* yang rumit, atau *framework* berat yang tidak perlu.

* **Backend:** Node.js + Express.js (CommonJS atau ES Modules konsisten).

* **Template Engine & Frontend:** EJS (Server-Side Rendering) + Vanilla JavaScript + Tailwind CSS (via CDN atau Tailwind CLI).

* **Database:** MySQL / MariaDB menggunakan `mysql2/promise` (sediakan juga file `schema.sql`).

* **Keamanan & Utilitas:**

  * `crypto` (bawaan Node.js) untuk generate hash URL 8–12 karakter.

  * `bcrypt` untuk hashing password per-link.

  * `express-session` untuk manajemen sesi terisolasi per hash link.

  * `express-rate-limit` untuk proteksi *brute-force* pada halaman input password.

  * **Peta & Pencarian Lokasi Gratis (Tanpa API Key Berbayar):** Gunakan **OpenStreetMap Nominatim API** (`https://nominatim.openstreetmap.org/search`) + **Leaflet.js** (via CDN) untuk pencarian lokasi interaktif, disertai input manual untuk menempelkan **Link Google Maps**.

## 2. DESIGN SYSTEM ("NO AI SLOP" DIRECTIVE)

Aplikasi ini digunakan oleh vendor produksi event, *wedding organizer*, dan kru lapangan. Antarmuka harus terasa seperti **Lembar Manifest Produksi / Technical Spec Sheet** yang presisi, bersih, dan fungsional.

* **DILARANG (Anti-AI-Slop):**

  * JANGAN gunakan gradasi ungu/biru/pink, efek *glassmorphism* berlebihan, bayangan (*drop-shadow*) tebal yang mengambang, atau sudut membulat ekstrem (`rounded-2xl`/`rounded-3xl`).

  * JANGAN gunakan emoji sebagai ikon navigasi atau label kategori; gunakan ikon SVG garis tipis (`stroke-width="1.75"`, gaya Lucide/Tabler).

* **WAJIB DITERAPKAN (Utilitarian Technical Aesthetic):**

  * **Palet Warna:**

    * Background Canvas: Warm Stone / Off-White (`#F5F5F4`)

    * Surface / Form Sheet: Pure White (`#FFFFFF`) dengan garis batas tegas `1px solid #D6D3D1`

    * Teks Utama: Deep Charcoal (`#1C1917`), Teks Sekunder: `#57534E`

    * Aksen Utama: Industrial Amber (`#B45309` / `#D97706`) atau Deep Slate (`#0F172A`)

    * Status Badge: Emerald (`#15803D`) untuk aktif/terkirim, Crimson (`#B91C1C`) untuk terkunci/kedaluwarsa.

  * **Tipografi:**

    * UI & Heading: `Plus Jakarta Sans` atau `Inter` (Google Fonts).

    * Angka, Durasi Jam, Kode Hash, Dimensi: `JetBrains Mono` dengan `font-variant-numeric: tabular-nums`.

  * **Geometri:** Sudut tajam/minimalis (`rounded` / `4px`), layout berbasis grid rapi, label input jelas di atas field, dan tampilan *mobile-first* yang nyaman diisi lewat HP di lapangan.

## 3. ARSITEKTUR AKSES & KEAMANAN PER-LINK

### A. Format URL & Login

* Format URL klien: `https://domain.com/?user={hash_code}` (contoh: `/?user=k9P2mX7qL4`, panjang 8–12 karakter alfanumerik aman tanpa karakter ambigu `0, O, I, l`).

* **Password-Only Authentication:** Klien tidak perlu memasukkan username atau email. Halaman awal hanya menampilkan nama klien/event sebagai konfirmasi dan 1 kolom input **Password**.

* **Isolasi Sesi:** Status login disimpan per hash di dalam session: `req.session.unlockedLinks[hash_code] = true`. Membuka link lain di tab berbeda tetap mewajibkan input password untuk link tersebut.

* **Rate Limiting:** Maksimal 5 percobaan password gagal per 15 menit per kombinasi IP + `hash_code`.

### B. Pengaturan Link oleh Admin

Setiap link memiliki konfigurasi yang diatur Admin saat pembuatan link:

1. **Opsi Edit (`allow_edit` & `is_locked`):**

   * `allow_edit` (Boolean): Jika `true`, klien dapat membuka ulang link dan merevisi pesanan setelah submit. Jika `false`, setelah 1x submit form otomatis berubah menjadi mode **Read-Only (Bukti Pemesanan)**.

   * `is_locked` (Boolean): *Override* manual oleh Admin untuk mengunci form kapan saja (misal saat barang sudah naik truk *loading*).

2. **Opsi Kedaluwarsa (`expires_at`, `max_submissions`, `lock_before_event_hours`):**

   * `expires_at` (Datetime, opsional): Jika melewati waktu ini, link menampilkan halaman *Expired* sebelum meminta password.

   * `max_submissions` (Int): `0` = tidak terbatas, `1` = hangus setelah 1x submit.

   * `lock_before_event_hours` (Int): Otomatis mengunci form menjadi *read-only* $X$ jam sebelum tanggal/jam acara pertama dimulai.

3. **Opsi Pengaturan Form Lainnya (disimpan di kolom JSON `settings`):**

   * `allow_custom_items` (Boolean): Mengizinkan klien menambah item di kategori "Lain-lain".

   * `require_terms_agreement` (Boolean): Mewajibkan centang S&K sebelum tombol kirim aktif.

   * `client_note` (String): Catatan/instruksi khusus dari Admin yang tampil sebagai banner di atas form klien.

## 4. SPESIFIKASI FORMULIR KLIEN

### Bagian 1: Informasi Dasar Acara

1. **Jenis Acara (Wajib):**

   * Dropdown / Radio pilihan: `Wedding / Pernikahan`, `Kesenian / Pentas Budaya`, `Wisuda / Akademik`, `Seminar / Konferensi`, `Konser / Festival Musik`, `Corporate / Gathering`, `Pameran / Expo`, `Lainnya` (jika pilih Lainnya, munculkan input teks).

2. **Nama Acara / Judul Event:** Input teks (dapat sudah terisi awal oleh Admin jika ada).

3. **Lokasi Acara (Hybrid Search + Google Maps Link):**

   * **Input Pencarian Lokasi (Gratis):** Input teks dengan *autocomplete* menggunakan API gratis **OpenStreetMap Nominatim** (`limit=5&countrycodes=id`) yang menampilkan koordinat dan mini-map **Leaflet.js** untuk konfirmasi titik lokasi.

   * **Input Nama Gedung / Alamat Lengkap:** Input teks (otomatis terisi dari hasil pencarian peta, namun tetap bisa diedit manual oleh klien).

   * **Input Link Google Maps:** Input URL opsional/wajib agar klien bisa menempelkan tautan share location WhatsApp (`https://maps.app.goo.gl/...`).

### Bagian 2: Tanggal & Waktu Pelaksanaan (Single-Day / Multi-Day)

* Klien dapat memilih apakah acara berlangsung **1 Hari** atau **Lebih dari 1 Hari** (dengan tombol `+ Tambah Tanggal Pelaksanaan`).

* Untuk **setiap tanggal** yang ditambahkan, klien wajib mengisi:

  * `Tanggal` (`YYYY-MM-DD`)

  * `Jam Mulai` (`HH:mm`)

  * `Jam Selesai` (`HH:mm`)

  * `Catatan Hari` (opsional, misal: *"Loading & Check Sound"*, *"Acara Inti"*)

* **Kalkulasi Durasi Otomatis:**

  * Sistem menghitung durasi per hari secara otomatis (mendukung acara lintas tengah malam, misal `19:00` s/d `01:00` = `6 jam`).

  * Di **Panel Admin**, sistem menampilkan rangkuman lengkap:

    * Jumlah total hari pelaksanaan.

    * Rincian durasi masing-masing tanggal (karena beda hari bisa beda jam/durasi).

    * **Total Akumulasi Durasi (Jam)** keseluruhan acara.

### Bagian 3: Daftar Perlengkapan Event (11 Kategori Terstruktur)

Setiap kategori perlengkapan ditampilkan sebagai modul yang dapat diaktifkan/dicentang (`checkbox` / toggle). **ATURAN WAJIB: Setiap item/kategori yang dipilih HARUS memiliki kolom `Keterangan` (catatan teknis/ukuran/warna/spesifikasi).**

 1. **Sound System**

    * Jumlah / Paket (input angka/teks, misal: `1 Paket - 10.000 Watt`)

    * Opsi Wajib: **Include Genset?** (`Ya` / `Tidak`)

    * `Keterangan` (textarea/input)

 2. **LED Screen / Videotron**

    * Jumlah / Dimensi (misal: `1 Set - 3x4 Meter`)

    * Opsi Wajib: **Include Genset?** (`Ya` / `Tidak`)

    * `Keterangan`

 3. **Tenda (Tratak)**

    * Jumlah / Ukuran (misal: `4 Plong / 6x12 Meter`)

    * `Keterangan` (misal: dekorasi plafon, warna kain, dll.)

 4. **Panggung Rigging**

    * Jumlah / Ukuran (misal: `1 Set - 8x6 Meter`)

    * `Keterangan`

 5. **Panggung (Non-Rigging / Level)**

    * Jumlah / Ukuran (misal: `1 Set - 6x4 Meter, Tinggi 60cm`)

    * `Keterangan`

 6. **Kursi (Logika Bersyarat Multi-Tipe)**
    Klien dapat memilih satu atau lebih jenis kursi berikut secara bersamaan:

    * **A. Kursi Futura:**

      * `Jumlah Unit` (angka)

      * `Include Cover?` (`Ya` / `Tidak`)

      * *Jika `Include Cover = Ya`*, muncul pilihan **Cakupan Cover**:

        * `Semua Dicover` (otomatis jumlah cover = jumlah unit)

        * `Sebagian Dicover` -> muncul input wajib `Jumlah Kursi yang Dicover` (angka, validasi `<= Jumlah Unit`).

      * `Keterangan` (misal: warna pita/cover)

    * **B. Kursi Plastik:**

      * `Jumlah Unit` (angka)

      * `Include Cover?` (`Ya` / `Tidak`)

      * *Jika `Include Cover = Ya`*, muncul pilihan **Cakupan Cover**:

        * `Semua Dicover`

        * `Sebagian Dicover` -> muncul input wajib `Jumlah Kursi yang Dicover` (angka, validasi `<= Jumlah Unit`).

      * `Keterangan`

    * **C. Sofa (VIP):**

      * `Jumlah Unit / Seater` (angka)

      * *(Tidak memiliki opsi cover)*

      * `Keterangan` (misal: single seater / double seater, warna)

 7. **Meja (Multi-Bentuk)**
    Klien dapat memilih satu atau kedua bentuk meja berikut:

    * **A. Meja Bulat:** `Jumlah Unit` (angka) + `Keterangan` (misal: diameter, taplak/skirting)

    * **B. Meja Kotak:** `Jumlah Unit` (angka) + `Keterangan`

 8. **Lighting**

    * Jumlah / Paket (misal: `1 Set - Par LED & Moving Head`)

    * Opsi Wajib: **Include Genset?** (`Ya` / `Tidak`)

    * `Keterangan`

 9. **Barrikade**

    * Jumlah Unit / Panjang Meter (angka)

    * `Keterangan` (misal: barrikade besi BRC / pembatas VIP)

10. **Genset (Standalone / Terpisah)**

    * Kapasitas (kVA) & Jumlah Unit (misal: `1 Unit - 60 kVA`)

    * `Keterangan` (misal: durasi standby, panjang kabel)

11. **Lain-lain (Dynamic Repeater)**

    * Tombol `+ Tambah Perlengkapan Lainnya` (bisa menambah banyak baris).

    * Per baris berisi: `Nama Perlengkapan`, `Jumlah & Satuan`, dan `Keterangan`.

## 5. DESAIN DATABASE (`schema.sql`)

```
CREATE DATABASE IF NOT EXISTS event_booking_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE event_booking_db;

-- 1. Master Link & Konfigurasi Akses
CREATE TABLE booking_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hash_code VARCHAR(12) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    
    -- Info Klien & Acara
    client_name VARCHAR(150) NOT NULL,
    client_phone VARCHAR(30) NULL,
    event_type VARCHAR(100) NULL,
    event_name VARCHAR(200) NULL,
    
    -- Lokasi Acara
    venue_name VARCHAR(255) NULL,
    venue_address TEXT NULL,
    latitude DECIMAL(10, 8) NULL,
    longitude DECIMAL(11, 8) NULL,
    gmaps_url TEXT NULL,
    
    -- Opsi 1: Kontrol Edit
    allow_edit BOOLEAN DEFAULT TRUE,
    is_locked BOOLEAN DEFAULT FALSE,
    
    -- Opsi 2: Kedaluwarsa
    expires_at DATETIME NULL,
    max_submissions INT DEFAULT 0,
    submission_count INT DEFAULT 0,
    lock_before_event_hours INT DEFAULT 24,
    
    -- Opsi 3: Pengaturan Tambahan Form (JSON)
    settings JSON NOT NULL,
    
    status ENUM('pending', 'submitted', 'revised', 'locked', 'expired') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Jadwal Pelaksanaan Per Hari (Mendukung Single & Multi-Day Beda Durasi)
CREATE TABLE booking_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    link_id INT NOT NULL,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INT NOT NULL, -- Dihitung otomatis saat simpan
    day_note VARCHAR(255) NULL,
    FOREIGN KEY (link_id) REFERENCES booking_links(id) ON DELETE CASCADE
);

-- 3. Daftar Perlengkapan yang Dipesan
CREATE TABLE booking_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    link_id INT NOT NULL,
    category_key VARCHAR(50) NOT NULL, -- 'sound_system', 'led_screen', 'tenda', 'panggung_rigging', 'panggung', 'kursi_futura', 'kursi_plastik', 'kursi_sofa', 'meja_bulat', 'meja_kotak', 'lighting', 'barrikade', 'genset', 'lain_lain'
    item_label VARCHAR(150) NOT NULL,
    qty_text VARCHAR(100) NOT NULL, -- Bisa angka atau paket misal '100' atau '1 Set (3x4m)'
    attributes JSON NULL, -- Menyimpan: { include_genset: true/false, include_cover: true/false, cover_scope: 'all'|'partial', cover_qty: 50 }
    notes TEXT NULL, -- Kolom Keterangan (Wajib tersedia di setiap item)
    FOREIGN KEY (link_id) REFERENCES booking_links(id) ON DELETE CASCADE
);

-- 4. Log Aktivitas & Audit Trail
CREATE TABLE booking_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    link_id INT NOT NULL,
    action ENUM('login_success', 'login_failed', 'submitted', 'edited', 'locked') NOT NULL,
    ip_address VARCHAR(45) NULL,
    snapshot_data JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES booking_links(id) ON DELETE CASCADE
);

```

## 6. STRUKTUR DIREKTORI PROYEK (PURE JS)

```
event-booking-eform/
├── package.json
├── .env.example
├── schema.sql
├── server.js                  # Entry point Express, session, middleware global
├── config/
│   └── db.js                  # Pool koneksi mysql2/promise
├── utils/
│   ├── linkSecurity.js        # Generator hash 8-12 char, bcrypt, evaluasi izin edit/kedaluwarsa
│   └── durationHelper.js      # Kalkulator durasi per hari & rangkuman akumulasi jam
├── middleware/
│   ├── formGate.js            # Validasi ?user=hash, cek kedaluwarsa, cek password session
│   └── adminAuth.js           # Proteksi dasar untuk halaman admin
├── routes/
│   ├── clientRoutes.js        # GET /?user=..., POST /unlock, POST /submit
│   └── adminRoutes.js         # Dashboard admin, buat link, lihat rangkuman durasi & perlengkapan, kunci/buka link
├── public/
│   ├── css/
│   │   └── custom.css         # Utility tambahan & @media print untuk cetak bukti booking
│   └── js/
│       ├── bookingForm.js     # Logika dinamis UI: multi-day date, Nominatim + Leaflet map, conditional equipment (cover kursi, genset, dll.)
│       └── adminDashboard.js  # Copy link + password ke format pesan WhatsApp, toggle lock
└── views/
    ├── partials/
    │   ├── header.ejs
    │   └── footer.ejs
    ├── client/
    │   ├── password-gate.ejs  # Halaman input password saja
    │   ├── booking-form.ejs   # Form utama (mendukung mode Editable & Read-Only)
    │   └── expired.ejs        # Halaman link kedaluwarsa / tidak valid
    └── admin/
        ├── login.ejs          # Login admin
        ├── dashboard.ejs      # Daftar semua link booking + status + ringkasan durasi
        ├── create-link.ejs    # Form buat link baru + generator password + pengaturan opsi
        └── detail.ejs         # Detail pesanan klien, rangkuman durasi per hari & total, cetak SPK/Manifest

```

## 7. URUTAN IMPLEMENTASI UNTUK COPILOT

Bangun proyek ini secara bertahap dengan urutan berikut:

1. **Fase 1 (Fondasi & Database):** Buat `package.json`, `.env.example`, `schema.sql`, `config/db.js`, dan `server.js`.

2. **Fase 2 (Utilitas & Keamanan):** Buat `utils/linkSecurity.js`, `utils/durationHelper.js`, dan middleware `middleware/formGate.js` serta `middleware/adminAuth.js`.

3. **Fase 3 (Panel Admin):** Buat `routes/adminRoutes.js` beserta views (`login.ejs`, `dashboard.ejs`, `create-link.ejs`, `detail.ejs`) lengkap dengan fitur pembuat link + password, rangkuman durasi multi-hari, dan tombol *Copy WhatsApp Invitation*.

4. **Fase 4 (Formulir Klien & Interaktivitas):** Buat `routes/clientRoutes.js`, views (`password-gate.ejs`, `booking-form.ejs`, `expired.ejs`), serta `public/js/bookingForm.js` untuk menangani jadwal multi-hari, pencarian peta Nominatim + Leaflet + Link Google Maps, dan logika kondisional ke-11 kategori perlengkapan.