document.addEventListener("DOMContentLoaded", () => {
  console.log("[v4] applicant_notifications.js loaded - Full Update");

  // --- 1. REPORT TYPES AND AUTO-HIDER ---
  const reportTypes = [
    "report_verdict", "verdict", "report_filed", 
    "applicant_reported", "employer_reported"
  ];

  const hideReportButtons = () => {
    document.querySelectorAll('.card').forEach(card => {
      let isReport = false;

      // Check data-type attribute
      if (card.dataset.type && reportTypes.includes(card.dataset.type)) isReport = true;

      // Check title text
      if (!isReport) {
        const title = card.querySelector('h3')?.textContent.toLowerCase() || "";
        if (title.includes("report") || title.includes("verdict")) isReport = true;
      }

      const btn = card.querySelector('.view-btn');
      if (btn) {
        btn.style.display = isReport ? 'none' : 'inline-block';
        btn.style.visibility = isReport ? 'hidden' : 'visible';
      }
    });
  };

  hideReportButtons();
  const listContainer = document.querySelector('.card-list');
  if (listContainer) {
    const observer = new MutationObserver(mutations => {
      if (mutations.some(m => m.addedNodes.length > 0)) hideReportButtons();
    });
    observer.observe(listContainer, { childList: true, subtree: true });
  }

  // --- 2. MODAL ELEMENTS ---
  const notifModal = document.getElementById("notifModal");
  const jobDetailsModal = document.getElementById("jobDetailsModal");
  const cancelConfirmModal = document.getElementById("cancelConfirmModal");

  let currentApplicationId = null;

  // --- 3. MARK NOTIFICATION AS READ ---
  async function markNotificationAsRead(notifId) {
    if(!notifId) return;
    try {
      await fetch(`/applicants/api/notifications/${notifId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (window.checkAndUpdateNotificationDot) window.checkAndUpdateNotificationDot();

      const card = document.querySelector(`[data-notif-id="${notifId}"]`);
      if (card) {
        const badge = card.querySelector(".badge-new");
        if (badge) badge.remove();
        card.classList.add("read");
      }
    } catch (err) {
      console.warn("Failed to mark read", err);
    }
  }

  // --- 4. CANCEL APPLICATION LOGIC ---
  window.cancelApplication = (applicationId) => {
    currentApplicationId = applicationId;
    if (cancelConfirmModal) cancelConfirmModal.style.display = "flex";
  };

  window.proceedCancel = async (applicationId) => {
    try {
      window.showLoader?.("Cancelling application...");
      const response = await fetch(`/applicants/api/cancel-application/${applicationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      });
      window.hideLoader?.();

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          window.showFlash?.("Application cancelled successfully", "success");
          setTimeout(() => window.location.reload(), 1500);
        } else {
          window.showFlash?.(data.message || "Failed to cancel application", "error");
        }
      } else {
        window.showFlash?.("Failed to cancel application", "error");
      }
    } catch (err) {
      window.hideLoader?.();
      console.error("Error cancelling application:", err);
      window.showFlash?.("An error occurred", "error");
    }
  };

  const confirmYesBtn = document.getElementById("confirmCancelYes");
  const confirmNoBtn = document.getElementById("confirmCancelNo");

  if (confirmYesBtn) confirmYesBtn.addEventListener("click", () => {
    if (cancelConfirmModal) cancelConfirmModal.style.display = "none";
    if (currentApplicationId) window.proceedCancel(currentApplicationId);
  });

  if (confirmNoBtn) confirmNoBtn.addEventListener("click", () => {
    if (cancelConfirmModal) cancelConfirmModal.style.display = "none";
    currentApplicationId = null;
  });

  // --- 5. HELPER: GET JOB ID ---
  function getJobId(target) {
    const raw = target.dataset.relatedIds;
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
      if (typeof parsed === "number" || typeof parsed === "string") return parsed;
    } catch (e) {
      return raw;
    }
    return null;
  }

  // --- 6. HELPER: GET APPLICATION ID FROM JOB ID ---
  async function getApplicationIdFromJobId(jobId) {
    try {
      const resp = await fetch(`/applicants/job/${jobId}`, { credentials: "same-origin" });
      if (resp.ok) {
        const html = await resp.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const metaDiv = doc.getElementById("applicationMeta");
        const applicationId = metaDiv?.dataset.applicationId;
        const hasCancelledOnce = metaDiv?.dataset.hasCancelledOnce === "true";
        return { applicationId, hasCancelledOnce, html };
      }
    } catch (err) {
      console.error("Failed to fetch job details:", err);
    }
    return { applicationId: null, hasCancelledOnce: false, html: null };
  }

  // --- 7. OPEN REPORT MODAL ---
  function openReportModal(title, message) {
    const reportModal = document.getElementById("reportModal");
    if (reportModal) {
      document.getElementById("reportModalTitle").textContent = title || "Report Notification";
      document.getElementById("reportModalBody").textContent = message || "No details available.";
      reportModal.style.display = "flex";
      reportModal.style.alignItems = "center";
      reportModal.style.justifyContent = "center";
    } else {
      // Fallback to regular notification modal
      if (notifModal) {
        document.getElementById("notifModalTitle").textContent = title || "Report Notification";
        document.getElementById("notifModalBody").textContent = message || "No details available.";
        notifModal.style.display = "flex";
        notifModal.style.alignItems = "center";
        notifModal.style.justifyContent = "center";
      }
    }
  }

  // --- 8. OPEN INTERVIEW MODAL ---
  async function openInterviewModal(jobId, applicationId) {
    if (!applicationId) {
      const result = await getApplicationIdFromJobId(jobId);
      applicationId = result.applicationId;
    }
    
    if (!applicationId) {
      console.error("No application ID found for interview");
      // Fallback: try to show notification modal
      const notifModal = document.getElementById("notifModal");
      if (notifModal) {
        document.getElementById("notifModalTitle").textContent = "Interview Notification";
        document.getElementById("notifModalBody").textContent = "Application details could not be loaded.";
        notifModal.style.display = "flex";
      }
      return;
    }

    // Use the existing viewApplicationDetails function which handles interview display
    if (typeof window.viewApplicationDetails === "function") {
      window.viewApplicationDetails(applicationId);
    } else {
      console.error("viewApplicationDetails function not available");
    }
  }

  // --- 9. MAIN CLICK HANDLER ---
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-view-notif, .view-btn");
    const card = e.target.closest(".card");
    if (!btn && !card) return;

    const target = btn || card;
    const notifId = target.dataset.notifId || target.dataset.id || card?.dataset.notifId;
    const notifType = target.dataset.type || card?.dataset.type || "";
    const notifTitle = target.dataset.title || target.getAttribute("data-title") || card?.querySelector('h3')?.textContent || "";
    const notifMessage = target.dataset.message || target.getAttribute("data-message") || card?.querySelector('p')?.textContent || "";
    const jobId = getJobId(target);

    if (notifId) await markNotificationAsRead(notifId);

    // Determine notification type
    const isReport = reportTypes.includes(notifType) || notifTitle.toLowerCase().includes("report") || notifTitle.toLowerCase().includes("verdict");
    const isInterview = notifTitle.toLowerCase().includes("interview") || notifMessage.toLowerCase().includes("interview");
    const isJobApplication = notifType === "job_application" || (!isReport && !isInterview && jobId);

    // Handle Report Notifications
    if (isReport) {
      openReportModal(notifTitle, notifMessage);
      return;
    }

    // Handle Interview Notifications
    if (isInterview && jobId) {
      const result = await getApplicationIdFromJobId(jobId);
      if (result.applicationId) {
        await openInterviewModal(jobId, result.applicationId);
      } else {
        openReportModal(notifTitle, notifMessage + "\n\nNote: Application details could not be loaded.");
      }
      return;
    }

    // Handle Job Application Notifications
    if (isJobApplication && jobId) {
      try {
        const result = await getApplicationIdFromJobId(jobId);
        const { applicationId, hasCancelledOnce, html } = result;

        if (applicationId && typeof window.viewApplicationDetails === "function") {
          // Open application details modal (which includes cancel button logic)
          notifModal && (notifModal.style.display = "none");
          window.viewApplicationDetails(applicationId);
          return;
        }

        // Fallback: Open job details modal with cancel button
        if (jobDetailsModal && html) {
          const innerBody = jobDetailsModal.querySelector(".modal-body");
          if (innerBody) innerBody.innerHTML = html;
          notifModal && (notifModal.style.display = "none");
          jobDetailsModal.style.display = "flex";

          // Show/hide cancel button based on cancellation history and status
          const cancelBtn = jobDetailsModal.querySelector("#jobDetailsModalCancelBtn");
          if (cancelBtn && applicationId) {
            // Fetch application details to check status
            try {
              const appResp = await fetch(`/applicants/api/applications/${applicationId}`);
              if (appResp.ok) {
                const appData = await appResp.json();
                const app = appData.application;
                const hasCancelledOnce = app.has_cancelled_once === true;
                const status = (app.status || "").toLowerCase();
                const isCancelled = status === "cancelled";
                
                if (!isCancelled && !hasCancelledOnce) {
                  cancelBtn.style.display = "inline-block";
                  cancelBtn.dataset.applicationId = applicationId;
                  cancelBtn.onclick = () => window.cancelApplication(applicationId);
                } else {
                  cancelBtn.style.display = "none";
                }
              } else {
                // If we can't fetch app details, hide button to be safe
                cancelBtn.style.display = "none";
              }
            } catch (err) {
              console.error("Error fetching application details:", err);
              cancelBtn.style.display = "none";
            }
          } else if (cancelBtn) {
            cancelBtn.style.display = "none";
          }
          return;
        }
      } catch (err) {
        console.error("Failed to fetch job/application details:", err);
      }
    }

    // Fallback: Generic notification modal
    if (notifModal) {
      document.getElementById("notifModalTitle").textContent = notifTitle || "Notification";
      document.getElementById("notifModalBody").textContent = notifMessage || "No details available.";
      notifModal.style.display = "flex";
      notifModal.style.alignItems = "center";
      notifModal.style.justifyContent = "center";
    }
  });

  // --- 10. MODAL CLOSE HANDLERS ---
  const closeNotifBtn = document.getElementById("notifModalClose");
  if (closeNotifBtn) closeNotifBtn.addEventListener("click", () => { notifModal && (notifModal.style.display = "none"); });

  const closeJobBtn = document.getElementById("jobDetailsModalCloseBtn");
  if (closeJobBtn) closeJobBtn.addEventListener("click", () => { jobDetailsModal && (jobDetailsModal.style.display = "none"); });

  const closeReportBtn = document.getElementById("reportModalClose");
  if (closeReportBtn) closeReportBtn.addEventListener("click", () => {
    const reportModal = document.getElementById("reportModal");
    if (reportModal) reportModal.style.display = "none";
  });

  window.addEventListener("click", (e) => {
    if (e.target === notifModal) notifModal.style.display = "none";
    if (e.target === jobDetailsModal) jobDetailsModal.style.display = "none";
    if (e.target === cancelConfirmModal) cancelConfirmModal.style.display = "none";
    const reportModal = document.getElementById("reportModal");
    if (e.target === reportModal) reportModal.style.display = "none";
  });

  // --- 8. POLYFILLS ---
  if (typeof window.showLoader !== "function") window.showLoader = () => console.log("Loading...");
  if (typeof window.hideLoader !== "function") window.hideLoader = () => console.log("Loaded.");
  if (typeof window.showFlash !== "function") window.showFlash = (msg, type) => alert(msg);
});
