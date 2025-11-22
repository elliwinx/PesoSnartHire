document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("notifModal")
  const jobDetailsModal = document.getElementById("jobDetailsModalUnique") || document.createElement("div")

  // Delegate view button clicks
  document.body.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-view-notif")
    if (!btn) return

    const notifId = btn.dataset.notifId
    let related = []
    try {
      related = JSON.parse(btn.dataset.relatedIds || "[]")
    } catch (err) {
      related = []
    }
    const jobId = related && related.length ? related[0] : null

    try {
      await fetch(`/applicants/api/notifications/${notifId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    } catch (err) {
      console.warn("Failed to mark notification read", err)
    }

    const card = document.querySelector(`[data-notif-id=\"${notifId}\"]`)
    if (card) {
      const badge = card.querySelector(".badge-new")
      if (badge) badge.remove()
      card.classList.add("read")
    }

    if (jobId) {
      try {
        console.log("[v0] Fetching job details for job:", jobId)
        const response = await fetch(`/applicants/job/${jobId}`, {
          credentials: "same-origin",
        })
        if (response.ok) {
          const html = await response.text()
          const jobDetailsModal = document.getElementById("jobDetailsModal")
          if (jobDetailsModal) {
            const modalBody = jobDetailsModal.querySelector(".modal-content")
            if (modalBody) {
              modalBody.innerHTML = html
            }
          }
          // Show job details modal instead of notification modal
          if (modal) modal.style.display = "none"
          if (jobDetailsModal) jobDetailsModal.style.display = "flex"
          return
        }
      } catch (err) {
        console.error("[v0] Failed to fetch job details:", err)
        // Fall back to simple modal
      }
    }

    if (!modal) return
    const titleEl = modal.querySelector(".modal-title")
    const bodyEl = modal.querySelector(".modal-body")
    const jobLink = modal.querySelector(".modal-job-link")

    const details = card ? card.querySelector(".details") : null
    titleEl.textContent = details ? details.querySelector("h3").childNodes[0].textContent.trim() : "Notification"
    bodyEl.textContent = details ? details.querySelector("p").textContent.trim() : ""

    if (jobId) {
      jobLink.href = `/job/${jobId}`
      jobLink.style.display = "inline-block"
    } else {
      jobLink.style.display = "none"
    }

    modal.style.display = "block"
  })

  // Modal close handlers
  const closeBtn = document.getElementById("notifModalClose")
  if (closeBtn)
    closeBtn.addEventListener("click", () => {
      if (modal) modal.style.display = "none"
    })

  window.addEventListener("click", (e) => {
    if (modal && e.target === modal) modal.style.display = "none"
  })
})
