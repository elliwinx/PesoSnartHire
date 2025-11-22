document.addEventListener('DOMContentLoaded', () => {
  // Delegate view button clicks
  document.body.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-view-notif');
    if (!btn) return;

    const notifId = btn.dataset.notifId;
    let related = [];
    try {
      related = JSON.parse(btn.dataset.relatedIds || '[]');
    } catch (err) {
      related = [];
    }
    const jobId = related && related.length ? related[0] : null;

    // Mark notification as read on the server
    try {
      await fetch(`/applicants/api/notifications/${notifId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      // ignore network errors for now
      console.warn('Failed to mark notification read', err);
    }

    // Update UI: remove NEW badge
    const card = document.querySelector(`[data-notif-id=\"${notifId}\"]`);
    if (card) {
      const badge = card.querySelector('.badge-new');
      if (badge) badge.remove();
      card.classList.add('read');
    }

    // Populate and show modal
    const modal = document.getElementById('notifModal');
    if (!modal) return;

    const titleEl = modal.querySelector('.modal-title');
    const bodyEl = modal.querySelector('.modal-body');
    const jobLink = modal.querySelector('.modal-job-link');

    const details = card ? card.querySelector('.details') : null;
    titleEl.textContent = details ? details.querySelector('h3').childNodes[0].textContent.trim() : 'Notification';
    bodyEl.textContent = details ? details.querySelector('p').textContent.trim() : '';

    if (jobId) {
      jobLink.href = `/job/${jobId}`;
      jobLink.style.display = 'inline-block';
    } else {
      jobLink.style.display = 'none';
    }

    modal.style.display = 'block';
  });

  // Modal close handlers
  const closeBtn = document.getElementById('notifModalClose');
  if (closeBtn) closeBtn.addEventListener('click', () => {
    document.getElementById('notifModal').style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    const modal = document.getElementById('notifModal');
    if (modal && e.target === modal) modal.style.display = 'none';
  });
});
