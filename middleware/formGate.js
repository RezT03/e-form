const rateLimit = require('express-rate-limit');
const { query } = require('../config/db');
const { evaluateLinkAccess } = require('../utils/linkSecurity');

/**
 * Rate limiter for password gate attempts:
 * Max 5 failed attempts per 15 minutes per IP + hash_code.
 */
const passwordAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userCode = (req.body.user_code || req.query.user || req.params.user || '').trim();
    const ip = req.ip || req.connection.remoteAddress || 'unknown-ip';
    return `${ip}_${userCode}`;
  },
  handler: (req, res) => {
    const userCode = (req.body.user_code || req.query.user || '').trim();
    return res.status(429).render('client/password-gate', {
      link: req.bookingLink || { hash_code: userCode, client_name: 'Klien', event_name: 'Acara' },
      userCode,
      error: 'Terlalu banyak percobaan password salah. Silakan coba lagi setelah 15 menit.',
      rateLimited: true
    });
  }
});

/**
 * Middleware to validate `?user={hash_code}`, check expiration, and load link data
 */
async function loadAndValidateLink(req, res, next) {
  const userCode = (req.query.user || req.body.user_code || req.params.user || '').trim();

  if (!userCode) {
    return res.status(400).render('client/expired', {
      title: 'Link Tidak Valid',
      heading: 'Parameter Link Tidak Ditemukan',
      message: 'Pastikan Anda membuka URL lengkap dengan parameter ?user=kode_link yang diberikan oleh penyelenggara.'
    });
  }

  try {
    // 1. Find link by hash_code
    const [links] = await query('SELECT * FROM booking_links WHERE hash_code = ? LIMIT 1', [userCode]);

    if (!links || links.length === 0) {
      return res.status(404).render('client/expired', {
        title: 'Link Tidak Ditemukan',
        heading: 'Kode Booking Tidak Terdaftar',
        message: 'Link booking yang Anda akses tidak terdaftar dalam sistem atau telah dihapus.'
      });
    }

    const link = links[0];

    // Parse settings JSON if needed
    if (typeof link.settings === 'string') {
      try {
        link.settings = JSON.parse(link.settings);
      } catch (e) {
        link.settings = {};
      }
    } else if (!link.settings) {
      link.settings = {};
    }

    // 2. Fetch schedules for link
    const [schedules] = await query('SELECT * FROM booking_schedules WHERE link_id = ? ORDER BY event_date ASC, start_time ASC', [link.id]);

    // 3. Evaluate access (expiration, lock before event, readonly)
    const access = evaluateLinkAccess(link, schedules);

    // If link is expired, render expired page before asking password
    if (access.isExpired) {
      return res.status(403).render('client/expired', {
        title: 'Link Kedaluwarsa',
        heading: 'Masa Berlaku Link Telah Berakhir',
        message: access.reason || 'Link pemesanan perlengkapan ini sudah melewati batas waktu kedaluwarsa atau batas kuota pengisian.'
      });
    }

    // Attach to request
    req.bookingLink = link;
    req.bookingSchedules = schedules;
    req.linkAccess = access;

    next();
  } catch (err) {
    console.error('[FORM GATE ERROR]', err);
    return res.status(500).render('client/expired', {
      title: 'Terjadi Kesalahan Sistem',
      heading: 'Kesalahan Server',
      message: 'Gagal memproses data link pemesanan. Pastikan database MySQL telah terhubung dengan benar.'
    });
  }
}

/**
 * Middleware ensuring the link has been unlocked in the client's session
 */
function requireLinkUnlocked(req, res, next) {
  const link = req.bookingLink;
  const userCode = link.hash_code;

  req.session.unlockedLinks = req.session.unlockedLinks || {};

  if (!req.session.unlockedLinks[userCode]) {
    // Show password gate
    return res.render('client/password-gate', {
      link,
      userCode,
      error: req.session.passwordError || null,
      rateLimited: false
    });
  }

  // Clear any temporary password error from session
  delete req.session.passwordError;
  next();
}

module.exports = {
  loadAndValidateLink,
  requireLinkUnlocked,
  passwordAttemptLimiter
};
