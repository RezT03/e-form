const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/db');
const clientRoutes = require('./routes/clientRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS as template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session Management (Per-link password isolation & admin auth)
app.use(session({
  secret: process.env.SESSION_SECRET || 'event-manifest-booking-secret-key-2026',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false, // set to true if using HTTPS in production behind reverse proxy
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Global locals
app.use((req, res, next) => {
  res.locals.currentYear = new Date().getFullYear();
  res.locals.isAdmin = Boolean(req.session && req.session.adminLoggedIn);
  next();
});

// Mount Routes
app.use('/admin', adminRoutes);
app.use('/', clientRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('client/expired', {
    title: 'Halaman Tidak Ditemukan',
    heading: '404 - Halaman Tidak Ditemukan',
    message: 'Halaman atau endpoint yang Anda cari tidak tersedia dalam sistem.'
  });
});

// Central Error Handler
app.use((err, req, res, next) => {
  console.error('[UNCAUGHT ERROR]', err);
  res.status(500).render('client/expired', {
    title: 'Kesalahan Sistem',
    heading: '500 - Internal Server Error',
    message: 'Terjadi kesalahan sistem internal: ' + err.message
  });
});

// Start Server
app.listen(PORT, async () => {
  console.log('====================================================');
  console.log(`[SERVER] Event Equipment E-Form Booking System`);
  console.log(`[SERVER] Running at: http://localhost:${PORT}`);
  console.log(`[SERVER] Admin Panel: http://localhost:${PORT}/admin`);
  console.log('====================================================');

  // Verify MySQL Connection
  const dbStatus = await testConnection();
  if (dbStatus.ok) {
    console.log('[DATABASE] MySQL connection established successfully.');
  } else {
    console.warn('----------------------------------------------------');
    console.warn('[DATABASE WARNING] Could not connect to MySQL:');
    console.warn(`Error: ${dbStatus.error} (${dbStatus.code || 'UNKNOWN'})`);
    console.warn('Pastikan service MySQL / MariaDB telah berjalan di port 3306.');
    console.warn('Untuk menginisialisasi skema database, jalankan: npm run init-db');
    console.warn('----------------------------------------------------');
  }
});
