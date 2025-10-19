// Function to create and show the logout modal
function showLogoutModal() {
  // Prevent creating multiple modals
  if (document.getElementById("logoutModal")) return;

  // Overlay (use the app's modal classes so shared loader can target it)
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
  `;

  // Modal box (use modal-content class so CSS matches other modals)
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

  // Close button
  const closeBtn = document.createElement("span");
  closeBtn.innerHTML = "&times;";
  closeBtn.style.cssText = `
    position: absolute; top: 8px; right: 12px;
    font-size: 20px; cursor: pointer;
  `;
  closeBtn.addEventListener("click", () => overlay.remove());

  // Title
  const title = document.createElement("h2");
  title.textContent = "Logging Out";
  title.style.color = "maroon";

  // Message
  const msg = document.createElement("p");
  msg.textContent = "Are you sure you want to log out?";

  // Confirm button
  const confirmBtn = document.createElement("button");
  confirmBtn.textContent = "Confirm";
  confirmBtn.style.cssText = `
    padding: 8px 15px; margin: 5px; border: none;
    border-radius: 5px; cursor: pointer;
    background: maroon; color: white; font-weight: bold;
  `;
  confirmBtn.addEventListener("click", () => {
    // Disable buttons and prevent close
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    closeBtn.style.pointerEvents = "none";

    // Use the app-wide loader to keep visual consistency
    showLoader("Logging out — please wait...");

    // Force the loader to paint immediately.
    // If the page includes #ajaxLoader, make sure it's visible and force a reflow.
    const ajaxLoaderEl = document.getElementById("ajaxLoader");
    if (ajaxLoaderEl) {
      ajaxLoaderEl.style.display = "flex";
      // force reflow so browser paints before navigation
      void ajaxLoaderEl.offsetHeight;
    } else if (!document.querySelector(".modal-loader-overlay")) {
      // Fallback: create a quick overlay so the user sees something immediately
      const quick = document.createElement("div");
      quick.className = "modal-loader-overlay";
      quick.id = "logoutQuickLoader";
      quick.innerHTML = `
        <div class="modal-loader-content">
          <div class="spinner" aria-hidden="true"></div>
          <div class="modal-loader-text">Logging out — please wait...</div>
        </div>
      `;
      document.body.appendChild(quick);
      // force reflow
      void quick.offsetHeight;
    }

    // Delay the redirect slightly to let the loader appear to the user
    setTimeout(() => {
      window.location.href = "/logout";
    }, 1000);
  });

  // Cancel button
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.style.cssText = `
    padding: 8px 15px; margin: 5px; border: none;
    border-radius: 5px; cursor: pointer;
    background: gray; color: white; font-weight: bold;
  `;
  cancelBtn.addEventListener("click", () => overlay.remove());

  // Append elements
  modal.appendChild(closeBtn);
  modal.appendChild(title);
  modal.appendChild(msg);
  modal.appendChild(confirmBtn);
  modal.appendChild(cancelBtn);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Close when clicking outside modal
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// Attach modal to logout link
const logoutLink = document.getElementById("logoutLink");
if (logoutLink) {
  logoutLink.addEventListener("click", (e) => {
    e.preventDefault(); // prevent page reload
    showLogoutModal();
  });
}
