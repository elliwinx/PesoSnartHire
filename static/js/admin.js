document.getElementById("menuToggle")?.addEventListener("click", (e) => {
  const menu = document.getElementById("dropdownMenu");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
  e.stopPropagation();
});

// Close menu if click outside
document.addEventListener("click", (e) => {
  const menu = document.getElementById("dropdownMenu");
  const toggle = document.getElementById("menuToggle");
  if (
    menu &&
    toggle &&
    !menu.contains(e.target) &&
    !toggle.contains(e.target)
  ) {
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
      emailField.value = emailField.defaultValue;
    });
  }

  const editStatusBtn = document.getElementById("editStatusBtn");
  const modal = document.getElementById("statusModal");
  const closeModal = document.getElementById("closeModal");
  const applicantContainer = document.querySelector(".applicant-details");

  if (editStatusBtn && modal && applicantContainer) {
    const applicantId = applicantContainer.dataset.applicantId;
    console.log("[v0] Applicant ID:", applicantId);

    // Open modal
    editStatusBtn.addEventListener("click", () => {
      modal.style.display = "flex";
    });

    // Close modal
    closeModal.addEventListener("click", () => {
      modal.style.display = "none";
    });

    // Handle approve/reject/reupload buttons
    document.querySelectorAll(".status-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.action;
        console.log("[v0] Action clicked:", action);

        try {
          const response = await fetch(
            `/admin/update_nonlipeno_status/${applicantId}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action }),
            }
          );

          console.log("[v0] Response status:", response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error("[v0] Error response:", errorText);
            throw new Error("Network response was not ok");
          }

          const result = await response.json();
          console.log("[v0] Result:", result);

          if (result.success) {
            alert(result.message);
            window.location.reload();
          } else {
            alert("Failed: " + result.message);
          }
        } catch (error) {
          console.error("[v0] Error updating status:", error);
          alert(
            "Something went wrong while updating status. Please check the console for details."
          );
        }
      });
    });

    // Close modal if click outside modal content
    window.addEventListener("click", (e) => {
      if (e.target === modal) modal.style.display = "none";
    });
  }
});
