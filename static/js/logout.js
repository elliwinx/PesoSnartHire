document.addEventListener("DOMContentLoaded", () => {
  function showLogoutModal() {
    if (document.getElementById("logoutModal")) return;

    const overlay = document.createElement("div");
    overlay.id = "logoutModal";
    overlay.className = "modal";
    overlay.style.cssText = `
      display: flex;
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      justify-content: center;
      align-items: center;
      background: rgba(0,0,0,0.4);
      z-index: 9999;
    `;

    const modal = document.createElement("div");
    modal.className = "modal-content";
    modal.style.cssText = `
      background: #fff;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      width: 300px;
      position: relative;
      box-shadow: 0px 4px 10px rgba(0,0,0,0.3);
    `;

    const closeBtn = document.createElement("span");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.cssText = `
      position: absolute; top: 8px; right: 12px;
      font-size: 20px; cursor: pointer;
    `;
    closeBtn.addEventListener("click", () => overlay.remove());

    const title = document.createElement("h2");
    title.textContent = "Logging Out";
    title.style.color = "maroon";

    const msg = document.createElement("p");
    msg.textContent = "Are you sure you want to log out?";

    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "Confirm";
    confirmBtn.style.cssText = `
      padding: 8px 15px; margin: 5px; border: none;
      border-radius: 5px; cursor: pointer;
      background: maroon; color: white; font-weight: bold;
    `;

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = `
      padding: 8px 15px; margin: 5px; border: none;
      border-radius: 5px; cursor: pointer;
      background: gray; color: white; font-weight: bold;
    `;
    cancelBtn.addEventListener("click", () => overlay.remove());

    confirmBtn.addEventListener("click", async () => {
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      closeBtn.style.pointerEvents = "none";

      // Use global AJAX loader
      const ajaxLoaderEl = document.getElementById("ajaxLoader");
      if (ajaxLoaderEl) {
        ajaxLoaderEl.style.display = "flex";
        const text = ajaxLoaderEl.querySelector("#ajaxLoaderText");
        if (text) text.textContent = "Logging out — please wait...";
        void ajaxLoaderEl.offsetHeight;
      }

      overlay.remove();

      try {
        await fetch("/logout", { method: "GET", credentials: "same-origin" });
      } catch (e) {
        console.warn("Logout failed, redirecting anyway");
      }

      setTimeout(() => {
        window.location.href = "/";
      }, 1200);
    });

    modal.append(closeBtn, title, msg, confirmBtn, cancelBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // Attach to all logout triggers
  const logoutLinks = document.querySelectorAll("#logoutLink, .logout-link");
  logoutLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      showLogoutModal();
    });
  });
});
