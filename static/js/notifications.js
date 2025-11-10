// Notification management for admin dashboard
if (typeof window.notifSystemInitialized === "undefined") {
  window.notifSystemInitialized = true;
  window.currentFilter = "all";
}

// Fetch and display notifications
async function fetchNotifications(filter = "all") {
  console.log("[v0] Fetching notifications with filter:", filter);

  try {
    const response = await fetch(`/admin/api/notifications?filter=${filter}`);

    if (!response.ok) {
      throw new Error("Failed to fetch notifications");
    }

    const data = await response.json();
    console.log("[v0] Notifications received:", data.notifications.length);

    displayNotifications(data.notifications);
  } catch (error) {
    console.error("[v0] Error fetching notifications:", error);
    document.getElementById("notificationList").innerHTML =
      '<p style="text-align: center; color: #e74c3c; padding: 2rem;">Failed to load notifications. Please refresh the page.</p>';
  }
}

// Display notifications in the card list
function displayNotifications(notifications) {
  const notificationList = document.getElementById("notificationList");

  if (!notifications || notifications.length === 0) {
    notificationList.innerHTML =
      '<p style="text-align: center; color: #666; padding: 2rem;">No notifications to display.</p>';
    return;
  }

  notificationList.innerHTML = notifications
    .map((notif) => {
      const timeAgo = getTimeAgo(notif.created_at);
      const isNew = !notif.is_read;
      const badge = isNew ? '<span class="badge">NEW</span>' : "";

      return `
      <div class="card ${isNew ? "unread" : ""}" data-notification-id="${
        notif.notification_id
      }" data-redirect="${notif.redirect_url || "#"}">
        <!-- Left: details stacked -->
        <div class="card-details">
          <h3>${notif.title}</h3>
          <p>${notif.message}</p>
          <small>Type: ${notif.notification_type} | Recruitment: ${
        notif.recruitment_type || "N/A"
      } | ${timeAgo}</small>
        </div>

        <!-- Right: badge + button -->
        <div class="card-actions">
          ${badge}
          <a href="${notif.redirect_url || "#"}" class="view-btn">
            <i class="fa-solid fa-eye"></i>
            View
          </a>
        </div>
      </div>
    `;
    })
    .join("");

  // Add click handlers to cards
  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", handleNotificationClick);
  });

  // Ensure 'View' buttons behave the same as clicking the card (mark as read
  // first, then navigate). Prevent default link navigation so we can finish
  // the mark-read request.
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const card = e.target.closest(".card");
      if (!card) return;
      const notificationId = card.dataset.notificationId;
      const redirectUrl = btn.getAttribute("href") || card.dataset.redirect;

      try {
        await fetch(`/admin/api/notifications/${notificationId}/read`, {
          method: "POST",
        });
        // Refresh notifications to update badge
        fetchNotifications(currentFilter);
      } catch (err) {
        console.error("Error marking notification as read:", err);
      }

      if (redirectUrl && redirectUrl !== "#") {
        window.location.href = redirectUrl;
      }
    });
  });
}

// Handle notification card click
async function handleNotificationClick(event) {
  const card = event.currentTarget;
  const notificationId = card.dataset.notificationId;
  const redirectUrl = card.dataset.redirect;

  console.log("[v0] Notification clicked:", notificationId);

  // Mark as read
  try {
    await fetch(`/admin/api/notifications/${notificationId}/read`, {
      method: "POST",
    });
    console.log("[v0] Notification marked as read");
    // Refresh notifications to update badge
    fetchNotifications(currentFilter);
  } catch (error) {
    console.error("[v0] Error marking notification as read:", error);
  }

  // Redirect if URL is provided
  if (redirectUrl && redirectUrl !== "#") {
    window.location.href = redirectUrl;
  }
}

// Calculate time ago from timestamp
function getTimeAgo(timestamp) {
  const now = new Date();
  const notifTime = new Date(timestamp);
  const diffMs = now - notifTime;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
}

// Handle filter button clicks
function setupFilterButtons() {
  const filterButtons = document.querySelectorAll(".tab-group button");

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Update active state
      filterButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Fetch notifications with new filter
      const filter = button.dataset.filter;
      window.currentFilter = filter;
      console.log("[v0] Filter changed to:", filter);
      fetchNotifications(filter);
    });
  });
}

// Poll for new notifications every 30 seconds
function startNotificationPolling() {
  setInterval(() => {
    console.log("[v0] Polling for new notifications");
    fetchNotifications(window.currentFilter);
    updateNotifBadge(); // <--- ALSO check the badge when polling
  }, 30000); // 30 seconds
}

// --- BADGE FUNCTION ---
async function updateNotifBadge() {
  try {
    const res = await fetch("/admin/api/notifications/unread-count");
    const data = await res.json();

    let badge = document.getElementById("notifBadge");
    // Fallback: try to find badge in all nav links if not found
    if (!badge) {
      const navLinks = document.querySelectorAll(".nav-link, .nav-link-active");
      navLinks.forEach((link) => {
        const possibleBadge = link.querySelector(".notif-badge");
        if (possibleBadge) badge = possibleBadge;
      });
    }

    if (badge) {
      if (data.success && data.unread_count > 0) {
        badge.style.display = "inline-block";
        badge.textContent = "●"; // or data.unread_count if you prefer number
      } else {
        badge.style.display = "none";
      }
    }
  } catch (err) {
    console.error("Error fetching unread count:", err);
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] Initializing notification system");
  setupFilterButtons();
  fetchNotifications("all");
  startNotificationPolling();
  updateNotifBadge(); // <--- also run immediately when page loads

  // Global polling for notif badge (always updates every 30s)
  setInterval(() => {
    updateNotifBadge();
  }, 30000);
});
