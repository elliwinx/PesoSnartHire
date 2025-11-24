document.addEventListener("DOMContentLoaded", () => {
  const REFRESH_INTERVAL = 5000; // Refresh every 5 seconds

  function getJobIdFromCurrentPage() {
    // Extract job_id from current URL (e.g., /employers/job/15/applicants)
    const match = window.location.pathname.match(/\/job\/(\d+)\/applicants/);
    return match ? Number.parseInt(match[1]) : null;
  }

  function getStatusBadgeClass(status) {
    const statusMap = {
      Pending: "status-pending",
      Hired: "status-hired",
      Shortlisted: "status-shortlisted",
      Rejected: "status-rejected",
      "For Interview": "status-for-interview",
    };
    return statusMap[status] || "status-pending";
  }

  function refreshApplicantList() {
    const jobId = getJobIdFromCurrentPage();
    if (!jobId) {
      console.log("[v0] Could not extract job_id from URL");
      return;
    }

    fetch(`/employers/api/job/${jobId}/applicants`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log("[v0] Fresh applicant data received:", data);

        if (!data.applicants || data.applicants.length === 0) {
          console.log("[v0] No applicants in API response");
          return;
        }

        const applicantCards = document.querySelectorAll(".applicant-card");

        applicantCards.forEach((card) => {
          // Extract applicant_id from the card
          const profileLink = card.querySelector(".btn-view-profile");
          if (!profileLink) return;

          const href = profileLink.getAttribute("href");
          const match = href.match(/applicant_id=(\d+)/);
          const applicantId = match ? Number.parseInt(match[1]) : null;

          if (!applicantId) return;

          // Find matching applicant in API data
          const applicantData = data.applicants.find(
            (app) => app.applicant_id === applicantId
          );
          if (!applicantData) return;

          // Update status badge
          const statusBadge = card.querySelector(".status-badge");
          const currentStatus = statusBadge?.textContent?.trim();

          if (applicantData.status !== currentStatus) {
            console.log(
              `[v0] Status changed for applicant ${applicantId}: "${currentStatus}" -> "${applicantData.status}"`
            );

            if (statusBadge) {
              statusBadge.textContent = applicantData.status;
              statusBadge.className = `status-badge ${getStatusBadgeClass(
                applicantData.status
              )}`;

              statusBadge.style.transition = "all 0.3s ease";
              statusBadge.style.backgroundColor = "#90EE90";
              setTimeout(() => {
                statusBadge.style.backgroundColor = "";
              }, 1000);
            }
          }
        });
      })
      .catch((err) =>
        console.error("[v0] Error refreshing applicant list:", err)
      );
  }

  // Set up periodic refresh
  setInterval(refreshApplicantList, REFRESH_INTERVAL);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      console.log(
        "[v0] Page became visible, refreshing applicant list immediately"
      );
      refreshApplicantList();
    }
  });

  // Initial refresh after page loads
  setTimeout(refreshApplicantList, 1000);
});
