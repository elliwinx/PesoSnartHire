// DOM Elements
const form = document.getElementById("jobPostForm");
const addJobVacancyBtn = document.getElementById("addJobVacancy");
const successModal = document.getElementById("successModal");
const closeModal = document.querySelector(".close");
const modalOk = document.getElementById("modalOk");
const forcePasswordModal = document.getElementById("forcePasswordModal");
const Swal = window.Swal; // Declare the Swal variable

// ========================
// Form Validation
// ========================
function showError(field, message) {
  const errorElement = field.parentElement.querySelector(".error-message");
  field.classList.add("error");
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add("show");
  }
}

function clearError(field) {
  const errorElement = field.parentElement.querySelector(".error-message");
  field.classList.remove("error");
  if (errorElement) {
    errorElement.classList.remove("show");
    errorElement.textContent = "";
  }
}

function clearAllErrors(form) {
  form.querySelectorAll(".error-message").forEach((el) => {
    el.textContent = "";
    el.classList.remove("show");
  });
  form.querySelectorAll(".error").forEach((el) => el.classList.remove("error"));
}

function validateForm(form) {
  let isValid = true;
  clearAllErrors(form);

  const jobPosition = form.querySelector('[name="job_position"]');
  const workSchedule = form.querySelector('[name="work_schedule"]');
  const numVacancy = form.querySelector('[name="num_vacancy"]');
  const minSalary = form.querySelector('[name="min_salary"]');
  const maxSalary = form.querySelector('[name="max_salary"]');
  const jobDescription = form.querySelector('[name="job_description"]');
  const qualifications = form.querySelector('[name="qualifications"]');

  if (!jobPosition.value.trim()) {
    showError(jobPosition, "Job position is required");
    isValid = false;
  }
  if (!workSchedule.value) {
    showError(workSchedule, "Work schedule is required");
    isValid = false;
  }
  if (!numVacancy.value || Number.parseInt(numVacancy.value) < 1) {
    showError(numVacancy, "Number of vacancy must be at least 1");
    isValid = false;
  }

  const min = Number.parseFloat(minSalary.value);
  const max = Number.parseFloat(maxSalary.value);

  if (isNaN(min) || min < 0) {
    showError(minSalary, "Minimum salary must be ≥ 0");
    isValid = false;
  }
  if (isNaN(max) || max < 0) {
    showError(maxSalary, "Maximum salary must be ≥ 0");
    isValid = false;
  } else if (!isNaN(min) && max < min) {
    showError(maxSalary, "Maximum salary must be ≥ minimum salary");
    isValid = false;
  }

  if (!jobDescription.value.trim()) {
    showError(jobDescription, "Job description is required");
    isValid = false;
  }
  if (!qualifications.value.trim()) {
    showError(qualifications, "Qualifications are required");
    isValid = false;
  }

  return isValid;
}

// ========================
// Submit Form via AJAX
// ========================
document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelectorAll(".jobPostForm:not(#createJobForm)")
    .forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!validateForm(form)) return;

        try {
          const res = await fetch(form.action, {
            method: "POST",
            body: new FormData(form),
          });

          const data = await res.json();

          if (data.success) {
            form.reset();
            const vacancy = form.querySelector('[name="num_vacancy"]');
            if (vacancy) vacancy.value = 1;
            clearAllErrors(form);
            location.reload();
          } else {
            const errorMsg =
              data.error || data.message || "Failed to save job post.";
            console.error(errorMsg);
          }
        } catch (err) {
          console.error(err);
        }
      });

      // Real-time salary validation
      const minSalary = form.querySelector('[name="min_salary"]');
      const maxSalary = form.querySelector('[name="max_salary"]');
      if (minSalary && maxSalary) {
        const salaryCheck = () => {
          const min = Number.parseFloat(minSalary.value);
          const max = Number.parseFloat(maxSalary.value);
          if (!isNaN(min) && !isNaN(max) && max < min) {
            showError(maxSalary, "Maximum salary must be ≥ minimum salary");
          } else {
            clearError(maxSalary);
          }
        };
        minSalary.addEventListener("input", salaryCheck);
        maxSalary.addEventListener("input", salaryCheck);
      }

      // Clear individual field error on input
      form.querySelectorAll("input, select, textarea").forEach((field) => {
        field.addEventListener("input", () => clearError(field));
      });
    });
});

// ========================
// Add Job Vacancy Button
// ========================
document.addEventListener("DOMContentLoaded", () => {
  const addJobVacancyBtn = document.getElementById("addJobVacancy");
  if (!addJobVacancyBtn) return;

  addJobVacancyBtn.addEventListener("click", () => {
    const container = document.getElementById("jobFormContainer");
    if (!container) return;

    const original = container.querySelector(".job-form-section");
    if (!original) return;

    // Clone the entire form section
    const clone = original.cloneNode(true);

    // Reset all input, textarea, select fields
    clone.querySelectorAll("input, textarea, select").forEach((field) => {
      field.value = "";
      field.removeAttribute("id"); // remove duplicate IDs para walang conflict
    });

    // Clear all error messages
    clone.querySelectorAll(".error-message").forEach((err) => {
      err.textContent = "";
    });

    // Add spacing between sections
    clone.style.marginTop = "20px"; // adjust px as needed

    // Append the new cloned section
    container.appendChild(clone);
  });
});

// ========================
// Modal Controls
// ========================
if (closeModal && successModal) {
  closeModal.addEventListener("click", () => {
    successModal.style.display = "none";
  });
}

if (modalOk && successModal) {
  modalOk.addEventListener("click", () => {
    successModal.style.display = "none";
    // Optionally reset the form after successful submission
    if (form) {
      form.reset();
      const numVacancy = document.getElementById("numVacancy");
      if (numVacancy) numVacancy.value = 1;
    }
  });
}

// Close modal when clicking outside of it
window.addEventListener("click", (e) => {
  if (successModal && e.target === successModal) {
    successModal.style.display = "none";
  }
});

// ========================
// FILTER JOB CARDS BY STATUS
// ========================
document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab-group button");
  const jobCards = document.querySelectorAll(".listing-card");

  const normalize = (value) => value?.trim().toLowerCase();

  const applyFilter = (filter) => {
    const normalizedFilter = normalize(filter);

    jobCards.forEach((card) => {
      let status = normalize(card.dataset.status);

      if (status === "archive") status = "archived";

      if (
        normalizedFilter === "all" ||
        !normalizedFilter ||
        normalizedFilter === status
      ) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    });

    const visibleCount = [...jobCards].filter(
      (c) => c.style.display !== "none"
    ).length;
    const container = document.querySelector(".listing-container");
    const noResultMsg = document.getElementById("noJobsMessage");

    if (noResultMsg) {
      if (visibleCount === 0) {
        noResultMsg.style.display = "block";
        if (container) container.classList.add("empty-state");
      } else {
        noResultMsg.style.display = "none";
        if (container) container.classList.remove("empty-state");
      }
    }
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((x) => x.classList.remove("active"));
      tab.classList.add("active");
      applyFilter(tab.dataset.filter);
    });
  });

  applyFilter("all");

  jobCards.forEach((card) => {
    const status = normalize(card.dataset.status);
    if (status === "inactive" || status === "archived") {
      card.classList.add("job-inactive");
    }
  });
});

// ========================
// GLOBAL LOADER CONTROLS
// ========================
function showLoader(message = "Processing — please wait...") {
  const loader = document.getElementById("ajaxLoader");
  const loaderText = document.getElementById("ajaxLoaderText");
  if (loader && loaderText) {
    loaderText.textContent = message;
    loader.style.display = "flex";
  }
}

function hideLoader() {
  const loader = document.getElementById("ajaxLoader");
  if (loader) loader.style.display = "none";
}

// ========================
// CONFIRMATION MODAL
// ========================
function showConfirmModal(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("confirmModal");
    const modalTitle = document.getElementById("confirmModalTitle");
    const modalMessage = document.getElementById("confirmModalMessage");
    const yesBtn = document.getElementById("confirmModalYes");
    const noBtn = document.getElementById("confirmModalNo");

    if (!modal) {
      resolve(false);
      return;
    }

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.style.display = "block";

    const handleYes = () => {
      cleanup();
      resolve(true);
    };

    const handleNo = () => {
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      modal.style.display = "none";
      yesBtn.removeEventListener("click", handleYes);
      noBtn.removeEventListener("click", handleNo);
      window.removeEventListener("click", handleWindowClick);
    };

    const handleWindowClick = (e) => {
      if (e.target === modal) {
        cleanup();
        resolve(false);
      }
    };

    yesBtn.addEventListener("click", handleYes);
    noBtn.addEventListener("click", handleNo);
    window.addEventListener("click", handleWindowClick);
  });
}

// ========================
// JOB POST ACTION BUTTONS (Edit, Archive, Delete)
// ========================
document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelectorAll(".listing-actions .action-btn")
    .forEach((button) => {
      button.addEventListener("click", async function () {
        const jobId = this.dataset.jobId;
        const action = this.dataset.action;

        if (action === "edit") return;

        const card = this.closest(".listing-card");
        const currentStatus = card?.dataset.status?.toLowerCase();
        const isArchived = currentStatus === "archived";
        const isSuspended = currentStatus === "suspended";

        // PREVENT DELETION OF SUSPENDED JOBS
        if (action === "delete" && isSuspended) {
          await Swal.fire({
            icon: "error",
            title: "Cannot Delete Suspended Job",
            html: `This job post has been <strong>suspended</strong> and cannot be deleted.<br><br>
                  Please contact <strong>PESO SmartHire Admin</strong> for assistance.`,
            confirmButtonText: "OK",
            confirmButtonColor: "#7b1113",
          });
          return;
        }

        const actionTexts = {
          archive: {
            title: isArchived ? "Unarchive Job Post" : "Archive Job Post",
            confirm: isArchived
              ? "Are you sure you want to unarchive this job post? It will be visible to applicants again."
              : "Are you sure you want to archive this job post? It will no longer be visible to applicants.",
            loader: isArchived
              ? "Unarchiving job post..."
              : "Archiving job post...",
          },
          delete: {
            title: "Delete Job Post",
            confirm:
              "Are you sure you want to delete this job post? This action cannot be undone.",
            loader: "Deleting job post...",
          },
        };

        const actionConfig = actionTexts[action];
        if (!actionConfig) return;

        const confirmed = await showConfirmModal(
          actionConfig.title,
          actionConfig.confirm
        );

        if (confirmed) {
          showLoader(actionConfig.loader);

          fetch(`/employers/job/${action}/${jobId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_id: jobId }),
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.success) {
                setTimeout(() => {
                  hideLoader();
                  location.reload();
                }, 1500);
              } else {
                hideLoader();
                // Show error message if deletion failed (e.g., backend also blocked it)
                if (data.message) {
                  Swal.fire({
                    icon: "error",
                    title: "Action Failed",
                    text: data.message,
                    confirmButtonText: "OK",
                  });
                } else {
                  location.reload();
                }
              }
            })
            .catch((error) => {
              hideLoader();
              Swal.fire({
                icon: "error",
                title: "Error",
                text: "Failed to complete action. Please try again.",
                confirmButtonText: "OK",
              });
            });
        }
      });
    });
});

// ========================
// Edit Job Modal Controls
// ========================
document.addEventListener("DOMContentLoaded", () => {
  const editModal = document.getElementById("ej_editJobModal");
  if (!editModal) return;

  const closeBtn = editModal.querySelector(".ej-close-modal");
  const editForm = document.getElementById("ej_editJobForm");

  document.querySelectorAll(".action-edit").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const jobId = btn.dataset.jobId;
      showLoader("Loading job details...");

      try {
        const res = await fetch(`/employers/job/${jobId}/json`);

        if (!res.ok) {
          throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        hideLoader();

        console.log("[v0] Job data received:", data);

        if (data.success && data.job) {
          const job = data.job;
          document.getElementById("ej_editJobId").value = job.job_id;
          document.getElementById("ej_editJobTitle").value =
            job.job_position || "";
          document.getElementById("ej_editJobSchedule").value =
            job.work_schedule || "";
          document.getElementById("ej_editJobVacancy").value =
            job.num_vacancy || 1;
          document.getElementById("ej_editJobMinSalary").value =
            job.min_salary || 0;
          document.getElementById("ej_editJobMaxSalary").value =
            job.max_salary || 0;
          document.getElementById("ej_editJobDescription").value =
            job.job_description || "";
          document.getElementById("ej_editJobQualifications").value =
            job.qualifications || "";
          const statusValue = job.status
            ? job.status.charAt(0).toUpperCase() +
              job.status.slice(1).toLowerCase()
            : "Active";
          document.getElementById("ej_editJobStatus").value = statusValue;
          editModal.style.display = "block";
        } else {
          const errorMsg = data.message || "Unable to load job details.";
          console.error("[v0] API Error:", errorMsg);
          showFlash("Error: " + errorMsg, "danger");
          hideLoader();
        }
      } catch (err) {
        hideLoader();
        console.error("[v0] Fetch Error:", err.message);
        showFlash("Failed to load job details: " + err.message, "danger");
      }
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener(
      "click",
      () => (editModal.style.display = "none")
    );
  }

  window.addEventListener("click", (e) => {
    if (e.target === editModal) editModal.style.display = "none";
  });

  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      // --- START VALIDATION ---
      let isValid = true;

      // Clear previous errors in the edit form
      editForm.querySelectorAll(".error-message").forEach((el) => {
        el.textContent = "";
        el.classList.remove("show");
      });
      editForm
        .querySelectorAll(".error")
        .forEach((el) => el.classList.remove("error"));

      // Get fields
      const position = editForm.querySelector('[name="ej_job_position"]');
      const schedule = editForm.querySelector('[name="ej_work_schedule"]');
      const vacancy = editForm.querySelector('[name="ej_vacancy"]');
      const minSalary = editForm.querySelector('[name="ej_min_salary"]');
      const maxSalary = editForm.querySelector('[name="ej_max_salary"]');
      const description = editForm.querySelector('[name="ej_job_description"]');
      const qualifications = editForm.querySelector(
        '[name="ej_qualifications"]'
      );

      // Validate Job Position
      if (!position.value.trim()) {
        showError(position, "Job position is required");
        isValid = false;
      }

      // Validate Schedule
      if (!schedule.value.trim()) {
        showError(schedule, "Work schedule is required");
        isValid = false;
      }

      // Validate Vacancy
      if (!vacancy.value || parseInt(vacancy.value) < 1) {
        showError(vacancy, "Vacancy must be at least 1");
        isValid = false;
      }

      // Validate Salary
      const min = parseFloat(minSalary.value);
      const max = parseFloat(maxSalary.value);

      if (isNaN(min) || min < 0) {
        showError(minSalary, "Minimum salary must be ≥ 0");
        isValid = false;
      }
      if (isNaN(max) || max < 0) {
        showError(maxSalary, "Maximum salary must be ≥ 0");
        isValid = false;
      }
      if (!isNaN(min) && !isNaN(max) && max < min) {
        showError(maxSalary, "Max salary cannot be less than Min salary");
        isValid = false;
      }

      // Validate Description
      if (!description.value.trim()) {
        showError(description, "Job description is required");
        isValid = false;
      }

      // Validate Qualifications
      if (!qualifications.value.trim()) {
        showError(qualifications, "Qualifications are required");
        isValid = false;
      }

      if (!isValid) return;
      // --- END VALIDATION ---

      const fd = new FormData(editForm);
      const jobId = fd.get("ej_job_id");
      showLoader("Saving changes...");

      function showFlash(message, type = "success") {
        // Create flash element
        const flashDiv = document.createElement("div");
        flashDiv.className = `flash ${type}`; // 'success' or 'danger'
        flashDiv.innerHTML = `${message} <button class="close" onclick="this.parentElement.remove()">×</button>`;

        // Insert at top of body
        document.body.insertBefore(flashDiv, document.body.firstChild);

        // Auto remove after 3s
        setTimeout(() => {
          flashDiv.classList.add("fade-out");
          setTimeout(() => flashDiv.remove(), 500);
        }, 3000);
      }

      try {
        const res = await fetch(`/employers/job/${jobId}/update`, {
          method: "POST",
          body: fd,
        });
        const result = await res.json();
        hideLoader();

        if (result.success) {
          // Use SweetAlert if available, otherwise standard flash
          if (typeof Swal !== "undefined") {
            Swal.fire({
              icon: "success",
              title: "Success",
              text: "Job post updated successfully!",
              confirmButtonColor: "#7b1113",
            }).then(() => {
              editModal.style.display = "none";
              location.reload();
            });
          } else {
            // REPLACED ALERT
            showFlash("Job updated successfully!", "success");
            editModal.style.display = "none";
            setTimeout(() => location.reload(), 1000);
          }
        } else {
          console.error(result.message || "Update failed.");
          // REPLACED ALERT
          showFlash(result.message || "Failed to update job.", "danger");
        }
      } catch (err) {
        hideLoader();
        console.error(err);
        // REPLACED ALERT
        showFlash("An error occurred while saving.", "danger");
      }
    });

    // Add real-time validation clearing for edit form inputs
    editForm.querySelectorAll("input, textarea, select").forEach((field) => {
      field.addEventListener("input", () => clearError(field));
    });
  }

  const statusBtn = document.getElementById("ej_btnEditStatus");
  if (statusBtn) {
    statusBtn.addEventListener("click", () => {
      const sel = document.getElementById("ej_editJobStatus");
      sel.value = sel.value === "Archived" ? "Active" : "Archived";
    });
  }
});

// ========================
// Create Job Form Submission
// ========================
document.addEventListener("DOMContentLoaded", () => {
  const createJobForm = document.getElementById("createJobForm");
  if (!createJobForm) return;

  // Flag to prevent double submission
  let isSubmitting = false;

  createJobForm.addEventListener("submit", (e) => {
    // Prevent multiple submissions
    if (isSubmitting) {
      e.preventDefault();
      return;
    }

    // Validate form
    if (!validateForm(createJobForm)) {
      e.preventDefault();
      return;
    }

    // Check salary validation
    const minSalary = Number.parseFloat(
      createJobForm.querySelector('[name="min_salary"]')?.value
    );
    const maxSalary = Number.parseFloat(
      createJobForm.querySelector('[name="max_salary"]')?.value
    );

    if (!isNaN(minSalary) && !isNaN(maxSalary) && maxSalary < minSalary) {
      e.preventDefault();
      const maxSalaryField = createJobForm.querySelector('[name="max_salary"]');
      showError(maxSalaryField, "Maximum salary must be ≥ minimum salary");
      return;
    }

    // Set flag and allow form to submit naturally
    isSubmitting = true;
    showLoader("Creating job post...");
  });

  // Real-time salary validation
  const minSalaryInput = createJobForm.querySelector('[name="min_salary"]');
  const maxSalaryInput = createJobForm.querySelector('[name="max_salary"]');
  if (minSalaryInput && maxSalaryInput) {
    const salaryCheck = () => {
      const min = Number.parseFloat(minSalaryInput.value);
      const max = Number.parseFloat(maxSalaryInput.value);
      if (!isNaN(min) && !isNaN(max) && max < min) {
        showError(maxSalaryInput, "Maximum salary must be ≥ minimum salary");
      } else {
        clearError(maxSalaryInput);
      }
    };
    minSalaryInput.addEventListener("input", salaryCheck);
    maxSalaryInput.addEventListener("input", salaryCheck);
  }

  // Clear individual field error on input
  createJobForm.querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("input", () => clearError(field));
  });
});

// ========================
// FORCE PASSWORD CHANGE MODAL
// ========================
document.addEventListener("DOMContentLoaded", () => {
  const dataAttr = document.body.getAttribute("data-must-change-password");

  let mustChangePassword = false;
  try {
    if (dataAttr) {
      const parsed = JSON.parse(dataAttr);
      mustChangePassword = parsed === true;
    }
  } catch (e) {
    console.error("Error parsing must_change_password:", e);
    mustChangePassword = false;
  }

  if (mustChangePassword === true) {
    if (forcePasswordModal) {
      forcePasswordModal.style.display = "flex";
    }
  } else {
    if (forcePasswordModal) {
      forcePasswordModal.style.display = "none";
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
      hint.textContent = "";
      submitBtn.disabled = true;
      return false;
    }

    if (password !== "" && !allRequirementsMet) {
      hint.textContent = "Password does not meet all requirements.";
      hint.style.color = "#ff6666";
      submitBtn.disabled = true;
      return false;
    }

    if (allRequirementsMet && password !== confirm) {
      hint.textContent = "Passwords do not match.";
      hint.style.color = "#ff6666";
      submitBtn.disabled = true;
      return false;
    }

    if (allRequirementsMet && password === confirm && password !== "") {
      hint.textContent = "Password looks good!";
      hint.style.color = "green";
      submitBtn.disabled = false;
      return true;
    }

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
    if (forcePasswordModal) forcePasswordModal.style.display = "none";

    showLoader("Updating password...");
    // Then submit the form
    forcePasswordForm.submit();
  });

  // Initial validation run
  validatePasswords();
});

// ========================
// Initialize Archive Button Text Based on Status
// ========================
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".listing-card").forEach((card) => {
    const status = card.dataset.status?.toLowerCase();
    const archiveBtn = card.querySelector(".action-archive");
    if (archiveBtn && status === "archived") {
      archiveBtn.textContent = "Unarchive";
    }
  });
});

// ----------------------------
// SEARCH + STATUS FILTER
// ----------------------------

// Find the filterApplicants function and replace it with this updated version:

function filterApplicants() {
  const searchValue = document.getElementById("searchBar").value.toLowerCase();
  const statusValue = document.getElementById("statusFilter").value;

  // All applicant cards
  const cards = document.querySelectorAll(".applicant-card");
  let visibleCount = 0; // Track visible cards

  cards.forEach((card) => {
    const name = card.querySelector("h3").innerText.toLowerCase();
    // Get status text (ensure we handle case sensitivity or whitespace)
    const statusElement = card.querySelector(".status-badge");
    const status = statusElement ? statusElement.innerText.trim() : "";

    // Search logic
    const matchesSearch = name.includes(searchValue);

    // [FIX] Status logic: Hide Cancelled/Blacklisted by default
    let matchesStatus = false;
    if (statusValue === "") {
      // If "All Status" is selected, SHOW everything EXCEPT Cancelled or Blacklisted
      matchesStatus = status !== "Cancelled" && status !== "Blacklisted";
    } else {
      // Otherwise, match exactly what the user selected
      matchesStatus = status === statusValue;
    }

    // Show or hide
    if (matchesSearch && matchesStatus) {
      card.style.display = "block";
      visibleCount++;
    } else {
      card.style.display = "none";
    }
  });

  const emptyState = document.querySelector(".empty-state-message");
  if (emptyState)
    emptyState.style.display = visibleCount === 0 ? "block" : "none";
}

// Trigger on typing / dropdown change
document
  .getElementById("searchBar")
  .addEventListener("keyup", filterApplicants);
document
  .getElementById("statusFilter")
  .addEventListener("change", filterApplicants);

// ==========================================
// APPLICANT REPORT MODERATION (Edit Status)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Attach click event to all "Edit Status" buttons for applicants
  document.querySelectorAll(".edit-applicant-status-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      const reportId = this.dataset.reportId;

      // Step 1: Choose Action (Confirm or Reject)
      Swal.fire({
        title: "Review Applicant Report",
        input: "select",
        inputOptions: {
          confirm: "Confirm (Restrict Applicant)",
          reject: "Reject (Dismiss Report)",
        },
        inputPlaceholder: "Select an action",
        showCancelButton: true,
        confirmButtonText: "Next",
        confirmButtonColor: "#7b1113",
        cancelButtonText: "Cancel",
      }).then((result) => {
        if (!result.value) return;
        const action = result.value;

        if (action === "confirm") {
          // Step 2 (Confirm): Ask for blacklist duration & note
          Swal.fire({
            title: "Confirm Report & Restrict",
            html:
              '<label style="display:block; text-align:left; margin-bottom:5px; font-weight:600;">Restriction Duration (Days)</label>' +
              '<input id="swal-blacklist-days" class="swal2-input" type="number" placeholder="365" value="365" min="1">' +
              '<label style="display:block; text-align:left; margin:15px 0 5px; font-weight:600;">Moderator Note</label>' +
              '<textarea id="swal-note" class="swal2-textarea" placeholder="Reason for restriction..."></textarea>',
            showCancelButton: true,
            confirmButtonText: "Confirm",
            confirmButtonColor: "#dc3545", // Red for restrictive action
            preConfirm: () => {
              const days = document.getElementById("swal-blacklist-days").value;
              const note = document.getElementById("swal-note").value;
              if (!days || days < 1) {
                Swal.showValidationMessage(
                  "Please enter a valid number of days"
                );
              }
              return { days, note };
            },
          }).then((confirmResult) => {
            if (confirmResult.isConfirmed) {
              submitApplicantReportAction(
                reportId,
                "confirm",
                confirmResult.value.days,
                confirmResult.value.note
              );
            }
          });
        } else {
          // Step 2 (Reject): Ask for optional note to reporter
          Swal.fire({
            title: "Reject Report",
            input: "textarea",
            inputPlaceholder: "Reason for rejection (optional)...",
            showCancelButton: true,
            confirmButtonText: "Reject Report",
            confirmButtonColor: "#6c757d",
          }).then((rejectResult) => {
            if (rejectResult.isConfirmed) {
              submitApplicantReportAction(
                reportId,
                "reject",
                null,
                rejectResult.value
              );
            }
          });
        }
      });
    });
  });
});

// Helper function to send the API request
function submitApplicantReportAction(reportId, action, days, note) {
  // Show loader using existing helper in admin.js
  showLoader("Processing action...");

  const payload = {
    action: action,
    moderator_note: note,
    blacklist_days: days ? parseInt(days) : null,
  };

  fetch(`/admin/applicant_reports/${reportId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .then((data) => {
      hideLoader();
      if (data.success) {
        Swal.fire({
          icon: "success",
          title: "Success",
          text: data.message,
          confirmButtonColor: "#7b1113",
        }).then(() => location.reload());
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: data.message || "Failed to process request",
        });
      }
    })
    .catch((err) => {
      hideLoader();
      console.error(err);
      Swal.fire("Error", "An unexpected error occurred", "error");
    });
}
