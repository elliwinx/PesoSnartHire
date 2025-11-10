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
  document
    .querySelectorAll(".edit-status-btn, #editStatusBtn")
    .forEach((btn) => {
      if (btn.dataset.listenerAttached) return;
      btn.dataset.listenerAttached = "1";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("[admin.js] edit-status clicked (fallback)");

        const modal = document.getElementById("statusModal");
        if (!modal) return console.warn("statusModal not found");

        // Clear previous dataset
        delete modal.dataset.employerId;
        delete modal.dataset.applicantId;
        delete modal.dataset.recruitmentType;

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

        if (employerId) modal.dataset.employerId = employerId;
        if (applicantId) modal.dataset.applicantId = applicantId;
        if (recruitmentType) modal.dataset.recruitmentType = recruitmentType;

        modal.style.display = "flex";
      });
    });
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

// ========== STATUS MODAL LOGIC ==========
// Modal action buttons inside the status modal use class "status-btn" in templates
const statusModal = document.getElementById("statusModal");
// Only select status buttons that carry a data-action attribute inside the status modal
// This avoids binding action handlers to cancel/other modal controls that share the same class
const statusButtons = statusModal
  ? Array.from(statusModal.querySelectorAll(".status-btn[data-action]"))
  : Array.from(document.querySelectorAll(".status-btn[data-action]"));
const documentSelectionModal = document.getElementById(
  "documentSelectionModal"
);
const confirmDocumentBtn = document.getElementById("confirmDocumentBtn");
const documentSelect = null; // deprecated - using checkbox list instead
const documentCheckboxList = document.getElementById("documentCheckboxList");
let selectedDocument = null; // legacy single-selection
let selectedDocuments = []; // hold array from checkboxes

// Open status modal when clicking any edit-status button (employer or applicant)
document.querySelectorAll(".edit-status-btn, #editStatusBtn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault();

    // Clear previous dataset
    delete statusModal.dataset.employerId;
    delete statusModal.dataset.applicantId;
    delete statusModal.dataset.recruitmentType;

    // Prefer explicit data attributes on the button, otherwise search closest container
    const employerId =
      btn.getAttribute("data-employer-id") ||
      (btn.closest("[data-employer-id]") || {}).dataset?.employerId;
    const applicantId =
      btn.getAttribute("data-applicant-id") ||
      (btn.closest("[data-applicant-id]") || {}).dataset?.applicantId;
    const recruitmentType =
      btn.getAttribute("data-recruitment-type") ||
      (btn.closest("[data-recruitment-type]") || {}).dataset?.recruitmentType;

    if (employerId) statusModal.dataset.employerId = employerId;
    if (applicantId) statusModal.dataset.applicantId = applicantId;
    if (recruitmentType) statusModal.dataset.recruitmentType = recruitmentType;

    // Show modal
    statusModal.style.display = "flex";
  });
});

// When confirm is clicked, read the selected value from the select element
if (confirmDocumentBtn) {
  confirmDocumentBtn.addEventListener("click", () => {
    if (!documentCheckboxList)
      return showFlashMessage("Document selector not available", "danger");

    // Collect all checked inputs inside the checkbox list
    const checked = Array.from(
      documentCheckboxList.querySelectorAll("input[type=checkbox]:checked")
    ).map((cb) => cb.value);

    if (!checked || checked.length === 0)
      return showFlashMessage("Please select at least one document", "warning");

    selectedDocuments = checked;
    selectedDocument = checked.length === 1 ? checked[0] : null;
    statusModal.dataset.selectedDocument = selectedDocument;
    documentSelectionModal.style.display = "none";
    proceedWithReupload();
  });
}

const cancelDocumentBtn = document.getElementById("cancelDocumentBtn");
if (cancelDocumentBtn) {
  cancelDocumentBtn.addEventListener("click", () => {
    if (documentSelectionModal) documentSelectionModal.style.display = "none";
  });
}

// Close modal button
const closeModalBtn = document.getElementById("closeModal");
if (closeModalBtn && statusModal) {
  closeModalBtn.addEventListener("click", () => {
    statusModal.style.display = "none";
  });
}

// Ensure documentSelectionModal is defined before usage
if (typeof documentSelectionModal === "undefined" || !documentSelectionModal) {
  // Create a no-op object so later code can call .style without throwing
  window.documentSelectionModal = { style: { display: "none" } };
}

function proceedWithReupload() {
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

  const payload = {
    action: "reupload",
    document_name:
      selectedDocuments && selectedDocuments.length
        ? selectedDocuments
        : selectedDocument,
  };

  console.debug("[admin.js] reupload payload:", payload);

  // Show loader
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
        showFlashAboveModal(
          data.message || "Request sent successfully",
          "success"
        );
        statusModal.style.display = "none";
        setTimeout(() => location.reload(), 900);
      } else {
        showFlashAboveModal(
          "Error: " + (data.message || "Failed to request reupload"),
          "danger"
        );
      }
    })
    .catch((err) => {
      console.error(err);
      hideLoader();
      showInlineFlash(
        "Something went wrong while requesting reupload",
        "danger"
      );
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
document.querySelectorAll(".edit-status-btn, #editStatusBtn").forEach((btn) => {
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

statusButtons.forEach((button) => {
  button.addEventListener("click", function () {
    const action = this.getAttribute("data-action");

    if (action === "reupload") {
      // For applicants, auto-request the endorsement letter (no selection modal)
      if (statusModal.dataset.applicantId) {
        selectedDocument = "Endorsement Letter";
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
      void quick.offsetHeight; // force reflow
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

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rejected", reason }),
      });
      const data = await res.json();
      hideLoader();
      if (confirmRejectionBtn) confirmRejectionBtn.disabled = false;
      if (cancelRejectionBtn) cancelRejectionBtn.disabled = false;

      if (data.success) {
        const statusSpan =
          document.getElementById("employer-status") ||
          document.getElementById("applicant-status");
        if (statusSpan) statusSpan.textContent = "Rejected";
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
  currentFilter = filter; // Store the current filter
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
  currentFilter = filter; // Store the current filter
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
