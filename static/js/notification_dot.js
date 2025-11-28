document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] Employer notification dot manager loaded");

  // 1. Define the checker function globally
  window.checkAndUpdateEmployerDot = async function () {
    try {
      // Use the lightweight count endpoint
      const response = await fetch("/employers/api/notifications/unread-count");

      if (response.ok) {
        const data = await response.json();
        const count = data.count || 0;

        // Target the specific ID in your Employer Navbar
        const badge = document.getElementById("employerNotifBadge");

        if (badge) {
          if (count > 0) {
            badge.style.display = "inline";
            // Optional: Uncomment to show the number
            // badge.textContent = count > 99 ? '99+' : count;
          } else {
            badge.style.display = "none";
          }
        }
      }
    } catch (err) {
      console.warn("[v0] Failed to check employer notification dot:", err);
    }
  };

  // 2. Run immediately on load
  window.checkAndUpdateEmployerDot();

  // 3. Poll every 30 seconds to keep it updated
  setInterval(window.checkAndUpdateEmployerDot, 30000);
});
