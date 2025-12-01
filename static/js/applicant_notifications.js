document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("notifModal");
  const jobDetailsModal =
    document.getElementById("jobDetailsModal") || document.createElement("div");
  const cancelConfirmModal = document.getElementById("cancelConfirmModal");

  console.log("[v0] applicant_notifications.js loaded");

  // 1. Consolidated function to mark notification as read
  async function markNotificationAsRead(notifId) {
    try {
      await fetch(`/applicants/api/notifications/${notifId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      // Update dot immediately
      if (window.checkAndUpdateNotificationDot) {
        window.checkAndUpdateNotificationDot();
      }

      // Visual update
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

  // 2. Cancel Logic Variables
  let currentApplicationId = null;

  window.cancelApplication = (applicationId) => {
    currentApplicationId = applicationId;
    if (cancelConfirmModal) {
      cancelConfirmModal.style.display = "flex";
    }
  };

  window.proceedCancel = async (applicationId) => {
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
      window.showFlash("An error occurred", "error");
    }
  };

  // 3. Main View Button Handler (The Fix)
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

    // Mark read first
    await markNotificationAsRead(notifId);

    // --- DETECTION LOGIC START ---
    // Find the card to read its title/content
    const card = btn.closest(".notification-card, .card");
    let notifText = "";
    if (card) {
      const titleEl =
        card.querySelector(".details h3") || card.querySelector("h3");
      if (titleEl) notifText = titleEl.textContent.toLowerCase();
    }

    // Determine if this is an Interview or Status update
    const isInterviewOrStatus =
      notifText.includes("interview") ||
      notifText.includes("status") ||
      notifText.includes("application");
    // --- DETECTION LOGIC END ---

    if (jobId) {
      try {
        // We must fetch the job HTML to find the Application ID (hidden in metadata)
        const response = await fetch(`/applicants/job/${jobId}`, {
          credentials: "same-origin",
        });

        if (response.ok) {
          const html = await response.text();

          // Extract Application ID from the response HTML
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          const metaDiv = doc.getElementById("applicationMeta");
          const applicationId = metaDiv ? metaDiv.dataset.applicationId : null;

          const isValidAppId =
            applicationId && applicationId !== "None" && applicationId !== "";

          // >>> ROUTING FIX <<<
          // If it's an Interview/Status Notification AND we have an Application ID,
          // Open the APPLICATION Modal (via applicant.js function) instead of Job Modal.
          if (
            isInterviewOrStatus &&
            isValidAppId &&
            typeof window.viewApplicationDetails === "function"
          ) {
            console.log(
              "[v0] Routing to Application Details for ID:",
              applicationId
            );
            if (modal) modal.style.display = "none"; // Close generic notif modal if open
            window.viewApplicationDetails(applicationId);
            return; // STOP here, do not show Job Details
          }

          // Else: Fallback to showing Job Details (Description, Salary, etc.)
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
            jobDetailsModal.style.display = "flex"; // or "block" depending on your CSS

            // Setup Cancel Button inside Job Modal (if needed)
            const cancelBtn = jobDetailsModal.querySelector(
              "#jobDetailsModalCancelBtn"
            );
            if (cancelBtn) {
              if (isValidAppId) {
                cancelBtn.style.display = "inline-block";
                cancelBtn.dataset.applicationId = applicationId;
                currentApplicationId = applicationId;
                cancelBtn.onclick = () =>
                  window.cancelApplication(applicationId);
              } else {
                cancelBtn.style.display = "none";
              }
            }
          }
          return;
        }
      } catch (err) {
        console.error("Failed to fetch job details:", err);
      }
    }

    // 4. Fallback: Generic Notification Modal (Text Only)
    if (!modal) return;
    const titleEl = modal.querySelector(".modal-title");
    const bodyEl = modal.querySelector(".modal-body");
    const jobLink = modal.querySelector(".modal-job-link");
    const notifCancelBtn = modal.querySelector("#notifModalCancelBtn");

    const details = card ? card.querySelector(".details") : null;

    if (titleEl) {
      titleEl.textContent = details
        ? details.querySelector("h3").textContent.trim()
        : "Notification";
    }
    if (bodyEl) {
      bodyEl.textContent = details
        ? details.querySelector("p").textContent.trim()
        : "";
    }

    if (jobLink) jobLink.style.display = "none";
    if (notifCancelBtn) notifCancelBtn.style.display = "none";

    modal.style.display = "block";
  });

  // --- Confirm Cancel Modal Buttons ---
  const confirmYesBtn = document.getElementById("confirmCancelYes");
  const confirmNoBtn = document.getElementById("confirmCancelNo");

  if (confirmYesBtn) {
    confirmYesBtn.addEventListener("click", () => {
      if (cancelConfirmModal) cancelConfirmModal.style.display = "none";
      if (currentApplicationId) window.proceedCancel(currentApplicationId);
    });
  }

  if (confirmNoBtn) {
    confirmNoBtn.addEventListener("click", () => {
      if (cancelConfirmModal) cancelConfirmModal.style.display = "none";
      currentApplicationId = null;
    });
  }

  // --- Close Handlers ---
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
    if (cancelConfirmModal && e.target === cancelConfirmModal)
      cancelConfirmModal.style.display = "none";
  });

  // Polyfills
  if (typeof window.showLoader !== "function")
    window.showLoader = () => console.log("Loading...");
  if (typeof window.hideLoader !== "function")
    window.hideLoader = () => console.log("Loaded.");
  if (typeof window.showFlash !== "function")
    window.showFlash = (m, t) => alert(m);
});
