const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Character set without ambiguous characters (0, O, I, l)
const SAFE_CHARS = '23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generate a secure random hash code (8-12 characters)
 * @param {number} length - Default 10 chars
 * @returns {string}
 */
function generateHashCode(length = 10) {
  if (length < 8) length = 8;
  if (length > 12) length = 12;

  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += SAFE_CHARS[bytes[i] % SAFE_CHARS.length];
  }
  return result;
}

/**
 * Generate a random readable client password (e.g. EVT-7492)
 * @returns {string}
 */
function generateRandomPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numbers = '23456789';
  let prefix = '';
  for (let i = 0; i < 3; i++) {
    prefix += letters[crypto.randomInt(0, letters.length)];
  }
  let digits = '';
  for (let i = 0; i < 4; i++) {
    digits += numbers[crypto.randomInt(0, numbers.length)];
  }
  return `${prefix}-${digits}`;
}

/**
 * Hash a plain text password using bcrypt
 * @param {string} plainPassword 
 * @returns {Promise<string>}
 */
async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

/**
 * Compare plain text password with hashed password
 * @param {string} plainPassword 
 * @param {string} hashedPassword 
 * @returns {Promise<boolean>}
 */
async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Evaluate link status, checking expiration, lock, and edit permissions
 * @param {object} link - Row from booking_links
 * @param {Array} schedules - Rows from booking_schedules
 * @returns {object} statusDetails
 */
function evaluateLinkAccess(link, schedules = []) {
  const now = new Date();

  // 1. Expiration check (Date/Time)
  let isExpiredByDate = false;
  if (link.expires_at) {
    const expiryDate = new Date(link.expires_at);
    if (!isNaN(expiryDate.getTime()) && now > expiryDate) {
      isExpiredByDate = true;
    }
  }

  // 2. Expiration by max submissions
  const maxSubmissions = parseInt(link.max_submissions || 0, 10);
  const submissionCount = parseInt(link.submission_count || 0, 10);
  const isExpiredByMaxSubmissions = (maxSubmissions > 0 && submissionCount >= maxSubmissions && !link.allow_edit);

  const isExpired = isExpiredByDate || isExpiredByMaxSubmissions;

  // 3. Manual admin lock
  const isManuallyLocked = Boolean(link.is_locked || link.status === 'locked');

  // 4. Lock before event hours check
  let isLockedBeforeEvent = false;
  const lockBeforeHours = parseInt(link.lock_before_event_hours || 0, 10);

  if (lockBeforeHours > 0 && Array.isArray(schedules) && schedules.length > 0) {
    // Find earliest event date + start time
    const sortedSchedules = [...schedules].sort((a, b) => {
      const timeA = new Date(`${a.event_date}T${a.start_time}`).getTime();
      const timeB = new Date(`${b.event_date}T${b.start_time}`).getTime();
      return timeA - timeB;
    });

    const earliest = sortedSchedules[0];
    if (earliest && earliest.event_date) {
      const startTimeStr = earliest.start_time || '00:00:00';
      const eventStart = new Date(`${earliest.event_date}T${startTimeStr}`);
      if (!isNaN(eventStart.getTime())) {
        const lockThresholdMs = eventStart.getTime() - (lockBeforeHours * 60 * 60 * 1000);
        if (now.getTime() >= lockThresholdMs) {
          isLockedBeforeEvent = true;
        }
      }
    }
  }

  // 5. Read-Only logic:
  // If allow_edit is false and already submitted at least once, or locked manually, or locked before event
  const allowEdit = Boolean(link.allow_edit);
  const isSubmissionLimitReadOnly = (!allowEdit && submissionCount >= 1);
  const isReadOnly = isManuallyLocked || isLockedBeforeEvent || isSubmissionLimitReadOnly;

  let reason = '';
  if (isExpiredByDate) {
    reason = 'Link ini telah melewati batas waktu kedaluwarsa.';
  } else if (isExpiredByMaxSubmissions) {
    reason = 'Batas maksimal pengisian formulir telah tercapai.';
  } else if (isManuallyLocked) {
    reason = 'Formulir telah dikunci oleh administrator.';
  } else if (isLockedBeforeEvent) {
    reason = `Formulir dikunci otomatis ${lockBeforeHours} jam sebelum acara dimulai.`;
  } else if (isSubmissionLimitReadOnly) {
    reason = 'Formulir telah disubmit dan berada dalam mode bukti pemesanan (Read-Only).';
  }

  return {
    isExpired,
    isReadOnly,
    isManuallyLocked,
    isLockedBeforeEvent,
    isExpiredByDate,
    isExpiredByMaxSubmissions,
    reason
  };
}

module.exports = {
  generateHashCode,
  generateRandomPassword,
  hashPassword,
  verifyPassword,
  evaluateLinkAccess
};
