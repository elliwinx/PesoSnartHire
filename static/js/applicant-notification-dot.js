document.addEventListener("DOMContentLoaded", () => {
  // 1. Define the checker function globally
  window.checkAndUpdateNotificationDot = async function () {
    try {
      const response = await fetch(
        "/applicants/api/notifications/unread-count"
      );
      if (response.ok) {
        const data = await response.json();
        const count = data.count || 0;

        // TARGET YOUR SPECIFIC BADGE ID HERE
        const badge = document.getElementById("notifBadge");

        if (badge) {
          if (count > 0) {
            // Show the dot (inline usually works best for spans inside links)
            badge.style.display = "inline-block";
            // Optional: If you want to show the number, uncomment the next line
            // badge.textContent = count > 99 ? '99+' : count;
          } else {
            // Hide the dot
            badge.style.display = "none";
          }
        }
      }
    } catch (err) {
      console.warn("[v0] Failed to check notification dot:", err);
    }
  };

  // 2. Run immediately on load
  window.checkAndUpdateNotificationDot();

  // 3. Keep checking every 30 seconds (polling)
  setInterval(window.checkAndUpdateNotificationDot, 30000);

  // --- Existing Modal Logic Below (Kept from your original file) ---
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

      // Update dot immediately after marking as read
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
