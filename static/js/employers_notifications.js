let currentFilter = "all";

document.addEventListener("DOMContentLoaded", function () {
  console.log("[v0] Notifications page loaded");
  setupFilterButtons();
  loadNotifications();
  setInterval(loadNotifications, 30000);
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

      return `
            <div class="card ${
              isUnread ? "unread" : ""
            }" data-notification-id="${notif.notification_id}">
              <div class="card-details">
                <h3>${notif.title}</h3>
                <p>${notif.message}</p>
                <small>Type: ${notif.notification_type} | ${timeAgo}</small>
              </div>
              <div class="card-actions">
                ${badge}
                ${
                  isUnread
                    ? `<button class="view-btn" onclick="markAsRead(${notif.notification_id})">Mark as Read</button>`
                    : ""
                }
              </div>
            </div>
          `;
    })
    .join("");
}

async function markAsRead(notificationId) {
  try {
    const response = await fetch(
      `/employers/api/notifications/${notificationId}/read`,
      {
        method: "POST",
      }
    );

    if (response.ok) {
      loadNotifications();
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
