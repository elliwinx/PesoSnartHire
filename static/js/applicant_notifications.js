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

  // --- 6. MAIN CLICK HANDLER ---
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-view-notif, .view-btn");
    const card = e.target.closest(".card");
    if (!btn && !card) return;

    const target = btn || card;
    const notifId = target.dataset.notifId || target.dataset.id || card?.dataset.notifId;
    const notifType = target.dataset.type;
    const notifTitle = target.dataset.title || target.getAttribute("data-title") || card?.querySelector('h3')?.textContent || "";
    const notifMessage = target.dataset.message || target.getAttribute("data-message") || card?.querySelector('p')?.textContent || "";
    const jobId = getJobId(target);

    if (notifId) await markNotificationAsRead(notifId);

    const isReport = reportTypes.includes(notifType) || notifTitle.toLowerCase().includes("report") || notifTitle.toLowerCase().includes("verdict");

    if (isReport || !jobId) {
      if (notifModal) {
        document.getElementById("notifModalTitle").textContent = notifTitle || "Notification";
        document.getElementById("notifModalBody").textContent = notifMessage || "No details available.";
        const jobLink = notifModal.querySelector(".modal-job-link");
        const cancelBtn = document.getElementById("notifModalCancelBtn");
        if (jobLink) jobLink.style.display = "none";
        if (cancelBtn) cancelBtn.style.display = "none";

        notifModal.style.display = "flex";
        notifModal.style.alignItems = "center";
        notifModal.style.justifyContent = "center";
      }
      return;
    }

    // Job/Application modal logic
    if (jobId) {
      try {
        const resp = await fetch(`/applicants/job/${jobId}`, { credentials: "same-origin" });
        if (resp.ok) {
          const html = await resp.text();
          const doc = new DOMParser().parseFromString(html, "text/html");
          const metaDiv = doc.getElementById("applicationMeta");
          const applicationId = metaDiv?.dataset.applicationId;
          const isValidAppId = applicationId && applicationId !== "None" && applicationId !== "";

          if (isValidAppId && typeof window.viewApplicationDetails === "function") {
            notifModal && (notifModal.style.display = "none");
            window.viewApplicationDetails(applicationId);
            return;
          }

          if (jobDetailsModal) {
            const innerBody = jobDetailsModal.querySelector(".modal-body");
            if (innerBody) innerBody.innerHTML = html;
            notifModal && (notifModal.style.display = "none");
            jobDetailsModal.style.display = "flex";

            const cancelBtn = jobDetailsModal.querySelector("#jobDetailsModalCancelBtn");
            if (cancelBtn) cancelBtn.style.display = "none";
          }
          return;
        }
      } catch (err) {
        console.error("Failed to fetch job/application details:", err);
      }
    }

    // Fallback
    if (notifModal) {
      document.getElementById("notifModalTitle").textContent = notifTitle;
      document.getElementById("notifModalBody").textContent = notifMessage;
      notifModal.style.display = "flex";
    }
  });

  // --- 7. MODAL CLOSE HANDLERS ---
  const closeNotifBtn = document.getElementById("notifModalClose");
  if (closeNotifBtn) closeNotifBtn.addEventListener("click", () => { notifModal && (notifModal.style.display = "none"); });

  const closeJobBtn = document.getElementById("jobDetailsModalCloseBtn");
  if (closeJobBtn) closeJobBtn.addEventListener("click", () => { jobDetailsModal && (jobDetailsModal.style.display = "none"); });

  window.addEventListener("click", (e) => {
    if (e.target === notifModal) notifModal.style.display = "none";
    if (e.target === jobDetailsModal) jobDetailsModal.style.display = "none";
    if (e.target === cancelConfirmModal) cancelConfirmModal.style.display = "none";
  });

  // --- 8. POLYFILLS ---
  if (typeof window.showLoader !== "function") window.showLoader = () => console.log("Loading...");
  if (typeof window.hideLoader !== "function") window.hideLoader = () => console.log("Loaded.");
  if (typeof window.showFlash !== "function") window.showFlash = (msg, type) => alert(msg);
});
