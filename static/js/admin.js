const statusModal = document.getElementById("statusModal");
const statusTriggerButtons = Array.from(
  document.querySelectorAll(".edit-status-btn, #editStatusBtn")
).filter((btn) => !btn.dataset.reportId);

document.addEventListener("DOMContentLoaded", () => {
  // ========== DROPDOWN MENU ==========
  const menuToggle = document.getElementById("menuToggle");
  const dropdownMenu = document.getElementById("dropdownMenu");

  if (menuToggle && dropdownMenu) {
    // ensure a consistent initial hidden state
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

    // close with Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && dropdownMenu.classList.contains("show")) {
        dropdownMenu.classList.remove("show", "open");
        dropdownMenu.style.display = "none";
        menuToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // ========== ACCOUNT EMAIL EDIT ==========
  const emailField = document.getElementById("email");
  const editBtn = document.getElementById("editBtn");
  const saveBtn = document.getElementById("saveBtn");
  const cancelBtn = document.getElementById("cancelBtn");

  if (editBtn && saveBtn && cancelBtn && emailField) {
    editBtn.addEventListener("click", () => {
      emailField.removeAttribute("readonly");
      emailField.focus();
      editBtn.style.display = "none";
      saveBtn.style.display = "inline";
      cancelBtn.style.display = "inline";
    });

    cancelBtn.addEventListener("click", () => {
      emailField.setAttribute("readonly", true);
      emailField.value = emailField.defaultValue;
      editBtn.style.display = "inline";
      saveBtn.style.display = "none";
      cancelBtn.style.display = "none";
    });
  }

  // --- Fallback modal initializer ---
  // Ensures edit-status buttons open the modal even if other bindings fail.
  if (statusModal) {
    statusTriggerButtons.forEach((btn) => {
      if (btn.dataset.listenerAttached) return;
      btn.dataset.listenerAttached = "1";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("[admin.js] edit-status clicked (fallback)");

        // Clear previous dataset
        ["employerId", "applicantId", "recruitmentType"].forEach(
          (key) => delete statusModal.dataset[key]
        );

        const employerId =
          btn.getAttribute("data-employer-id") ||
          (btn.closest("[data-employer-id]") || {}).dataset?.employerId;
        const applicantId =
          btn.getAttribute("data-applicant-id") ||
          (btn.closest("[data-applicant-id]") || {}).dataset?.applicantId;
        const recruitmentType =
          btn.getAttribute("data-recruitment-type") ||
          (btn.closest("[data-recruitment-type]") || {}).dataset
            ?.recruitmentType;

        if (employerId) statusModal.dataset.employerId = employerId;
        if (applicantId) statusModal.dataset.applicantId = applicantId;
        if (recruitmentType) statusModal.dataset.recruitmentType = recruitmentType;

        statusModal.style.display = "flex";
      });
    });
  }
});

// ========== FLASH MESSAGE UTILITY ==========
function showFlashMessage(message, type = "success") {
  const flashContainer =
    document.getElementById("flashContainer") || document.body;
  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.setAttribute("role", "alert");
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  flashContainer.insertBefore(alertDiv, flashContainer.firstChild);
  setTimeout(() => alertDiv.remove(), 3000);
}

// ================= STATUS MODAL LOGIC =================
const statusButtons = statusModal
  ? Array.from(statusModal.querySelectorAll(".status-btn[data-action]"))
  : [];
const closeModalBtn = document.getElementById("closeModal");

// Document selection modal
const documentSelectionModal = document.getElementById("documentSelectionModal");
const confirmDocumentBtn = document.getElementById("confirmDocumentBtn");
const cancelDocumentBtn = document.getElementById("cancelDocumentBtn");
const documentCheckboxList = document.getElementById("documentCheckboxList");

let selectedDocument = null;
let selectedDocuments = [];

// ---------- Open Status Modal ----------
if (statusModal) {
  statusTriggerButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      // Clear previous dataset
      ["employerId", "applicantId", "recruitmentType", "changePending"].forEach(
        (attr) => delete statusModal.dataset[attr]
      );

      // Populate modal dataset from button or closest container
      const getDataset = (key) =>
        btn.getAttribute(`data-${key}`) || (btn.closest(`[data-${key}]`)?.dataset?.[key]);

      ["employerId", "applicantId", "recruitmentType", "changePending"].forEach((key) => {
        const value = getDataset(key);
        if (value !== undefined) statusModal.dataset[key] = value;
      });

      // Show modal
      statusModal.style.display = "flex";
    });
  });
}

// ---------- Close Modal ----------
if (closeModalBtn) {
  closeModalBtn.addEventListener("click", () => (statusModal.style.display = "none"));
}

// Close modal on outside click
window.addEventListener("click", (e) => {
  if (e.target === statusModal) statusModal.style.display = "none";
  if (e.target === documentSelectionModal) documentSelectionModal.style.display = "none";
});

// ---------- Handle Status Button Clicks ----------
statusButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.action;

    if (action === "reupload") {
      // Open document selection modal
      if (documentSelectionModal) documentSelectionModal.style.display = "flex";
    } else {
      updateStatus(action);
    }
  });
});

// ---------- Document Selection ----------
if (confirmDocumentBtn) {
  confirmDocumentBtn.addEventListener("click", () => {
    if (!documentCheckboxList)
      return showFlashMessage("Document selector not available", "danger");

    const checked = Array.from(
      documentCheckboxList.querySelectorAll("input[type=checkbox]:checked")
    ).map((cb) => cb.value);

    if (!checked.length)
      return showFlashMessage("Please select at least one document", "warning");

    selectedDocuments = checked;
    selectedDocument = checked.length === 1 ? checked[0] : null;

    statusModal.dataset.selectedDocument = selectedDocument;
    documentSelectionModal.style.display = "none";

    proceedWithReupload();
  });
}

if (cancelDocumentBtn) {
  cancelDocumentBtn.addEventListener("click", () => {
    if (documentSelectionModal) documentSelectionModal.style.display = "none";
  });
}

// ---------- Functions ----------
function updateStatus(action) {
  const entityId = statusModal.dataset.employerId || statusModal.dataset.applicantId;
  const recruitmentType = statusModal.dataset.recruitmentType;

  let endpoint = null;
  if (statusModal.dataset.employerId) {
    endpoint =
      recruitmentType === "Local"
        ? `/admin/update_local_employer_status/${entityId}`
        : `/admin/update_international_employer_status/${entityId}`;
  } else if (statusModal.dataset.applicantId) {
    endpoint = `/admin/update_nonlipeno_status/${entityId}`;
  }

  if (!endpoint || !entityId)
    return showFlashMessage("Error: Could not process request", "danger");

  const payload = { action };

  showLoader("Processing — please wait...");

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .then((data) => {
      hideLoader();
      if (data.success) {
        showFlashAboveModal(data.message || "Status updated successfully", "success");
        statusModal.style.display = "none";
        setTimeout(() => location.reload(), 900);
      } else {
        showFlashAboveModal("Error: " + (data.message || "Failed to update status"), "danger");
      }
    })
    .catch((err) => {
      console.error(err);
      hideLoader();
      showInlineFlash("Something went wrong while updating status", "danger");
    });
}

function proceedWithReupload() {
  const entityId = statusModal.dataset.employerId || statusModal.dataset.applicantId;
  const recruitmentType = statusModal.dataset.recruitmentType;

  let endpoint = null;
  if (statusModal.dataset.employerId) {
    endpoint =
      recruitmentType === "Local"
        ? `/admin/update_local_employer_status/${entityId}`
        : `/admin/update_international_employer_status/${entityId}`;
  } else if (statusModal.dataset.applicantId) {
    endpoint = `/admin/update_nonlipeno_status/${entityId}`;
  }

  if (!endpoint || !entityId)
    return showFlashMessage("Error: Could not process request", "danger");

  const payload = {
    action: "reupload",
    document_name: selectedDocuments.length ? selectedDocuments : selectedDocument,
  };

  console.debug("[admin.js] reupload payload:", payload);

  showLoader("Processing — sending email...");

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .then((data) => {
      hideLoader();
      if (data.success) {
        showFlashAboveModal(data.message || "Request sent successfully", "success");
        statusModal.style.display = "none";
        setTimeout(() => location.reload(), 900);
      } else {
        showFlashAboveModal("Error: " + (data.message || "Failed to request reupload"), "danger");
      }
    })
    .catch((err) => {
      console.error(err);
      hideLoader();
      showInlineFlash("Something went wrong while requesting reupload", "danger");
    });
}

// Loader & inline flash helpers
function showLoader(text) {
  const loader = document.getElementById("ajaxLoader");
  const txt = document.getElementById("ajaxLoaderText");
  if (txt && text) txt.textContent = text;
  if (loader) loader.style.display = "flex";
  // Also show modal-level loader
  showModalLoader(text);
}

function hideLoader() {
  const loader = document.getElementById("ajaxLoader");
  if (loader) loader.style.display = "none";
  hideModalLoader();
}

function showInlineFlash(message, type = "success") {
  const container = document.getElementById("ajaxFlashContainer");
  if (!container) return;
  container.innerHTML = `<div class="flash ${
    type === "success" ? "success" : "danger"
  }">${message}<button class="close" onclick="this.parentElement.remove()">×</button></div>`;
  container.style.display = "block";
  setTimeout(() => {
    const f = container.querySelector(".flash");
    if (f) f.classList.add("fade-out");
    setTimeout(() => (container.style.display = "none"), 1200);
  }, 2700);
}

// Modal-aware helpers
function getTopVisibleModal() {
  const candidates = [
    statusModal,
    documentSelectionModal,
    typeof rejectionModal !== "undefined" ? rejectionModal : null,
  ];
  for (const el of candidates) {
    if (!el) continue;
    if (
      el.style &&
      (el.style.display === "flex" || el.style.display === "block")
    )
      return el;
  }
  const modals = Array.from(
    document.querySelectorAll('[role="dialog"], .modal')
  );
  for (const m of modals) {
    if (m && m.offsetParent !== null) return m;
  }
  return null;
}

function showModalLoader(text) {
  hideModalLoader();
  // If the page already includes a server-rendered ajax loader modal (used on employer reupload), prefer that design
  const ajaxLoaderEl = document.getElementById("ajaxLoader");
  const ajaxLoaderText = document.getElementById("ajaxLoaderText");
  if (ajaxLoaderEl) {
    if (ajaxLoaderText && text) ajaxLoaderText.textContent = text;
    // show the existing ajax loader modal (it uses .modal and .modal-content markup with a FontAwesome spinner)
    // ensure it appears above any open modal by temporarily raising z-index
    try {
      ajaxLoaderEl.style.zIndex = "120500";
      const content = ajaxLoaderEl.querySelector(".modal-content");
      if (content) content.style.zIndex = "120501";
    } catch (e) {
      /* ignore styling errors */
    }
    ajaxLoaderEl.style.display = "flex";
    return;
  }

  const modal = getTopVisibleModal();
  if (!modal) return;
  const loaderDiv = document.createElement("div");
  loaderDiv.id = "modalLoaderFlash";
  loaderDiv.className = "modal-loader-overlay";
  loaderDiv.innerHTML = `
    <div class="modal-loader-content">
      <div class="spinner" aria-hidden="true"></div>
      <div class="modal-loader-text">${
        text || "Processing — please wait..."
      }</div>
    </div>
  `;
  // Insert the loader overlay right before the modal to appear above the page but below modal dialog z-index
  modal.parentNode.insertBefore(loaderDiv, modal);
}

function hideModalLoader() {
  // Prefer hiding the page's ajaxLoader modal if present
  const ajaxLoaderEl = document.getElementById("ajaxLoader");
  if (ajaxLoaderEl) {
    // hide and reset any temporary inline z-index overrides
    ajaxLoaderEl.style.display = "none";
    try {
      ajaxLoaderEl.style.zIndex = "";
      const content = ajaxLoaderEl.querySelector(".modal-content");
      if (content) content.style.zIndex = "";
    } catch (e) {
      /* ignore */
    }
    return;
  }

  const existing = document.getElementById("modalLoaderFlash");
  if (existing && existing.parentNode)
    existing.parentNode.removeChild(existing);
  // Also remove any custom overlay with new classname
  const overlay = document.querySelector(".modal-loader-overlay");
  if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
}

function showFlashAboveModal(message, type = "success") {
  // Ensure modal loader is removed so flash is visible
  hideModalLoader();
  // Create .flash styled element (consistent with site styles)
  const flash = document.createElement("div");
  flash.className = `flash ${type === "success" ? "success" : "danger"}`;
  flash.innerHTML = `${message}<button class="close" onclick="this.parentElement.remove()">&times;</button>`;
  // Append to body so it's fixed and visible above content
  document.body.appendChild(flash);
  // Auto-fade and remove after a short delay
  setTimeout(() => {
    flash.classList.add("fade-out");
    setTimeout(() => flash.remove(), 600);
  }, 2800);
}

// Populate document selection modal with options based on recruitment type
function populateDocumentOptions(recruitmentType) {
  // Define option sets for local vs international
  const optionsByType = {
    Local: [
      { key: "Business Permit", label: "Business Permit" },
      {
        key: "DOLE No Pending Case",
        label: "DOLE - No Pending Case Certificate",
      },
      {
        key: "DOLE Authority to Recruit",
        label: "DOLE - Authority to Recruit",
      },
      { key: "PhilJobNet Registration", label: "PhilJobNet Registration" },
      { key: "Job Orders of Client", label: "Job Orders of Client/s" },
    ],
    International: [
      { key: "Business Permit", label: "Business Permit" },
      {
        key: "DMW No Pending Case",
        label: "DMW - No Pending Case Certificate",
      },
      { key: "License to Recruit", label: "DMW - License to Recruit" },
      { key: "PhilJobNet Registration", label: "PhilJobNet Registration" },
      { key: "Job Orders of Client", label: "Job Orders of Client/s" },
    ],
  };

  const opts = optionsByType[recruitmentType] || optionsByType.Local;
  const list = documentCheckboxList;
  if (!list) return;

  // Clear existing and reset
  list.innerHTML = "";
  selectedDocument = null;
  selectedDocuments = [];

  opts.forEach((o, idx) => {
    const id = `docchk_${idx}`;
    const wrapper = document.createElement("div");
    wrapper.style.marginBottom = "6px";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.value = o.key;
    input.name = "requested_documents";

    const label = document.createElement("label");
    label.setAttribute("for", id);
    label.style.marginLeft = "8px";
    label.textContent = o.label;

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    list.appendChild(wrapper);
  });
}

// When status modal opens, if it's for an employer, populate the document modal
if (statusModal) {
  statusTriggerButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const recruitmentType =
        btn.getAttribute("data-recruitment-type") ||
        (btn.closest("[data-recruitment-type]") || {}).dataset?.recruitmentType;

      // Only populate if employer
      const employerId =
        btn.getAttribute("data-employer-id") ||
        (btn.closest("[data-employer-id]") || {}).dataset?.employerId;
      if (employerId && documentSelectionModal) {
        populateDocumentOptions(recruitmentType || "Local");
      }
    });
  });
}

statusButtons.forEach((button) => {
  button.addEventListener("click", function () {
    const action = this.getAttribute("data-action");

    if (action === "reupload") {
      // For applicants, auto-request the recommendation letter (no selection modal)
      if (statusModal.dataset.applicantId) {
        selectedDocument = "Recommendation Letter";
        proceedWithReupload();
        return;
      }

      // For employers, hide the status modal (so modal stacking is clear), then show document selection modal
      if (statusModal) statusModal.style.display = "none";
      documentSelectionModal.style.display = "flex";
      return;
    }

    if (action === "rejected") {
      // Open rejection modal instead of immediately sending the request
      const rejectionModal = document.getElementById("rejectionModal");
      if (rejectionModal) rejectionModal.style.display = "flex";
      return;
    }

    const entityId =
      statusModal.dataset.employerId || statusModal.dataset.applicantId;
    const recruitmentType = statusModal.dataset.recruitmentType;
    let endpoint = null;

    if (statusModal.dataset.employerId) {
      endpoint =
        recruitmentType === "Local"
          ? `/admin/update_local_employer_status/${entityId}`
          : `/admin/update_international_employer_status/${entityId}`;
    } else if (statusModal.dataset.applicantId) {
      endpoint = `/admin/update_nonlipeno_status/${entityId}`;
    }

    if (!endpoint || !entityId)
      return showFlashMessage("Error: Could not process request", "danger");
    // Prevent duplicate clicks and show loader — only disable actionable status buttons
    const actionableButtons = statusModal
      ? Array.from(statusModal.querySelectorAll(".status-btn[data-action]"))
      : Array.from(document.querySelectorAll(".status-btn[data-action]"));
    actionableButtons.forEach((b) => (b.disabled = true));
    showLoader("Updating status...");

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
      .then((res) => res.json())
      .then((data) => {
        hideLoader();
        actionableButtons.forEach((b) => (b.disabled = false));
        if (data.success) {
          const statusSpan =
            document.getElementById("employer-status") ||
            document.getElementById("applicant-status");
          if (statusSpan)
            statusSpan.textContent =
              action === "approved" ? "Approved" : "Rejected";
          showFlashAboveModal(data.message, "success");
          statusModal.style.display = "none";
          setTimeout(() => location.reload(), 1000);
        } else {
          showFlashAboveModal(
            "Error: " + (data.message || "Failed to update status"),
            "danger"
          );
        }
      })
      .catch((err) => {
        console.error(err);
        hideLoader();
        actionableButtons.forEach((b) => (b.disabled = false));
        showFlashMessage(
          "Something went wrong while updating status",
          "danger"
        );
      });
  });
});

const approveReuploadBtn = document.getElementById("approveReuploadBtn");
if (approveReuploadBtn) {
  approveReuploadBtn.addEventListener("click", function () {
    const applicantId = this.getAttribute("data-applicant-id");
    const employerId = this.getAttribute("data-employer-id");
    const entityType = this.getAttribute("data-entity-type");

    const endpoint =
      entityType === "applicant"
        ? `/admin/approve-reupload/${applicantId}`
        : `/admin/approve-employer-reupload/${employerId}`;

    if (!endpoint)
      return showFlashMessage("Error: Could not process approval", "danger");

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          showFlashAboveModal(data.message, "success");
          setTimeout(() => location.reload(), 1000);
        } else {
          showFlashAboveModal(
            "Error: " + (data.message || "Failed to approve"),
            "danger"
          );
        }
      })
      .catch(() =>
        showFlashMessage("Something went wrong while approving", "danger")
      );
  });
}

// Rejection modal handlers
const rejectionModal = document.getElementById("rejectionModal");
const rejectionSelect = document.getElementById("rejectionReasonSelect");
const rejectionOtherWrap = document.getElementById("rejectionOtherWrap");
const rejectionOther = document.getElementById("rejectionReasonOther");
const confirmRejectionBtn = document.getElementById("confirmRejectionBtn");
const cancelRejectionBtn = document.getElementById("cancelRejectionBtn");

if (rejectionSelect) {
  rejectionSelect.addEventListener("change", function () {
    if (this.value === "Other") {
      if (rejectionOtherWrap) rejectionOtherWrap.style.display = "block";
    } else {
      if (rejectionOtherWrap) rejectionOtherWrap.style.display = "none";
    }
  });
}

if (cancelRejectionBtn && rejectionModal) {
  cancelRejectionBtn.addEventListener("click", () => {
    rejectionModal.style.display = "none";
  });
}

if (confirmRejectionBtn && rejectionModal) {
  confirmRejectionBtn.addEventListener("click", async () => {
    // Gather reason
    let reason = rejectionSelect ? rejectionSelect.value : "";
    if (reason === "Other" && rejectionOther)
      reason = rejectionOther.value.trim();

    // Prepare UI: show modal-level loader and disable buttons to prevent duplicate clicks
    if (confirmRejectionBtn) confirmRejectionBtn.disabled = true;
    if (cancelRejectionBtn) cancelRejectionBtn.disabled = true;
    showLoader("Processing — sending email...");

    // Force the loader to paint immediately (help browsers render before async work)
    const ajaxLoaderEl = document.getElementById("ajaxLoader");
    if (ajaxLoaderEl) {
      ajaxLoaderEl.style.display = "flex";
      void ajaxLoaderEl.offsetHeight; // force reflow
    } else if (!document.querySelector(".modal-loader-overlay")) {
      const quick = document.createElement("div");
      quick.className = "modal-loader-overlay";
      quick.id = "rejectionQuickLoader";
      quick.innerHTML = `
        <div class="modal-loader-content">
          <div class="spinner" aria-hidden="true"></div>
          <div class="modal-loader-text">Processing — sending email...</div>
        </div>
      `;
      document.body.appendChild(quick);
      void quick.offsetHeight;
    }

    // Proceed to call the same status update endpoint with action=rejected and reason
    const entityId =
      statusModal.dataset.employerId || statusModal.dataset.applicantId;
    const recruitmentType = statusModal.dataset.recruitmentType;
    let endpoint = null;

    if (statusModal.dataset.employerId) {
      endpoint =
        recruitmentType === "Local"
          ? `/admin/update_local_employer_status/${entityId}`
          : `/admin/update_international_employer_status/${entityId}`;
    } else if (statusModal.dataset.applicantId) {
      endpoint = `/admin/update_nonlipeno_status/${entityId}`;
    }

    if (!endpoint || !entityId) {
      hideLoader();
      if (confirmRejectionBtn) confirmRejectionBtn.disabled = false;
      if (cancelRejectionBtn) cancelRejectionBtn.disabled = false;
      return showFlashMessage("Error: Could not process request", "danger");
    }

    try {
      // allow the browser to paint the loader: wait for two animation frames
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );

      const changePending = statusModal.dataset.changePending || 0;

      let res;

      if (changePending == "1") {
        // Rejection is for RECRUITMENT TYPE CHANGE
        res = await fetch(`/admin/reject-recruitment-type-change/${entityId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
      } else {
        // Normal registration rejection
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "rejected",
            reason,
            rejection_for: "registration",
          }),
        });
      }

      const data = await res.json();
      hideLoader();
      if (confirmRejectionBtn) confirmRejectionBtn.disabled = false;
      if (cancelRejectionBtn) cancelRejectionBtn.disabled = false;

      if (data.success) {
        const statusSpan =
          document.getElementById("employer-status") ||
          document.getElementById("applicant-status");
        if (statusSpan) {
          statusSpan.textContent =
            changePending == "1" ? "Approved" : "Rejected";
        }
        showFlashAboveModal(data.message, "success");
        // hide both modals and refresh
        if (rejectionModal) rejectionModal.style.display = "none";
        if (statusModal) statusModal.style.display = "none";
        setTimeout(() => location.reload(), 1000);
      } else {
        showFlashAboveModal(
          "Error: " + (data.message || "Failed to update status"),
          "danger"
        );
      }
    } catch (err) {
      console.error(err);
      hideLoader();
      if (confirmRejectionBtn) confirmRejectionBtn.disabled = false;
      if (cancelRejectionBtn) cancelRejectionBtn.disabled = false;
      showFlashMessage("Something went wrong while updating status", "danger");
    }
  });
}

let currentFilter = "all";

function filterApplicants(filter) {
  currentFilter = filter;
  const rows = document.querySelectorAll("#applicantsTable tbody tr");
  const buttons = document.querySelectorAll(".filter-btn");

  buttons.forEach((btn) => btn.classList.remove("active"));
  event.target.classList.add("active");

  applyApplicantFilters();
}

function searchApplicants() {
  applyApplicantFilters();
}

function applyApplicantFilters() {
  const searchValue = document
    .getElementById("searchInput")
    .value.toLowerCase();
  const rows = document.querySelectorAll("#applicantsTable tbody tr");
  const table = document.getElementById("applicantsTable");
  const noResultsMessage = document.getElementById("noResultsMessage");
  const noResultsText = document.getElementById("noResultsText");

  let visibleCount = 0;

  rows.forEach((row) => {
    const type = row.getAttribute("data-type");
    const name = row.cells[0].textContent.toLowerCase();

    const matchesFilter =
      currentFilter === "all" ||
      (currentFilter === "lipeno" && type === "lipeno") ||
      (currentFilter === "non-lipeno" && type === "non-lipeno");

    const matchesSearch = searchValue === "" || name.includes(searchValue);

    if (matchesFilter && matchesSearch) {
      row.style.display = "";
      visibleCount++;
    } else {
      row.style.display = "none";
    }
  });

  // Show/hide empty state based on visible rows count
  if (visibleCount === 0) {
    table.style.display = "none";
    noResultsMessage.style.display = "block";

    if (searchValue) {
      noResultsText.textContent = `No applicants found matching "${searchValue}"`;
    } else if (currentFilter === "lipeno") {
      noResultsText.textContent = "No Lipeño applicants found";
    } else if (currentFilter === "non-lipeno") {
      noResultsText.textContent = "No Non-Lipeño applicants found";
    } else {
      noResultsText.textContent = "No applicants match your current filter";
    }
  } else {
    table.style.display = "table";
    noResultsMessage.style.display = "none";
  }
}

function filterEmployers(filter) {
  currentFilter = filter;
  const rows = document.querySelectorAll("#employersTable tbody tr");
  const buttons = document.querySelectorAll(".filter-btn");

  buttons.forEach((btn) => btn.classList.remove("active"));
  event.target.classList.add("active");

  applyEmployerFilters();
}

function searchEmployers() {
  applyEmployerFilters();
}

function applyEmployerFilters() {
  const searchValue = document
    .getElementById("searchInput")
    .value.toLowerCase();
  const rows = document.querySelectorAll("#employersTable tbody tr");
  const table = document.getElementById("employersTable");
  const noResultsMessage = document.getElementById("noResultsMessage");
  const noResultsText = document.getElementById("noResultsText");

  let visibleCount = 0;

  rows.forEach((row) => {
    const type = row.getAttribute("data-type");
    const name = row.cells[0].textContent.toLowerCase();

    const matchesFilter = currentFilter === "all" || type === currentFilter;
    const matchesSearch = searchValue === "" || name.includes(searchValue);

    if (matchesFilter && matchesSearch) {
      row.style.display = "";
      visibleCount++;
    } else {
      row.style.display = "none";
    }
  });

  if (visibleCount === 0) {
    table.style.display = "none";
    if (noResultsMessage) noResultsMessage.style.display = "block";

    if (noResultsText) {
      if (searchValue) {
        noResultsText.textContent = `No employers found matching "${searchValue}"`;
      } else if (currentFilter === "local") {
        noResultsText.textContent = "No local employers found";
      } else if (currentFilter === "international") {
        noResultsText.textContent = "No international employers found";
      } else {
        noResultsText.textContent = "No employers match your current filter";
      }
    }
  } else {
    table.style.display = "table";
    if (noResultsMessage) noResultsMessage.style.display = "none";
  }
}

document.querySelectorAll(".edit-status-btn[data-report-id]").forEach((btn) => {
  btn.addEventListener("click", function () {
    const reportId = this.dataset.reportId;

    // Step 1: Select Status
    Swal.fire({
      title: "Change Status",
      input: "select",
      inputOptions: {
        Pending: "Pending",
        Confirm: "Confirm", 
        Reject: "Reject",
      },
      inputPlaceholder: "Select status",
      showCancelButton: true,
      confirmButtonText: "OK",
      cancelButtonText: "Cancel"
    }).then((result) => {
      if (!result.value) return;

      const status = result.value;

      if (status === "Confirm") {
        // Step 2: Ask for days
        Swal.fire({
          title: "Set Report Time Frame",
          input: "number", 
          inputLabel: "How many days is the employer allowed to respond?",
          inputPlaceholder: "Enter number of days...",
          inputAttributes: { min: 1, max: 30 },
          showCancelButton: true,
          confirmButtonText: "OK", 
          cancelButtonText: "Cancel",
          validationMessage: "Please enter a number between 1 and 30"
        }).then((daysResult) => {
          if (daysResult.isDismissed) return;

          const days = daysResult.value;
          if (!days || days < 1) {
            Swal.fire("Error!", "Please enter a valid number of days.", "error");
            return;
          }

          console.log(`Confirming report ${reportId} with ${days} days`);

          // Show loading
          Swal.fire({
            title: "Processing...",
            text: "Updating status and sending notifications",
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            }
          });

          // Use the working endpoint
          const formData = new FormData();
          formData.append('report_id', reportId);
          formData.append('status', 'Confirmed');
          formData.append('days', days);

          fetch("/admin/update_report_status", {
            method: "POST",
            body: formData
          })
          .then(res => res.json())
          .then(data => {
            Swal.close();
            if (data.status === "success") {

              Swal.fire({
              icon: "success",
              title: "Success!",
              html: `Report confirmed!<br><br>
                    <strong>Emails sent to:</strong><br>
                    • Employer (${days} days to respond)<br>
                    • All applicants (applications cancelled)<br>
                    • Reporter`,
              confirmButtonText: "OK"
            }).then(() => location.reload());
            } else {
              Swal.fire("Error!", data.message || "Failed to update status", "error");
            }
          })
          .catch(err => {
            Swal.close();
            console.error("Error:", err);
            Swal.fire("Error!", "Failed to update status. Please try again.", "error");
          });
        });

      } else {
        // For Reject and Pending
        const formData = new FormData();
        formData.append('report_id', reportId);
        formData.append('status', status);

        fetch("/admin/update_report_status", {
          method: "POST",
          body: formData
        })
        .then(res => res.json())
        .then(data => {
          if (data.status === "success") {
            Swal.fire("Success!", `Report status changed to ${status}.`, "success")
              .then(() => location.reload());
          } else {
            Swal.fire("Error!", data.message || "Failed to update status", "error");
          }
        })
        .catch(err => {
          Swal.fire("Error!", "Failed to update status.", "error");
        });
      }
    });
  });
});


const jobModalElement = document.getElementById("viewJobModal");
const jobActionButtons = document.querySelectorAll(".job-action-btn");
const jobActionFeedback = document.getElementById("jobActionFeedback");
const modalJobStatus = document.getElementById("modalJobStatus");
const modalEmploymentTypeBadge = document.getElementById("modalEmploymentType");
const modalEmploymentTypeValue = document.getElementById("modalEmploymentTypeValue");
const modalWorkScheduleBadge = document.getElementById("modalWorkSchedule");
const modalWorkScheduleValue = document.getElementById("modalWorkScheduleValue");
const modalSalaryElement = document.getElementById("modalSalary");
const modalLocationElement = document.getElementById("modalLocation");
const modalEmployerElement = document.getElementById("modalEmployerName");
const modalDescriptionElement = document.getElementById("modalDescription");
const modalRequirementsList = document.getElementById("modalRequirements");
const modalJobTitleElement = document.getElementById("modalJobTitle");
const modalPostedDateElement = document.getElementById("modalPostedDate");
const modalJobStatusValue = document.getElementById("modalJobStatusValue");
const modalEmployerLink = document.getElementById("modalEmployerLink");
let activeJobContext = {
  jobId: null,
  reportId: null,
  row: null,
};
let fallbackJobModalBackdrop = null;

if (jobActionButtons.length) {
  toggleJobActionButtons(false, true);
}

document.querySelectorAll(".view-job-btn").forEach((btn) => {
  btn.addEventListener("click", function () {
    const jobId = this.dataset.jobId;
    const jobDetailsModal = document.getElementById("jobDetailsModal");
    
    jobDetailsModal.querySelector("#modal-body-unique").innerHTML =
      "<p style='text-align: center; padding: 20px;'>Loading job details...</p>";
    jobDetailsModal.dataset.modalJobId = jobId;
    jobDetailsModal.style.display = "flex";
    console.log("[v0] Modal displayed");

    // CHANGE THIS LINE: Use admin route instead of applicants route
    fetch(`/admin/job/${jobId}`, { credentials: "same-origin" })
      .then((res) => {
        console.log("[v0] Response status:", res.status);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
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
});

// Helper function to safely set element text
function setElementText(element, value, fallback = "—") {
  if (!element) {
    console.warn('[DEBUG] Attempted to set text on null element');
    return;
  }
  element.textContent = value || fallback;
}

// Enhanced salary formatting with error handling
function formatSalaryRange(min, max) {
  try {
    const formatter = new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
    });
    
    const numericMin = Number(min);
    const numericMax = Number(max);
    const hasMin = Number.isFinite(numericMin) && numericMin > 0;
    const hasMax = Number.isFinite(numericMax) && numericMax > 0;

    if (!hasMin && !hasMax) return "Not specified";
    if (hasMin && hasMax) {
      return `${formatter.format(numericMin)} - ${formatter.format(numericMax)}`;
    }
    return formatter.format(hasMin ? numericMin : numericMax);
  } catch (error) {
    console.error('[DEBUG] Error formatting salary:', error);
    return "Salary not specified";
  }
}

jobActionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.jobAction;
    if (!action) return;
    handleJobAction(action);
  });
});

function toggleJobActionButtons(enable, suppressMessage = false) {
  jobActionButtons.forEach((btn) => {
    btn.disabled = !enable;
  });
  if (!enable && jobActionFeedback && !suppressMessage) {
    jobActionFeedback.textContent = "Open a reported job to enable moderation actions.";
    jobActionFeedback.classList.remove("text-success", "text-danger");
    jobActionFeedback.classList.add("text-muted");
  }

  if (enable && !suppressMessage) {
    resetJobActionFeedback();
  }
}

function resetJobActionFeedback() {
  if (!jobActionFeedback) return;
  jobActionFeedback.textContent = "";
  jobActionFeedback.classList.remove("text-success", "text-danger", "text-muted");
}

function setElementText(element, value, fallback = "—") {
  if (!element) return;
  element.textContent = value || fallback;
}

function applyStatusBadgeClass(statusText) {
  if (!modalJobStatus) return;
  const normalized = (statusText || "Pending").toLowerCase();
  modalJobStatus.textContent = statusText || "Pending";
  modalJobStatus.className = "badge job-status-chip";

  if (normalized.includes("suspend")) {
    modalJobStatus.classList.add("status-suspended");
  } else if (normalized.includes("reject")) {
    modalJobStatus.classList.add("status-rejected");
  } else if (normalized.includes("active") || normalized.includes("approve")) {
    modalJobStatus.classList.add("status-active");
  } else {
    modalJobStatus.classList.add("status-pending");
  }
}

function setJobActionBusy(isBusy) {
  jobActionButtons.forEach((btn) => {
    btn.dataset.originalHtml = btn.dataset.originalHtml || btn.innerHTML;
    if (isBusy) {
      btn.dataset.prevDisabled = btn.disabled ? "1" : "0";
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Processing...';
    } else {
      btn.disabled = btn.dataset.prevDisabled === "1";
      btn.innerHTML = btn.dataset.originalHtml;
      delete btn.dataset.prevDisabled;
    }
  });
}

function showJobActionFeedback(message, type = "success") {
  if (!jobActionFeedback) return;
  jobActionFeedback.textContent = message;
  jobActionFeedback.classList.remove("text-success", "text-danger", "text-muted");
  jobActionFeedback.classList.add(type === "success" ? "text-success" : "text-danger");
}

function updateReportRowBadge(status) {
  if (!activeJobContext.row) return;
  const badge = activeJobContext.row.querySelector(".badge");
  if (!badge) return;
  const classMap = {
    Approved: "bg-success",
    Rejected: "bg-danger",
    Banned: "bg-dark",
    Confirmed: "bg-success",
    Suspended: "bg-secondary",
    Archived: "bg-dark",
    Pending: "bg-warning text-dark",
    Reviewed: "bg-primary",
    Resolved: "bg-secondary",
  };
  badge.className = `badge ${classMap[status] || "bg-warning text-dark"}`;
  badge.textContent = status;
}

function hasBootstrapModalSupport() {
  return typeof bootstrap !== "undefined" && bootstrap.Modal;
}

function showJobModal() {
  if (!jobModalElement) return;
  if (hasBootstrapModalSupport()) {
    const instance = bootstrap.Modal.getOrCreateInstance(jobModalElement);
    instance.show();
    return;
  }

  jobModalElement.classList.add("show");
  jobModalElement.style.display = "block";
  jobModalElement.removeAttribute("aria-hidden");
  jobModalElement.setAttribute("aria-modal", "true");
  document.body.classList.add("modal-open");

  fallbackJobModalBackdrop = document.createElement("div");
  fallbackJobModalBackdrop.className = "modal-backdrop fade show";
  document.body.appendChild(fallbackJobModalBackdrop);
}

function hideJobModal() {
  if (!jobModalElement) return;
  if (hasBootstrapModalSupport()) {
    const instance = bootstrap.Modal.getOrCreateInstance(jobModalElement);
    instance.hide();
    return;
  }

  jobModalElement.classList.remove("show");
  jobModalElement.style.display = "none";
  jobModalElement.setAttribute("aria-hidden", "true");
  jobModalElement.removeAttribute("aria-modal");
  document.body.classList.remove("modal-open");

  if (fallbackJobModalBackdrop) {
    document.body.removeChild(fallbackJobModalBackdrop);
    fallbackJobModalBackdrop = null;
  }
}

if (jobModalElement) {
  jobModalElement.addEventListener("click", (event) => {
    if (event.target === jobModalElement && !hasBootstrapModalSupport()) {
      hideJobModal();
    }
  });

  jobModalElement
    .querySelectorAll('[data-bs-dismiss="modal"]')
    .forEach((btn) =>
      btn.addEventListener("click", () => {
        if (!hasBootstrapModalSupport()) hideJobModal();
      })
    );
}

async function handleJobAction(action) {
  if (!activeJobContext.reportId) {
    return showFlashMessage("No report selected for moderation.", "warning");
  }

  let payload = { action };

  if (typeof Swal !== "undefined") {
    if (action === "confirm") {
      const { isConfirmed } = await Swal.fire({
        title: "Confirm report?",
        text: "The job post will be suspended and all applications withdrawn.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, suspend job",
      });
      if (!isConfirmed) return;
    }
    if (action === "reject") {
      const { value: note } = await Swal.fire({
        title: "Reject report",
        input: "textarea",
        inputPlaceholder: "Optional note for the reporter",
        showCancelButton: true,
        confirmButtonText: "Reject report",
      });
      if (note === undefined) return;
      if (note) {
        payload.moderator_note = note;
      }
    }
  }

  setJobActionBusy(true);
  try {
    const res = await fetch(`/admin/job_reports/${activeJobContext.reportId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to update job status.");
    }

    if (modalJobStatus) modalJobStatus.innerText = formatStatusLabel(data.job_status) || "Updated";
    updateReportRowBadge(data.report_status || "Reviewed");
    showJobActionFeedback(data.message || "Status updated.", "success");
  } catch (err) {
    console.error("[v0] Failed to process job action", err);
    showJobActionFeedback(err.message || "Failed to update job.", "danger");
  } finally {
    setJobActionBusy(false);
  }
}

const applicantActionButtons = document.querySelectorAll(".applicant-action-btn");
if (applicantActionButtons.length) {
  applicantActionButtons.forEach((button) => {
    button.addEventListener("click", () => handleApplicantReportAction(button));
  });
}

async function handleApplicantReportAction(button) {
  const reportId = button.dataset.reportId;
  const action = button.dataset.action;
  if (!reportId || !action) return;

  button.disabled = true;
  let payload = { action };

  try {
    if (typeof Swal !== "undefined") {
      if (action === "confirm") {
        const { value: formValues } = await Swal.fire({
          title: "Confirm report",
          html:
            '<input id="swalSuspensionDays" class="swal2-input" type="number" min="0" placeholder="Suspension in days (0 = indefinite)">' +
            '<textarea id="swalModeratorNote" class="swal2-textarea" placeholder="Moderator note (optional)"></textarea>',
          focusConfirm: false,
          showCancelButton: true,
          confirmButtonText: "Confirm",
          preConfirm: () => {
            const days = document.getElementById("swalSuspensionDays").value;
            const note = document.getElementById("swalModeratorNote").value;
            return { days, note };
          },
        });
        if (!formValues) {
          button.disabled = false;
          return;
        }
        payload.suspension_days = Number(formValues.days) || 0;
        payload.moderator_note = formValues.note || "";
      }

      if (action === "reject") {
        const { value: note } = await Swal.fire({
          title: "Reject report",
          input: "textarea",
          inputPlaceholder: "Optional note back to the reporter",
          showCancelButton: true,
          confirmButtonText: "Reject report",
        });
        if (note === undefined) {
          button.disabled = false;
          return;
        }
        if (note) {
          payload.moderator_note = note;
        }
      }
    }

    const res = await fetch(`/admin/applicant_reports/${reportId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to update applicant report.");
    }

    updateApplicantReportRow(reportId, data.report_status || formatStatusLabel(action));
    showFlashMessage(data.message || "Applicant status updated.", "success");
  } catch (err) {
    console.error("[v0] Failed to process applicant report action", err);
    showFlashMessage(err.message || "Failed to update applicant.", "danger");
  } finally {
    button.disabled = false;
  }
}

function updateApplicantReportRow(reportId, status) {
  const row = document.querySelector(`tr[data-applicant-report-id="${reportId}"]`);
  if (!row) return;
  const badge = row.querySelector(".badge");
  if (!badge) return;
  const classMap = {
    Confirmed: "bg-success",
    Rejected: "bg-danger",
    Suspended: "bg-secondary",
    Pending: "bg-warning text-dark",
  };
  badge.className = `badge ${classMap[status] || "bg-warning text-dark"}`;
  badge.textContent = status;
}

function formatSalaryRange(min, max) {
  const formatter = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
  });
  const numericMin = Number(min);
  const numericMax = Number(max);
  const hasMin = Number.isFinite(numericMin) && numericMin > 0;
  const hasMax = Number.isFinite(numericMax) && numericMax > 0;

  if (!hasMin && !hasMax) return "Not specified";
  if (hasMin && hasMax)
    return `${formatter.format(numericMin)} - ${formatter.format(numericMax)}`;
  return formatter.format(hasMin ? numericMin : numericMax);
}

function formatStatusLabel(value) {
  if (!value) return "Pending";
  return value
    .toString()
    .split(/[\s_-]+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
