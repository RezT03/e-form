const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { requireAdmin } = require('../middleware/adminAuth');
const { 
  generateHashCode, 
  generateRandomPassword, 
  hashPassword, 
  evaluateLinkAccess 
} = require('../utils/linkSecurity');
const { summarizeSchedules } = require('../utils/durationHelper');

/**
 * GET /admin/login
 */
router.get('/login', (req, res) => {
  if (req.session && req.session.adminLoggedIn) {
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: null });
});

/**
 * POST /admin/login
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

  if (username === adminUser && password === adminPass) {
    req.session.adminLoggedIn = true;
    const returnTo = req.session.returnTo || '/admin';
    delete req.session.returnTo;
    return res.redirect(returnTo);
  } else {
    return res.render('admin/login', { error: 'Username atau password admin salah!' });
  }
});

/**
 * GET /admin/logout
 */
router.get('/logout', (req, res) => {
  req.session.adminLoggedIn = false;
  res.redirect('/admin/login');
});

/**
 * GET /admin - Dashboard Overview
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const [links] = await query('SELECT * FROM booking_links ORDER BY created_at DESC');

    // Load schedules for each link to show duration summary and status
    const linkPromises = links.map(async (l) => {
      const [schedules] = await query(
        'SELECT * FROM booking_schedules WHERE link_id = ? ORDER BY event_date ASC, start_time ASC',
        [l.id]
      );
      const summary = summarizeSchedules(schedules);
      const access = evaluateLinkAccess(l, schedules);

      return {
        ...l,
        isExpired: access.isExpired,
        scheduleSummary: summary
      };
    });

    const enrichedLinks = await Promise.all(linkPromises);

    // Compute metrics
    const metrics = {
      total: enrichedLinks.length,
      pending: enrichedLinks.filter(l => l.status === 'pending' && !l.is_locked && !l.isExpired).length,
      submitted: enrichedLinks.filter(l => (l.status === 'submitted' || l.status === 'revised') && !l.is_locked).length,
      locked: enrichedLinks.filter(l => l.is_locked || l.isExpired).length
    };

    res.render('admin/dashboard', {
      links: enrichedLinks,
      metrics
    });
  } catch (err) {
    console.error('[ADMIN DASHBOARD ERROR]', err);
    res.status(500).send('Terjadi kesalahan saat memuat dashboard admin: ' + err.message);
  }
});

/**
 * GET /admin/create-link
 */
router.get('/create-link', requireAdmin, (req, res) => {
  const suggestedPassword = generateRandomPassword();
  res.render('admin/create-link', { suggestedPassword });
});

/**
 * POST /admin/create-link
 */
router.post('/create-link', requireAdmin, async (req, res) => {
  const {
    client_name,
    client_phone,
    event_name,
    event_type,
    link_password,
    allow_edit,
    is_locked,
    expires_at,
    max_submissions,
    lock_before_event_hours,
    allow_custom_items,
    require_terms_agreement,
    client_note
  } = req.body;

  if (!client_name || !link_password) {
    return res.status(400).send('Nama Klien dan Password Akses wajib diisi.');
  }

  try {
    // Generate unique 10-char hash code
    let hashCode = generateHashCode(10);
    let attempts = 0;
    while (attempts < 5) {
      const [existing] = await query('SELECT id FROM booking_links WHERE hash_code = ? LIMIT 1', [hashCode]);
      if (existing.length === 0) break;
      hashCode = generateHashCode(10);
      attempts++;
    }

    // Hash password
    const passwordHash = await hashPassword(link_password.trim());

    // Settings JSON
    const settings = {
      allow_custom_items: allow_custom_items === '1',
      require_terms_agreement: require_terms_agreement === '1',
      client_note: (client_note || '').trim()
    };

    const allowEditVal = allow_edit === '1' ? 1 : 0;
    const isLockedVal = is_locked === '1' ? 1 : 0;
    const maxSubVal = parseInt(max_submissions || '0', 10);
    const lockHoursVal = parseInt(lock_before_event_hours || '24', 10);
    const expiresAtVal = expires_at ? new Date(expires_at) : null;

    const [result] = await query(
      `INSERT INTO booking_links (
        hash_code, password_hash, client_name, client_phone, event_name, event_type,
        allow_edit, is_locked, expires_at, max_submissions, lock_before_event_hours,
        settings, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hashCode,
        passwordHash,
        client_name.trim(),
        (client_phone || '').trim(),
        (event_name || '').trim(),
        (event_type || '').trim(),
        allowEditVal,
        isLockedVal,
        expiresAtVal,
        maxSubVal,
        lockHoursVal,
        JSON.stringify(settings),
        isLockedVal ? 'locked' : 'pending'
      ]
    );

    res.redirect(`/admin/detail/${result.insertId}`);
  } catch (err) {
    console.error('[ADMIN CREATE LINK ERROR]', err);
    res.status(500).send('Gagal membuat link baru: ' + err.message);
  }
});

/**
 * GET /admin/detail/:id - SPK Manifest & Activity Trail
 */
router.get('/detail/:id', requireAdmin, async (req, res) => {
  const linkId = req.params.id;

  try {
    const [links] = await query('SELECT * FROM booking_links WHERE id = ? LIMIT 1', [linkId]);
    if (!links || links.length === 0) {
      return res.status(404).send('Link booking tidak ditemukan.');
    }

    const link = links[0];
    if (typeof link.settings === 'string') {
      try { link.settings = JSON.parse(link.settings); } catch (e) { link.settings = {}; }
    }

    // Schedules & summary
    const [schedules] = await query(
      'SELECT * FROM booking_schedules WHERE link_id = ? ORDER BY event_date ASC, start_time ASC',
      [link.id]
    );
    const summary = summarizeSchedules(schedules);

    // Items
    const [items] = await query('SELECT * FROM booking_items WHERE link_id = ? ORDER BY id ASC', [link.id]);

    // Logs
    const [logs] = await query('SELECT * FROM booking_logs WHERE link_id = ? ORDER BY created_at DESC LIMIT 50', [link.id]);

    res.render('admin/detail', {
      link,
      summary,
      items,
      logs
    });
  } catch (err) {
    console.error('[ADMIN DETAIL ERROR]', err);
    res.status(500).send('Gagal memuat detail pesanan: ' + err.message);
  }
});

/**
 * POST /admin/toggle-lock/:id - AJAX lock/unlock
 */
router.post('/toggle-lock/:id', requireAdmin, async (req, res) => {
  const linkId = req.params.id;
  const isLocked = Boolean(req.body.is_locked);

  try {
    const newStatus = isLocked ? 'locked' : 'pending';
    await query(
      'UPDATE booking_links SET is_locked = ?, status = CASE WHEN status = "locked" AND ? = 0 THEN "pending" WHEN ? = 1 THEN "locked" ELSE status END WHERE id = ?',
      [isLocked ? 1 : 0, isLocked ? 1 : 0, isLocked ? 1 : 0, linkId]
    );

    // Audit log
    const ip = req.ip || req.connection.remoteAddress || 'admin';
    await query(
      'INSERT INTO booking_logs (link_id, action, ip_address, snapshot_data) VALUES (?, ?, ?, ?)',
      [linkId, 'locked', ip, JSON.stringify({ is_locked: isLocked })]
    );

    res.json({ ok: true, is_locked: isLocked });
  } catch (err) {
    console.error('[ADMIN TOGGLE LOCK ERROR]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /admin/delete-link/:id
 */
router.post('/delete-link/:id', requireAdmin, async (req, res) => {
  const linkId = req.params.id;

  try {
    await query('DELETE FROM booking_links WHERE id = ?', [linkId]);
    res.redirect('/admin');
  } catch (err) {
    console.error('[ADMIN DELETE ERROR]', err);
    res.status(500).send('Gagal menghapus link: ' + err.message);
  }
});

module.exports = router;
