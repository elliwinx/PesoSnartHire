// DOM Elements
const form = document.getElementById("jobPostForm");
const clearFormBtn = document.getElementById("clearForm");
const addJobVacancyBtn = document.getElementById("addJobVacancy");
const successModal = document.getElementById("successModal");
const closeModal = document.querySelector(".close");
const modalOk = document.getElementById("modalOk");
const forcePasswordModal = document.getElementById("forcePasswordModal");

// Form validation functions
function showError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const errorElement = document.getElementById(fieldId + "Error");

  field.classList.add("error");
  errorElement.textContent = message;
  errorElement.classList.add("show");
}

function clearError(fieldId) {
  const field = document.getElementById(fieldId);
  const errorElement = document.getElementById(fieldId + "Error");

  field.classList.remove("error");
  errorElement.classList.remove("show");
}

function clearAllErrors() {
  const errorElements = document.querySelectorAll(".error-message");
  const inputElements = document.querySelectorAll(".error");

  errorElements.forEach((element) => element.classList.remove("show"));
  inputElements.forEach((element) => element.classList.remove("error"));
}

function validateForm() {
  let isValid = true;
  clearAllErrors();

  // Get form values
  const jobPosition = document.getElementById("jobPosition").value.trim();
  const workSchedule = document.getElementById("workSchedule").value;
  const numVacancy = Number.parseInt(
    document.getElementById("numVacancy").value
  );
  const minSalary = Number.parseFloat(
    document.getElementById("minSalary").value
  );
  const maxSalary = Number.parseFloat(
    document.getElementById("maxSalary").value
  );
  const jobDescription = document.getElementById("jobDescription").value.trim();
  const qualifications = document.getElementById("qualifications").value.trim();

  // Validate Job Position
  if (!jobPosition) {
    showError("jobPosition", "Job position is required");
    isValid = false;
  }

  // Validate Work Schedule
  if (!workSchedule) {
    showError("workSchedule", "Work schedule is required");
    isValid = false;
  }

  // Validate Number of Vacancy
  if (!numVacancy || numVacancy < 1) {
    showError("numVacancy", "Number of vacancy must be at least 1");
    isValid = false;
  }

  // Validate Minimum Salary
  if (isNaN(minSalary) || minSalary < 0) {
    showError("minSalary", "Minimum salary must be a valid number ≥ 0");
    isValid = false;
  }

  // Validate Maximum Salary
  if (isNaN(maxSalary) || maxSalary < 0) {
    showError("maxSalary", "Maximum salary must be a valid number ≥ 0");
    isValid = false;
  } else if (!isNaN(minSalary) && maxSalary < minSalary) {
    showError(
      "maxSalary",
      "Maximum salary must be greater than or equal to minimum salary"
    );
    isValid = false;
  }

  // Validate Job Description
  if (!jobDescription) {
    showError("jobDescription", "Job description is required");
    isValid = false;
  }

  // Validate Qualifications
  if (!qualifications) {
    showError("qualifications", "Qualifications are required");
    isValid = false;
  }

  return isValid;
}

// Event Listeners
form.addEventListener("submit", (e) => {
  e.preventDefault();

  if (validateForm()) {
    // Show success modal
    successModal.style.display = "block";
  }
});

clearFormBtn.addEventListener("click", () => {
  // Reset form
  form.reset();

  // Reset number of vacancy to 1
  document.getElementById("numVacancy").value = 1;

  // Clear all errors
  clearAllErrors();
});

addJobVacancyBtn.addEventListener("click", () => {
  // This could navigate to a new page or open a modal
  // For now, we'll just show an alert
  alert("Add Job Vacancy functionality would be implemented here");
});

// Modal event listeners
closeModal.addEventListener("click", () => {
  successModal.style.display = "none";
});

modalOk.addEventListener("click", () => {
  successModal.style.display = "none";
  // Optionally reset the form after successful submission
  form.reset();
  document.getElementById("numVacancy").value = 1;
  clearAllErrors();
});

// Close modal when clicking outside of it
window.addEventListener("click", (e) => {
  if (e.target === successModal) {
    successModal.style.display = "none";
  }
});

// Real-time validation for salary fields
document.getElementById("minSalary").addEventListener("input", function () {
  const minSalary = Number.parseFloat(this.value);
  const maxSalaryField = document.getElementById("maxSalary");
  const maxSalary = Number.parseFloat(maxSalaryField.value);

  if (!isNaN(minSalary) && !isNaN(maxSalary) && maxSalary < minSalary) {
    showError(
      "maxSalary",
      "Maximum salary must be greater than or equal to minimum salary"
    );
  } else {
    clearError("maxSalary");
  }
});

document.getElementById("maxSalary").addEventListener("input", function () {
  const maxSalary = Number.parseFloat(this.value);
  const minSalaryField = document.getElementById("minSalary");
  const minSalary = Number.parseFloat(minSalaryField.value);

  if (!isNaN(minSalary) && !isNaN(maxSalary) && maxSalary < minSalary) {
    showError(
      "maxSalary",
      "Maximum salary must be greater than or equal to minimum salary"
    );
  } else {
    clearError("maxSalary");
  }
});

// Clear individual field errors on input
document.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", function () {
    if (this.classList.contains("error")) {
      clearError(this.id);
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  // ===== FORCE PASSWORD CHANGE MODAL =====
  const dataAttr = document.body.getAttribute("data-must-change-password");
  console.log("[v0] data-must-change-password attribute:", dataAttr);

  let mustChangePassword = false;
  try {
    if (dataAttr) {
      const parsed = JSON.parse(dataAttr);
      // Only show modal if explicitly true (not truthy)
      mustChangePassword = parsed === true;
    }
  } catch (e) {
    console.error("[v0] Error parsing must_change_password:", e);
    mustChangePassword = false;
  }

  console.log("[v0] mustChangePassword after parsing:", mustChangePassword);

  if (mustChangePassword === true) {
    const modal = document.getElementById("forcePasswordModal");
    if (modal) {
      modal.style.display = "flex";
      console.log("[v0] Password change modal shown");
    }
  } else {
    const modal = document.getElementById("forcePasswordModal");
    if (modal) {
      modal.style.display = "none";
      console.log("[v0] Password change modal hidden");
    }
  }

  // ===== SHOW / HIDE PASSWORD =====
  document.querySelectorAll(".toggle-password").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const input = toggle.previousElementSibling;
      if (input.type === "password") {
        input.type = "text";
        toggle.textContent = "Hide";
      } else {
        input.type = "password";
        toggle.textContent = "Show";
      }
    });
  });

  // ===== PASSWORD VALIDATION =====
  const forcePasswordForm = document.getElementById("forcePasswordForm");
  const newPass = document.getElementById("newPassword");
  const confirmPass = document.getElementById("confirmPassword");
  const submitBtn = document.getElementById("submitBtn");
  const hint = document.getElementById("passwordHint");
  const requirements = document.querySelectorAll("#passwordRequirements li");

  if (!forcePasswordForm || !newPass || !confirmPass || !submitBtn || !hint) {
    console.log(
      "[v0] Force password form elements not found, skipping validation setup"
    );
    return;
  }

  function validatePasswords() {
    const password = newPass.value.trim();
    const confirm = confirmPass.value.trim();

    const hasMinLength = /.{8,}/.test(password);
    const hasUpperAndLower = /[A-Z]/.test(password) && /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[@$!%*?&]/.test(password);

    const rules = [hasMinLength, hasUpperAndLower, hasNumber, hasSpecialChar];

    // Update requirement checklist colors
    requirements.forEach((li, i) => {
      li.style.color = rules[i] ? "green" : "#ff6666";
    });

    const allRequirementsMet = rules.every(Boolean);

    if (password === "" && confirm === "") {
      // Both empty - no validation message yet
      hint.textContent = "";
      submitBtn.disabled = true;
      console.log("[v0] Passwords: both empty, button disabled");
      return false;
    }

    if (password !== "" && !allRequirementsMet) {
      // Password entered but doesn't meet requirements
      hint.textContent = "Password does not meet all requirements.";
      hint.style.color = "#ff6666";
      submitBtn.disabled = true;
      console.log("[v0] Passwords: requirements not met, button disabled");
      return false;
    }

    if (allRequirementsMet && password !== confirm) {
      // Requirements met but passwords don't match
      hint.textContent = "Passwords do not match.";
      hint.style.color = "#ff6666";
      submitBtn.disabled = true;
      console.log("[v0] Passwords: mismatch, button disabled");
      return false;
    }

    if (allRequirementsMet && password === confirm && password !== "") {
      // All requirements met and passwords match
      hint.textContent = "Password looks good!";
      hint.style.color = "green";
      submitBtn.disabled = false;
      console.log("[v0] Passwords: valid and match, button enabled");
      return true;
    }

    // Default: not ready to submit
    submitBtn.disabled = true;
    return false;
  }

  // Attach event listeners
  newPass.addEventListener("input", validatePasswords);
  confirmPass.addEventListener("input", validatePasswords);

  forcePasswordForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const password = newPass.value.trim();
    const confirm = confirmPass.value.trim();

    const hasMinLength = /.{8,}/.test(password);
    const hasUpperAndLower = /[A-Z]/.test(password) && /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[@$!%*?&]/.test(password);

    const allRequirementsMet =
      hasMinLength &&
      hasUpperAndLower &&
      hasNumber &&
      hasSpecialChar &&
      password === confirm &&
      password !== "";

    if (!allRequirementsMet) {
      hint.textContent = "Please fix the errors above before submitting.";
      hint.style.color = "#ff6666";
      return;
    }

    // Hide the modal first
    const modal = document.getElementById("forcePasswordModal");
    if (modal) modal.style.display = "none";

    // Then submit the form
    forcePasswordForm.submit();
  });

  // Initial validation run
  validatePasswords();
});
