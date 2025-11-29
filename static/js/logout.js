document.addEventListener("DOMContentLoaded", () => {
  function showLogoutModal() {
    if (document.getElementById("logoutModal")) return;

    // 1. Determine where to redirect based on current URL
    // If the URL path starts with "/admin", we go to admin login.
    const isAdmin = window.location.pathname.startsWith("/admin");
    const redirectUrl = isAdmin ? "/admin/login" : "/";

    const overlay = document.createElement("div");
    overlay.id = "logoutModal";
    overlay.className = "logout-modal-overlay";
    overlay.style.cssText = `
      display: flex;
      position: fixed;
      top: 0; 
      left: 0;
      width: 100%; 
      height: 100%;
      justify-content: center;
      align-items: center;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      z-index: 9999;
      opacity: 0;
      animation: fadeIn 0.3s ease-out forwards;
    `;

    const modal = document.createElement("div");
    modal.className = "logout-modal-content";
    modal.style.cssText = `
      background: #fff;
      padding: 2rem;
      border-radius: 12px;
      text-align: center;
      width: 90%;
      max-width: 400px;
      position: relative;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 24px rgba(0, 0, 0, 0.1);
      transform: translateY(-20px) scale(0.95);
      animation: modalSlideIn 0.3s ease-out 0.1s forwards;
      border: 1px solid #e1e5e9;
    `;

    const closeBtn = document.createElement("span");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.cssText = `
      position: absolute; 
      top: 12px; 
      right: 16px;
      font-size: 24px; 
      cursor: pointer;
      color: #6b7280;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      font-weight: 300;
    `;
    closeBtn.addEventListener("mouseenter", () => {
      closeBtn.style.background = "#f3f4f6";
      closeBtn.style.color = "#374151";
    });
    closeBtn.addEventListener("mouseleave", () => {
      closeBtn.style.background = "transparent";
      closeBtn.style.color = "#6b7280";
    });
    closeBtn.addEventListener("click", () => {
      animateModalOut(overlay);
    });

    const icon = document.createElement("div");
    icon.style.cssText = `
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #fef2f2;
      border: 2px solid #fecaca;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1rem;
    `;
    icon.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        <polyline points="16 17 21 12 16 7"></polyline>
        <line x1="21" y1="12" x2="9" y2="12"></line>
      </svg>
    `;

    const title = document.createElement("h2");
    title.textContent = "Log Out";
    title.style.cssText = `
      color: #1f2937;
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
      font-weight: 600;
    `;

    const msg = document.createElement("p");
    msg.textContent =
      "Are you sure you want to log out? You'll need to sign in again to access your account.";
    msg.style.cssText = `
      color: #6b7280;
      margin: 0 0 2rem 0;
      line-height: 1.5;
      font-size: 0.95rem;
    `;

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
      display: flex;
      gap: 12px;
      justify-content: center;
    `;

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = `
      padding: 12px 24px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      cursor: pointer;
      background: white;
      color: #374151;
      font-weight: 500;
      font-size: 0.95rem;
      transition: all 0.2s ease;
      flex: 1;
    `;
    cancelBtn.addEventListener("mouseenter", () => {
      cancelBtn.style.background = "#333";
      cancelBtn.style.borderColor = "#333";
      cancelBtn.style.color = "white";
    });
    cancelBtn.addEventListener("mouseleave", () => {
      cancelBtn.style.background = "white";
      cancelBtn.style.borderColor = "#333";
      cancelBtn.style.color = "#333";
    });
    cancelBtn.addEventListener("click", () => {
      animateModalOut(overlay);
    });

    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "Log Out";
    confirmBtn.style.cssText = `
      color: white;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      background: #dc2626;
      color: white;
      font-weight: 500;
      font-size: 0.95rem;
      transition: all 0.2s ease;
      flex: 1;
    `;
    confirmBtn.addEventListener("mouseenter", () => {
      confirmBtn.style.background = "white";
      confirmBtn.style.color = "#7b1113";
      confirmBtn.style.border = "1px solid #7b1113";
      confirmBtn.style.transform = "translateY(-1px)";
    });
    confirmBtn.addEventListener("mouseleave", () => {
      confirmBtn.style.background = "#dc2626";
      confirmBtn.style.color = "white";
      confirmBtn.style.transform = "translateY(0)";
    });

    confirmBtn.addEventListener("click", async () => {
      // Disable interactions
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      closeBtn.style.pointerEvents = "none";

      // Update button to loading state
      confirmBtn.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
          <div style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; border-top: 2px solid white; animation: spin 1s linear infinite;"></div>
          Logging out...
        </div>
      `;
      confirmBtn.style.background = "#9ca3af";
      confirmBtn.style.cursor = "not-allowed";

      // Use global AJAX loader with improved styling
      const ajaxLoaderEl = document.getElementById("ajaxLoader");
      if (ajaxLoaderEl) {
        ajaxLoaderEl.style.display = "flex";
        const text = ajaxLoaderEl.querySelector("#ajaxLoaderText");
        if (text) text.textContent = "Logging out — please wait...";
        void ajaxLoaderEl.offsetHeight;
      }

      animateModalOut(overlay);

      try {
        await fetch("/logout", { method: "GET", credentials: "same-origin" });
      } catch (e) {
        console.warn("Logout failed, redirecting anyway");
      }

      // 2. Perform the redirect based on the check we did earlier
      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 1200);
    });

    buttonContainer.append(cancelBtn, confirmBtn);
    modal.append(closeBtn, icon, title, msg, buttonContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Add CSS animations
    addModalStyles();

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        animateModalOut(overlay);
      }
    });

    // Add escape key listener
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        animateModalOut(overlay);
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);
  }

  function animateModalOut(overlay) {
    overlay.style.animation = "fadeOut 0.2s ease-in forwards";
    const modal = overlay.querySelector(".logout-modal-content");
    if (modal) {
      modal.style.animation = "modalSlideOut 0.2s ease-in forwards";
    }
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 200);
  }

  function addModalStyles() {
    if (document.getElementById("modal-styles")) return;

    const styles = document.createElement("style");
    styles.id = "modal-styles";
    styles.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes modalSlideIn {
        from { 
          transform: translateY(-20px) scale(0.95);
          opacity: 0;
        }
        to { 
          transform: translateY(0) scale(1);
          opacity: 1;
        }
      }
      @keyframes modalSlideOut {
        from { 
          transform: translateY(0) scale(1);
          opacity: 1;
        }
        to { 
          transform: translateY(-20px) scale(0.95);
          opacity: 0;
        }
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styles);
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
