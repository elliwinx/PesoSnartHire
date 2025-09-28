// New scalable modal system - handles unlimited modals with data attributes
document.addEventListener("DOMContentLoaded", () => {
  // Open modal when clicking triggers with data-modal-target
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest("[data-modal-target]");
    if (trigger) {
      e.preventDefault();
      const modalId = trigger.getAttribute("data-modal-target");
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.style.display = "block";
        document.body.style.overflow = "hidden"; // Prevent background scrolling
      }
    }
  });

  // Close modal when clicking close buttons or outside modal
  document.addEventListener("click", (e) => {
    // Close button clicked
    if (e.target.closest("[data-modal-close]")) {
      const modal = e.target.closest(".modal");
      if (modal) {
        modal.style.display = "none";
        document.body.style.overflow = "auto";
      }
    }

    // Clicked outside modal (on backdrop)
    if (e.target.classList.contains("modal")) {
      e.target.style.display = "none";
      document.body.style.overflow = "auto";
    }
  });

  // Close modal with Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const openModal = document.querySelector('.modal[style*="block"]');
      if (openModal) {
        openModal.style.display = "none";
        document.body.style.overflow = "auto";
      }
    }
  });

  // Handle form submissions in modals
  document.addEventListener("submit", (e) => {
    const form = e.target;
    const modal = form.closest(".modal");

    if (modal && form.id === "adminLoginForm") {
      e.preventDefault();
      console.log("Admin login form submitted");
      // Add your login logic here

      // Close modal after submission
      modal.style.display = "none";
      document.body.style.overflow = "auto";
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".content");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Hide all content
      contents.forEach((c) => (c.style.display = "none"));

      // Show target content
      const targetId = btn.getAttribute("data-target");
      document.getElementById(targetId).style.display = "block";

      // Update active button
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Show quick summary by default
  document.getElementById("quick-summary").style.display = "block";
});
