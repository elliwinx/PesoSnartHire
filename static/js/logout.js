// Function to create and show the logout modal
function showLogoutModal() {
  // Prevent creating multiple modals
  if (document.getElementById("logoutModal")) return;

  // Overlay
  const overlay = document.createElement("div");
  overlay.id = "logoutModal";
  overlay.style.cssText = `
    display: flex;
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    justify-content: center;
    align-items: center;
    background: rgba(0,0,0,0.4);
    z-index: 2000;
  `;

  // Modal box
  const modal = document.createElement("div");
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
    // Disable buttons
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    closeBtn.style.pointerEvents = "none";

    // Replace modal content with loading spinner
    modal.innerHTML = `
      <h2 style="color: maroon;">Logging Out...</h2>
      <p>Please wait</p>
      <div class="spinner"></div>
    `;

    // Spinner CSS
    const style = document.createElement("style");
    style.innerHTML = `
      .spinner {
        margin: 20px auto;
        width: 40px;
        height: 40px;
        border: 5px solid #ccc;
        border-top-color: maroon;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    // Redirect after 1 second
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
