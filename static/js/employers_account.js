// ============================================
// EMPLOYER ACCOUNT & SECURITY PAGE
// Mirrors applicant flow: Tab switching, Edit/Save/Cancel, Company logo hover upload
// ============================================

// Import Swal from SweetAlert2
const Swal = window.Swal;

// ========== DROPDOWN MENU ==========

document.addEventListener("DOMContentLoaded", () => {
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

// 1️⃣ TAB SWITCHING LOGIC
document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".content");
  const employerStatus = document
    .querySelector(".form-card")
    ?.getAttribute("data-employer-status");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      contents.forEach((c) => (c.style.display = "none"));
      const targetId = btn.getAttribute("data-target");
      document.getElementById(targetId).style.display = "block";

      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Default tab depending on employer status
  if (employerStatus === "Reupload") {
    document.getElementById("company-information").style.display = "none";
    document.getElementById("documents").style.display = "block";
  } else {
    document.getElementById("company-information").style.display = "block";
    document.getElementById("documents").style.display = "none";
  }
});

// 2️⃣ EDIT / SAVE / CANCEL LOGIC
document.addEventListener("DOMContentLoaded", () => {
  const editBtn = document.getElementById("editBtn");
  const saveBtn = document.getElementById("saveBtn");
  const cancelBtn = document.getElementById("cancelBtn");
  const accountForm = document.getElementById("accountForm");

  const inputs = document.querySelectorAll(".chip");
  const selects = document.querySelectorAll("select");
  const fileInputs = document.querySelectorAll("#documents .file-input");
  const profileTop = document.querySelector(".profile-top");
  const avatar = document.querySelector(".profile-top .avatar");

  // store original values before editing
  let originalValues = {};

  // --- EDIT BUTTON ---
  if (editBtn) {
    editBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // Store initial values before enabling edit
      originalValues = {};
      inputs.forEach((el) => (originalValues[el.name] = el.value));
      selects.forEach((el) => (originalValues[el.name] = el.value));

      const recruitmentSelect = document.getElementById("recruitment_type");
      if (recruitmentSelect) {
        originalValues["recruitment_type"] = recruitmentSelect.value;
      }

      // Store original company logo
      const logoImg = document.getElementById("companyLogoPreview");
      if (logoImg) originalValues["logoSrc"] = logoImg.src;

      profileTop.classList.add("edit-mode");
      avatar.classList.add("editable");

      // 1. Unlock Text Inputs & Selects
      inputs.forEach((el) => el.removeAttribute("readonly"));
      selects.forEach((el) => {
        el.removeAttribute("disabled");
        el.classList.remove("select-readonly");
      });

      // 2. FILE INPUT LOGIC (UPDATED FOR SECURITY)
      // First, ensure ALL file inputs are hidden/disabled by default
      fileInputs.forEach((el) => {
        el.style.display = "none";
        el.setAttribute("disabled", "true");
      });

      // Second, Unlock ONLY expiring files
      // (This works with the HTML update: data-expiring="true")
      document.querySelectorAll(".document-item").forEach((item) => {
        const isExpiring = item.getAttribute("data-expiring") === "true";
        const input = item.querySelector(".file-input");

        if (input && isExpiring) {
          input.style.display = "block";
          input.removeAttribute("disabled");
        }
      });

      // Show Save/Cancel, Hide Edit
      editBtn.style.display = "none";
      saveBtn.style.display = "inline-block";
      cancelBtn.style.display = "inline-block";
    });
  }

  // --- CANCEL BUTTON ---
  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // restore original values
      inputs.forEach((el) => {
        if (originalValues.hasOwnProperty(el.name)) {
          el.value = originalValues[el.name];
        }
      });
      selects.forEach((el) => {
        if (originalValues.hasOwnProperty(el.name)) {
          el.value = originalValues[el.name];
        }
      });

      // Restore original company logo
      const logoImg = document.getElementById("companyLogoPreview");
      if (logoImg && originalValues["logoSrc"]) {
        logoImg.src = originalValues["logoSrc"];
      }

      // Disable again
      profileTop.classList.remove("edit-mode");
      avatar.classList.remove("editable");

      fileInputs.forEach((el) => {
        el.style.display = "none";
        el.setAttribute("disabled", true);
        el.value = ""; // clear file input
      });
      inputs.forEach((el) => el.setAttribute("readonly", true));
      selects.forEach((el) => {
        el.setAttribute("disabled", true);
        el.classList.add("select-readonly");
      });

      editBtn.style.display = "inline-block";
      saveBtn.style.display = "none";
      cancelBtn.style.display = "none";

      // Trigger change handler for recruitment_type to reset UI
      const recruitmentSelect = document.getElementById("recruitment_type");
      if (recruitmentSelect) {
        recruitmentSelect.dispatchEvent(new Event("change"));
      }
    });
  }

  // --- SAVE BUTTON ---
  if (saveBtn && accountForm) {
    saveBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const recruitmentSelect = document.getElementById("recruitment_type");
      if (recruitmentSelect) {
        const currentType = recruitmentSelect.value;
        const oldType = originalValues["recruitment_type"];

        // If recruitment type changed, add hidden inputs to signal backend
        if (oldType && currentType && oldType !== currentType) {
          // Remove any existing hidden inputs first
          const existingInputs = accountForm.querySelectorAll(
            'input[name="recruitment_type_changed"], input[name="old_recruitment_type"], input[name="new_recruitment_type"]'
          );
          existingInputs.forEach((input) => input.remove());

          // Add hidden inputs
          const changedInput = document.createElement("input");
          changedInput.type = "hidden";
          changedInput.name = "recruitment_type_changed";
          changedInput.value = "true";
          accountForm.appendChild(changedInput);

          const oldTypeInput = document.createElement("input");
          oldTypeInput.type = "hidden";
          oldTypeInput.name = "old_recruitment_type";
          oldTypeInput.value = oldType;
          accountForm.appendChild(oldTypeInput);

          const newTypeInput = document.createElement("input");
          newTypeInput.type = "hidden";
          newTypeInput.name = "new_recruitment_type";
          newTypeInput.value = currentType;
          accountForm.appendChild(newTypeInput);
        }
      }

      accountForm.submit();
    });
  }

  // --- RECRUITMENT TYPE CHANGE HANDLER (NEW) ---
  // If user changes recruitment type while editing, we MUST unlock all files
  const recruitmentSelect = document.getElementById("recruitment_type");
  if (recruitmentSelect) {
    recruitmentSelect.addEventListener("change", () => {
      // Only run this logic if we are in Edit Mode (Save button is visible)
      if (saveBtn.style.display === "none") return;

      const currentType = recruitmentSelect.value;
      const oldType = originalValues["recruitment_type"];
      const allFileInputs = document.querySelectorAll("#documents .file-input");

      if (currentType !== oldType) {
        // CASE: Type Changed -> Unlock ALL file inputs (user needs to upload new docs)
        allFileInputs.forEach((input) => {
          input.style.display = "block";
          input.removeAttribute("disabled");
        });
      } else {
        // CASE: Switched BACK to Original -> Lock all except expiring
        allFileInputs.forEach((input) => {
          const parent = input.closest(".document-item");
          const isExpiring =
            parent && parent.getAttribute("data-expiring") === "true";

          if (isExpiring) {
            input.style.display = "block";
            input.removeAttribute("disabled");
          } else {
            input.style.display = "none";
            input.setAttribute("disabled", "true");
            input.value = ""; // Clear any file they might have selected
          }
        });
      }
    });
  }
});

// === PHONE INPUT HANDLER (+63 lock + 10-digit limit) ===
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
    if (phoneInput.value.trim() === "" || phoneInput.value === "+63") {
      phoneInput.value = "+63";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const provinceSelect = document.getElementById("province");
  const citySelect = document.getElementById("city");
  const barangaySelect = document.getElementById("barangay");
  const BASE_URL = "https://psgc.gitlab.io/api";
  const METRO_MANILA_CODE = "130000000";

  let isEditMode = false;

  async function fetchJson(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      return await response.json();
    } catch (error) {
      console.error("API Error:", error);
      return [];
    }
  }

  function populateSelect(element, items, defaultText, selectedValue = null) {
    if (!element) return null;
    element.innerHTML = `<option value="">${defaultText}</option>`;

    let selectedCode = null;
    items.sort((a, b) => a.name.localeCompare(b.name));

    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.name;
      option.textContent = item.name;
      option.dataset.code = item.code;

      if (selectedValue && item.name === selectedValue) {
        option.selected = true;
        selectedCode = item.code;
      }
      element.appendChild(option);
    });
    return selectedCode;
  }

  // Updated loadCities to handle Metro Manila
  async function loadCities(code, selectedCity = null) {
    if (!citySelect) return null;
    citySelect.innerHTML = "<option>Loading...</option>";

    let url;
    if (code === METRO_MANILA_CODE) {
      url = `${BASE_URL}/regions/${METRO_MANILA_CODE}/cities-municipalities/`;
    } else {
      url = `${BASE_URL}/provinces/${code}/cities-municipalities/`;
    }

    const data = await fetchJson(url);
    const selectedCode = populateSelect(
      citySelect,
      data,
      "Select Municipality/City",
      selectedCity
    );

    citySelect.disabled = !isEditMode;
    return selectedCode;
  }

  async function loadBarangays(cityCode, selectedBarangay = null) {
    if (!barangaySelect) return;
    barangaySelect.innerHTML = "<option>Loading...</option>";

    const data = await fetchJson(
      `${BASE_URL}/cities-municipalities/${cityCode}/barangays/`
    );
    populateSelect(barangaySelect, data, "Select Barangay", selectedBarangay);

    barangaySelect.disabled = !isEditMode;
  }

  async function initializeAddressData(provVal, cityVal, barVal) {
    if (!provinceSelect) return;

    // 1. Load Provinces
    const provData = await fetchJson(`${BASE_URL}/provinces/`);

    // MANUAL FIX: Add Metro Manila
    provData.push({
      code: METRO_MANILA_CODE,
      name: "Metro Manila",
    });

    const provCode = populateSelect(
      provinceSelect,
      provData,
      "Select Province",
      provVal
    );

    // 2. If we found a matching province code (saved value), load cities
    if (provCode) {
      const cityCode = await loadCities(provCode, cityVal);
      // 3. If we found a matching city code, load barangays
      if (cityCode) {
        await loadBarangays(cityCode, barVal);
      }
    }
  }

  // --- EVENT LISTENERS ---

  if (provinceSelect) {
    // Initialize on load with saved values
    const defProv = provinceSelect.dataset.default;
    const defCity = citySelect.dataset.default;
    const defBar = barangaySelect.dataset.default;
    initializeAddressData(defProv, defCity, defBar);

    provinceSelect.addEventListener("change", async function () {
      const selectedOption = this.options[this.selectedIndex];
      const code = selectedOption.dataset.code;

      // Reset children
      citySelect.innerHTML = '<option value="">Select Province First</option>';
      barangaySelect.innerHTML = '<option value="">Select City First</option>';
      citySelect.disabled = true;
      barangaySelect.disabled = true;

      if (code) {
        citySelect.disabled = false;
        await loadCities(code);
      }
    });
  }

  if (citySelect) {
    citySelect.addEventListener("change", async function () {
      const selectedOption = this.options[this.selectedIndex];
      const code = selectedOption.dataset.code;

      barangaySelect.innerHTML = '<option value="">Select City First</option>';
      barangaySelect.disabled = true;

      if (code) {
        barangaySelect.disabled = false;
        await loadBarangays(code);
      }
    });
  }

  // Hook into Edit/Cancel
  const editBtn = document.getElementById("editBtn");
  const cancelBtn = document.getElementById("cancelBtn");

  if (editBtn) {
    editBtn.addEventListener("click", () => {
      isEditMode = true;
      if (provinceSelect) provinceSelect.disabled = false;
      if (citySelect && provinceSelect.value) citySelect.disabled = false;
      if (barangaySelect && citySelect.value) barangaySelect.disabled = false;
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      isEditMode = false;

      if (provinceSelect) {
        const defProv = provinceSelect.dataset.default;
        const defCity = citySelect.dataset.default;
        const defBar = barangaySelect.dataset.default;

        provinceSelect.disabled = true;
        citySelect.disabled = true;
        barangaySelect.disabled = true;

        // Reset to original data
        initializeAddressData(defProv, defCity, defBar);
      }
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const recruitmentSelect = document.getElementById("recruitment_type");
  const doleFields = document.querySelectorAll(".dole-docs");
  const dmwFields = document.querySelectorAll(".dmw-docs");
  const employerStatus = document
    .querySelector(".form-card")
    ?.getAttribute("data-employer-status");

  function updateDocumentVisibility() {
    const type = recruitmentSelect.value;

    if (employerStatus === "Reupload") {
      doleFields.forEach((el) => (el.style.display = "block"));
      dmwFields.forEach((el) => (el.style.display = "block"));
      return;
    }

    if (type === "Local") {
      doleFields.forEach((el) => (el.style.display = "block"));
      dmwFields.forEach((el) => (el.style.display = "none"));
    } else if (type === "International") {
      doleFields.forEach((el) => (el.style.display = "none"));
      dmwFields.forEach((el) => (el.style.display = "block"));
    } else {
      doleFields.forEach((el) => (el.style.display = "none"));
      dmwFields.forEach((el) => (el.style.display = "none"));
    }
  }

  if (recruitmentSelect) {
    recruitmentSelect.addEventListener("change", updateDocumentVisibility);
    updateDocumentVisibility(); // run once on page load
  }
});

// ============================================
// AUTO SHOW FILE INPUTS FOR REUPLOAD STATE
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  const employerStatus = document
    .querySelector(".form-card")
    ?.getAttribute("data-employer-status");

  if (employerStatus === "Reupload") {
    const fileInputs = document.querySelectorAll("#documents .file-input");

    // 🔹 Show all file inputs immediately
    fileInputs.forEach((el) => {
      el.style.display = "block";
      el.removeAttribute("disabled");
    });

    // 🔹 Make sure the correct tab is active
    document.getElementById("company-information").style.display = "none";
    document.getElementById("documents").style.display = "block";

    // 🔹 Lock other input fields (so only files are editable)
    const textInputs = document.querySelectorAll(".chip, select");
    textInputs.forEach((el) => {
      el.setAttribute("readonly", true);
      el.setAttribute("disabled", true);
      el.classList.add("select-readonly");
    });
  }
});

// ============================================
// COMPANY LOGO HOVER UPLOAD (like applicant avatar)
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  const avatar = document.querySelector(".avatar");
  if (!avatar) return;

  const input = avatar.querySelector("input[type='file']");
  const img = document.getElementById("companyLogoPreview");
  if (!input || !img) return;

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  img.addEventListener("click", () => {
    const employerStatus = document
      .querySelector(".form-card")
      ?.getAttribute("data-employer-status");

    // Only allow upload in Edit mode or Reupload state
    if (
      avatar.classList.contains("editable") ||
      employerStatus === "Reupload"
    ) {
      input.click();
    }
  });

  img.addEventListener("mouseenter", () => {
    if (avatar.classList.contains("editable")) {
      img.style.opacity = "0.7";
      img.style.cursor = "pointer";
    }
  });

  img.addEventListener("mouseleave", () => {
    img.style.opacity = "1";
  });
});
const deactivateBtn = document.getElementById("deactivateAccountBtn");

if (deactivateBtn) {
  deactivateBtn.addEventListener("click", async (e) => {
    e.preventDefault(); // ✅ Prevent default action

    try {
      // ✅ SAFETY CHECK - Wait for SweetAlert to be available
      let retries = 0;
      const maxRetries = 10;

      while (typeof window.Swal === "undefined" && retries < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        retries++;
      }

      // ✅ FINAL CHECK - If still not available, use fallback
      if (typeof window.Swal === "undefined") {
        console.warn("SweetAlert2 not loaded after retries, using fallback");
        if (
          confirm(
            "Are you sure? Your account will be permanently deleted after 30 days."
          )
        ) {
          await deactivateAccount();
        }
        return;
      }

      // ✅ Now safely use SweetAlert
      const confirmDelete = await window.Swal.fire({
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

      await deactivateAccount();
    } catch (error) {
      console.error("Deactivation process error:", error);
    }
  });
}

// ✅ Separate function for the deactivation logic
async function deactivateAccount() {
  showLoader("Deactivating account — please wait…");

  try {
    const res = await fetch("/employers/deactivate", { method: "POST" });
    const data = await res.json();

    if (data.success) {
      setTimeout(() => {
        hideLoader();
        window.location.href = "/";
      }, 1500);
    } else {
      hideLoader();
      // Use fallback if SweetAlert fails
      if (typeof window.Swal !== "undefined") {
        window.Swal.fire("Error", data.message, "error");
      } else {
        alert("Error: " + data.message);
      }
    }
  } catch (err) {
    hideLoader();
    // Use fallback if SweetAlert fails
    if (typeof window.Swal !== "undefined") {
      window.Swal.fire(
        "Error",
        "Something went wrong. Please try again later.",
        "error"
      );
    } else {
      alert("Something went wrong. Please try again later.");
    }
  }
}

// Loader control functions
function showLoader(text = "Processing — please wait...") {
  const loader = document.getElementById("ajaxLoader");
  const loaderText = document.getElementById("ajaxLoaderText");
  if (loaderText) loaderText.textContent = text;
  loader.style.display = "flex";
}

function hideLoader() {
  const loader = document.getElementById("ajaxLoader");
  loader.style.display = "none";
}
