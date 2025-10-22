// DOM Elements
const form = document.getElementById("jobPostForm");
const clearFormBtn = document.getElementById("clearForm");
const addJobVacancyBtn = document.getElementById("addJobVacancy");
const modal = document.getElementById("successModal");
const closeModal = document.querySelector(".close");
const modalOk = document.getElementById("modalOk");

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
    modal.style.display = "block";
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
  modal.style.display = "none";
});

modalOk.addEventListener("click", () => {
  modal.style.display = "none";
  // Optionally reset the form after successful submission
  form.reset();
  document.getElementById("numVacancy").value = 1;
  clearAllErrors();
});

// Close modal when clicking outside of it
window.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
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
