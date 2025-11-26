// Shared notification dot manager for all pages
document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] Notification dot manager loaded");
  initNotificationDot();
  // Check for new notifications every 15 seconds
  setInterval(checkAndUpdateNotificationDot, 15000);
});

async function checkAndUpdateNotificationDot() {
  try {
    const response = await fetch("/employers/api/notifications");
    if (!response.ok) return;

    const data = await response.json();
    updateNotificationDot(data.unread_count || 0);
  } catch (error) {
    console.error("[v0] Error checking notifications:", error);
  }
}

function initNotificationDot() {
  // Find the notification nav link
  const navLinks = document.querySelectorAll(".nav-link, .nav-link-active");

  navLinks.forEach((link) => {
    if (link.href && link.href.includes("/employers/notifications")) {
      // Create dot element if it doesn't exist
      let dot = link.querySelector(".notif-dot");
      if (!dot) {
        dot = document.createElement("span");
        dot.className = "notif-dot";
        link.appendChild(dot);
      }
    }
  });

  // Initial check
  checkAndUpdateNotificationDot();
}

function updateNotificationDot(unreadCount) {
  const navLinks = document.querySelectorAll(".nav-link, .nav-link-active");

  navLinks.forEach((link) => {
    if (link.href && link.href.includes("/employers/notifications")) {
      const dot = link.querySelector(".notif-dot");
      if (dot) {
        dot.style.display = unreadCount > 0 ? "inline-block" : "none";
      }
    }
  });
}

// Expose function for external use (when notification is marked as read)
window.updateNotificationDot = updateNotificationDot;
window.checkAndUpdateNotificationDot = checkAndUpdateNotificationDot;
