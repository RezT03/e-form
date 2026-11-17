/**
 * Admin Dashboard & Detail Interactive Logic
 * WhatsApp Generator & Quick Lock Toggles
 */

document.addEventListener('DOMContentLoaded', () => {
  initLockToggle();
  initWhatsAppModal();
});

/* ==========================================================================
   1. QUICK LOCK / UNLOCK TOGGLE
   ========================================================================== */
function initLockToggle() {
  document.querySelectorAll('.btn-toggle-lock').forEach(btn => {
    btn.addEventListener('click', async () => {
      const linkId = btn.getAttribute('data-id');
      const isLocked = btn.getAttribute('data-locked') === '1';
      const newLocked = !isLocked;

      btn.disabled = true;
      btn.textContent = 'Menyimpan...';

      try {
        const res = await fetch(`/admin/toggle-lock/${linkId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ is_locked: newLocked })
        });

        const data = await res.json();
        if (data.ok) {
          window.location.reload();
        } else {
          alert('Gagal mengubah status lock: ' + (data.error || 'Terjadi kesalahan'));
          btn.disabled = false;
        }
      } catch (err) {
        console.error('Lock toggle error:', err);
        alert('Gagal menghubungi server');
        btn.disabled = false;
      }
    });
  });
}

/* ==========================================================================
   2. WHATSAPP INVITATION GENERATOR & MODAL
   ========================================================================== */
function initWhatsAppModal() {
  const modal = document.getElementById('wa-modal');
  const textArea = document.getElementById('wa-text-area');
  const btnClose = document.getElementById('btn-close-wa-modal');
  const btnCopy = document.getElementById('btn-copy-clipboard');
  const btnOpen = document.getElementById('btn-open-wa');
  const statusLabel = document.getElementById('wa-copied-status');

  if (!modal || !textArea) return;

  document.querySelectorAll('.btn-copy-wa').forEach(btn => {
    btn.addEventListener('click', () => {
      const hash = btn.getAttribute('data-hash');
      const client = btn.getAttribute('data-client') || 'Klien';
      const eventName = btn.getAttribute('data-event') || 'Acara';
      let phone = (btn.getAttribute('data-phone') || '').trim();

      // Format clean phone for WhatsApp international format
      if (phone.startsWith('0')) {
        phone = '62' + phone.slice(1);
      }
      phone = phone.replace(/[^0-9]/g, '');

      const formUrl = `${window.location.origin}/?user=${hash}`;

      const waText = 
`*LEMBAR SPESIFIKASI PEMESANAN PERLENGKAPAN EVENT*
Halo *${client}*,

Berikut adalah link formulir manifest teknis pemesanan perlengkapan untuk:
*${eventName}*

🔗 *Link Formulir:*
${formUrl}

🔑 *Kode Ref:* \`${hash}\`
_Silakan gunakan password akses yang telah disepakati untuk membuka formulir._

Mohon melengkapi rincian tanggal & jam pelaksanaan, titik lokasi Google Maps, serta spesifikasi perlengkapan agar persiapan tim lapangan dapat berjalan presisi.

Terima kasih.
*Tim Produksi & Perlengkapan Event*`;

      textArea.value = waText;

      // Set WhatsApp Web Link
      if (btnOpen) {
        if (phone) {
          btnOpen.href = `https://wa.me/${phone}?text=${encodeURIComponent(waText)}`;
        } else {
          btnOpen.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(waText)}`;
        }
      }

      modal.classList.remove('hidden');

      // Auto copy to clipboard immediately for convenience
      if (navigator.clipboard) {
        navigator.clipboard.writeText(waText).then(() => {
          showCopyNotice();
        }).catch(() => {});
      }
    });
  });

  function showCopyNotice() {
    if (statusLabel) {
      statusLabel.classList.remove('opacity-0');
      statusLabel.classList.add('opacity-100');
      setTimeout(() => {
        statusLabel.classList.remove('opacity-100');
        statusLabel.classList.add('opacity-0');
      }, 2500);
    }
  }

  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      textArea.select();
      if (navigator.clipboard) {
        navigator.clipboard.writeText(textArea.value).then(() => {
          showCopyNotice();
        });
      } else {
        document.execCommand('copy');
        showCopyNotice();
      }
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  // Close when clicking modal backdrop
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });
}
