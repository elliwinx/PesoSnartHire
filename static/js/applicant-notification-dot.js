document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("notifModal");
  const jobDetailsModal =
    document.getElementById("jobDetailsModal") || document.createElement("div");

  // Consolidated function to mark notification as read
  async function markNotificationAsRead(notifId) {
    try {
      await fetch(`/applicants/api/notifications/${notifId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Update dot after marking as read
      if (window.checkAndUpdateNotificationDot) {
        window.checkAndUpdateNotificationDot();
      }

      const card = document.querySelector(`[data-notif-id="${notifId}"]`);
      if (card) {
        const badge = card.querySelector(".badge-new");
        if (badge) badge.remove();
        card.classList.add("read");
      }
    } catch (err) {
      console.warn("Failed to mark notification read", err);
    }
  }

  let currentApplicationId = null;

  // Delegate view button clicks
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-view-notif, .view-btn");
    if (!btn) return;

    e.stopPropagation();

    const notifId = btn.dataset.notifId || btn.dataset.id;
    let related = [];
    try {
      related = JSON.parse(btn.dataset.relatedIds || "[]");
    } catch (err) {
      related = [];
    }
    const jobId = related && related.length ? related[0] : null;

    // Mark as read using consolidated function
    await markNotificationAsRead(notifId);

    if (jobId) {
      try {
        const response = await fetch(`/applicants/job/${jobId}`, {
          credentials: "same-origin",
        });
        if (response.ok) {
          const html = await response.text();
          if (jobDetailsModal) {
            const modalBody =
              jobDetailsModal.querySelector(".modal-body") || jobDetailsModal;
            if (modalBody) {
              modalBody.innerHTML = html;
              const newClose = modalBody.querySelector(".close");
              if (newClose) {
                newClose.onclick = () =>
                  (jobDetailsModal.style.display = "none");
              }
            }
            if (modal) modal.style.display = "none";
            jobDetailsModal.style.display = "flex";
            jobDetailsModal.style.display = "block";

            const applicationIdElement = modalBody.querySelector(
              "[data-application-id]"
            );
            const applicationId = applicationIdElement
              ? applicationIdElement.dataset.applicationId
              : jobId;
            currentApplicationId = applicationId;

            const cancelBtn = jobDetailsModal.querySelector(
              "#jobDetailsModalCancelBtn"
            );
            if (cancelBtn) {
              cancelBtn.style.display = "inline-block";
              cancelBtn.dataset.applicationId = applicationId;
            }
          }
          return;
        }
      } catch (err) {
        console.error("Failed to fetch job details:", err);
      }
    }

    if (!modal) return;
    const titleEl = modal.querySelector(".modal-title");
    const bodyEl = modal.querySelector(".modal-body");
    const jobLink = modal.querySelector(".modal-job-link");
    const cancelBtn = modal.querySelector("#notifModalCancelBtn");

    const details = document.querySelector(
      `[data-notif-id="${notifId}"] .details`
    );
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

    if (jobId) {
      cancelBtn.style.display = "inline-block";
      cancelBtn.dataset.applicationId = jobId;
    } else {
      cancelBtn.style.display = "none";
    }

    modal.style.display = "block";
  });

  const jobDetailsCancelBtn = document.getElementById(
    "jobDetailsModalCancelBtn"
  );
  if (jobDetailsCancelBtn) {
    jobDetailsCancelBtn.addEventListener("click", () => {
      const applicationId = jobDetailsCancelBtn.dataset.applicationId;
      if (applicationId && window.cancelApplication) {
        jobDetailsModal.style.display = "none";
        window.cancelApplication(applicationId);
      }
    });
  }

  const cancelBtn = document.getElementById("notifModalCancelBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      const applicationId = cancelBtn.dataset.applicationId;
      if (applicationId && window.cancelApplication) {
        modal.style.display = "none";
        window.cancelApplication(applicationId);
      }
    });
  }

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

const proceedCancel = async (applicationId) => {
  try {
    window.showLoader("Cancelling application...");
    const response = await fetch(
      `/applicants/api/cancel-application/${applicationId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      }
    );

    window.hideLoader();

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        window.showFlash("Application cancelled successfully", "success");
        // Reload page after 1.5 seconds to reflect changes
        setTimeout(() => window.location.reload(), 1500);
      } else {
        window.showFlash(
          data.message || "Failed to cancel application",
          "error"
        );
      }
    } else {
      window.showFlash("Failed to cancel application", "error");
    }
  } catch (error) {
    window.hideLoader();
    console.error("Error cancelling application:", error);
    window.showFlash(
      "An error occurred while cancelling the application",
      "error"
    );
  }
};

window.cancelApplication = proceedCancel;

const jobDetailsCancelBtn = document.getElementById("jobDetailsModalCancelBtn");
if (jobDetailsCancelBtn) {
  jobDetailsCancelBtn.addEventListener("click", () => {
    const applicationId = jobDetailsCancelBtn.dataset.applicationId;
    if (applicationId && window.cancelApplication) {
      const jobDetailsModal = document.getElementById("jobDetailsModal");
      if (jobDetailsModal) jobDetailsModal.style.display = "none";
      window.cancelApplication(applicationId);
    }
  });
}

const applicationCancelBtn = document.getElementById("applicationCancelBtn");
if (applicationCancelBtn) {
  applicationCancelBtn.addEventListener("click", () => {
    const applicationId = applicationCancelBtn.dataset.applicationId;
    if (applicationId && window.cancelApplication) {
      const modal = document.getElementById("applicationDetailsModal");
      if (modal) modal.style.display = "none";
      window.cancelApplication(applicationId);
    }
  });
}

const cancelBtn = document.getElementById("notifModalCancelBtn");
if (cancelBtn) {
  cancelBtn.addEventListener("click", () => {
    const applicationId = cancelBtn.dataset.applicationId;
    if (applicationId && window.cancelApplication) {
      const modal = document.getElementById("notifModal");
      if (modal) modal.style.display = "none";
      window.cancelApplication(applicationId);
    }
  });
}
