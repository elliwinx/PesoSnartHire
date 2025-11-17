// DOM Elements
const form = document.getElementById("jobPostForm");
const addJobVacancyBtn = document.getElementById("addJobVacancy");
const modal = document.getElementById("successModal");
const closeModal = document.querySelector(".close");
const modalOk = document.getElementById("modalOk");

// ========================
// Form Validation
// ========================
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
  document.querySelectorAll(".error-message").forEach(el => el.classList.remove("show"));
  document.querySelectorAll(".error").forEach(el => el.classList.remove("error"));
}

function validateForm() {
  let isValid = true;
  clearAllErrors();

  const jobPosition = document.getElementById("jobPosition").value.trim();
  const workSchedule = document.getElementById("workSchedule").value;
  const numVacancy = Number.parseInt(document.getElementById("numVacancy").value);
  const minSalary = Number.parseFloat(document.getElementById("minSalary").value);
  const maxSalary = Number.parseFloat(document.getElementById("maxSalary").value);
  const jobDescription = document.getElementById("jobDescription").value.trim();
  const qualifications = document.getElementById("qualifications").value.trim();

  if (!jobPosition) { showError("jobPosition", "Job position is required"); isValid = false; }
  if (!workSchedule) { showError("workSchedule", "Work schedule is required"); isValid = false; }
  if (!numVacancy || numVacancy < 1) { showError("numVacancy", "Number of vacancy must be at least 1"); isValid = false; }
  if (isNaN(minSalary) || minSalary < 0) { showError("minSalary", "Minimum salary must be ≥ 0"); isValid = false; }
  if (isNaN(maxSalary) || maxSalary < 0) { showError("maxSalary", "Maximum salary must be ≥ 0"); isValid = false; }
  else if (!isNaN(minSalary) && maxSalary < minSalary) { showError("maxSalary", "Maximum salary must be ≥ minimum salary"); isValid = false; }
  if (!jobDescription) { showError("jobDescription", "Job description is required"); isValid = false; }
  if (!qualifications) { showError("qualifications", "Qualifications are required"); isValid = false; }

  return isValid;
}

// ========================
// Submit Form via AJAX
// ========================
if (form) {
  form.addEventListener("submit", function(e) {
    e.preventDefault();

    if (!validateForm()) return;

    fetch("/employers/create_job", {
      method: "POST",
      body: new FormData(form)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          modal.style.display = "block"; // show modal
          form.reset(); // clear form
          document.getElementById("numVacancy").value = 1;
          clearAllErrors();
        } else {
          alert(data.error || "Failed to save job post.");
        }
      })
      .catch(err => {
        console.error(err);
        alert("An error occurred while saving the job post.");
      });
  });
}

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

