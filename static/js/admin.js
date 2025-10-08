document.getElementById("menuToggle").addEventListener("click", function (e) {
  const menu = document.getElementById("dropdownMenu");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
  e.stopPropagation(); // prevent click bubbling
});

// Close menu if click outside
document.addEventListener("click", function (e) {
  const menu = document.getElementById("dropdownMenu");
  const toggle = document.getElementById("menuToggle");
  if (!menu.contains(e.target) && !toggle.contains(e.target)) {
    menu.style.display = "none";
  }
});

// For account and security editing
document.addEventListener("DOMContentLoaded", () => {
  const emailField = document.getElementById("email");
  const editBtn = document.getElementById("editBtn");
  const saveBtn = document.getElementById("saveBtn");
  const cancelBtn = document.getElementById("cancelBtn");

  if (editBtn) {
    editBtn.addEventListener("click", () => {
      emailField.removeAttribute("readonly");
      emailField.focus();
      editBtn.style.display = "none";
      saveBtn.style.display = "inline";
      cancelBtn.style.display = "inline";
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      emailField.setAttribute("readonly", true);
      editBtn.style.display = "inline";
      saveBtn.style.display = "none";
      cancelBtn.style.display = "none";
      // Reset field value if canceled
      emailField.value = emailField.defaultValue;
    });
  }
});

// NON-LIPEÑO ACTION HANDLER (event delegation)
document.addEventListener("DOMContentLoaded", () => {
  const editBtn = document.getElementById("editStatusBtn");
  const modal = document.getElementById("statusModal");
  const closeModal = document.getElementById("closeModal");
  const applicantContainer = document.querySelector(".applicant-details");
  const applicantId = applicantContainer.dataset.applicantId;

  // Open modal
  editBtn?.addEventListener("click", () => {
    modal.style.display = "flex";
  });

  // Close modal
  closeModal?.addEventListener("click", () => {
    modal.style.display = "none";
  });

  // Handle approve/reject/reupload buttons
  document.querySelectorAll(".status-btn").forEach(button => {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;

      try {
        const response = await fetch(`/admin/update_nonlipeno_status/${applicantId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action })
        });

        if (!response.ok) throw new Error("Network response was not ok");

        const result = await response.json();

        if (result.success) {
          alert(result.message);
          window.location.reload();
        } else {
          alert("Failed: " + result.message);
        }
      } catch (error) {
        console.error("Error updating status:", error);
        alert("Something went wrong while updating status.");
      }
    });
  });

  // Close modal if click outside modal content
  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });
});




