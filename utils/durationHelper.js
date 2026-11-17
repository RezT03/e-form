/**
 * Parse time string "HH:mm" or "HH:mm:ss" to total minutes from 00:00
 * @param {string} timeStr 
 * @returns {number}
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return (hours * 60) + minutes;
}

/**
 * Calculate duration in minutes between start time and end time.
 * Supports cross-midnight events (e.g., 19:00 to 01:00 = 6 hours = 360 mins).
 * @param {string} startTime 
 * @param {string} endTime 
 * @returns {number} duration in minutes
 */
function calculateDurationMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  if (endMin >= startMin) {
    return endMin - startMin;
  } else {
    // Crosses midnight
    return (24 * 60 - startMin) + endMin;
  }
}

/**
 * Format minutes into Indonesian human-readable string: e.g. "6 Jam", "6 Jam 30 Menit", "45 Menit"
 * @param {number} totalMinutes 
 * @returns {string}
 */
function formatDurationHuman(totalMinutes) {
  const mins = Math.max(0, parseInt(totalMinutes || 0, 10));
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;

  if (hours > 0 && remainingMins > 0) {
    return `${hours} Jam ${remainingMins} Menit`;
  } else if (hours > 0) {
    return `${hours} Jam`;
  } else {
    return `${remainingMins} Menit`;
  }
}

/**
 * Convert minutes to decimal hours, e.g. 390 -> "6.5"
 * @param {number} totalMinutes 
 * @returns {string}
 */
function formatHoursDecimal(totalMinutes) {
  const mins = Math.max(0, parseInt(totalMinutes || 0, 10));
  const hours = (mins / 60).toFixed(1);
  return hours.endsWith('.0') ? hours.slice(0, -2) : hours;
}

/**
 * Format date YYYY-MM-DD to Indonesian format e.g. "Senin, 24 Nov 2026"
 * @param {string} dateStr 
 * @returns {string}
 */
function formatDateIndo(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    return d.toLocaleDateString('id-ID', options);
  } catch (e) {
    return dateStr;
  }
}

/**
 * Summarize an array of schedules
 * @param {Array} schedules 
 * @returns {object}
 */
function summarizeSchedules(schedules = []) {
  const totalDays = schedules.length;
  let totalMinutes = 0;

  const scheduleList = schedules.map((item, idx) => {
    let dur = parseInt(item.duration_minutes || 0, 10);
    if (!dur && item.start_time && item.end_time) {
      dur = calculateDurationMinutes(item.start_time, item.end_time);
    }
    totalMinutes += dur;

    // clean time format HH:mm
    const startClean = (item.start_time || '').slice(0, 5);
    const endClean = (item.end_time || '').slice(0, 5);

    return {
      ...item,
      dayIndex: idx + 1,
      startTimeClean: startClean,
      endTimeClean: endClean,
      dateFormatted: formatDateIndo(item.event_date),
      durationMinutes: dur,
      durationHuman: formatDurationHuman(dur),
      isCrossMidnight: timeToMinutes(endClean) < timeToMinutes(startClean)
    };
  });

  return {
    totalDays,
    totalMinutes,
    totalHoursDecimal: formatHoursDecimal(totalMinutes),
    totalHoursHuman: formatDurationHuman(totalMinutes),
    schedules: scheduleList
  };
}

module.exports = {
  timeToMinutes,
  calculateDurationMinutes,
  formatDurationHuman,
  formatHoursDecimal,
  formatDateIndo,
  summarizeSchedules
};
