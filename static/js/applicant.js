function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function showFlash(message, category = 'info') {
  const flashContainer = document.body;
  const flashDiv = document.createElement('div');
  flashDiv.className = `flash ${category}`;
  flashDiv.innerHTML = `
    ${message}
    <button class="flash-close" onclick="this.parentElement.remove()">x</button>
  `;
  flashContainer.insertBefore(flashDiv, flashContainer.firstChild);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (flashDiv.parentElement) {
      flashDiv.classList.add('fade-out');
      setTimeout(() => flashDiv.remove(), 500);
    }
  }, 3000);
}

document.addEventListener("DOMContentLoaded", () => {
  // ================== DROPDOWN MENU ==================
  const menuToggle = document.getElementById("menuToggle");
  const dropdownMenu = document.getElementById("dropdownMenu");

  if (menuToggle && dropdownMenu) {
    dropdownMenu.classList.remove("show", "open");
    dropdownMenu.style.display = "none";
    menuToggle.setAttribute("aria-expanded", "false");

    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdownMenu.classList.toggle("show");
      dropdownMenu.classList.toggle("open", isOpen);
      dropdownMenu.style.display = isOpen ? "block" : "none";
      menuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    document.addEventListener("click", (e) => {
      if (!dropdownMenu.contains(e.target) && !menuToggle.contains(e.target)) {
        if (dropdownMenu.classList.contains("show")) {
          dropdownMenu.classList.remove("show", "open");
          dropdownMenu.style.display = "none";
          menuToggle.setAttribute("aria-expanded", "false");
        }
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && dropdownMenu.classList.contains("show")) {
        dropdownMenu.classList.remove("show", "open");
        dropdownMenu.style.display = "none";
        menuToggle.setAttribute("aria-expanded", "false");
      }
    });
  }
});

  // ================== TAB SWITCHING ==================
  const buttons = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".content");
  const applicantStatus = document.getElementById("applicantStatus")?.value;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      contents.forEach((c) => (c.style.display = "none"));
      const target = document.getElementById(btn.getAttribute("data-target"));
      if (target) target.style.display = "block";

      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  const personalTab = document.getElementById("personal-information");
  const documentsTab = document.getElementById("documents");
  if (applicantStatus === "Reupload") {
    if (personalTab) personalTab.style.display = "none";
    if (documentsTab) documentsTab.style.display = "block";
  } else {
    if (personalTab) personalTab.style.display = "block";
    if (documentsTab) documentsTab.style.display = "none";
  }

  // ================== EDIT / SAVE / CANCEL ==================
  const editBtn = document.getElementById("editBtn");
  const saveBtn = document.getElementById("saveBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const accountForm = document.getElementById("accountForm");

  const inputs = document.querySelectorAll(".chip");
  const selects = document.querySelectorAll("select");
  const radios = document.querySelectorAll("input[type='radio']");
  const fileInputs = document.querySelectorAll(
    ".file-input, .avatar input[type='file']"
  );
  const profileTop = document.querySelector(".profile-top");
  const avatar = document.querySelector(".profile-top .avatar");

  const pwdYes = document.getElementById("pwd_yes");
  const pwdNo = document.getElementById("pwd_no");
  const pwdDetails = document.getElementById("pwd_details");
  const expYes = document.getElementById("exp_yes");
  const expNo = document.getElementById("exp_no");
  const workDetails = document.getElementById("work_details");

  function setConditionalInputsEditable(editable) {
    [pwdDetails, workDetails].forEach((section) => {
      if (section) {
        section.querySelectorAll("input, select, textarea").forEach((el) => {
          if (editable) {
            el.removeAttribute("disabled");
            if (el.tagName === "SELECT") el.classList.remove("select-readonly");
          } else {
            el.setAttribute("disabled", true);
            if (el.tagName === "SELECT") el.classList.add("select-readonly");
          }
        });
      }
    });
  }

  function updateConditionals() {
    if (pwdDetails && pwdYes)
      pwdDetails.style.display = pwdYes.checked ? "block" : "none";
    if (workDetails && expYes)
      workDetails.style.display = expYes.checked ? "block" : "none";
  }

  [pwdYes, pwdNo, expYes, expNo].forEach((el) => {
    if (el) el.addEventListener("change", updateConditionals);
  });

  let originalValues = {};

  if (editBtn) {
    editBtn.addEventListener("click", (e) => {
      e.preventDefault();
      originalValues = {};
      inputs.forEach((el) => (originalValues[el.name] = el.value));
      selects.forEach((el) => (originalValues[el.name] = el.value));
      radios.forEach((el) => (originalValues[el.name] = el.checked));
      const avatarImg = document.getElementById("profilePicPreview");
      if (avatarImg) originalValues["avatarSrc"] = avatarImg.src;

      profileTop?.classList.add("edit-mode");
      avatar?.classList.add("editable");

      fileInputs.forEach((el) => {
        el.style.display = "block";
        el.removeAttribute("disabled");
      });
      inputs.forEach((el) => el.removeAttribute("readonly"));
      selects.forEach((el) => {
        el.removeAttribute("disabled");
        el.classList.remove("select-readonly");
      });
      radios.forEach((el) => el.removeAttribute("disabled"));
      setConditionalInputsEditable(true);

      editBtn.style.display = "none";
      saveBtn.style.display = "inline-block";
      cancelBtn.style.display = "inline-block";

      updateConditionals();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      inputs.forEach((el) => {
        if (originalValues.hasOwnProperty(el.name))
          el.value = originalValues[el.name];
      });
      selects.forEach((el) => {
        if (originalValues.hasOwnProperty(el.name))
          el.value = originalValues[el.name];
      });
      radios.forEach((el) => {
        if (originalValues.hasOwnProperty(el.name))
          el.checked = originalValues[el.name];
      });
      const avatarImg = document.getElementById("profilePicPreview");
      if (avatarImg && originalValues["avatarSrc"])
        avatarImg.src = originalValues["avatarSrc"];

      profileTop?.classList.remove("edit-mode");
      avatar?.classList.remove("editable");

      fileInputs.forEach((el) => {
        if (applicantStatus !== "Reupload") el.style.display = "none";
        el.setAttribute("disabled", true);
        el.value = "";
      });
      inputs.forEach((el) => el.setAttribute("readonly", true));
      selects.forEach((el) => {
        el.setAttribute("disabled", true);
        el.classList.add("select-readonly");
      });
      radios.forEach((el) => el.setAttribute("disabled", true));
      setConditionalInputsEditable(false);

      editBtn.style.display = "inline-block";
      saveBtn.style.display = "none";
      cancelBtn.style.display = "none";

      updateConditionals();
    });
  }

  saveBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    accountForm?.submit();
  });

  updateConditionals();
  fileInputs.forEach((el) => {
    el.style.display = applicantStatus === "Reupload" ? "block" : "none";
  });

  // ================== PHONE INPUT ==================
  const phoneInput = document.querySelector("input[name='phone']");
  if (phoneInput) {
    phoneInput.addEventListener("focus", () => {
      if (!phoneInput.value.startsWith("+63")) phoneInput.value = "+63";
    });
    phoneInput.addEventListener("input", () => {
      if (!phoneInput.value.startsWith("+63")) phoneInput.value = "+63";
      const digits = phoneInput.value.slice(3).replace(/\D/g, "").slice(0, 10);
      phoneInput.value = "+63" + digits;
    });
    phoneInput.addEventListener("blur", () => {
      if (!phoneInput.value || phoneInput.value === "+63")
        phoneInput.value = "+63";
    });
  }

  // ================== AVATAR PREVIEW ==================
  const avatarContainer = document.querySelector(".avatar");
  const inputFile = avatarContainer?.querySelector("input[type='file']");
  const imgPreview = document.getElementById("profilePicPreview");
  if (inputFile && imgPreview) {
    inputFile.addEventListener("change", () => {
      const file = inputFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => (imgPreview.src = e.target.result);
      reader.readAsDataURL(file);
    });
  }

  // ================== DEACTIVATE APPLICANT ==================
  const deactivateBtn = document.getElementById("deactivateApplicantBtn");
  if (deactivateBtn) {
    deactivateBtn.addEventListener("click", async () => {
      const confirmDelete = await Swal.fire({
        title: "Are you sure?",
        text: "Your account will be permanently deleted after 30 days.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#8b0d0d",
        cancelButtonColor: "gray",
        confirmButtonText: "Confirm",
        cancelButtonText: "Cancel",
      });
      if (!confirmDelete.isConfirmed) return;

      const loader = document.getElementById("ajaxLoader");
      const loaderText = document.getElementById("ajaxLoaderText");
      if (loaderText)
        loaderText.textContent = "Deactivating account — please wait…";
      if (loader) loader.style.display = "flex";

      try {
        const res = await fetch("/applicants/deactivate", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          setTimeout(() => {
            if (loader) loader.style.display = "none";
            window.location.href = "/";
          }, 1500);
        } else {
          if (loader) loader.style.display = "none";
          showFlash(data.message, "danger");
        }
      } catch (err) {
        if (loader) loader.style.display = "none";
        showFlash("Something went wrong. Please try again later.", "danger");
      }
    });
  }

  // ================== APPLICATION TAB FILTER ==================
  const tabGroup = document.querySelector(".tab-group");
  if (tabGroup) {
    const tabButtons = Array.from(tabGroup.querySelectorAll("button"));
    const cards = Array.from(document.querySelectorAll(".application-card"));

    function setActiveButton(activeBtn) {
      tabButtons.forEach((b) => b.classList.toggle("active", b === activeBtn));
    }

    function filterCards(filter) {
      cards.forEach((card) => {
        const status = card.getAttribute("data-status") || "";
        if (filter === "all" || filter === "") card.classList.remove("hidden");
        else
          status === filter
            ? card.classList.remove("hidden")
            : card.classList.add("hidden");
      });
    }

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const filter = btn.dataset.filter || "all";
        setActiveButton(btn);
        filterCards(filter);
        btn.focus();
      });
    });

    const initialBtn =
      tabButtons.find((b) => b.classList.contains("active")) || tabButtons[0];
    if (initialBtn) {
      setActiveButton(initialBtn);
      filterCards(initialBtn.dataset.filter || "all");
    }
  }

  // ================== JOB SEARCH & FILTER ==================
  const searchEl = document.getElementById("searchInput");
  const industrySelect = document.getElementById("industrySelect");
  const typeSelect = document.getElementById("typeSelect");
  const scheduleSelect = document.getElementById("scheduleSelect");

  function _normalize(str) {
    return (str || "").toString().trim().toLowerCase();
  }

  // collect job cards and remember their default display value so we can
  // restore it when showing the card (preserves layout like flex/grid)
  let jobCards = Array.from(document.querySelectorAll(".job-card"));
  jobCards.forEach((card) => {
    const cs = window.getComputedStyle(card);
    // if computed style is 'inline' we prefer 'inline-block' to avoid layout collapse
    card.dataset.defaultDisplay = cs.display === "inline" ? "inline-block" : cs.display || "block";
  });

  function filterJobs() {
    const searchValue = _normalize(searchEl?.value);
    const industryValue = _normalize(industrySelect?.value);
    const typeValue = _normalize(typeSelect?.value);
    const scheduleValue = _normalize(scheduleSelect?.value);

    jobCards.forEach((card) => {
      const jobTitle = _normalize(card.querySelector(".job-title")?.textContent);
      const companyName = _normalize(card.querySelector(".company-name")?.textContent);
      const cardIndustry = _normalize(card.querySelector(".job-industry")?.textContent);
      const cardType = _normalize(card.querySelector(".job-type")?.textContent);
      const cardSchedule = _normalize(card.querySelector(".job-schedule")?.textContent);

      const matchesSearch =
        !searchValue || jobTitle.includes(searchValue) || companyName.includes(searchValue);
      const matchesIndustry = !industryValue || cardIndustry.includes(industryValue);
      const matchesType = !typeValue || cardType.includes(typeValue);
      const matchesSchedule = !scheduleValue || cardSchedule.includes(scheduleValue);

      const show = matchesSearch && matchesIndustry && matchesType && matchesSchedule;

      // Restore the original display when showing, don't force 'block'
      card.style.display = show ? card.dataset.defaultDisplay : "none";
      card.classList.toggle("hidden", !show);
    });
  }

  // Use 'input' for the search to get immediate updates and 'change' for selects
  if (searchEl) searchEl.addEventListener("input", filterJobs);
  [industrySelect, typeSelect, scheduleSelect].forEach((el) => {
    if (el) el.addEventListener("change", filterJobs);
  });

  // Run initially to apply any default filter state
  filterJobs();

  // ================== JOB DETAILS MODAL ==================
  const jobModal = document.getElementById("jobDetailsModalUnique");
  const modalBody = document.getElementById("modal-body-unique");
  const closeJobModalBtn = jobModal?.querySelector(".close-unique");
  // backend route is /job/<id> (singular) — use that as default. You can override by
  // setting <body data-job-url-template="/your/path/"></body>
  const JOB_URL_TEMPLATE = document.querySelector("body")?.dataset.jobUrlTemplate || "/job/";
  let currentJobIdFromModal = null;

  if (closeJobModalBtn) {
    closeJobModalBtn.addEventListener("click", () => {
      jobModal.style.display = "none";
      modalBody.innerHTML = "";
      currentJobIdFromModal = null;
    });
  }

  window.addEventListener("click", e => {
    if (e.target === jobModal) {
      jobModal.style.display = "none";
      modalBody.innerHTML = "";
      currentJobIdFromModal = null;
    }
  });

  document.body.addEventListener("click", async e => {
    const btn = e.target.closest(".btn-details");
    if (!btn) return;
    e.preventDefault();

    const jobId = btn.dataset.jobId;
    if (!jobId || !modalBody) return;
    
    currentJobIdFromModal = jobId;

    modalBody.innerHTML = "<p>Loading...</p>";
    jobModal.style.display = "flex";

    try {
      // Build URL from template; support templates like '/job/0' or '/job/'
      let url;
      if (JOB_URL_TEMPLATE.includes('0')) {
        url = JOB_URL_TEMPLATE.replace(/\/0$/, `/${jobId}`);
      } else {
        url = JOB_URL_TEMPLATE.replace(/\/$/, '') + '/' + jobId;
      }
      const res = await fetch(url, { credentials: "same-origin" });
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await res.json();
        modalBody.innerHTML = data.success ? data.html : "<p>No content available.</p>";
      } else {
        modalBody.innerHTML = await res.text();
      }
    } catch (err) {
      console.error("[v0] Job details error:", err);
      showFlash("Failed to load job details. Please try again.", "danger");
      jobModal.style.display = "none";
    }
  });

  const modalApplyBtn = document.getElementById("modalApplyBtn");
  const modalCancelBtn = document.getElementById("modalCancelBtn");
  
  if (modalCancelBtn) {
    modalCancelBtn.addEventListener("click", () => {
      jobModal.style.display = "none";
      modalBody.innerHTML = "";
      currentJobIdFromModal = null;
    });
  }

  if (modalApplyBtn) {
    modalApplyBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!currentJobIdFromModal) {
        showFlash("No job selected.", "warning");
        return;
      }

      // Set the global currentJobId to the modal's job
      currentJobId = currentJobIdFromModal;
      
      // Show confirmation modal
      if (confirmModal) {
        confirmModal.style.display = "flex";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
  const confirmModal = document.getElementById("confirmModalUnique");
  const cancelBtn = document.getElementById("confirmCancelBtn");

  cancelBtn?.addEventListener("click", () => {
    if (confirmModal) confirmModal.style.display = "none";
  });
});


  // ================== REPORT MODAL ==================
  const reportModal = document.getElementById("reportModalUnique");
  const closeReportBtn = reportModal?.querySelector(".close-report-unique");
  const cancelReportBtn = document.getElementById("cancelReportUnique");
  const confirmReportBtn = document.getElementById("confirmReportUnique");
  const reportReasonSelect = document.getElementById("reportReasonUnique");
  let reportingJobId = null;

  document.body.addEventListener("click", e => {
    const btn = e.target.closest(".btn-report");
    if (!btn) return;
    reportingJobId = btn.closest(".job-card")?.querySelector(".btn-details")?.dataset.jobId;
    reportModal.style.display = "flex";
  });

  if (closeReportBtn) {
    closeReportBtn.addEventListener("click", () => {
      reportModal.style.display = "none";
      reportReasonSelect.value = "";
    });
  }

  if (cancelReportBtn) {
    cancelReportBtn.addEventListener("click", () => {
      reportModal.style.display = "none";
      reportReasonSelect.value = "";
    });
  }

if (confirmReportBtn) {
  confirmReportBtn.addEventListener("click", async () => {  // <-- async here
    const reason = reportReasonSelect?.value;
    if (!reason) {
      showFlash("Please select a reason for the report.", "warning");
      return;
    }

    try {
      const res = await fetch("/applicants/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: reportingJobId, reason }),
        credentials: "same-origin"
      });
      const data = await res.json();

      if (data.success) {
        showFlash("Report submitted successfully. Thank you!", "success");
        reportModal.style.display = "none";
        reportReasonSelect.value = "";
      } else {
        showFlash(data.message || "Failed to submit report.", "danger");
      }
    } catch (err) {
      console.error("[v0] Report error:", err);
      showFlash("An error occurred while submitting your report.", "danger");
    }
  });
}

  window.addEventListener("click", e => {
    if (e.target === reportModal) {
      reportModal.style.display = "none";
      reportReasonSelect.value = "";
    }
  });
  // ================== APPLY MODAL FLOW ==================
let selectedJobId = null;
const confirmModal = document.getElementById("confirmModalUnique");
const successModal = document.getElementById("successModalUnique");
const confirmApplyBtn = confirmModal?.querySelector(".btn-confirm");
const successConfirmBtn = successModal?.querySelector(".btn-confirm");

/* ====================================================
   CUSTOM TOAST FOR ALREADY APPLIED
==================================================== */
function showAlreadyAppliedToast() {
  const toast = document.getElementById("alreadyAppliedToast");
  if (!toast) return;

  toast.style.display = "flex";
  setTimeout(() => (toast.style.display = "none"), 3000);
}

document.getElementById("alreadyAppliedClose")?.addEventListener("click", () => {
  document.getElementById("alreadyAppliedToast").style.display = "none";
});

/* ====================================================
   CHECK IF USER ALREADY APPLIED (BACKEND)
==================================================== */
async function hasApplied(jobId) {
  try {
    const res = await fetch(`/api/check-application?jobId=${jobId}`);
    const data = await res.json();
    return data.applied; // backend should return { applied: true/false }
  } catch (err) {
    console.error("Error checking application:", err);
    return false;
  }
}

/* ====================================================
   OPEN CONFIRM MODAL WHEN APPLY BUTTON IS CLICKED
==================================================== */
document.querySelectorAll(".btn-apply").forEach((button) => {
  button.addEventListener("click", async () => {
    selectedJobId = button.dataset.jobId;

    if (await hasApplied(selectedJobId)) {
      showAlreadyAppliedToast();
      return;
    }

    confirmModal.style.display = "flex";
  });
});

/* ====================================================
   BACKEND SUBMISSION FUNCTION
==================================================== */
async function sendApplication(jobId) {
  const form = document.getElementById(`applyForm-${jobId}`);
  if (!form) return { success: false };

  try {
    const formData = new FormData(form);
    const response = await fetch(form.action, {
      method: "POST",
      body: formData,
      credentials: "same-origin",
    });

    return await response.json();
  } catch {
    return { success: false, message: "Invalid JSON" };
  }
}

/* ====================================================
   CONFIRM APPLY → SEND TO BACKEND
==================================================== */
if (confirmApplyBtn) {
  confirmApplyBtn.addEventListener("click", async () => {
    if (!selectedJobId) return;

    const backend = await sendApplication(selectedJobId);

    if (!backend.success && backend.message.includes("already")) {
      confirmModal.style.display = "none";
      showAlreadyAppliedToast();
      return;
    }

    confirmModal.style.display = "none";
    successModal.style.display = "flex";

    // Optionally, re-render applications list
    renderApplications();
  });
}

/* ====================================================
   SUCCESS MODAL CLOSE
==================================================== */
window.closeSuccessModal = () => {
  successModal.style.display = "none";
};

successConfirmBtn?.addEventListener("click", () => {
  successModal.style.display = "none";
});

/* ====================================================
   CLICK OUTSIDE TO CLOSE MODALS
==================================================== */
window.addEventListener("click", (e) => {
  if (e.target === confirmModal) confirmModal.style.display = "none";
  if (e.target === successModal) successModal.style.display = "none";
});
// ================== APPLICATIONS LIST RENDER & TAB FILTER ==================
async function renderApplications() {
  const applicationsList = document.getElementById("applicationsList");
  if (!applicationsList) return;

  try {
    const res = await fetch("/applicants/api/applications", { credentials: "same-origin" });
    const applications = await res.json();

    if (!applications || applications.length === 0) {
      applicationsList.innerHTML = `<div class="empty-state"><p>No applications yet.</p></div>`;
      return;
    }

    applicationsList.innerHTML = applications.map(app => `
      <div class="application-card" data-status="${app.status?.toLowerCase() || 'pending'}">
        <h3>${app.jobTitle || 'N/A'}</h3>
        <p>${app.companyName || 'Company'}</p>
        <p>Applied on: ${new Date(app.date).toLocaleDateString()}</p>
      </div>
    `).join("");

    // ===== TAB LOGIC =====
    const tabButtons = Array.from(document.querySelectorAll(".tab-group button"));
    const cards = Array.from(applicationsList.querySelectorAll(".application-card"));

    function filterCards(filter) {
      cards.forEach(card => {
        const status = card.dataset.status || "";
        card.style.display = filter === "all" || status === filter ? "flex" : "none";
      });
    }

    tabButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        tabButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        filterCards(btn.dataset.filter || "all");
      });
    });

    const initialBtn = tabButtons.find(b => b.classList.contains("active")) || tabButtons[0];
    if (initialBtn) initialBtn.click();

  } catch (err) {
    console.error("Failed to load applications:", err);
  }
}

// Run after DOM loads
document.addEventListener("DOMContentLoaded", renderApplications);

async function deleteApplication(appId) {
  if (!confirm("Are you sure you want to delete this application?")) return;

  try {
    const res = await fetch(`/applicants/api/delete-application/${appId}`, {
      method: "DELETE",
      credentials: "same-origin"
    });
    const data = await res.json();
    if (data.success) {
      showFlash("Application deleted successfully.", "success");
      renderApplications(); // ✅ replace loadApplications
    } else {
      showFlash(data.message || "Failed to delete application.", "danger");
    }
  } catch (err) {
    console.error("Error deleting application:", err);
    showFlash("Error deleting application.", "danger");
  }
}

// Run once after DOM loaded
document.addEventListener("DOMContentLoaded", renderApplications);

  // ================== TAB FILTER ==================
 const applicationsList = document.getElementById("applicationsList");
 const cards = applicationsList ? Array.from(applicationsList.querySelectorAll(".application-card")) : [];


  function filterCards(filter) {
    cards.forEach((card) => {
      const status = card.dataset.status || "";
      card.style.display = filter === "all" || status === filter ? "flex" : "none";
    });
  }

  if (tabButtons.length) {
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const filter = btn.dataset.filter || "all";
        tabButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        filterCards(filter);
      });
    });

    const initialBtn = tabButtons.find((b) => b.classList.contains("active")) || tabButtons[0];
    if (initialBtn) initialBtn.click();
  }

document.addEventListener("DOMContentLoaded", renderApplications);
