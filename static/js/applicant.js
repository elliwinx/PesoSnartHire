// ========== UTILITY FUNCTIONS ==========
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function showFlash(message, category = "info") {
  const flashContainer = document.createElement("div");
  flashContainer.className = `flash ${category}`;
  flashContainer.innerHTML = `
    ${message}
    <button class="close" onclick="this.parentElement.remove()">×</button>
  `;
  document.body.insertBefore(flashContainer, document.body.firstChild);

  setTimeout(() => {
    if (flashContainer.parentElement) {
      flashContainer.remove();
    }
  }, 5000);
}

function hideFlash() {
  const flashContainer = document.querySelector(".flash");
  if (flashContainer) {
    flashContainer.remove();
  }
}

function showLoader(text = "Processing — please wait...") {
  const loader = document.getElementById("ajaxLoader");
  const loaderText = document.getElementById("ajaxLoaderText");
  if (loaderText) loaderText.textContent = text;
  if (loader) loader.style.display = "flex";
}

function hideLoader() {
  const loader = document.getElementById("ajaxLoader");
  if (loader) loader.style.display = "none";
}

// ========== GLOBAL APPLICANT STATUS ==========
const applicantStatus = document.getElementById("applicantStatus")?.value;

// ========== MAIN DOM READY ==========
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

  function showTab(id) {
    contents.forEach((c) => {
      c.classList.add("hidden");
      c.style.display = "none";
    });
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove("hidden");
      el.style.display = "block";
    }
    buttons.forEach((b) => b.classList.remove("active"));
    const btn = Array.from(buttons).find(
      (b) => b.getAttribute("data-target") === id
    );
    if (btn) btn.classList.add("active");
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      showTab(btn.getAttribute("data-target"));
    });
  });

  if (applicantStatus === "Reupload") {
    showTab("documents");
  } else {
    showTab("personal-information");
  }

  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  const focus = params.get("focus");
  if (tab === "documents") {
    showTab("documents");
    if (focus === "reco") {
      const reco = document.getElementById("recommendation_file");
      if (reco) {
        reco.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => reco.focus(), 200);
      }
    }
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

  const residencyYes = document.getElementById("residency_yes");
  const residencyNo = document.getElementById("residency_no");
  const cityInput = document.querySelector('input[name="city"]');
  const barangayInput = document.querySelector('input[name="barangay"]');
  const provinceInput = document.querySelector('input[name="province"]');
  const provinceSelect = document.getElementById("applicantProvince");
  const citySelect = document.getElementById("applicantCity");
  const cityTextInput = document.getElementById("applicantCityText");
  const barangaySelect = document.getElementById("applicantBarangay");
  const barangayTextInput = document.getElementById("applicantBarangayText");

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
      isEditMode = true;
      isCanceling = false;

      // ... (Keep your existing 'originalValues' capture logic) ...
      originalValues = {};
      inputs.forEach((el) => (originalValues[el.name] = el.value));
      selects.forEach((el) => (originalValues[el.name] = el.value));
      radios.forEach((el) => {
        if (el.id) originalValues[el.id] = el.checked;
      });
      const avatarImg = document.getElementById("profilePicPreview");
      if (avatarImg) originalValues["avatarSrc"] = avatarImg.src;
      // ...

      // Store original state variables
      originalIsLipeno = residencyYes.checked;
      originalCity = cityInput ? cityInput.value : "";
      originalProvince = provinceInput ? provinceInput.value : "";
      originalBarangay = barangayInput ? barangayInput.value : "";

      // UI Updates
      profileTop?.classList.add("edit-mode");
      avatar?.classList.add("editable");

      // 1. Unlock Text Inputs & Radios
      inputs.forEach((el) => el.removeAttribute("readonly"));
      selects.forEach((el) => {
        el.removeAttribute("disabled");
        el.classList.remove("select-readonly");
      });
      radios.forEach((el) => el.removeAttribute("disabled"));
      setConditionalInputsEditable(true);

      // 2. LOCK ALL FILES BY DEFAULT
      fileInputs.forEach((el) => {
        el.style.display = "none";
        el.setAttribute("disabled", "true");
      });

      // 3. EXPLICITLY UNLOCK RESUME (Always allowed)
      const resumeInp = document.getElementById("resume_file");
      if (resumeInp) {
        resumeInp.style.display = "block";
        resumeInp.removeAttribute("disabled");
      }

      // 4. UNLOCK AVATAR UPLOAD
      const avatarInp = document.querySelector(".avatar input[type='file']");
      if (avatarInp) {
        avatarInp.removeAttribute("disabled");
      }

      // 5. CALL FUNCTION TO CHECK RECOMMENDATION EXPIRY
      // This will unlock recommendation_file ONLY if isExpiring=true
      // updateResidencyRequirements();

      if (typeof handleResidencyChange === "function") {
        handleResidencyChange();
      }

      editBtn.style.display = "none";
      saveBtn.style.display = "inline-block";
      cancelBtn.style.display = "inline-block";

      updateConditionals();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();

      if (typeof window.setResidencyCancelMode === "function") {
        window.setResidencyCancelMode(true);
      }

      inputs.forEach((el) => {
        if (originalValues.hasOwnProperty(el.name))
          el.value = originalValues[el.name];
      });
      selects.forEach((el) => {
        if (originalValues.hasOwnProperty(el.name))
          el.value = originalValues[el.name];
      });

      radios.forEach((el) => {
        if (el.id && originalValues.hasOwnProperty(el.id)) {
          el.checked = originalValues[el.id];
        }
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

      if (typeof window.updateResidencyRequirements === "function") {
        window.updateResidencyRequirements();
      }

      // FIX: Force the residency UI (Recommendation Letter) to update/hide based on the restored value
      if (typeof handleResidencyChange === "function") {
        handleResidencyChange();
      }

      if (typeof window.setResidencyCancelMode === "function") {
        window.setResidencyCancelMode(false);
      }
    });
  }

  if (saveBtn && accountForm) {
    saveBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const currentIsLipeno = residencyYes ? residencyYes.checked : false;
      const originalIsLipeno = originalValues["residency_yes"] === true;
      const changedToNonLipeno = originalIsLipeno && !currentIsLipeno;

      if (changedToNonLipeno) {
        const recommendationFile = document.getElementById(
          "recommendation_file"
        );
        const hasFile =
          recommendationFile && recommendationFile.files.length > 0;

        if (!hasFile) {
          showFlash(
            "You are changing your residency to Non-Lipeño. Please upload your recommendation letter before saving.",
            "danger"
          );
          if (recommendationFile) {
            recommendationFile.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            setTimeout(() => recommendationFile.focus(), 300);
          }
          return;
        }
      }

      if (typeof window.copyDynamicBarangayToInput === "function") {
        window.copyDynamicBarangayToInput();
      }

      accountForm.submit();
    });
  }

  updateConditionals();
  if (applicantStatus === "Reupload") {
    fileInputs.forEach((el) => (el.style.display = "block"));
  } else {
    fileInputs.forEach((el) => (el.style.display = "none"));
  }

  if (provinceSelect) {
    provinceSelect.addEventListener("change", () => {
      if (residencyYes && residencyYes.checked) return;

      if (citySelect) {
        citySelect.style.display = "none";
        citySelect.required = false;
        citySelect.value = "";
      }
      if (cityTextInput) {
        cityTextInput.style.display = "block";
        cityTextInput.required = true;
      }

      if (barangaySelect) {
        barangaySelect.style.display = "none";
        barangaySelect.required = false;
        barangaySelect.value = "";
      }
      if (barangayTextInput) {
        barangayTextInput.style.display = "block";
        barangayTextInput.required = true;
      }
    });
  }

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
      if (phoneInput.value.trim() === "" || phoneInput.value === "+63") {
        phoneInput.value = "+63";
      }
    });
  }

  // ================== AVATAR PREVIEW ==================
  const avatar_el = document.querySelector(".avatar");
  if (avatar_el) {
    const input = avatar_el.querySelector("input[type='file']");
    const img = document.getElementById("profilePicPreview");
    if (input && img) {
      input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }
  }

  // ================== DEACTIVATE APPLICANT ==================
  const deactivateBtn = document.getElementById("deactivateApplicantBtn");
  if (deactivateBtn) {
    deactivateBtn.addEventListener("click", async () => {
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

      showLoader("Deactivating account — please wait…");

      try {
        const res = await fetch("/applicants/deactivate", { method: "POST" });
        const data = await res.json();

        if (data.success) {
          setTimeout(() => {
            hideLoader();
            window.location.href = "/";
          }, 1500);
        } else {
          hideLoader();
          window.Swal.fire("Error", data.message, "error");
        }
      } catch (err) {
        hideLoader();
        window.Swal.fire(
          "Error",
          "Something went wrong. Please try again later.",
          "error"
        );
      }
    });
  }

  // ==========================================
  //  ADDRESS API & RESIDENCY LOGIC (PSGC Integration)
  // ==========================================

  // NOTE: provinceSelect, citySelect, barangaySelect, residencyYes, residencyNo
  // are already defined at the top of applicant.js, so we just use them here.

  // Define NEW variables that were deleted in the previous step
  const recContainer = document.getElementById(
    "recommendation-upload-container"
  );
  const recInput = document.getElementById("recommendation_file");
  const warningBanner = document.getElementById("residency-warning-banner");
  const BASE_URL = "https://psgc.gitlab.io/api";
  const METRO_MANILA_CODE = "130000000";

  // Ensure isEditMode is tracked globally
  if (typeof isEditMode === "undefined") var isEditMode = false;

  // --- 1. API Helpers ---

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

    // Sort alphabetically
    items.sort((a, b) => a.name.localeCompare(b.name));

    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.name;
      option.textContent = item.name;
      option.dataset.code = item.code;

      // Select if matches saved value
      if (selectedValue && item.name === selectedValue) {
        option.selected = true;
        selectedCode = item.code;
      }

      element.appendChild(option);
    });

    return selectedCode; // Return code to help chain the next dropdown
  }

  // --- 2. Data Loaders (Chainable) ---

  async function initializeAddressData(provVal, cityVal, barVal) {
    // 1. Load Provinces
    const provData = await fetchJson(`${BASE_URL}/provinces/`);

    // FIXED: Add Metro Manila
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

    // 2. If we have a province (saved), load its Cities
    if (provCode) {
      const cityCode = await loadCities(provCode, cityVal);
      // 3. If we have a city code, load its Barangays immediately
      if (cityCode) {
        await loadBarangays(cityCode, barVal);
      }
    }
  }

  async function loadCities(provinceCode, selectedCity = null) {
    if (!citySelect) return null;
    citySelect.innerHTML = "<option>Loading...</option>";

    // FIXED: Logic for Metro Manila
    let url;
    if (provinceCode === METRO_MANILA_CODE) {
      url = `${BASE_URL}/regions/${METRO_MANILA_CODE}/cities-municipalities/`;
    } else {
      url = `${BASE_URL}/provinces/${provinceCode}/cities-municipalities/`;
    }

    const data = await fetchJson(url);

    // Capture the code of the selected item
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

    // Manage disabled state
    barangaySelect.disabled = !isEditMode;
  }

  // --- 3. Event Listeners ---

  if (provinceSelect) {
    provinceSelect.addEventListener("change", async function () {
      const selectedOption = this.options[this.selectedIndex];
      const code = selectedOption.dataset.code;

      // Reset child dropdowns
      if (citySelect)
        citySelect.innerHTML =
          '<option value="">Select Province First</option>';
      if (barangaySelect)
        barangaySelect.innerHTML =
          '<option value="">Select City First</option>';

      if (code) {
        if (citySelect) citySelect.disabled = false;
        await loadCities(code);

        // Logic: If user manually changes province away from Batangas, uncheck "Lipa"
        if (
          this.value !== "Batangas" &&
          residencyYes &&
          residencyYes.checked &&
          isEditMode
        ) {
          residencyNo.checked = true;
          residencyNo.dispatchEvent(new Event("change"));
        }
      } else {
        if (citySelect) citySelect.disabled = true;
        if (barangaySelect) barangaySelect.disabled = true;
      }
    });
  }

  if (citySelect) {
    citySelect.addEventListener("change", async function () {
      const selectedOption = this.options[this.selectedIndex];
      const code = selectedOption.dataset.code;

      if (code) {
        if (barangaySelect) barangaySelect.disabled = false;
        await loadBarangays(code);

        // FIX: Update "Lipa City" to "City of Lipa"
        if (
          this.value === "City of Lipa" &&
          provinceSelect.value === "Batangas" &&
          isEditMode
        ) {
          if (residencyYes && !residencyYes.checked) {
            residencyYes.checked = true;
            residencyYes.dispatchEvent(new Event("change"));
          }
        } else if (isEditMode && residencyYes && residencyYes.checked) {
          // If they change city to NOT Lipa, uncheck Yes
          residencyNo.checked = true;
          residencyNo.dispatchEvent(new Event("change"));
        }
      } else {
        if (barangaySelect) {
          barangaySelect.innerHTML =
            '<option value="">Select City First</option>';
          barangaySelect.disabled = true;
        }
      }
    });
  }

  // --- 4. "From Lipa" Checkbox Logic ---

  function handleResidencyChange() {
    const isLipeno = residencyYes.checked;

    // Toggle Recommendation Letter Section
    if (recContainer) {
      // 1. Container visibility (Label + Link + Input)
      // Show if Non-Lipeño, Hide if Lipeño
      recContainer.style.display = isLipeno ? "none" : "block";

      // 2. File Input visibility
      if (recInput) {
        // FIX: Added check for applicantStatus === "Reupload"
        if (!isLipeno && (isEditMode || applicantStatus === "Reupload")) {
          // CASE: Non-Lipeño AND (Editing OR Reuploading) -> Show the file picker
          recInput.style.display = "block";
          recInput.removeAttribute("disabled");
          recInput.required = true;
        } else {
          // CASE: Lipeño OR Not Editing -> Hide the file picker
          recInput.style.display = "none";
          recInput.setAttribute("disabled", "true");
          recInput.required = false;
          if (isLipeno) recInput.value = ""; // Clear file if switching to Lipeño
        }
      }
    }

    // Show warning banner if editing
    if (warningBanner && isEditMode) {
      warningBanner.classList.add("show");
    }

    // Auto-Fill Address Logic for Lipeños
    if (isEditMode && isLipeno) {
      const batOption = Array.from(provinceSelect.options).find(
        (o) => o.value === "Batangas"
      );

      if (batOption) {
        if (provinceSelect.value !== "Batangas") {
          provinceSelect.value = "Batangas";
          loadCities(batOption.dataset.code).then(() => {
            selectLipaCity();
          });
        } else {
          selectLipaCity();
        }
      }
    }
  }

  function selectLipaCity() {
    // FIX: Update string here too
    const lipaOption = Array.from(citySelect.options).find(
      (o) => o.value === "City of Lipa"
    );
    if (lipaOption && citySelect.value !== "City of Lipa") {
      citySelect.value = "City of Lipa";
      citySelect.disabled = false;
      loadBarangays(lipaOption.dataset.code).then(() => {
        if (barangaySelect) barangaySelect.disabled = false;
      });
    }
  }

  if (residencyYes && residencyNo) {
    residencyYes.addEventListener("change", handleResidencyChange);
    residencyNo.addEventListener("change", handleResidencyChange);
  }

  // --- 5. Initialization & Button Hooks ---

  // Initialize on Load using data-default attributes from HTML
  if (provinceSelect) {
    const defProv = provinceSelect.dataset.default;
    const defCity = citySelect.dataset.default;
    const defBar = barangaySelect.dataset.default;

    initializeAddressData(defProv, defCity, defBar);

    // Ensure Correct Residency UI State (Recommendation Letter visibility)
    handleResidencyChange();
  }

  // ADDED: Hook into existing EDIT button to ensure dropdowns unlock
  // We reuse the existing 'editBtn' variable from top of file
  if (editBtn) {
    editBtn.addEventListener("click", () => {
      // Trigger standard edit mode
      isEditMode = true;

      // Unlock Province
      if (provinceSelect) provinceSelect.disabled = false;

      // Unlock City/Barangay only if they have valid parents selected
      if (citySelect && provinceSelect.value) citySelect.disabled = false;
      if (barangaySelect && citySelect.value) barangaySelect.disabled = false;

      // Ensure UI updates (banner, recommendation letter)
      handleResidencyChange();
    });
  }

  // ADDED: Hook into existing CANCEL button to reset dropdowns
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      isEditMode = false;

      // Re-lock dropdowns
      if (provinceSelect) provinceSelect.disabled = true;
      if (citySelect) citySelect.disabled = true;
      if (barangaySelect) barangaySelect.disabled = true;

      // Reset to defaults from database
      const defProv = provinceSelect.dataset.default;
      const defCity = citySelect.dataset.default;
      const defBar = barangaySelect.dataset.default;

      // Reload data to original state
      initializeAddressData(defProv, defCity, defBar);

      // Hide banner
      if (warningBanner) warningBanner.classList.remove("show");
    });
  }

  // ================== PDF FILE VALIDATION ==================
  const resumeInput = document.getElementById("resume_file");
  const recommendationInput = document.getElementById("recommendation_file");

  function validatePDFFile(input) {
    if (!input) return;

    input.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const fileName = file.name.toLowerCase();
      const isPDF = fileName.endsWith(".pdf");

      if (!isPDF) {
        showFlash(
          "Please upload a PDF file only. Other file formats are not accepted.",
          "danger"
        );
        input.value = "";
        return false;
      }

      console.log(`[v0] Valid PDF uploaded: ${file.name}`);
      return true;
    });
  }

  validatePDFFile(resumeInput);
  validatePDFFile(recommendationInput);

  // ================== FORCE PASSWORD CHANGE MODAL ==========
  const dataAttr = document.body.getAttribute("data-must-change-password");
  console.log("[v0] data-must-change-password attribute:", dataAttr);

  let mustChangePassword = false;
  try {
    if (dataAttr) {
      const parsed = JSON.parse(dataAttr);
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

  // ================== SHOW / HIDE PASSWORD ==========
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

  // ================== PASSWORD VALIDATION ==========
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
  } else {
    function validatePasswords() {
      const password = newPass.value.trim();
      const confirm = confirmPass.value.trim();

      const hasMinLength = /.{8,}/.test(password);
      const hasUpperAndLower = /[A-Z]/.test(password) && /[a-z]/.test(password);
      const hasNumber = /\d/.test(password);
      const hasSpecialChar = /[@$!%*?&]/.test(password);

      const rules = [hasMinLength, hasUpperAndLower, hasNumber, hasSpecialChar];

      requirements.forEach((li, i) => {
        li.style.color = rules[i] ? "green" : "#ff6666";
      });

      const allRequirementsMet = rules.every(Boolean);

      if (password === "" && confirm === "") {
        hint.textContent = "";
        submitBtn.disabled = true;
        console.log("[v0] Passwords: both empty, button disabled");
        return false;
      }

      if (password !== "" && !allRequirementsMet) {
        hint.textContent = "Password does not meet all requirements.";
        hint.style.color = "#ff6666";
        submitBtn.disabled = true;
        console.log("[v0] Passwords: requirements not met, button disabled");
        return false;
      }

      if (allRequirementsMet && password !== confirm) {
        hint.textContent = "Passwords do not match.";
        hint.style.color = "#ff6666";
        submitBtn.disabled = true;
        console.log("[v0] Passwords: mismatch, button disabled");
        return false;
      }

      if (allRequirementsMet && password === confirm && password !== "") {
        hint.textContent = "Password looks good!";
        hint.style.color = "green";
        submitBtn.disabled = false;
        console.log("[v0] Passwords: valid and match, button enabled");
        return true;
      }

      submitBtn.disabled = true;
      return false;
    }

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

      const modal = document.getElementById("forcePasswordModal");
      if (modal) modal.style.display = "none";

      forcePasswordForm.submit();
    });

    validatePasswords();
  }

  // ==================== APPLICATION TAB FILTER ====================
  // The original code for this section had a redeclaration of tabGroup, which is now fixed.
  let tabGroup = document.querySelector(".tab-group");
  if (tabGroup) {
    const tabButtons = Array.from(tabGroup.querySelectorAll("button"));
    const cards = Array.from(document.querySelectorAll(".application-card")); // This line might not be needed for the filter logic itself, but kept for context.

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

  // ==================== JOB SEARCH & FILTER ====================
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

  // ==================== REPORT MODAL ====================
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
    if (reportModal) reportModal.style.display = "flex";
  });

  if (closeReportBtn) {
    closeReportBtn.addEventListener("click", () => {
      if (reportModal) reportModal.style.display = "none";
      if (reportReasonSelect) reportReasonSelect.value = "";
    });
  }

  if (cancelReportBtn) {
    cancelReportBtn.addEventListener("click", () => {
      if (reportModal) reportModal.style.display = "none";
      if (reportReasonSelect) reportReasonSelect.value = "";
    });
  }

  if (confirmReportBtn) {
    confirmReportBtn.addEventListener("click", async () => {
      const reason = reportReasonSelect?.value;
      if (!reason) {
        showFlash("Please select a reason for the report.", "warning");
        return;
      }

      if (!reportingJobId) {
        showFlash("Unable to determine which job to report.", "danger");
        return;
      }

      try {
        const res = await fetch(`/applicants/report_job/${reportingJobId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
          credentials: "same-origin",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Failed to submit report.");
        }

        if (data.success) {
          showFlash("Report submitted successfully. Thank you!", "success");
          if (reportModal) reportModal.style.display = "none";
          if (reportReasonSelect) reportReasonSelect.value = "";
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
      if (reportModal) reportModal.style.display = "none";
      if (reportReasonSelect) reportReasonSelect.value = "";
    }
  });

  // ==================== APPLY MODAL FLOW ====================
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

      if (confirmModal) confirmModal.style.display = "flex";
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

  if (confirmApplyBtn) {
    confirmApplyBtn.addEventListener("click", async () => {
      if (!selectedJobId) return;

      showLoader("Submitting your application...");

      try {
        const res = await fetch(`/applicants/apply/${selectedJobId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
        });

        const data = await res.json();

        hideLoader();
        if (confirmModal) confirmModal.style.display = "none";

        if (data.success) {
          if (successModal) successModal.style.display = "flex";

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
        hideLoader();
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
      if (successModal) successModal.style.display = "none";
      location.reload();
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === confirmModal) {
      if (confirmModal) confirmModal.style.display = "none";
      selectedJobId = null;
    }
    if (e.target === successModal && successModal)
      successModal.style.display = "none";
  });

  // ==================== JOB DETAILS MODAL ====================
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

    // ✅ NEW: Get the applied status from the button we clicked
    // This reads the data-has-applied="1" we added in HTML
    const hasApplied = detailsBtn.getAttribute("data-has-applied") === "1";

    console.log("[v0] Details clicked for job:", jobId, "Applied:", hasApplied);

    if (!jobId) {
      console.log("[v0] No job ID found");
      return;
    }

    if (!jobDetailsModal) {
      console.log("[v0] Modal not found in DOM");
      return;
    }

    // ✅ NEW: Update the Modal Apply Button based on status
    if (modalApplyBtn) {
      if (hasApplied) {
        modalApplyBtn.textContent = "Application Sent";
        modalApplyBtn.disabled = true;
        modalApplyBtn.style.backgroundColor = "#6c757d"; // Optional: Gray it out
        modalApplyBtn.style.cursor = "not-allowed";
      } else {
        modalApplyBtn.textContent = "Apply Now";
        modalApplyBtn.disabled = false;
        modalApplyBtn.style.backgroundColor = ""; // Reset to default
        modalApplyBtn.style.cursor = "pointer";
      }
    }

    // --- The rest of your existing code stays the same ---
    jobDetailsModal.querySelector("#modal-body-unique").innerHTML =
      "<p style='text-align: center; padding: 20px;'>Loading job details...</p>";
    jobDetailsModal.dataset.modalJobId = jobId;
    jobDetailsModal.style.display = "flex";
    console.log("[v0] Modal displayed");

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

  document.addEventListener("click", async (e) => {
    const applyBtn = e.target.closest(
      "#jobDetailsModalUnique .btn-apply, #jobDetailsModalUnique #modal-apply-btn"
    );
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
      if (jobDetailsModal) jobDetailsModal.style.display = "none";
      showAlreadyAppliedToast();
      return;
    }

    if (jobDetailsModal) jobDetailsModal.style.display = "none";
    if (confirmModal) confirmModal.style.display = "flex";
  });

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", () => {
      if (jobDetailsModal) jobDetailsModal.style.display = "none";
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      if (jobDetailsModal) jobDetailsModal.style.display = "none";
    });
  }

  window.addEventListener("click", (e) => {
    if (e.target === jobDetailsModal && jobDetailsModal) {
      jobDetailsModal.style.display = "none";
    }
  });

  // ==================== RENDER APPLICATIONS ====================
  // ========== ADDED FUNCTIONS FOR APPLICATION MANAGEMENT ==========

  // PART 2: Fix renderApplications in applicant.js
  window.renderApplications = async (filter = "all") => {
    const container = document.getElementById("applicationsList");
    if (!container) return;

    console.log("[v0] renderApplications called with filter:", filter);

    try {
      container.innerHTML = '<div class="loader">Loading applications...</div>';

      const response = await fetch(
        `/applicants/api/applications?filter=${filter}`
      );

      console.log("[v0] API response status:", response.status);

      if (!response.ok) throw new Error("Failed to fetch applications");

      const data = await response.json();
      console.log("[v0] API response data:", data);

      const applications = data.applications || [];
      console.log("[v0] Applications array length:", applications.length);

      if (applications.length === 0) {
        container.innerHTML = '<p class="empty-msg">No applications found.</p>';
        return;
      }

      container.innerHTML = applications
        .map((app) => {
          const statusClass = app.status.toLowerCase().replace(/\s+/g, "-");
          console.log(
            "[v0] Rendering application:",
            app.job_position,
            "Status:",
            app.status,
            "StatusClass:",
            statusClass
          );

          return `
        <div class="application-card" data-status="${statusClass}" onclick="viewApplicationDetails(${
            app.id
          })" style="cursor: pointer;">
        <div class="app-header" style="display: flex; justify-content: space-between; align-items: center;">
          <h3> ${app.job_position}</h3>
          <span class="status-badge ${statusClass}">${app.status}</span>
        </div>

          <div class="app-body">
            <p><strong>${app.employer_name || "N/A"}</strong> </p>
            <p>Applied on</strong> ${new Date(
              app.applied_at
            ).toLocaleDateString()}</p>
            <p class="click-hint" style="font-size: 0.8rem; color: #666; margin-top: 8px;"></p>
          </div>
        </div>
      `;
        })
        .join("");
    } catch (error) {
      console.error("[v0] Error rendering applications:", error);
      container.innerHTML =
        '<p class="error-msg">Failed to load applications. Please try again.</p>';
    }
  };

  // <CHANGE> FIXED: Properly handle the existing modal buttons and make them work
  window.viewApplicationDetails = async (applicationId) => {
    const modal = document.getElementById("applicationDetailsModal");
    const content = document.getElementById("applicationDetailsContent");
    const cancelBtn = document.getElementById("applicationCancelBtn");
    const closeBtn = document.getElementById("applicationCloseBtn");

    if (!modal || !content) return;

    content.innerHTML = '<div class="loader">Loading...</div>';
    modal.style.display = "block";

    try {
      const response = await fetch(
        `/applicants/api/applications/${applicationId}`
      );
      const data = await response.json();
      const app = data.application;

      let interviewHtml = "";

      // Only fetch interview details if status is 'For Interview'
      if (app.status === "For Interview") {
        const intRes = await fetch(
          `/applicants/api/applications/${app.id}/interview`
        );
        const intData = await intRes.json();

        if (intData.success && intData.interview) {
          const i = intData.interview;
          // Format date for display
          const dateObj = new Date(i.interview_date);
          const dateStr = isNaN(dateObj)
            ? i.interview_date
            : dateObj.toLocaleDateString();

          interviewHtml = `
                <div style="margin-top:20px; background:#fff; padding:20px; border-radius:8px; border:1px solid #e0e0e0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <h4 style="color:#7b1113; margin-top:0; border-bottom:1px solid #eee; padding-bottom:10px; font-size: 1.1rem;">
                        <i class="fa-solid fa-calendar-check"></i> Interview Details
                    </h4>
                    
                    <div style="display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 10px; font-size: 0.95rem;">
                        <p style="margin:0;"><strong>Date & Time:</strong> ${dateStr} @ ${
            i.interview_time
          }</p>
                        <p style="margin:0;"><strong>Type:</strong> ${
                          i.interview_type
                        }</p>
                        <p style="margin:0;"><strong>Location/Link:</strong> <span style="color: #006341;">${
                          i.location_link
                        }</span></p>
                        <p style="margin:0;"><strong>Notes:</strong> ${
                          i.notes || "No additional notes."
                        }</p>
                        <p style="margin:0;"><strong>Status:</strong> <span class="status-badge pending">${
                          i.status
                        }</span></p>
                    </div>
                    
                    ${
                      i.status === "Pending"
                        ? `
                        <div id="intActionButtons-${i.id}" style="margin-top:20px; display:flex; gap:10px; flex-wrap: wrap;">
                            <button onclick="respondToInterview(${i.id}, 'Confirmed')" class="btn" style="background:#006341; color:white; flex:1;">Confirm</button>
                            <button onclick="respondToInterview(${i.id}, 'Declined')" class="btn" style="background:#dc3545; color:white; flex:1;">Decline</button>
                            <button onclick="showReschedForm(${i.id})" class="btn" style="background:#ffc107; color:black; flex:1;">Reschedule</button>
                        </div>

                        <div id="reschedForm-${i.id}" style="display:none; margin-top:15px;">
                            <label style="font-size: 0.9rem; font-weight: 600;">Reason & Preferred Time:</label>
                            <textarea id="reschedReason-${i.id}" rows="3" style="width:100%; padding:10px; border:1px solid #ccc; border-radius:4px; margin-bottom:10px; resize: vertical;"></textarea>
                            <div style="display:flex; gap:10px;">
                                <button onclick="submitReschedule(${i.id})" class="btn" style="background:#006341; color:white; flex:1;">Submit</button>
                                <button onclick="hideReschedForm(${i.id})" class="btn" style="background:#6c757d; color:white; flex:1;">Cancel</button>
                            </div>
                        </div>
                    `
                        : `<p style="margin-top:15px; font-style:italic; color:#666;">You have ${i.status.toLowerCase()} this interview.</p>`
                    }
                </div>`;
        }
      }

      // Combine header, details, and interview HTML
      content.innerHTML = `
          <div class="header-row">
            <h2 style="color: #333;">${app.job_position}</h2>
            <span class="status-badge ${app.status
              .toLowerCase()
              .replace(/\s+/g, "-")}">${app.status}</span>
          </div>
          <div class="detail-group" style="margin: 10px 0; color: #555;">
            <p style="margin: 5px 0;"><i class="fa-solid fa-building"></i> ${
              app.employer_name
            }</p>
            <p style="margin: 5px 0;"><i class="fa-solid fa-clock"></i> Applied: ${new Date(
              app.applied_at
            ).toLocaleDateString()}</p>
          </div>
          ${interviewHtml}
        `;

      // Button visibility logic
      if (cancelBtn) {
        if (app.status === "Pending") {
          cancelBtn.style.display = "inline-block";
          cancelBtn.onclick = () => window.cancelApplication(app.id);
        } else {
          cancelBtn.style.display = "none";
        }
      }
      if (closeBtn)
        closeBtn.onclick = () => {
          modal.style.display = "none";
        };
    } catch (e) {
      console.error(e);
      content.innerHTML =
        "<p style='color:red; text-align:center; padding:20px;'>Error loading details.</p>";
    }
  };

  // --- Helper Functions ---

  window.showReschedForm = (id) => {
    document.getElementById(`intActionButtons-${id}`).style.display = "none";
    document.getElementById(`reschedForm-${id}`).style.display = "block";
  };

  window.hideReschedForm = (id) => {
    document.getElementById(`reschedForm-${id}`).style.display = "none";
    document.getElementById(`intActionButtons-${id}`).style.display = "flex";
  };

  window.respondToInterview = async (id, action, notes = "") => {
    if (!confirm(`Are you sure you want to mark this as ${action}?`)) return;

    showLoader("Sending response...");

    try {
      const res = await fetch(`/applicants/api/interview/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      });
      const data = await res.json();
      hideLoader();

      if (data.success) {
        showFlash("Response sent successfully!", "success"); // FIXED
        document.getElementById("applicationDetailsModal").style.display =
          "none";
        if (typeof renderApplications === "function") renderApplications();
      } else {
        showFlash("Failed to send response", "danger"); // FIXED
      }
    } catch (e) {
      hideLoader();
      console.error(e);
      showFlash("An error occurred", "danger"); // FIXED
    }
  };

  window.submitReschedule = async (id) => {
    const notes = document.getElementById(`reschedReason-${id}`).value;
    if (!notes.trim()) {
      showFlash("Please enter a reason for rescheduling.", "warning"); // FIXED
      return;
    }
    await respondToInterview(id, "Reschedule Requested", notes);
  };

  const proceedCancel = async (applicationId) => {
    try {
      window.showLoader("Cancelling application...");
      console.log("[v0] Calling cancel endpoint for app:", applicationId);

      // <CHANGE> Correct endpoint path: /applicants/api/cancel-application (legacy delete path delegated server-side)
      // Use POST method (not DELETE)
      const response = await fetch(
        `/applicants/api/cancel-application/${applicationId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
        }
      );

      window.hideLoader();

      if (response.ok) {
        const data = await response.json();
        console.log("[v0] Cancel response:", data);

        if (data.success) {
          window.showFlash("Application cancelled successfully", "success");
          setTimeout(() => window.location.reload(), 1500);
        } else {
          console.error("[v0] Cancel failed:", data.message);
          window.showFlash(
            data.message || "Failed to cancel application",
            "error"
          );
        }
      } else {
        console.error("[v0] HTTP error:", response.status);
        window.showFlash(
          "Failed to cancel application with status: " + response.status,
          "error"
        );
      }
    } catch (error) {
      window.hideLoader();
      console.error("[v0] Error cancelling application:", error);
      window.showFlash(
        "An error occurred while cancelling the application",
        "error"
      );
    }
  };

  window.cancelApplication = (applicationId) => {
    const modal = document.getElementById("cancelConfirmModal");

    if (!modal) {
      console.error("[v0] cancelConfirmModal not found in DOM");
      return;
    }

    modal.style.display = "flex";

    // When YES is clicked
    const confirmYesBtn = document.getElementById("confirmCancelYes");
    if (confirmYesBtn) {
      confirmYesBtn.onclick = () => {
        modal.style.display = "none";
        proceedCancel(applicationId);
      };
    }

    // When NO is clicked
    const confirmNoBtn = document.getElementById("confirmCancelNo");
    if (confirmNoBtn) {
      confirmNoBtn.onclick = () => {
        modal.style.display = "none";
      };
    }

    modal.addEventListener("click", function (e) {
      if (e.target === this) {
        modal.style.display = "none";
      }
    });
  };

  document.addEventListener("click", (event) => {
    const modal = document.getElementById("applicationDetailsModal");
    if (
      event.target === modal ||
      event.target.classList.contains("close-modal")
    ) {
      if (modal) modal.style.display = "none";
    }
  });
  // END OF ADDED FUNCTIONS FOR APPLICATION MANAGEMENT

  // ==================== APPLICATION TAB FILTER UPDATE ====================
  // Re-selecting tabGroup here to fix lint/suspicious/noRedeclare
  tabGroup = document.querySelector(".tab-group");
  if (tabGroup) {
    const tabButtons = Array.from(tabGroup.querySelectorAll("button"));

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const filter = btn.dataset.filter || "all";
        console.log("[v0] Tab clicked with filter:", filter);

        // Set active button
        tabButtons.forEach((b) => b.classList.toggle("active", b === btn));

        if (typeof window.renderApplications === "function") {
          window.renderApplications(filter);
        }
        btn.focus();
      });
    });

    // Load initial applications
    const initialBtn =
      tabButtons.find((b) => b.classList.contains("active")) || tabButtons[0];
    if (initialBtn) {
      tabButtons.forEach((b) => b.classList.toggle("active", b === initialBtn));
      if (typeof window.renderApplications === "function") {
        window.renderApplications(initialBtn.dataset.filter || "all");
      }
    }
  }
});
