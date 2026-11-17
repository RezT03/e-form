/**
 * Booking Form Client-Side Logic
 * Pure JavaScript - Handles Map, Schedules, Conditional Equipment, Duration
 */

document.addEventListener('DOMContentLoaded', () => {
  initEventType();
  initLeafletMap();
  initSchedules();
  initEquipmentToggles();
  initTermsAgreement();
});

/* ==========================================================================
   1. EVENT TYPE TOGGLE
   ========================================================================== */
function initEventType() {
  const select = document.getElementById('event_type_select');
  const customWrapper = document.getElementById('custom-event-type-wrapper');
  const customInput = document.getElementById('event_type_custom');

  if (!select) return;

  select.addEventListener('change', () => {
    if (select.value === 'Lainnya') {
      customWrapper.classList.remove('hidden');
      if (customInput) customInput.required = true;
    } else {
      customWrapper.classList.add('hidden');
      if (customInput) {
        customInput.required = false;
        customInput.value = '';
      }
    }
  });
}

/* ==========================================================================
   2. LEAFLET MAP & NOMINATIM SEARCH
   ========================================================================== */
function initLeafletMap() {
  const mapElement = document.getElementById('map-container');
  if (!mapElement) return;

  const latInput = document.getElementById('geo-lat');
  const lngInput = document.getElementById('geo-lng');
  const coordDisplay = document.getElementById('coord-display');
  const venueAddress = document.getElementById('venue_address');
  const searchInput = document.getElementById('search-location');
  const searchBtn = document.getElementById('btn-search-location');
  const searchResults = document.getElementById('search-results');

  // Determine initial coordinates (Default: Jakarta Monas if empty)
  let initialLat = parseFloat(latInput.value) || -6.175392;
  let initialLng = parseFloat(lngInput.value) || 106.827153;
  const hasInitialCoords = Boolean(latInput.value && lngInput.value);

  // Initialize Leaflet Map
  const map = L.map('map-container').setView([initialLat, initialLng], hasInitialCoords ? 15 : 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Marker
  let marker = L.marker([initialLat, initialLng], {
    draggable: !mapElement.classList.contains('map-readonly')
  }).addTo(map);

  function updateCoordinates(lat, lng) {
    latInput.value = lat.toFixed(7);
    lngInput.value = lng.toFixed(7);
    if (coordDisplay) {
      coordDisplay.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }

  if (hasInitialCoords) {
    updateCoordinates(initialLat, initialLng);
  }

  // Handle marker drag
  marker.on('dragend', (e) => {
    const pos = e.target.getLatLng();
    updateCoordinates(pos.lat, pos.lng);
  });

  // Handle click on map to move marker
  map.on('click', (e) => {
    if (mapElement.classList.contains('map-readonly')) return;
    marker.setLatLng(e.latlng);
    updateCoordinates(e.latlng.lat, e.latlng.lng);
  });

  // OpenStreetMap Nominatim Location Search
  let searchTimeout = null;

  async function performSearch() {
    const query = (searchInput.value || '').trim();
    if (query.length < 3) return;

    searchBtn.disabled = true;
    searchBtn.textContent = 'Mencari...';

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=id`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();

      searchResults.innerHTML = '';
      if (!data || data.length === 0) {
        searchResults.innerHTML = '<li class="p-2.5 text-stone-500 text-center">Lokasi tidak ditemukan. Coba kata kunci lain.</li>';
      } else {
        data.forEach(item => {
          const li = document.createElement('li');
          li.className = 'p-2.5 hover:bg-stone-100 cursor-pointer text-stone-800 transition';
          li.innerHTML = `<span class="font-semibold block">${item.name || item.display_name.split(',')[0]}</span><span class="text-[11px] text-stone-500 block truncate">${item.display_name}</span>`;
          li.addEventListener('click', () => {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            map.setView([lat, lon], 16);
            marker.setLatLng([lat, lon]);
            updateCoordinates(lat, lon);

            // Autofill address if empty or user wants
            if (venueAddress && (!venueAddress.value || venueAddress.value.trim() === '')) {
              venueAddress.value = item.display_name;
            }

            searchResults.classList.add('hidden');
          });
          searchResults.appendChild(li);
        });
      }
      searchResults.classList.remove('hidden');
    } catch (err) {
      console.error('Nominatim search error:', err);
    } finally {
      searchBtn.disabled = false;
      searchBtn.textContent = 'Cari';
    }
  }

  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        performSearch();
      }
    });

    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      if (searchInput.value.trim().length >= 4) {
        searchTimeout = setTimeout(performSearch, 500);
      } else {
        searchResults.classList.add('hidden');
      }
    });

    // Close search dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target) && !searchBtn.contains(e.target)) {
        searchResults.classList.add('hidden');
      }
    });
  }
}

/* ==========================================================================
   3. SCHEDULES & DURATION CALCULATION
   ========================================================================== */
function timeToMins(tStr) {
  if (!tStr) return 0;
  const [h, m] = tStr.split(':').map(Number);
  return (h * 60) + (m || 0);
}

function calculateRowDuration(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const startMins = timeToMins(startTime);
  const endMins = timeToMins(endTime);

  if (endMins >= startMins) {
    return endMins - startMins;
  } else {
    // Cross midnight e.g. 19:00 to 01:00
    return (24 * 60 - startMins) + endMins;
  }
}

function formatMinsHuman(mins) {
  mins = Math.max(0, mins);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h} Jam ${m} Menit`;
  if (h > 0) return `${h} Jam`;
  return `${m} Menit`;
}

function initSchedules() {
  const container = document.getElementById('schedule-container');
  const btnAdd = document.getElementById('btn-add-day');
  const btnAddWrapper = document.getElementById('btn-add-day-wrapper');
  const singleRadio = document.querySelector('input[name="day_mode"][value="single"]');
  const multiRadio = document.querySelector('input[name="day_mode"][value="multi"]');
  const summaryDays = document.getElementById('summary-total-days');
  const summaryHours = document.getElementById('summary-total-hours');

  function updateAllDurations() {
    const rows = container.querySelectorAll('.schedule-row');
    let totalMins = 0;

    rows.forEach((row, idx) => {
      // Update Day Badge
      const badge = row.querySelector('.day-badge');
      if (badge) badge.textContent = `HARI KE-${idx + 1}`;

      const startInput = row.querySelector('input[name="schedule_start[]"]');
      const endInput = row.querySelector('input[name="schedule_end[]"]');
      const durLabel = row.querySelector('.row-duration');
      const removeBtn = row.querySelector('.btn-remove-day');

      if (removeBtn) {
        if (rows.length <= 1) {
          removeBtn.classList.add('hidden');
        } else {
          removeBtn.classList.remove('hidden');
        }
      }

      if (startInput && endInput && durLabel) {
        const dur = calculateRowDuration(startInput.value, endInput.value);
        totalMins += dur;

        const isCross = timeToMins(endInput.value) < timeToMins(startInput.value);
        durLabel.textContent = `Durasi: ${formatMinsHuman(dur)}${isCross ? ' (Lintas Hari)' : ''}`;
      }
    });

    if (summaryDays) {
      summaryDays.textContent = `${rows.length} Hari Pelaksanaan`;
    }
    if (summaryHours) {
      summaryHours.textContent = formatMinsHuman(totalMins);
    }
  }

  // Bind change events to time inputs
  if (container) {
    container.addEventListener('change', (e) => {
      if (e.target.classList.contains('time-input')) {
        updateAllDurations();
      }
    });

    // Delegate row removal
    container.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.btn-remove-day');
      if (removeBtn) {
        const rows = container.querySelectorAll('.schedule-row');
        if (rows.length > 1) {
          const row = removeBtn.closest('.schedule-row');
          row.remove();
          updateAllDurations();
        }
      }
    });
  }

  // Radio Day Mode toggle
  if (singleRadio && multiRadio) {
    singleRadio.addEventListener('change', () => {
      if (singleRadio.checked) {
        if (btnAddWrapper) btnAddWrapper.classList.add('hidden');
        // If there are more than 1 row, ask or keep first
        const rows = container.querySelectorAll('.schedule-row');
        for (let i = 1; i < rows.length; i++) {
          rows[i].remove();
        }
        updateAllDurations();
      }
    });

    multiRadio.addEventListener('change', () => {
      if (multiRadio.checked) {
        if (btnAddWrapper) btnAddWrapper.classList.remove('hidden');
      }
    });
  }

  // Add Day Button
  if (btnAdd && container) {
    btnAdd.addEventListener('click', () => {
      const rows = container.querySelectorAll('.schedule-row');
      const nextIdx = rows.length;

      // Suggest next date based on last row
      let nextDateStr = '';
      if (rows.length > 0) {
        const lastDateInput = rows[rows.length - 1].querySelector('input[name="schedule_date[]"]');
        if (lastDateInput && lastDateInput.value) {
          const d = new Date(lastDateInput.value);
          d.setDate(d.getDate() + 1);
          nextDateStr = d.toISOString().slice(0, 10);
        }
      }

      const newRow = document.createElement('div');
      newRow.className = 'schedule-row bg-stone-50 border border-stone-300 rounded p-4 relative';
      newRow.dataset.index = nextIdx;
      newRow.innerHTML = `
        <div class="flex items-center justify-between mb-3 text-xs">
          <span class="font-mono font-bold text-stone-700 uppercase tracking-wider day-badge">
            HARI KE-${nextIdx + 1}
          </span>
          <div class="flex items-center space-x-3">
            <span class="font-mono text-xs text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded border border-amber-300 row-duration">
              Durasi: Menghitung...
            </span>
            <button type="button" class="btn-remove-day text-stone-400 hover:text-red-600" title="Hapus Tanggal">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          <div>
            <label class="block text-[11px] font-semibold uppercase text-stone-600 mb-1">
              Tanggal <span class="text-red-500">*</span>
            </label>
            <input 
              type="date" 
              name="schedule_date[]" 
              required 
              value="${nextDateStr}"
              class="w-full px-2.5 py-2 text-xs font-mono border border-stone-300 rounded"
            >
          </div>

          <div>
            <label class="block text-[11px] font-semibold uppercase text-stone-600 mb-1">
              Jam Mulai <span class="text-red-500">*</span>
            </label>
            <input 
              type="time" 
              name="schedule_start[]" 
              required 
              value="08:00"
              class="w-full px-2.5 py-2 text-xs font-mono border border-stone-300 rounded time-input"
            >
          </div>

          <div>
            <label class="block text-[11px] font-semibold uppercase text-stone-600 mb-1">
              Jam Selesai <span class="text-red-500">*</span>
            </label>
            <input 
              type="time" 
              name="schedule_end[]" 
              required 
              value="17:00"
              class="w-full px-2.5 py-2 text-xs font-mono border border-stone-300 rounded time-input"
            >
          </div>

          <div>
            <label class="block text-[11px] font-semibold uppercase text-stone-600 mb-1">
              Catatan Hari (Opsional)
            </label>
            <input 
              type="text" 
              name="schedule_note[]" 
              placeholder="Misal: Acara Hari Ke-2, Penutupan"
              class="w-full px-2.5 py-2 text-xs border border-stone-300 rounded font-sans"
            >
          </div>
        </div>
      `;

      container.appendChild(newRow);
      updateAllDurations();
    });
  }

  // Initial calculation on page load
  updateAllDurations();
}

/* ==========================================================================
   4. EQUIPMENT ACCORDIONS & CONDITIONAL LOGIC
   ========================================================================== */
function initEquipmentToggles() {
  // Main Category Checkbox Toggles
  document.querySelectorAll('.cat-toggle').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const targetId = toggle.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        if (toggle.checked) {
          targetEl.classList.remove('hidden');
        } else {
          targetEl.classList.add('hidden');
        }
      }
    });
  });

  // Kursi Sub-Toggles (Futura, Plastik, Sofa)
  document.querySelectorAll('.kursi-sub-toggle').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const targetId = toggle.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        if (toggle.checked) {
          targetEl.classList.remove('hidden');
        } else {
          targetEl.classList.add('hidden');
        }
      }
    });
  });

  // Meja Sub-Toggles (Bulat, Kotak)
  document.querySelectorAll('.meja-sub-toggle').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const targetId = toggle.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        if (toggle.checked) {
          targetEl.classList.remove('hidden');
        } else {
          targetEl.classList.add('hidden');
        }
      }
    });
  });

  // Cover Conditional Logic for Futura & Plastik
  document.querySelectorAll('.cover-select').forEach(select => {
    select.addEventListener('change', () => {
      const targetWrapperId = select.getAttribute('data-scope-target');
      const wrapper = document.getElementById(targetWrapperId);
      if (wrapper) {
        if (select.value === 'Ya') {
          wrapper.classList.remove('hidden');
        } else {
          wrapper.classList.add('hidden');
        }
      }
    });
  });

  // Cover Scope Radio (Semua Dicover vs Sebagian Dicover)
  document.querySelectorAll('.cover-scope-radio').forEach(radio => {
    radio.addEventListener('change', () => {
      const partialTargetId = radio.getAttribute('data-partial-target');
      const partialWrapper = document.getElementById(partialTargetId);
      if (partialWrapper) {
        if (radio.value === 'partial') {
          partialWrapper.classList.remove('hidden');
        } else {
          partialWrapper.classList.add('hidden');
        }
      }
    });
  });

  // Cover quantity validation vs unit quantity
  const futuraQty = document.getElementById('futura_qty');
  const futuraCoverQty = document.getElementById('futura_cover_qty');
  if (futuraQty && futuraCoverQty) {
    futuraCoverQty.addEventListener('input', () => {
      const max = parseInt(futuraQty.value || '0', 10);
      const cur = parseInt(futuraCoverQty.value || '0', 10);
      if (max > 0 && cur > max) {
        futuraCoverQty.value = max;
        alert(`Jumlah cover futura tidak boleh melebihi total unit kursi (${max})`);
      }
    });
  }

  const plastikQty = document.getElementById('plastik_qty');
  const plastikCoverQty = document.getElementById('plastik_cover_qty');
  if (plastikQty && plastikCoverQty) {
    plastikCoverQty.addEventListener('input', () => {
      const max = parseInt(plastikQty.value || '0', 10);
      const cur = parseInt(plastikCoverQty.value || '0', 10);
      if (max > 0 && cur > max) {
        plastikCoverQty.value = max;
        alert(`Jumlah cover plastik tidak boleh melebihi total unit kursi (${max})`);
      }
    });
  }

  // Dynamic Repeater for Lain-lain
  const btnAddCustom = document.getElementById('btn-add-custom-item');
  const customContainer = document.getElementById('custom-items-container');

  if (btnAddCustom && customContainer) {
    btnAddCustom.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'custom-item-row p-3 bg-stone-50 border border-stone-200 rounded grid grid-cols-1 sm:grid-cols-12 gap-3 items-start';
      row.innerHTML = `
        <div class="sm:col-span-4">
          <label class="block font-semibold uppercase text-stone-600 mb-1">Nama Perlengkapan <span class="text-red-500">*</span></label>
          <input type="text" name="custom_name[]" placeholder="Misal: Kipas Blower / Handy Talky" required class="w-full px-2.5 py-1.5 border border-stone-300 rounded font-sans">
        </div>
        <div class="sm:col-span-3">
          <label class="block font-semibold uppercase text-stone-600 mb-1">Jumlah & Satuan <span class="text-red-500">*</span></label>
          <input type="text" name="custom_qty[]" placeholder="Misal: 6 Unit" required class="w-full px-2.5 py-1.5 border border-stone-300 rounded font-sans">
        </div>
        <div class="sm:col-span-4">
          <label class="block font-semibold uppercase text-stone-600 mb-1">Keterangan <span class="text-red-500">*</span></label>
          <input type="text" name="custom_notes[]" placeholder="Catatan teknis perlengkapan" required class="w-full px-2.5 py-1.5 border border-stone-300 rounded font-sans">
        </div>
        <div class="sm:col-span-1 pt-6 text-center">
          <button type="button" class="btn-remove-custom text-stone-400 hover:text-red-600">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      `;
      customContainer.appendChild(row);
    });

    customContainer.addEventListener('click', (e) => {
      const btnRemove = e.target.closest('.btn-remove-custom');
      if (btnRemove) {
        const row = btnRemove.closest('.custom-item-row');
        if (row) row.remove();
      }
    });
  }
}

/* ==========================================================================
   5. TERMS AGREEMENT & SUBMIT BUTTON VALIDATION
   ========================================================================== */
function initTermsAgreement() {
  const termsCheckbox = document.getElementById('terms-agree');
  const submitBtn = document.getElementById('btn-submit-form');
  const form = document.getElementById('booking-form');

  if (termsCheckbox && submitBtn) {
    termsCheckbox.addEventListener('change', () => {
      if (termsCheckbox.checked) {
        submitBtn.classList.remove('opacity-50', 'pointer-events-none');
      } else {
        submitBtn.classList.add('opacity-50', 'pointer-events-none');
      }
    });
  }

  // Validate that checked equipment categories have their mandatory Keterangan filled
  if (form) {
    form.addEventListener('submit', (e) => {
      // 1. Validate custom items if category is checked
      const catLain = document.querySelector('input[name="cat_lain_lain"]');
      if (catLain && catLain.checked) {
        const customRows = document.querySelectorAll('.custom-item-row');
        for (const row of customRows) {
          const name = row.querySelector('input[name="custom_name[]"]');
          const qty = row.querySelector('input[name="custom_qty[]"]');
          const note = row.querySelector('input[name="custom_notes[]"]');
          if (name && !name.value.trim()) {
            alert('Silakan isi Nama Perlengkapan untuk item tambahan.');
            name.focus();
            e.preventDefault();
            return;
          }
          if (qty && !qty.value.trim()) {
            alert('Silakan isi Jumlah & Satuan untuk item tambahan.');
            qty.focus();
            e.preventDefault();
            return;
          }
          if (note && !note.value.trim()) {
            alert('Silakan isi Kolom Keterangan untuk item tambahan.');
            note.focus();
            e.preventDefault();
            return;
          }
        }
      }

      // 2. Validate at least one schedule row has date
      const dateInputs = document.querySelectorAll('input[name="schedule_date[]"]');
      let hasValidDate = false;
      dateInputs.forEach(d => {
        if (d.value) hasValidDate = true;
      });

      if (!hasValidDate) {
        alert('Silakan tentukan minimal 1 tanggal pelaksanaan acara.');
        e.preventDefault();
        return;
      }
    });
  }
}
