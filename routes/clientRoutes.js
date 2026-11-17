const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { 
  loadAndValidateLink, 
  requireLinkUnlocked, 
  passwordAttemptLimiter 
} = require('../middleware/formGate');
const { verifyPassword } = require('../utils/linkSecurity');
const { calculateDurationMinutes, summarizeSchedules } = require('../utils/durationHelper');

/**
 * GET / - Entry point for client booking form or redirect
 */
router.get('/', (req, res, next) => {
  // If user parameter is not present, redirect to admin login
  if (!req.query.user) {
    return res.redirect('/admin');
  }
  next();
}, loadAndValidateLink, requireLinkUnlocked, async (req, res) => {
  const link = req.bookingLink;
  const access = req.linkAccess;

  try {
    // 1. Fetch schedules
    const [schedules] = await query(
      'SELECT * FROM booking_schedules WHERE link_id = ? ORDER BY event_date ASC, start_time ASC',
      [link.id]
    );

    // 2. Fetch items
    const [items] = await query(
      'SELECT * FROM booking_items WHERE link_id = ? ORDER BY id ASC',
      [link.id]
    );

    // 3. Summarize schedule durations
    const summary = summarizeSchedules(schedules);

    // Flash message if redirected after submit
    const flashSuccess = req.session.flashSuccess || null;
    delete req.session.flashSuccess;

    res.render('client/booking-form', {
      link,
      schedules,
      items,
      summary,
      isReadOnly: access.isReadOnly,
      readOnlyReason: access.reason,
      flashSuccess
    });
  } catch (err) {
    console.error('[CLIENT FORM RENDER ERROR]', err);
    res.status(500).render('client/expired', {
      title: 'Kesalahan Sistem',
      heading: 'Gagal Memuat Formulir',
      message: 'Terjadi gangguan saat mengambil data formulir dari database. ' + err.message
    });
  }
});

/**
 * POST /unlock - Password verification per hash link
 */
router.post('/unlock', passwordAttemptLimiter, loadAndValidateLink, async (req, res) => {
  const link = req.bookingLink;
  const password = (req.body.password || '').trim();
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  try {
    const isMatch = await verifyPassword(password, link.password_hash);

    if (isMatch) {
      // Isolate session per hash code
      req.session.unlockedLinks = req.session.unlockedLinks || {};
      req.session.unlockedLinks[link.hash_code] = true;

      // Log success
      await query(
        'INSERT INTO booking_logs (link_id, action, ip_address) VALUES (?, ?, ?)',
        [link.id, 'login_success', ip]
      );

      delete req.session.passwordError;
      return res.redirect(`/?user=${link.hash_code}`);
    } else {
      // Log failed attempt
      await query(
        'INSERT INTO booking_logs (link_id, action, ip_address) VALUES (?, ?, ?)',
        [link.id, 'login_failed', ip]
      );

      return res.render('client/password-gate', {
        link,
        userCode: link.hash_code,
        error: 'Password yang Anda masukkan salah. Silakan periksa kembali.',
        rateLimited: false
      });
    }
  } catch (err) {
    console.error('[UNLOCK ERROR]', err);
    return res.status(500).send('Terjadi kesalahan saat memverifikasi password.');
  }
});

/**
 * POST /submit - Process client booking form submission
 */
router.post('/submit', loadAndValidateLink, requireLinkUnlocked, async (req, res) => {
  const link = req.bookingLink;
  const access = req.linkAccess;

  if (access.isReadOnly) {
    return res.status(403).send('Formulir ini berada dalam mode Read-Only dan tidak dapat diubah.');
  }

  const b = req.body;
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  try {
    // 1. Resolve Event Type & Name
    let eventType = b.event_type_select;
    if (eventType === 'Lainnya' && b.event_type_custom) {
      eventType = b.event_type_custom.trim();
    }
    const eventName = (b.event_name || '').trim();
    const venueAddress = (b.venue_address || '').trim();
    const gmapsUrl = (b.gmaps_url || '').trim();
    const latitude = b.latitude ? parseFloat(b.latitude) : null;
    const longitude = b.longitude ? parseFloat(b.longitude) : null;

    // 2. Process Schedules
    const scheduleDates = Array.isArray(b['schedule_date[]']) ? b['schedule_date[]'] : (b['schedule_date[]'] ? [b['schedule_date[]']] : []);
    const scheduleStarts = Array.isArray(b['schedule_start[]']) ? b['schedule_start[]'] : (b['schedule_start[]'] ? [b['schedule_start[]']] : []);
    const scheduleEnds = Array.isArray(b['schedule_end[]']) ? b['schedule_end[]'] : (b['schedule_end[]'] ? [b['schedule_end[]']] : []);
    const scheduleNotes = Array.isArray(b['schedule_note[]']) ? b['schedule_note[]'] : (b['schedule_note[]'] ? [b['schedule_note[]']] : []);

    // Clear existing schedules for this link
    await query('DELETE FROM booking_schedules WHERE link_id = ?', [link.id]);

    for (let i = 0; i < scheduleDates.length; i++) {
      const eDate = scheduleDates[i];
      const sTime = scheduleStarts[i] || '08:00';
      const eTime = scheduleEnds[i] || '17:00';
      const dNote = scheduleNotes[i] || '';

      if (eDate) {
        const durMins = calculateDurationMinutes(sTime, eTime);
        await query(
          `INSERT INTO booking_schedules (link_id, event_date, start_time, end_time, duration_minutes, day_note)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [link.id, eDate, sTime, eTime, durMins, dNote]
        );
      }
    }

    // 3. Process Equipment Items
    const itemsToInsert = [];

    // Category 1: Sound System
    if (b.cat_sound_system === '1' && b.sound_qty) {
      itemsToInsert.push({
        category_key: 'sound_system',
        item_label: 'Sound System',
        qty_text: b.sound_qty.trim(),
        attributes: { include_genset: b.sound_genset === 'Ya' },
        notes: (b.sound_notes || '').trim()
      });
    }

    // Category 2: LED Screen
    if (b.cat_led_screen === '1' && b.led_qty) {
      itemsToInsert.push({
        category_key: 'led_screen',
        item_label: 'LED Screen / Videotron',
        qty_text: b.led_qty.trim(),
        attributes: { include_genset: b.led_genset === 'Ya' },
        notes: (b.led_notes || '').trim()
      });
    }

    // Category 3: Tenda
    if (b.cat_tenda === '1' && b.tenda_qty) {
      itemsToInsert.push({
        category_key: 'tenda',
        item_label: 'Tenda (Tratak)',
        qty_text: b.tenda_qty.trim(),
        attributes: {},
        notes: (b.tenda_notes || '').trim()
      });
    }

    // Category 4: Panggung Rigging
    if (b.cat_panggung_rigging === '1' && b.rigging_qty) {
      itemsToInsert.push({
        category_key: 'panggung_rigging',
        item_label: 'Panggung Rigging',
        qty_text: b.rigging_qty.trim(),
        attributes: {},
        notes: (b.rigging_notes || '').trim()
      });
    }

    // Category 5: Panggung Non-Rigging
    if (b.cat_panggung === '1' && b.panggung_qty) {
      itemsToInsert.push({
        category_key: 'panggung',
        item_label: 'Panggung (Non-Rigging / Level)',
        qty_text: b.panggung_qty.trim(),
        attributes: {},
        notes: (b.panggung_notes || '').trim()
      });
    }

    // Category 6: Kursi (Multi-Tipe: Futura, Plastik, Sofa)
    if (b.cat_kursi === '1') {
      // Futura
      if (b.kursi_futura_check === '1' && b.futura_qty) {
        itemsToInsert.push({
          category_key: 'kursi_futura',
          item_label: 'Kursi Futura',
          qty_text: b.futura_qty.trim(),
          attributes: {
            include_cover: b.futura_cover === 'Ya',
            cover_scope: b.futura_cover_scope || 'all',
            cover_qty: b.futura_cover_scope === 'partial' ? parseInt(b.futura_cover_qty || '0', 10) : parseInt(b.futura_qty || '0', 10)
          },
          notes: (b.futura_notes || '').trim()
        });
      }

      // Plastik
      if (b.kursi_plastik_check === '1' && b.plastik_qty) {
        itemsToInsert.push({
          category_key: 'kursi_plastik',
          item_label: 'Kursi Plastik',
          qty_text: b.plastik_qty.trim(),
          attributes: {
            include_cover: b.plastik_cover === 'Ya',
            cover_scope: b.plastik_cover_scope || 'all',
            cover_qty: b.plastik_cover_scope === 'partial' ? parseInt(b.plastik_cover_qty || '0', 10) : parseInt(b.plastik_qty || '0', 10)
          },
          notes: (b.plastik_notes || '').trim()
        });
      }

      // Sofa
      if (b.kursi_sofa_check === '1' && b.sofa_qty) {
        itemsToInsert.push({
          category_key: 'kursi_sofa',
          item_label: 'Sofa (VIP)',
          qty_text: b.sofa_qty.trim(),
          attributes: {},
          notes: (b.sofa_notes || '').trim()
        });
      }
    }

    // Category 7: Meja (Bulat & Kotak)
    if (b.cat_meja === '1') {
      if (b.meja_bulat_check === '1' && b.meja_bulat_qty) {
        itemsToInsert.push({
          category_key: 'meja_bulat',
          item_label: 'Meja Bulat (Round Table)',
          qty_text: b.meja_bulat_qty.trim(),
          attributes: {},
          notes: (b.meja_bulat_notes || '').trim()
        });
      }

      if (b.meja_kotak_check === '1' && b.meja_kotak_qty) {
        itemsToInsert.push({
          category_key: 'meja_kotak',
          item_label: 'Meja Kotak (Long Table)',
          qty_text: b.meja_kotak_qty.trim(),
          attributes: {},
          notes: (b.meja_kotak_notes || '').trim()
        });
      }
    }

    // Category 8: Lighting
    if (b.cat_lighting === '1' && b.lighting_qty) {
      itemsToInsert.push({
        category_key: 'lighting',
        item_label: 'Lighting',
        qty_text: b.lighting_qty.trim(),
        attributes: { include_genset: b.lighting_genset === 'Ya' },
        notes: (b.lighting_notes || '').trim()
      });
    }

    // Category 9: Barrikade
    if (b.cat_barrikade === '1' && b.barrikade_qty) {
      itemsToInsert.push({
        category_key: 'barrikade',
        item_label: 'Barrikade',
        qty_text: b.barrikade_qty.trim(),
        attributes: {},
        notes: (b.barrikade_notes || '').trim()
      });
    }

    // Category 10: Genset Terpisah
    if (b.cat_genset === '1' && b.genset_qty) {
      itemsToInsert.push({
        category_key: 'genset',
        item_label: 'Genset (Standalone)',
        qty_text: b.genset_qty.trim(),
        attributes: {},
        notes: (b.genset_notes || '').trim()
      });
    }

    // Category 11: Lain-lain (Custom items)
    if (b.cat_lain_lain === '1' && !(link.settings && link.settings.allow_custom_items === false)) {
      const customNames = Array.isArray(b['custom_name[]']) ? b['custom_name[]'] : (b['custom_name[]'] ? [b['custom_name[]']] : []);
      const customQtys = Array.isArray(b['custom_qty[]']) ? b['custom_qty[]'] : (b['custom_qty[]'] ? [b['custom_qty[]']] : []);
      const customNotes = Array.isArray(b['custom_notes[]']) ? b['custom_notes[]'] : (b['custom_notes[]'] ? [b['custom_notes[]']] : []);

      for (let i = 0; i < customNames.length; i++) {
        const cName = (customNames[i] || '').trim();
        const cQty = (customQtys[i] || '').trim();
        const cNote = (customNotes[i] || '').trim();
        if (cName && cQty) {
          itemsToInsert.push({
            category_key: 'lain_lain',
            item_label: cName,
            qty_text: cQty,
            attributes: {},
            notes: cNote
          });
        }
      }
    }

    // Clear and insert items
    await query('DELETE FROM booking_items WHERE link_id = ?', [link.id]);
    for (const item of itemsToInsert) {
      await query(
        `INSERT INTO booking_items (link_id, category_key, item_label, qty_text, attributes, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [link.id, item.category_key, item.item_label, item.qty_text, JSON.stringify(item.attributes), item.notes]
      );
    }

    // 4. Update booking_links master record
    const nextSubmissionCount = (link.submission_count || 0) + 1;
    const nextStatus = (link.submission_count > 0) ? 'revised' : 'submitted';

    await query(
      `UPDATE booking_links 
       SET event_type = ?, event_name = ?, venue_address = ?, gmaps_url = ?, 
           latitude = ?, longitude = ?, submission_count = ?, status = ?
       WHERE id = ?`,
      [eventType, eventName, venueAddress, gmapsUrl, latitude, longitude, nextSubmissionCount, nextStatus, link.id]
    );

    // 5. Audit Log
    const actionName = (link.submission_count > 0) ? 'edited' : 'submitted';
    const snapshot = {
      eventType,
      eventName,
      itemCount: itemsToInsert.length,
      scheduleCount: scheduleDates.length
    };
    await query(
      'INSERT INTO booking_logs (link_id, action, ip_address, snapshot_data) VALUES (?, ?, ?, ?)',
      [link.id, actionName, ip, JSON.stringify(snapshot)]
    );

    req.session.flashSuccess = 'Lembar manifest pemesanan berhasil disimpan.';
    res.redirect(`/?user=${link.hash_code}`);
  } catch (err) {
    console.error('[SUBMIT ERROR]', err);
    res.status(500).send('Terjadi kesalahan saat menyimpan formulir: ' + err.message);
  }
});

module.exports = router;
