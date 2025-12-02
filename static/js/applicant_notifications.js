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

  // 3. Main View Button Handler (FIXED)
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-view-notif, .view-btn");
    if (!btn) return;

    e.stopPropagation();

    const notifId = btn.dataset.notifId || btn.dataset.id;
    const notifType = btn.dataset.type;

    // Grab content directly from data attributes
    // Ensure your HTML uses data-title and data-message on the button
    const notifTitle = btn.getAttribute("data-title") || btn.dataset.title;
    const notifMessage =
      btn.getAttribute("data-message") || btn.dataset.message;

    let related = [];
    try {
      related = JSON.parse(btn.dataset.relatedIds || "[]");
    } catch (err) {
      related = [];
    }
    const jobId = related && related.length ? related[0] : null;

    // Mark read
    await markNotificationAsRead(notifId);

    // --- CASE 1: REPORT & GENERIC NOTIFICATIONS ---
    // Stop here if it is a report verdict. Do not fetch job details.
    if (
      notifType === "report_verdict" ||
      notifType === "report_filed" ||
      notifType === "applicant_reported" ||
      notifType === "employer_reported" ||
      !jobId
    ) {
      const modal = document.getElementById("notifModal");

      // Use explicit IDs from your HTML template
      const titleEl = document.getElementById("notifModalTitle");
      const bodyEl = document.getElementById("notifModalBody");
      const jobLink = document.querySelector("#notifModal .modal-job-link");
      const notifCancelBtn = document.getElementById("notifModalCancelBtn");

      if (modal) {
        if (titleEl) titleEl.textContent = notifTitle || "Notification";
        if (bodyEl)
          bodyEl.textContent = notifMessage || "No details available.";

        // Hide unrelated buttons inside this generic modal
        if (jobLink) jobLink.style.display = "none";
        if (notifCancelBtn) notifCancelBtn.style.display = "none";

        modal.style.display = "flex";
        modal.style.alignItems = "center";
        modal.style.justifyContent = "center";
      }
      return; // STOP EXECUTION HERE
    }

    // --- CASE 2: JOB / APPLICATION NOTIFICATIONS ---
    if (jobId) {
      try {
        const response = await fetch(`/applicants/job/${jobId}`, {
          credentials: "same-origin",
        });
        if (response.ok) {
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          const metaDiv = doc.getElementById("applicationMeta");
          const applicationId = metaDiv ? metaDiv.dataset.applicationId : null;
          const isValidAppId =
            applicationId && applicationId !== "None" && applicationId !== "";

          // If user has applied, show the Application Details Modal (Status/Interview)
          if (
            isValidAppId &&
            typeof window.viewApplicationDetails === "function"
          ) {
            if (modal) modal.style.display = "none";
            window.viewApplicationDetails(applicationId);
            return;
          }

          // Otherwise, show Job Details Modal (Description/Salary)
          if (jobDetailsModal) {
            const innerBody =
              jobDetailsModal.querySelector("#modal-body-unique") ||
              jobDetailsModal.querySelector(".modal-body");
            if (innerBody) innerBody.innerHTML = html;
            if (modal) modal.style.display = "none";
            jobDetailsModal.style.display = "flex";

            const cancelBtn = jobDetailsModal.querySelector(
              "#jobDetailsModalCancelBtn"
            );
            if (cancelBtn) cancelBtn.style.display = "none";
          }
          return;
        }
      } catch (err) {
        console.error("Failed to fetch details:", err);
      }
    }

    // Final fallback
    if (modal) modal.style.display = "flex";
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
