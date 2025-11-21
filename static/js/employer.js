// DOM Elements
const form = document.getElementById("jobPostForm");
const addJobVacancyBtn = document.getElementById("addJobVacancy");
const modal = document.getElementById("successModal");
const closeModal = document.querySelector(".close");
const modalOk = document.getElementById("modalOk");

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
  form.querySelectorAll(".error-message").forEach(el => {
    el.textContent = "";
    el.classList.remove("show");
  });
  form.querySelectorAll(".error").forEach(el => el.classList.remove("error"));
}

function validateForm(form) {
  let isValid = true;
  clearAllErrors(form);

  const jobPosition = form.querySelector('[name="jobPosition"]');
  const workSchedule = form.querySelector('[name="workSchedule"]');
  const numVacancy = form.querySelector('[name="numVacancy"]');
  const minSalary = form.querySelector('[name="minSalary"]');
  const maxSalary = form.querySelector('[name="maxSalary"]');
  const jobDescription = form.querySelector('[name="jobDescription"]');
  const qualifications = form.querySelector('[name="qualifications"]');

  if (!jobPosition.value.trim()) { showError(jobPosition, "Job position is required"); isValid = false; }
  if (!workSchedule.value) { showError(workSchedule, "Work schedule is required"); isValid = false; }
  if (!numVacancy.value || parseInt(numVacancy.value) < 1) { showError(numVacancy, "Number of vacancy must be at least 1"); isValid = false; }

  const min = parseFloat(minSalary.value);
  const max = parseFloat(maxSalary.value);

  if (isNaN(min) || min < 0) { showError(minSalary, "Minimum salary must be ≥ 0"); isValid = false; }
  if (isNaN(max) || max < 0) { showError(maxSalary, "Maximum salary must be ≥ 0"); isValid = false; }
  else if (!isNaN(min) && max < min) { showError(maxSalary, "Maximum salary must be ≥ minimum salary"); isValid = false; }

  if (!jobDescription.value.trim()) { showError(jobDescription, "Job description is required"); isValid = false; }
  if (!qualifications.value.trim()) { showError(qualifications, "Qualifications are required"); isValid = false; }

  return isValid;
}

// ========================
// Submit Form via AJAX
// ========================
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".jobPostForm").forEach(form => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!validateForm(form)) return;

      try {
        const res = await fetch(form.action, {
          method: "POST",
          body: new FormData(form)
        });

        const data = await res.json();

        if (data.success) {
          Swal.fire({
            icon: "success",
            title: "Success!",
            text: data.message || "Job post created successfully!"
          });
          form.reset();
          // reset numVacancy to 1
          const vacancy = form.querySelector('[name="numVacancy"]');
          if (vacancy) vacancy.value = 1;

          clearAllErrors(form);
        } else {
          Swal.fire({
            icon: "error",
            title: "Error!",
            text: data.error || data.message || "Failed to save job post."
          });
        }
      } catch (err) {
        console.error(err);
        Swal.fire({
          icon: "error",
          title: "Error!",
          text: "An error occurred while saving the job post."
        });
      }
    });

    // Real-time salary validation
    const minSalary = form.querySelector('[name="minSalary"]');
    const maxSalary = form.querySelector('[name="maxSalary"]');
    if (minSalary && maxSalary) {
      const salaryCheck = () => {
        const min = parseFloat(minSalary.value);
        const max = parseFloat(maxSalary.value);
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
    form.querySelectorAll("input, select, textarea").forEach(field => {
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

    // SweetAlert popup
    Swal.fire({
      title: "Success!",
      text: "New Job Vacancy section added!",
      icon: "success",
      confirmButtonText: "OK",
      confirmButtonColor: "#3B82F6",
    });

    const container = document.getElementById("jobFormContainer");
    if (!container) return;

    const original = container.querySelector(".job-form-section");
    if (!original) return;

    // Clone the entire form section
    const clone = original.cloneNode(true);

    // Reset all input, textarea, select fields
    clone.querySelectorAll("input, textarea, select").forEach(field => {
      field.value = "";
      field.removeAttribute("id"); // remove duplicate IDs para walang conflict
    });

    // Clear all error messages
    clone.querySelectorAll(".error-message").forEach(err => {
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
closeModal.addEventListener("click", () => {
  modal.style.display = "none";
});

modalOk.addEventListener("click", () => {
  modal.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

// ========================
// Real-time Salary Validation
// ========================
document.addEventListener("DOMContentLoaded", () => {
  const minSalaryInput = document.getElementById("minSalary");
  const maxSalaryInput = document.getElementById("maxSalary");

  if (minSalaryInput && maxSalaryInput) {
    minSalaryInput.addEventListener("input", () => {
      const minSalary = Number.parseFloat(minSalaryInput.value);
      const maxSalary = Number.parseFloat(maxSalaryInput.value);
      if (!isNaN(minSalary) && !isNaN(maxSalary) && maxSalary < minSalary) {
        showError("maxSalary", "Maximum salary must be ≥ minimum salary");
      } else {
        clearError("maxSalary");
      }
    });

    maxSalaryInput.addEventListener("input", () => {
      const maxSalary = Number.parseFloat(maxSalaryInput.value);
      const minSalary = Number.parseFloat(minSalaryInput.value);
      if (!isNaN(minSalary) && !isNaN(maxSalary) && maxSalary < minSalary) {
        showError("maxSalary", "Maximum salary must be ≥ minimum salary");
      } else {
        clearError("maxSalary");
      }
    });
  }
});


document.addEventListener("DOMContentLoaded", () => {
  const minSalaryInput = document.getElementById("minSalary");
  const maxSalaryInput = document.getElementById("maxSalary");

  if (minSalaryInput && maxSalaryInput) {
    minSalaryInput.addEventListener("input", () => {
      const minSalary = parseFloat(minSalaryInput.value);
      const maxSalary = parseFloat(maxSalaryInput.value);

      if (!isNaN(minSalary) && !isNaN(maxSalary) && maxSalary < minSalary) {
        showError("maxSalary", "Maximum salary must be ≥ minimum salary");
      } else {
        clearError("maxSalary");
      }
    });

    maxSalaryInput.addEventListener("input", () => {
      const minSalary = parseFloat(minSalaryInput.value);
      const maxSalary = parseFloat(maxSalaryInput.value);

      if (!isNaN(minSalary) && !isNaN(maxSalary) && maxSalary < minSalary) {
        showError("maxSalary", "Maximum salary must be ≥ minimum salary");
      } else {
        clearError("maxSalary");
      }
    });
  }
});

// Clear individual field errors on input
document.querySelectorAll("input, select, textarea").forEach((field) => {
  field.addEventListener("input", function () {
    if (this.classList.contains("error")) clearError(this.id);
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab-group button");
  const jobCards = document.querySelectorAll(".listing-card");

  // Normalize strings for consistency
  const normalize = (value) => value?.trim().toLowerCase();

  // ========================
  // FILTER JOB CARDS BY STATUS
  // ========================
  const applyFilter = (filter) => {
    const normalizedFilter = normalize(filter);

    jobCards.forEach((card) => {
      let status = normalize(card.dataset.status);

      // Handle cases where backend might send "archive" instead of "archived"
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

    // OPTIONAL: show message if no job matches filter
    const visibleCount = [...jobCards].filter(
      (c) => c.style.display !== "none"
    ).length;

    const noResultMsg = document.getElementById("noJobsMessage");
    if (noResultMsg) {
      noResultMsg.style.display = visibleCount === 0 ? "block" : "none";
    }
  };

  // ========================
  // HANDLE TAB CLICKS
  // ========================
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((x) => x.classList.remove("active"));
      tab.classList.add("active");
      applyFilter(tab.dataset.filter);
    });
  });

  // Default: show all
  applyFilter("all");

  // Apply visual style to inactive/archived
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
// JOB POST ACTION BUTTONS
// ========================
document.addEventListener("DOMContentLoaded", () => {
  document
  .querySelectorAll(".listing-actions .action-btn")
  .forEach((button) => {
    button.addEventListener("click", function () {
      const jobId = this.dataset.jobId;
      const action = this.dataset.action;

      // For "edit", just open the modal (handled separately)
      if (action === "edit") return;

      const actionTexts = {
        archive: {
          confirm: "archive this job post",
          loader: "Archiving job post...",
        },
        delete: {
          confirm: "delete this job post",
          loader: "Deleting job post...",
        },
      };

      const actionText = actionTexts[action]?.confirm || "";
      const loaderText =
        actionTexts[action]?.loader || "Processing — please wait...";

      Swal.fire({
        title: "Are you sure?",
        text: `You are about to ${actionText}.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, continue",
        cancelButtonText: "Cancel",
      }).then((result) => {
        if (result.isConfirmed) {
          showLoader(loaderText);

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
                Swal.fire("Error", data.message, "error");
              }
            })
            .catch(() => {
              hideLoader();
              Swal.fire("Error", "Request failed.", "error");
            });
        }
      });
    });
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const editModal = document.getElementById("ej_editJobModal");
  if (!editModal) return; // stop if modal not on page

  const closeBtn = editModal.querySelector(".ej-close-modal");
  const editForm = document.getElementById("ej_editJobForm");

  document.querySelectorAll(".action-edit").forEach(btn => {
    btn.addEventListener("click", async () => {
      const jobId = btn.dataset.jobId;
      showLoader("Loading job details...");

      try {
        const res = await fetch(`/employers/job/${jobId}/json`);
        const data = await res.json();
        hideLoader();

        if (data.success && data.job) {
          const job = data.job;
          document.getElementById("ej_editJobId").value = job.job_id;
          document.getElementById("ej_editJobTitle").value = job.job_position || '';
          document.getElementById("ej_editJobSchedule").value = job.work_schedule || '';
          document.getElementById("ej_editJobVacancy").value = job.vacancy || 1;
          document.getElementById("ej_editJobMinSalary").value = job.min_salary || 0;
          document.getElementById("ej_editJobMaxSalary").value = job.max_salary || 0;
          document.getElementById("ej_editJobDescription").value = job.job_description || '';
          document.getElementById("ej_editJobQualifications").value = job.qualifications || '';
          document.getElementById("ej_editJobStatus").value = job.status || 'Active';
          editModal.style.display = "block";
        } else {
          Swal.fire("Error", data.message || "Unable to load job details.", "error");
        }
      } catch (err) {
        hideLoader();
        console.error(err);
        Swal.fire("Error", "Unable to load job details.", "error");
      }
    });
  });

  closeBtn.addEventListener("click", () => editModal.style.display = "none");
  window.addEventListener("click", e => { if (e.target === editModal) editModal.style.display = "none"; });

  editForm.addEventListener("submit", async e => {
  e.preventDefault();
  const fd = new FormData(editForm);
  const jobId = fd.get("ej_job_id");
  showLoader("Saving changes...");

  try {
    const res = await fetch(`/employers/job/${jobId}/update`, { method: "POST", body: fd });
    const result = await res.json();
    hideLoader();

    if (result.success) {
      // ✅ Hide the modal overlay first
      editModal.style.display = "none";

      // Show SweetAlert only
      Swal.fire("Saved", "Job updated successfully!", "success").then(() => {
        location.reload(); // reload job list or page
      });
    } else {
      Swal.fire("Error", result.message || "Update failed.", "error");
    }
  } catch (err) {
    hideLoader();
    console.error(err);
    Swal.fire("Error", "Request failed.", "error");
  }
});

  const statusBtn = document.getElementById("ej_btnEditStatus");
  if (statusBtn) {
    statusBtn.addEventListener("click", () => {
      const sel = document.getElementById("ej_editJobStatus");
      sel.value = (sel.value === "Archived") ? "Active" : "Archived";
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("createJobForm");
    if (!form) return;

    form.addEventListener("submit", async function (e) {
        e.preventDefault();  

        const formData = new FormData(form);

        const response = await fetch(form.action, {
            method: "POST",
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            Swal.fire({
                icon: "success",
                title: "Success!",
                text: result.message
            });
            form.reset();
        } else {
            Swal.fire({
                icon: "error",
                title: "Error!",
                text: result.message
            });
        }
    });
});

