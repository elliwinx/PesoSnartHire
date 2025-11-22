function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function showFlash(message, category = "info") {
  const flashContainer = document.body;
  const flashDiv = document.createElement("div");
  flashDiv.className = `flash ${category}`;
  flashDiv.innerHTML = `
    ${message}
    <button class="flash-close" onclick="this.parentElement.remove()">x</button>
  `;
  flashContainer.insertBefore(flashDiv, flashContainer.firstChild);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (flashDiv.parentElement) {
      flashDiv.classList.add("fade-out");
      setTimeout(() => flashDiv.remove(), 500);
    }
  }, 3000);
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] Initializing applicant.js");

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
  const Swal = window.Swal;
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

  const jobCards = Array.from(document.querySelectorAll(".job-card"));
  jobCards.forEach((card) => {
    const cs = window.getComputedStyle(card);
    card.dataset.defaultDisplay =
      cs.display === "inline" ? "inline-block" : cs.display || "block";
  });

  function filterJobs() {
    const searchValue = _normalize(searchEl?.value);
    const industryValue = _normalize(industrySelect?.value);
    const typeValue = _normalize(typeSelect?.value);
    const scheduleValue = _normalize(scheduleSelect?.value);

    jobCards.forEach((card) => {
      const jobTitle = _normalize(
        card.querySelector(".job-title")?.textContent
      );
      const companyName = _normalize(
        card.querySelector(".company-name")?.textContent
      );
      const cardIndustry = _normalize(
        card.querySelector(".job-industry")?.textContent
      );
      const cardType = _normalize(card.querySelector(".job-type")?.textContent);
      const cardSchedule = _normalize(
        card.querySelector(".job-schedule")?.textContent
      );

      const matchesSearch =
        !searchValue ||
        jobTitle.includes(searchValue) ||
        companyName.includes(searchValue);
      const matchesIndustry =
        !industryValue || cardIndustry.includes(industryValue);
      const matchesType = !typeValue || cardType.includes(typeValue);
      const matchesSchedule =
        !scheduleValue || cardSchedule.includes(scheduleValue);

      const show =
        matchesSearch && matchesIndustry && matchesType && matchesSchedule;

      card.style.display = show ? card.dataset.defaultDisplay : "none";
      card.classList.toggle("hidden", !show);
    });
  }

  if (searchEl) searchEl.addEventListener("input", filterJobs);
  [industrySelect, typeSelect, scheduleSelect].forEach((el) => {
    if (el) el.addEventListener("change", filterJobs);
  });

  filterJobs();

  // ================== REPORT MODAL ==================
  const reportModal = document.getElementById("reportModalUnique");
  const closeReportBtn = reportModal?.querySelector(".close-report-unique");
  const cancelReportBtn = document.getElementById("cancelReportUnique");
  const confirmReportBtn = document.getElementById("confirmReportUnique");
  const reportReasonSelect = document.getElementById("reportReasonUnique");
  let reportingJobId = null;

  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-report");
    if (!btn) return;
    reportingJobId = btn.closest(".job-card")?.querySelector(".btn-details")
      ?.dataset.jobId;
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
    confirmReportBtn.addEventListener("click", async () => {
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
          credentials: "same-origin",
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

  window.addEventListener("click", (e) => {
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
  const cancelConfirmBtn = confirmModal?.querySelector(".btn-cancel-confirm");
  const successConfirmBtn = successModal?.querySelector(".btn-confirm");

  function showAlreadyAppliedToast() {
    const toast = document.getElementById("alreadyAppliedToast");
    if (!toast) return;

    toast.style.display = "flex";
    setTimeout(() => (toast.style.display = "none"), 3000);
  }

  document
    .getElementById("alreadyAppliedClose")
    ?.addEventListener("click", () => {
      document.getElementById("alreadyAppliedToast").style.display = "none";
    });

  async function hasApplied(jobId) {
    try {
      const res = await fetch(
        `/applicants/api/check-application?jobId=${jobId}`
      );
      const data = await res.json();
      return data.applied;
    } catch (err) {
      console.error("Error checking application:", err);
      return false;
    }
  }

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

  if (cancelConfirmBtn) {
    cancelConfirmBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log("[v0] Cancel button clicked");

      if (confirmModal) {
        confirmModal.style.display = "none";
      }
      selectedJobId = null;
    });
  }

  async function sendApplication(jobId) {
    try {
      const response = await fetch(`/applicants/apply/${jobId}`, {
        method: "POST",
        credentials: "same-origin",
      });

      return await response.json();
    } catch {
      return { success: false, message: "Network error" };
    }
  }

  if (confirmApplyBtn) {
    confirmApplyBtn.addEventListener("click", async () => {
      if (!selectedJobId) return;

      const loader = document.getElementById("ajaxLoader");
      const loaderText = document.getElementById("ajaxLoaderText");
      if (loaderText) loaderText.textContent = "Submitting your application...";
      if (loader) loader.style.display = "flex";

      try {
        const res = await fetch(`/applicants/apply/${selectedJobId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
        });

        const data = await res.json();

        if (loader) loader.style.display = "none";
        confirmModal.style.display = "none";

        if (data.success) {
          successModal.style.display = "flex";

          const jobCard = document
            .querySelector(`.job-card [data-job-id="${selectedJobId}"]`)
            ?.closest(".job-card");
          if (jobCard) {
            const applyBtn = jobCard.querySelector(".btn-apply");
            if (applyBtn) {
              applyBtn.textContent = "Applied";
              applyBtn.disabled = true;
              applyBtn.style.backgroundColor = "#6b7280";
              applyBtn.style.cursor = "not-allowed";
            }
          }
        } else {
          showFlash(data.message || "Failed to submit application.", "danger");
        }
      } catch (err) {
        if (loader) loader.style.display = "none";
        console.error("[v0] Apply error:", err);
        showFlash(
          "An error occurred while submitting your application.",
          "danger"
        );
      }
    });
  }

  if (successConfirmBtn) {
    successConfirmBtn.addEventListener("click", () => {
      successModal.style.display = "none";
      location.reload();
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === confirmModal) {
      confirmModal.style.display = "none";
      selectedJobId = null;
    }
    if (e.target === successModal) successModal.style.display = "none";
  });

  // ================== JOB DETAILS MODAL ==================
  const jobDetailsModal = document.getElementById("jobDetailsModalUnique");
  const modalApplyBtn = document.getElementById("modal-apply-btn");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const closeBtn = jobDetailsModal?.querySelector(".close-unique");

  document.addEventListener("click", (e) => {
    const detailsBtn = e.target.closest(".btn-details");
    if (!detailsBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const jobId = detailsBtn.dataset.jobId;
    console.log("[v0] Details clicked for job:", jobId);

    if (!jobId) {
      console.log("[v0] No job ID found");
      return;
    }

    if (!jobDetailsModal) {
      console.log("[v0] Modal not found in DOM");
      return;
    }

    // Show modal with loading state
    jobDetailsModal.querySelector("#modal-body-unique").innerHTML =
      "<p style='text-align: center; padding: 20px;'>Loading job details...</p>";
    // store job id on modal element so modal buttons can reference it
    jobDetailsModal.dataset.modalJobId = jobId;
    jobDetailsModal.style.display = "flex";
    console.log("[v0] Modal displayed");

    // Fetch job details
    fetch(`/applicants/job/${jobId}`, { credentials: "same-origin" })
      .then((res) => {
        console.log("[v0] Response status:", res.status);
        return res.text();
      })
      .then((html) => {
        console.log("[v0] Loaded HTML length:", html.length);
        jobDetailsModal.querySelector("#modal-body-unique").innerHTML = html;
      })
      .catch((err) => {
        console.error("[v0] Fetch error:", err);
        jobDetailsModal.querySelector("#modal-body-unique").innerHTML =
          "<p style='color: red; text-align: center;'>Failed to load job details. Please try again.</p>";
      });
  });

  // Add delegated listener for Apply button inside the job details modal
  document.addEventListener("click", async (e) => {
    const applyBtn = e.target.closest("#jobDetailsModalUnique .btn-apply, #jobDetailsModalUnique #modal-apply-btn");
    if (!applyBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const jobIdFromModal = jobDetailsModal?.dataset?.modalJobId;
    if (!jobIdFromModal) {
      console.log("[v0] No job ID in modal");
      return;
    }

    selectedJobId = jobIdFromModal;

    if (await hasApplied(selectedJobId)) {
      jobDetailsModal.style.display = "none";
      showAlreadyAppliedToast();
      return;
    }

    // close details and open confirm modal
    jobDetailsModal.style.display = "none";
    if (confirmModal) confirmModal.style.display = "flex";
  });

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", () => {
      jobDetailsModal.style.display = "none";
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      jobDetailsModal.style.display = "none";
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === jobDetailsModal) {
      jobDetailsModal.style.display = "none";
    }
  });
});

async function renderApplications() {
  const applicationsList = document.getElementById("applicationsList");
  if (!applicationsList) return;

  try {
    const res = await fetch("/applicants/api/applications", {
      credentials: "same-origin",
    });
    const applications = await res.json();

    if (!applications || applications.length === 0) {
      applicationsList.innerHTML = `<div class="empty-state"><p>No applications yet.</p></div>`;
      return;
    }

    applicationsList.innerHTML = applications
      .map(
        (app) => `
      <div class="application-card" data-status="${
        app.status?.toLowerCase() || "pending"
      }">
        <h3>${app.jobTitle || "N/A"}</h3>
        <p>${app.companyName || "Company"}</p>
        <p>Applied on: ${new Date(app.date).toLocaleDateString()}</p>
      </div>
    `
      )
      .join("");

    const tabButtons = Array.from(
      document.querySelectorAll(".tab-group button")
    );
    const cards = Array.from(
      applicationsList.querySelectorAll(".application-card")
    );

    function filterCards(filter) {
      cards.forEach((card) => {
        const status = card.dataset.status || "";
        card.style.display =
          filter === "all" || status === filter ? "flex" : "none";
      });
    }

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        tabButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        filterCards(btn.dataset.filter || "all");
      });
    });

    const initialBtn =
      tabButtons.find((b) => b.classList.contains("active")) || tabButtons[0];
    if (initialBtn) initialBtn.click();
  } catch (err) {
    console.error("Failed to load applications:", err);
  }
}

document.addEventListener("DOMContentLoaded", renderApplications);

async function deleteApplication(appId) {
  if (!confirm("Are you sure you want to delete this application?")) return;

  try {
    const res = await fetch(`/applicants/api/delete-application/${appId}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const data = await res.json();
    if (data.success) {
      showFlash("Application deleted successfully.", "success");
      renderApplications();
    } else {
      showFlash(data.message || "Failed to delete application.", "danger");
    }
  } catch (err) {
    console.error("Error deleting application:", err);
    showFlash("Error deleting application.", "danger");
  }
}

document.addEventListener("click", function (e) {
  // OPEN CONFIRMATION MODAL
  if (e.target.id === "modal-apply-btn") {
    const modal = document.getElementById("confirmModalUnique");
    modal.style.display = "flex";
  }

  // CANCEL BUTTON
  if (e.target.id === "confirmCancel") {
    const modal = document.getElementById("confirmModalUnique");
    modal.style.display = "none";
  }

  // YES APPLY BUTTON
  if (e.target.id === "confirmYes") {
    console.log("Proceed with application!");
    const modal = document.getElementById("confirmModalUnique");
    modal.style.display = "none";
  }
});
