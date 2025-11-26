document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("notifModal");
  const jobDetailsModal =
    document.getElementById("jobDetailsModal") || document.createElement("div");
  const cancelConfirmModal = document.getElementById("cancelConfirmModal");

  console.log("[v0] applicant_notifications.js loaded");
  console.log(
    "[v0] Modal elements found - notif:",
    !!modal,
    "job:",
    !!jobDetailsModal,
    "confirm:",
    !!cancelConfirmModal
  );

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

  window.cancelApplication = (applicationId) => {
    console.log("[v0] cancelApplication called with ID:", applicationId);

    currentApplicationId = applicationId;
    if (cancelConfirmModal) {
      console.log("[v0] Showing cancel confirmation modal");
      cancelConfirmModal.style.display = "flex";
    } else {
      console.error("[v0] cancelConfirmModal not found!");
    }
  };

  window.proceedCancel = async (applicationId) => {
    try {
      console.log("[v0] proceedCancel called for application:", applicationId);
      window.showLoader("Cancelling application...");

      const response = await fetch(
        `/applicants/api/cancel-application/${applicationId}`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        }
      );

      console.log("[v0] Cancel API response status:", response.status);
      window.hideLoader();

      if (response.ok) {
        const data = await response.json();
        console.log("[v0] Cancel response data:", data);

        if (data.success) {
          console.log("[v0] Application cancelled successfully");
          window.showFlash("Application cancelled successfully", "success");
          setTimeout(() => window.location.reload(), 1500);
        } else {
          console.error("[v0] Cancel failed:", data.message);
          window.showFlash(
            data.message || "Failed to cancel application",
            "error"
          );
        }
      } else {
        const errorText = await response.text();
        console.error("[v0] HTTP error:", response.status, errorText);
        window.showFlash(
          "Failed to cancel application with status: " + response.status,
          "error"
        );
      }
    } catch (error) {
      window.hideLoader();
      console.error("[v0] Error in proceedCancel:", error);
      window.showFlash(
        "An error occurred while cancelling the application",
        "error"
      );
    }
  };

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

    console.log(
      "[v0] View button clicked - notifId:",
      notifId,
      "jobId:",
      jobId
    );

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

            const applicationMeta =
              jobDetailsModal.querySelector("#applicationMeta");

            if (!applicationMeta) {
              console.error(
                "ERROR: Missing applicationMeta element in job modal HTML"
              );
              return;
            }

            const applicationId = applicationMeta.dataset.applicationId;

            // Check if applicationId is valid (not null, undefined, empty, or the string "None")
            const isValidApplicationId =
              applicationId &&
              applicationId !== "None" &&
              applicationId !== "null" &&
              applicationId !== "";

            console.log("[v0] Extracted applicationId:", applicationId);
            console.log("[v0] Is valid applicationId:", isValidApplicationId);

            const cancelBtn = jobDetailsModal.querySelector(
              "#jobDetailsModalCancelBtn"
            );

            if (cancelBtn) {
              if (isValidApplicationId) {
                // Only show cancel button if there's a valid application
                cancelBtn.style.display = "inline-block";
                cancelBtn.dataset.applicationId = applicationId;
                currentApplicationId = applicationId;
                cancelBtn.onclick = () => {
                  console.log("[v0] Job details cancel button clicked");
                  window.cancelApplication(applicationId);
                };
              } else {
                // Hide cancel button if no application exists
                cancelBtn.style.display = "none";
                currentApplicationId = null;
                console.log("[v0] No application found, hiding cancel button");
              }
            } else {
              console.warn(
                "[v0] jobDetailsModalCancelBtn not found in modal body"
              );
            }
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
      console.log(
        "[v0] jobDetailsModalCancelBtn clicked with applicationId:",
        applicationId
      );
      // Validate applicationId before proceeding
      const isValidApplicationId =
        applicationId &&
        applicationId !== "None" &&
        applicationId !== "null" &&
        applicationId !== "";
      if (isValidApplicationId && window.cancelApplication) {
        jobDetailsModal.style.display = "none";
        window.cancelApplication(applicationId);
      } else {
        console.error("[v0] Invalid applicationId, cannot cancel");
        window.showFlash("No application found to cancel", "error");
      }
    });
  }

  const cancelBtn = document.getElementById("notifModalCancelBtn");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      const applicationId = cancelBtn.dataset.applicationId;
      console.log(
        "[v0] notifModalCancelBtn clicked with applicationId:",
        applicationId
      );
      // Validate applicationId before proceeding
      const isValidApplicationId =
        applicationId &&
        applicationId !== "None" &&
        applicationId !== "null" &&
        applicationId !== "";
      if (isValidApplicationId && window.cancelApplication) {
        modal.style.display = "none";
        window.cancelApplication(applicationId);
      } else {
        console.error("[v0] Invalid applicationId, cannot cancel");
        window.showFlash("No application found to cancel", "error");
      }
    });
  }

  const confirmYesBtn = document.getElementById("confirmCancelYes");
  const confirmNoBtn = document.getElementById("confirmCancelNo");

  if (confirmYesBtn) {
    confirmYesBtn.addEventListener("click", () => {
      console.log(
        "[v0] Confirm YES clicked for applicationId:",
        currentApplicationId
      );
      if (cancelConfirmModal) {
        cancelConfirmModal.style.display = "none";
      }
      // Validate applicationId before proceeding
      const isValidApplicationId =
        currentApplicationId &&
        currentApplicationId !== "None" &&
        currentApplicationId !== "null" &&
        currentApplicationId !== "";
      if (window.proceedCancel && isValidApplicationId) {
        window.proceedCancel(currentApplicationId);
      } else {
        console.error(
          "[v0] proceedCancel function not found or invalid applicationId!",
          currentApplicationId
        );
        window.showFlash("No valid application found to cancel", "error");
      }
    });
  }

  if (confirmNoBtn) {
    confirmNoBtn.addEventListener("click", () => {
      console.log("[v0] Confirm NO clicked");
      if (cancelConfirmModal) {
        cancelConfirmModal.style.display = "none";
      }
      currentApplicationId = null;
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
    if (cancelConfirmModal && e.target === cancelConfirmModal)
      cancelConfirmModal.style.display = "none";
  });

  // Declare utility functions if not already defined (fallback for notif page)
  if (typeof window.showLoader !== "function") {
    window.showLoader = (message) => {
      console.log("[v0] Loader shown:", message);
    };
  }

  if (typeof window.hideLoader !== "function") {
    window.hideLoader = () => {
      console.log("[v0] Loader hidden");
    };
  }

  if (typeof window.showFlash !== "function") {
    window.showFlash = (message, type) => {
      console.log(`[v0] Flash message: ${message} (type: ${type})`);
    };
  }
});
