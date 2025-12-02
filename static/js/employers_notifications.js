let currentFilter = "all";

document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] Notifications page loaded");
  setupFilterButtons();
  loadNotifications();
  setInterval(loadNotifications, 30000);

  // Modal Close Handlers
  const modal = document.getElementById("notifModal");
  if (modal) {
    window.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
  }
});

function setupFilterButtons() {
  const tabButtons = document.querySelectorAll(".tab-group button");

  tabButtons.forEach((button) => {
    button.addEventListener("click", function (e) {
      e.preventDefault();
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      this.classList.add("active");
      currentFilter = this.getAttribute("data-filter");
      loadNotifications();
    });
  });
}

async function loadNotifications() {
  try {
    let url = "/employers/api/notifications";
    if (currentFilter !== "all") {
      url += `?filter=${currentFilter}`;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch notifications");

    const data = await response.json();
    displayNotifications(data.notifications);
  } catch (error) {
    console.error("[v0] Error loading notifications:", error);
    const container = document.getElementById("notificationList");
    container.innerHTML =
      '<p style="text-align: center; color: #e74c3c; padding: 2rem;">Failed to load notifications. Please refresh the page.</p>';
  }
}

function displayNotifications(notifications) {
  const container = document.getElementById("notificationList");

  if (window.checkAndUpdateEmployerDot) {
    window.checkAndUpdateEmployerDot();
  }

  if (!notifications || notifications.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: #666; padding: 2rem;">No notifications to display.</p>';
    return;
  }

  container.innerHTML = notifications
    .map((notif) => {
      const timeAgo = formatTimeAgo(notif.created_at);
      const isUnread = !notif.is_read;
      const badge = isUnread ? '<span class="badge">NEW</span>' : "";
      // Fix safe strings for attributes
      const safeTitle = (notif.title || "").replace(/"/g, "&quot;");
      const safeMsg = (notif.message || "").replace(/"/g, "&quot;");

      return `
            <div class="card ${isUnread ? "unread" : ""}" 
                 data-notification-id="${notif.notification_id}" 
                 data-redirect="${notif.redirect_url}"
                 data-type="${notif.notification_type}"
                 data-title="${safeTitle}"
                 data-message="${safeMsg}">
              <div class="card-details">
                <h3>${notif.title}</h3>
                <p>${notif.message}</p>
                <small>Type: ${notif.notification_type} | ${timeAgo}</small>
              </div>
              <div class="card-actions">
                ${badge}
                <button class="view-btn" 
                        data-id="${notif.notification_id}"
                        data-type="${notif.notification_type}"
                        data-title="${safeTitle}"
                        data-message="${safeMsg}">
                    View
                </button>
              </div>
            </div>
          `;
    })
    .join("");

  // Attach click handlers to cards and view buttons
  container.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", async (e) => {
      const id = card.dataset.notificationId;
      const url = card.dataset.redirect;
      const type = card.dataset.type;
      const title = card.dataset.title;
      const message = card.dataset.message;

      await markNotificationAsRead(id);

      // If Report Verdict or Report Filed, open modal
      if (type === "report_verdict" || type === "report_filed") {
        openNotifModal(title, message);
        return;
      }

      if (url && url !== "#") {
        window.location.href = url;
      }
    });

    const btn = card.querySelector(".view-btn");
    if (btn) {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const type = btn.dataset.type;
        const title = btn.dataset.title;
        const message = btn.dataset.message;
        const url = card.dataset.redirect;

        await markNotificationAsRead(id);

        // If Report Verdict, open modal
        if (type === "report_verdict" || type === "report_filed") {
          openNotifModal(title, message);
          return;
        }

        if (url && url !== "#") {
          window.location.href = url;
        }
      });
    }
  });
}

function openNotifModal(title, message) {
  const modal = document.getElementById("notifModal");
  const titleEl = document.getElementById("notifModalTitle");
  const bodyEl = document.getElementById("notifModalBody");

  if (modal && titleEl && bodyEl) {
    titleEl.textContent = title || "Notification";
    bodyEl.textContent = message || "";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
  }
}

async function markNotificationAsRead(notificationId) {
  try {
    const response = await fetch(
      `/employers/api/notifications/${notificationId}/read`,
      {
        method: "POST",
      }
    );

    if (response.ok && window.checkAndUpdateNotificationDot) {
      window.checkAndUpdateNotificationDot();
    }

    // Update visuals locally without full reload
    const card = document.querySelector(
      `.card[data-notification-id="${notificationId}"]`
    );
    if (card) {
      card.classList.remove("unread");
      const badge = card.querySelector(".badge");
      if (badge) badge.remove();
    }
  } catch (error) {
    console.error("[v0] Error marking notification as read:", error);
  }
}

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}
