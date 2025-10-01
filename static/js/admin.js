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
