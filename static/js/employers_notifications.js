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
  const navLinks = document.querySelectorAll('.nav-link, .nav-link-active');

  // Update global unread dot if there are unread notifications
  const unread = notifications.filter(n => !n.is_read).length;
  // Add small dot to notifications nav link
  navLinks.forEach(link => {
    if (link.href && link.href.includes('/employers/notifications')) {
      let dot = link.querySelector('.notif-dot');
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'notif-dot';
        link.appendChild(dot);
      }
      dot.style.display = unread > 0 ? 'inline-block' : 'none';
    }
  });

  if (!notifications || notifications.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: #666; padding: 2rem;">No notifications to display.</p>';
    return;
  }

  container.innerHTML = notifications
    .map((notif) => {
      const timeAgo = formatTimeAgo(notif.created_at);
      const isUnread = !notif.is_read;
      const badge = isUnread ? '<span class="badge">NEW</span>' : '';

      return `
            <div class="card ${isUnread ? "unread" : ""}" data-notification-id="${notif.notification_id}" data-redirect="${notif.redirect_url}">
              <div class="card-details">
                <h3>${notif.title}</h3>
                <p>${notif.message}</p>
                <small>Type: ${notif.notification_type} | ${timeAgo}</small>
              </div>
              <div class="card-actions">
                ${badge}
                <button class="view-btn" data-id="${notif.notification_id}">View</button>
              </div>
            </div>
          `;
    })
    .join("");

  // Attach click handlers to cards and view buttons
  container.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', async (e) => {
      const id = card.dataset.notificationId;
      const url = card.dataset.redirect;
      if (!url) return;

      // mark read then navigate
      try {
        await fetch(`/employers/api/notifications/${id}/read`, { method: 'POST' });
      } catch (err) {
        console.error('Failed to mark notification read', err);
      }

      window.location.href = url;
    });

    const btn = card.querySelector('.view-btn');
    if (btn) {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const url = card.dataset.redirect;
        try {
          await fetch(`/employers/api/notifications/${id}/read`, { method: 'POST' });
        } catch (err) {
          console.error('Failed to mark notification read', err);
        }
        window.location.href = url;
      });
    }
  });
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
