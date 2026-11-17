CREATE DATABASE IF NOT EXISTS event_booking_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE event_booking_db;

-- 1. Master Link & Konfigurasi Akses
CREATE TABLE IF NOT EXISTS booking_links (
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
CREATE TABLE IF NOT EXISTS booking_schedules (
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
CREATE TABLE IF NOT EXISTS booking_items (
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
CREATE TABLE IF NOT EXISTS booking_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    link_id INT NOT NULL,
    action ENUM('login_success', 'login_failed', 'submitted', 'edited', 'locked') NOT NULL,
    ip_address VARCHAR(45) NULL,
    snapshot_data JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES booking_links(id) ON DELETE CASCADE
);
