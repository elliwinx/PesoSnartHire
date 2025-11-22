document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("notifModal");
  const jobDetailsModal =
    document.getElementById("jobDetailsModal") || document.createElement("div");

  // Delegate view button clicks
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-view-notif, .view-btn"); // Added .view-btn selector
    if (!btn) return;

    e.stopPropagation();

    const notifId = btn.dataset.notifId || btn.dataset.id; // Handle both dataset attributes
    let related = [];
    try {
      related = JSON.parse(btn.dataset.relatedIds || "[]");
    } catch (err) {
      related = [];
    }
    const jobId = related && related.length ? related[0] : null;

    try {
      await fetch(`/applicants/api/notifications/${notifId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.warn("Failed to mark notification read", err);
    }

    const card = document.querySelector(`[data-notif-id=\"${notifId}\"]`);
    if (card) {
      const badge = card.querySelector(".badge-new");
      if (badge) badge.remove();
      card.classList.add("read");
    }

    if (jobId) {
      try {
        console.log("[v0] Fetching job details for job:", jobId);
        const response = await fetch(`/applicants/job/${jobId}`, {
          credentials: "same-origin",
        });
        if (response.ok) {
          const html = await response.text();
          if (jobDetailsModal) {
            const modalBody =
              jobDetailsModal.querySelector(".modal-body") || jobDetailsModal; // Fallback if modal-body not found
            if (modalBody) {
              modalBody.innerHTML = html;
              const newClose = modalBody.querySelector(".close");
              if (newClose) {
                newClose.onclick = () =>
                  (jobDetailsModal.style.display = "none");
              }
            }
            if (modal) modal.style.display = "none";
            jobDetailsModal.style.display = "flex"; // Ensure flex for centering if using flex
            jobDetailsModal.style.display = "block"; // Or block depending on CSS, but flex is usually safer for centering modals
          }
          return;
        }
      } catch (err) {
        console.error("[v0] Failed to fetch job details:", err);
      }
    }

    if (!modal) return;
    const titleEl = modal.querySelector(".modal-title");
    const bodyEl = modal.querySelector(".modal-body");
    const jobLink = modal.querySelector(".modal-job-link");

    const details = card ? card.querySelector(".details") : null;
    titleEl.textContent = details
      ? details.querySelector("h3").childNodes[0].textContent.trim()
      : "Notification";
    bodyEl.textContent = details
      ? details.querySelector("p").textContent.trim()
      : "";

    if (jobId) {
      jobLink.href = `/job/${jobId}`;
      jobLink.style.display = "inline-block";
    } else {
      jobLink.style.display = "none";
    }

    modal.style.display = "block";
  });

  // Modal close handlers
  const closeBtn = document.getElementById("notifModalClose");
  if (closeBtn)
    closeBtn.addEventListener("click", () => {
      if (modal) modal.style.display = "none";
    });

  const jobModalCloseBtn = jobDetailsModal?.querySelector(".close");
  if (jobModalCloseBtn) {
    jobModalCloseBtn.addEventListener("click", () => {
      if (jobDetailsModal) jobDetailsModal.style.display = "none";
    });
  }

  window.addEventListener("click", (e) => {
    if (modal && e.target === modal) modal.style.display = "none";
    if (jobDetailsModal && e.target === jobDetailsModal)
      jobDetailsModal.style.display = "none";
  });
});
